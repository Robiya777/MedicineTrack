// Live, synthetic-data browser checks. See docs/INTEGRATION_AUDIT_2026-11-18.md.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
process.loadEnvFile(path.join(root, 'backend/.env'))
const base = process.env.QA_BASE_URL || 'http://localhost:5173'
const fixturePath = process.env.QA_FIXTURE || '/tmp/medicinetrack-browser-audit/fixture.json'
const output = process.env.QA_OUTPUT || '/tmp/medicinetrack-browser-audit/results'
const require = createRequire(path.join(process.env.PLAYWRIGHT_PACKAGE_DIR || '/tmp/medicinetrack-browser-audit', 'package.json'))
const { chromium } = require('playwright')
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'))
const password = process.env.DEMO_PASSWORD
assert(password, 'DEMO_PASSWORD is required; its value is never printed.')
fs.mkdirSync(output, { recursive: true })
const secrets = new Set([password])
const redact = (value) => [...secrets].reduce((text, secret) => text.replaceAll(secret, '[redacted]'), String(value))
const report = { base, fixture_run: fixture.run_id, checks: [], browser_errors: [], server_errors: [] }
let browser
const pages = new Map()
const slugs = { hospital: 'koordinator', doctor: 'shifokor', patient: 'bemor', coordinator: 'koordinator', admin: 'admin', clinician: 'shifokor' }
const unique = Date.now().toString(36)

function localInput(date) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(date).map(({ type, value }) => [type, value]))
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`
}
async function check(name, operation) {
  const started = Date.now()
  try {
    const evidence = await operation()
    report.checks.push({ name, passed: true, ms: Date.now() - started, evidence })
    console.log('PASS', name)
  } catch (error) {
    report.checks.push({ name, passed: false, ms: Date.now() - started, error: redact(error.stack || error) })
    console.error('FAIL', name, redact(error.message || error))
    for (const [label, page] of pages) {
      if (!page.isClosed()) await screenshot(page, `failure-${label}`).catch(() => {})
    }
    throw error
  }
}
async function newPage(context, label) {
  const page = await context.newPage()
  page.setDefaultTimeout(15000)
  pages.set(label, page)
  page.on('pageerror', (error) => report.browser_errors.push({ page: label, error: redact(error.message) }))
  page.on('response', (response) => {
    if (response.status() >= 500) report.server_errors.push({ page: label, url: new URL(response.url()).pathname, status: response.status() })
  })
  return page
}
async function login(context, actor, username = fixture.users[actor]?.username, slug = slugs[actor]) {
  const page = await newPage(context, actor)
  await page.goto(`${base}/login`)
  await page.getByLabel('Login', { exact: true }).fill(username)
  await page.getByLabel('Parol', { exact: true }).fill(password)
  for (let attempt = 0; attempt < 3; attempt++) {
    const pending = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/v1/auth/login' && response.request().method() === 'POST')
    await page.getByRole('button', { name: 'Kirish', exact: true }).click()
    const response = await pending
    if (response.status() !== 429) {
      assert.equal(response.status(), 200, 'UI login must succeed')
      break
    }
    const seconds = Number(response.headers()['retry-after'] || 60)
    console.log(`WAIT login rate limit: respecting Retry-After ${seconds}s`)
    await new Promise((resolve) => setTimeout(resolve, (seconds + 1) * 1000))
  }
  await page.waitForURL((url) => url.pathname.replace(/\/$/, '') === `/kabinet/${slug}`)
  await page.getByRole('button', { name: 'Chiqish', exact: true }).first().waitFor({ state: 'visible' })
  return page
}
async function mutation(page, suffix, click, expected = 200, method = 'POST') {
  const result = page.waitForResponse((response) => new URL(response.url()).pathname.endsWith(suffix) && response.request().method() === method)
  await click()
  const response = await result
  assert.equal(response.status(), expected, `${method} ${suffix}: HTTP ${response.status()}`)
  return response.json()
}
async function screenshot(page, name) {
  await page.screenshot({ path: path.join(output, `${name}.png`), fullPage: true, mask: [page.locator('input[type="password"], input[name="code"], code')] })
}

try {
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] })
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'Asia/Tashkent' })
  await check('Frontend proxy reaches MedicineTrack API', async () => {
    const readiness = await context.request.get(`${base}/health/ready`)
    assert.equal(readiness.status(), 200)
    assert.equal((await readiness.json()).status, 'ready')
    const schema = await (await context.request.get(`${base}/api/v1/schema?format=json`)).json()
    assert.match(schema.info.title, /MedicineTrack/)
    return { api: schema.info.title, version: schema.info.version }
  })

  const hospital = await login(context, 'hospital')
  await check('Hospital login and session reload', async () => {
    await hospital.getByRole('heading', { level: 1 }).first().waitFor()
    await hospital.reload()
    await hospital.getByRole('heading', { level: 1 }).first().waitFor()
    await screenshot(hospital, 'hospital-dashboard')
  })
  await check('Nullable medication DRAFT renders in medication workspace', async () => {
    await hospital.goto(`${base}/kabinet/koordinator/dorilar/${fixture.patient_id}?dischargeId=${fixture.discharge_id}`)
    await hospital.getByText('Nomi kiritilmagan dori', { exact: true }).waitFor()
  })

  let createdPatient, discharge, task
  await check('UI creates patient and discharge DRAFT', async () => {
    await hospital.goto(`${base}/kabinet/koordinator/chiqarish/yangi`)
    await hospital.getByRole('button', { name: 'Yangi bemor', exact: true }).click()
    await hospital.getByLabel('Ism va familiya', { exact: true }).fill(`Sintetik web audit ${unique}`)
    await hospital.getByLabel('Tug‘ilgan sana', { exact: true }).fill('1985-01-01')
    await hospital.getByLabel('Xizmat hududi', { exact: true }).selectOption(fixture.territory_id)
    await hospital.getByLabel('Manzil', { exact: true }).fill('Sintetik brauzer audit manzili')
    await hospital.getByLabel('Telefon', { exact: true }).fill('+998900000099')
    createdPatient = await mutation(hospital, '/api/v1/patients', () => hospital.getByRole('button', { name: 'Bemorni saqlash', exact: true }).click(), 201)
    await hospital.getByLabel('Chiqaruvchi kasalxona', { exact: true }).selectOption(fixture.hospital_id)
    await hospital.getByLabel('Haqiqiy chiqarish vaqti', { exact: true }).fill(localInput(new Date(Date.now() - 300000)))
    await hospital.getByLabel('Kuzatuvga olish asosi', { exact: true }).fill('Sintetik browser audit kuzatuvi')
    await hospital.getByLabel('Shifokor tavsiyasi', { exact: true }).fill('Sintetik browser audit tavsiyasi')
    discharge = await mutation(hospital, '/api/v1/discharges', () => hospital.getByRole('button', { name: 'Loyihani saqlash va tekshirish', exact: true }).click(), 201)
    await hospital.getByRole('heading', { name: 'Chiqarish tafsiloti', exact: true }).waitFor()
    assert.equal(discharge.patient, createdPatient.id)
    assert.equal(discharge.status, 'DRAFT')
    return { patient_id: createdPatient.id, discharge_id: discharge.id }
  })

  await check('Discharge confirmation creates one UNASSIGNED task with 24-hour deadline', async () => {
    task = await mutation(hospital, `/discharges/${discharge.id}/confirm`, () => hospital.getByRole('button', { name: 'Chiqarishni tasdiqlash', exact: true }).click(), 201)
    assert.equal(task.status, 'UNASSIGNED')
    assert.equal(Date.parse(task.due_at) - Date.parse(task.discharged_at), 86400000)
    await hospital.reload()
    await hospital.getByText(task.id, { exact: true }).first().waitFor()
    return { task_id: task.id, due_at: task.due_at }
  })

  const coordinator = await login(context, 'coordinator')
  await check('Coordinator assigns the same browser-created task', async () => {
    await coordinator.goto(`${base}/kabinet/koordinator/chaqiruv/${task.id}`)
    await coordinator.getByRole('button', { name: 'Shifokor tayinlash', exact: true }).click()
    const dialog = coordinator.getByRole('dialog')
    await dialog.getByLabel('Yangi mas’ul shifokor', { exact: true }).selectOption(fixture.users.doctor.id)
    await dialog.getByLabel('Sabab', { exact: true }).fill('Sintetik browser audit tayinlashi')
    const assigned = await mutation(coordinator, `/tasks/${task.id}/reassign`, () => dialog.getByRole('button', { name: 'Tayinlash', exact: true }).click())
    assert.equal(assigned.assigned_doctor, fixture.users.doctor.id)
    assert.equal(assigned.due_at, task.due_at)
    task = assigned
  })

  const doctor = await login(context, 'doctor')
  await check('Doctor accepts task and records unsuccessful contact without closing it', async () => {
    await doctor.goto(`${base}/kabinet/shifokor/chaqiruv/${task.id}`)
    await doctor.getByRole('button', { name: 'Qabul qilish', exact: true }).click()
    task = await mutation(doctor, `/tasks/${task.id}/accept`, () => doctor.getByRole('button', { name: 'Qabul qilishni tasdiqlash', exact: true }).click())
    assert.equal(task.status, 'ACCEPTED')
    await doctor.getByRole('button', { name: 'Aloqani qayd etish', exact: true }).click()
    await doctor.locator('[name="note"]').fill('Sintetik javobsiz aloqa')
    await doctor.locator('[name="next_action"]').fill('Sintetik qayta aloqa')
    task = await mutation(doctor, `/tasks/${task.id}/contact-attempts`, () => doctor.getByRole('button', { name: 'Urinishni saqlash', exact: true }).click(), 201)
    assert.equal(task.status, 'ACCEPTED')
    assert.equal(task.contact_attempts.length, 1)
  })

  await check('Doctor completes task; hospital sees identical result', async () => {
    await doctor.getByRole('button', { name: 'Natijani yuborish', exact: true }).click()
    await doctor.locator('[name="observation"]').fill('Sintetik bemor holati')
    await doctor.locator('[name="actions"]').fill('Sintetik bajarilgan ish')
    await doctor.locator('[name="follow_up"]').fill('Sintetik keyingi reja')
    task = await mutation(doctor, `/tasks/${task.id}/complete`, () => doctor.getByRole('button', { name: 'Natijani tasdiqlash', exact: true }).click())
    assert.equal(task.status, 'COMPLETED')
    assert(task.report)
    await hospital.reload()
    await hospital.getByText('Bajarilgan', { exact: true }).first().waitFor()
    await screenshot(doctor, 'doctor-completed-task')
  })

  await check('Hospital activation code creates a patient account through the live web form', async () => {
    await hospital.getByLabel('Telefon raqamini tekshirdim', { exact: true }).check()
    const activation = await mutation(hospital, `/patients/${createdPatient.id}/activation`, () => hospital.getByRole('button', { name: 'Aktivatsiya kodini olish', exact: true }).click(), 201)
    secrets.add(activation.code)
    const page = await newPage(context, 'activation-form')
    await page.goto(`${base}/faollashtirish`)
    await page.getByLabel('Bemor UUIDsi', { exact: true }).fill(createdPatient.id)
    await page.getByLabel('Aktivatsiya kodi', { exact: true }).fill(activation.code)
    await page.getByLabel('Yangi parol', { exact: true }).fill(password)
    await page.getByLabel('Parolni takrorlang', { exact: true }).fill(password)
    const account = await mutation(page, '/auth/patient-activate', () => page.getByRole('button', { name: 'Hisobni faollashtirish', exact: true }).click(), 201)
    assert.equal(account.patient, createdPatient.id)
    const activated = await login(context, 'activated-patient', account.username, 'bemor')
    await activated.getByRole('heading', { name: createdPatient.full_name, exact: true }).waitFor()
    return { patient_id: account.patient }
  })

  const patient = await login(context, 'patient')
  const message = `Sintetik takroriy xabar ${unique}`
  await check('Two identical successful chat messages create two different messages', async () => {
    await patient.goto(`${base}/kabinet/bemor/suhbat/${fixture.conversation_id}`)
    const ids = []
    for (let i = 0; i < 2; i++) {
      await patient.getByLabel('Xabar', { exact: true }).fill(message)
      const saved = await mutation(patient, `/conversations/${fixture.conversation_id}/messages`, () => patient.getByRole('button', { name: 'Yuborish', exact: true }).click(), 201)
      ids.push(saved.id)
      await patient.getByLabel('Xabar', { exact: true }).waitFor()
      await patient.waitForFunction(() => document.querySelector('textarea[aria-label="Xabar"]')?.value === '')
    }
    assert.notEqual(ids[0], ids[1])
    await patient.getByText(message, { exact: true }).nth(1).waitFor()
    return { message_ids: ids }
  })

  await check('Patient worsened status reaches coordinator and doctor replies in live chat', async () => {
    await patient.getByLabel('Hozirgi holatingiz', { exact: true }).selectOption('WORSENED')
    await patient.getByLabel('Holat haqida izoh', { exact: true }).fill(`Sintetik holat ${unique}`)
    const status = await mutation(patient, `/conversations/${fixture.conversation_id}/status-updates`, () => patient.getByRole('button', { name: 'Holatni yuborish', exact: true }).click(), 201)
    assert.equal(status.self_reported_state, 'WORSENED')
    await coordinator.goto(`${base}/kabinet/koordinator/murojaatlar`)
    await coordinator.getByText('Yomonlashdi', { exact: false }).first().waitFor()
    await doctor.goto(`${base}/kabinet/shifokor/suhbat/${fixture.conversation_id}`)
    await doctor.getByText(message, { exact: true }).nth(1).waitFor()
    await doctor.getByLabel('Xabar', { exact: true }).fill(`Sintetik javob ${unique}`)
    await mutation(doctor, `/conversations/${fixture.conversation_id}/messages`, () => doctor.getByRole('button', { name: 'Yuborish', exact: true }).click(), 201)
    await patient.reload()
    await patient.getByText(`Sintetik javob ${unique}`, { exact: true }).waitFor()
    await screenshot(patient, 'patient-chat')
  })

  await check('Work schedule supports repeat saves and rejects stale coordinator edits', async () => {
    const metadata = (response) => new URL(response.url()).pathname === `/api/v1/conversations/${fixture.conversation_id}` && response.request().method() === 'GET'
    const initialMetadata = patient.waitForResponse(async (response) => metadata(response) && Boolean((await response.json()).response_due_at))
    await patient.getByLabel('Xabar', { exact: true }).fill(`Sintetik jadval savoli ${unique}`)
    await mutation(patient, `/conversations/${fixture.conversation_id}/messages`, () => patient.getByRole('button', { name: 'Yuborish', exact: true }).click(), 201)
    const originalDue = (await (await initialMetadata).json()).response_due_at

    const stale = await login(context, 'coordinator-stale', fixture.users.coordinator.username, 'koordinator')
    for (const page of [coordinator, stale]) {
      await page.goto(`${base}/kabinet/koordinator/ish-jadvali`)
      await page.getByLabel('Shifokor', { exact: true }).selectOption(fixture.users.doctor.id)
      await page.getByRole('button', { name: 'Saqlash', exact: true }).waitFor()
    }
    await stale.getByRole('button', { name: 'Istisno kunlar', exact: true }).click()
    await stale.getByLabel('Istisno sana', { exact: true }).fill('2026-12-29')
    await stale.getByRole('button', { name: 'Istisno qo‘shish', exact: true }).click()
    await coordinator.getByRole('button', { name: 'Asia/Tashkent', exact: true }).click()
    await coordinator.getByRole('dialog').getByLabel('Vaqt zonasi', { exact: true }).selectOption('UTC')
    await coordinator.getByRole('dialog').getByRole('button', { name: 'Yopish', exact: true }).first().click()
    const path = `/doctors/${fixture.users.doctor.id}/work-schedule`
    const first = await mutation(coordinator, path, () => coordinator.getByRole('button', { name: 'Saqlash', exact: true }).click(), 200, 'PUT')
    const second = await mutation(coordinator, path, () => coordinator.getByRole('button', { name: 'Saqlash', exact: true }).click(), 200, 'PUT')
    assert.equal(second.version, first.version + 1)
    await mutation(stale, path, () => stale.getByRole('button', { name: 'Saqlash', exact: true }).click(), 409, 'PUT')
    await stale.getByText('Jadval boshqa foydalanuvchi tomonidan o‘zgartirilgan.', { exact: false }).waitFor()
    await stale.getByText('2026-12-29', { exact: true }).first().waitFor()
    await screenshot(stale, 'schedule-conflict')
    await stale.getByRole('button', { name: 'Joriy jadvalni yuklash', exact: true }).click()
    await stale.waitForFunction(() => [...document.querySelectorAll('button')].some((button) => button.textContent.trim() === 'Saqlash' && !button.disabled))
    const currentMetadata = patient.waitForResponse(metadata)
    await patient.reload()
    assert.equal((await (await currentMetadata).json()).response_due_at, originalDue)
    await screenshot(coordinator, 'work-schedule')
  })

  await check('In-app notification bell reads delivered backend events', async () => {
    await doctor.getByRole('button', { name: /^Bildirishnomalar/ }).click()
    const dialog = doctor.getByRole('dialog')
    const result = await mutation(doctor, '/read', () => dialog.getByRole('button', { name: 'O‘qilgan deb belgilash', exact: true }).first().click())
    assert(result.read_at)
    await doctor.keyboard.press('Escape')
  })

  await check('Doctor clinically approves complete DRAFT while incomplete DRAFT stays visible', async () => {
    await doctor.goto(`${base}/kabinet/shifokor/dorilar/${fixture.patient_id}`)
    await doctor.getByText('Nomi kiritilmagan dori', { exact: true }).waitFor()
    const article = doctor.locator('article').filter({ has: doctor.getByRole('heading', { name: `Sintetik QA tasdiq ${fixture.run_id}`, exact: true }) })
    await article.getByRole('button', { name: 'Klinik tasdiqlash', exact: true }).click()
    const approved = await mutation(doctor, `/medication-plans/${fixture.complete_plan_id}/approve`, () => article.getByRole('button', { name: 'Amalni tasdiqlash', exact: true }).click())
    assert.equal(approved.status, 'ACTIVE')
  })

  await check('Patient records medication and note-only correction preserves taken timestamp', async () => {
    await patient.goto(`${base}/kabinet/bemor/dorilar`)
    const plan = patient.locator('article').filter({ has: patient.getByRole('heading', { name: `Sintetik QA dori ${fixture.run_id}`, exact: true }) })
    await plan.getByRole('button', { name: 'Qabulni qayd etish', exact: true }).first().click()
    await plan.getByLabel('Qabul izohi', { exact: true }).fill('Sintetik dastlabki qayd')
    const saved = await mutation(patient, '/record', () => plan.getByRole('button', { name: 'Qaydni saqlash', exact: true }).click(), 201)
    await plan.getByRole('button', { name: 'Qaydni tuzatish', exact: true }).first().click()
    await plan.getByLabel('Qabul izohi', { exact: true }).fill('Faqat sintetik izoh tuzatildi')
    await plan.getByLabel('Tuzatish sababi', { exact: true }).fill('Sintetik note-only QA')
    const corrected = await mutation(patient, `/dose-records/${saved.id}/corrections`, () => plan.getByRole('button', { name: 'Qaydni saqlash', exact: true }).click())
    assert.equal(Date.parse(corrected.reported_taken_at), Date.parse(saved.reported_taken_at))
    assert.equal(corrected.original.result, 'TAKEN')
    assert.equal(corrected.version, 2)
    await screenshot(patient, 'patient-medications')
  })

  await check('Hospital doctors retain doctor workspace without coordinator discharge permissions', async () => {
    const clinician = await login(context, 'clinician')
    assert.equal(await clinician.getByRole('link', { name: 'Chiqarishlar', exact: true }).count(), 0)
    await clinician.goto(`${base}/kabinet/shifokor/chiqarish/${fixture.clinical_discharge_id}`)
    await clinician.waitForURL((url) => url.pathname.replace(/\/$/, '') === '/kabinet/shifokor')
    const denied = clinician.waitForResponse((response) => new URL(response.url()).pathname === `/api/v1/patients/${fixture.patient_id}/medication-plans`)
    await clinician.goto(`${base}/kabinet/shifokor/dorilar/${fixture.patient_id}`)
    assert.equal((await denied).status(), 404)
    assert.equal(await clinician.getByRole('button', { name: 'Klinik tasdiqlash', exact: true }).count(), 0)
  })

  await check('Technical admin lists staff, institutions and territories', async () => {
    const admin = await login(context, 'admin')
    await admin.getByRole('heading', { name: 'Texnik boshqaruv', exact: true }).waitFor()
    for (const tab of ['Xodimlar', 'Muassasalar', 'Hududlar']) {
      await admin.getByRole('button', { name: tab, exact: true }).click()
      await admin.getByLabel('Ro‘yxatdan qidirish', { exact: true }).fill(fixture.run_id)
      await admin.locator('main').getByText(new RegExp(fixture.run_id)).first().waitFor()
    }
    await admin.getByRole('button', { name: 'Yangi hudud', exact: true }).click()
    await admin.getByLabel('Hudud nomi', { exact: true }).fill(`Sintetik QA qo‘shimcha hudud ${fixture.run_id}`)
    const territory = await mutation(admin, '/reference/territories', () => admin.getByRole('button', { name: 'Hududni saqlash', exact: true }).click(), 201)
    assert(territory.id)
    await admin.getByRole('button', { name: 'Muassasalar', exact: true }).click()
    await admin.getByRole('button', { name: 'Yangi muassasa', exact: true }).click()
    await admin.getByLabel('Muassasa nomi', { exact: true }).fill(`Sintetik QA yangi poliklinika ${fixture.run_id}`)
    await admin.getByLabel('Muassasa turi', { exact: true }).selectOption('CLINIC')
    await admin.getByLabel('Muassasa hududi', { exact: true }).selectOption(fixture.territory_id)
    const organization = await mutation(admin, '/reference/organizations', () => admin.getByRole('button', { name: 'Muassasani saqlash', exact: true }).click(), 201)
    await admin.getByRole('button', { name: 'Xodimlar', exact: true }).click()
    await admin.getByRole('button', { name: 'Yangi xodim', exact: true }).click()
    await admin.getByLabel('Xodim logini', { exact: true }).fill(`qa.extra.${fixture.run_id}.${unique}`)
    await admin.getByLabel('Xodim roli', { exact: true }).selectOption('DOCTOR')
    await admin.getByLabel('Xodim muassasasi', { exact: true }).selectOption(organization.id)
    await admin.getByLabel('Xodim paroli', { exact: true }).fill(password)
    await admin.getByLabel('Dori jadvalini klinik tasdiqlash ruxsati', { exact: true }).check()
    const account = await mutation(admin, '/reference/accounts', () => admin.getByRole('button', { name: 'Xodimni saqlash', exact: true }).click(), 201)
    assert.equal(account.organization, organization.id)
    assert.equal(account.can_approve_medication_schedule, true)
    assert.equal('password' in account, false)
    await screenshot(admin, 'technical-admin')
  })

  await check('Separate tabs retain separate user sessions and logout affects one tab', async () => {
    await doctor.reload()
    assert.match(doctor.url(), /\/kabinet\/shifokor/)
    await doctor.getByRole('button', { name: 'Chiqish', exact: true }).first().waitFor()
    await patient.getByRole('button', { name: 'Chiqish', exact: true }).first().click()
    await patient.waitForURL('**/login')
    await doctor.reload()
    await doctor.getByRole('button', { name: 'Chiqish', exact: true }).first().waitFor()
    assert.match(doctor.url(), /\/kabinet\/shifokor/)
    const cookies = await context.cookies()
    assert(cookies.filter((cookie) => cookie.name.startsWith('refresh_token_')).every((cookie) => cookie.httpOnly))
    assert.equal(await doctor.evaluate(() => [...Object.keys(sessionStorage), ...Object.keys(localStorage)].some((name) => /access|refresh|password/i.test(name))), false)
  })

  await check('360px layout and mobile navigation', async () => {
    await hospital.setViewportSize({ width: 360, height: 800 })
    await hospital.goto(`${base}/kabinet/koordinator`)
    await hospital.getByRole('heading', { level: 1 }).first().waitFor()
    await hospital.getByRole('button', { name: 'Menyuni ochish', exact: true }).click()
    await hospital.getByRole('dialog').waitFor()
    await screenshot(hospital, 'hospital-mobile-menu')
    await hospital.keyboard.press('Escape')
    assert(await hospital.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
    await screenshot(hospital, 'hospital-mobile')
  })
  await check('Browser JavaScript and backend 5xx errors', async () => {
    assert.deepEqual(report.browser_errors, [])
    assert.deepEqual(report.server_errors, [])
  })
} catch (error) {
  console.error(redact(error.stack || error))
  process.exitCode = 1
} finally {
  await browser?.close()
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2))
  console.log(`Browser audit: ${report.checks.filter((item) => item.passed).length}/${report.checks.length} checks passed. Report: ${path.join(output, 'report.json')}`)
}
