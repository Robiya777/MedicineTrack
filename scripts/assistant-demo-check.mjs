// Live demo checks use synthetic fixtures only. No real emergency calls are made.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
process.loadEnvFile(path.join(root, 'backend/.env'))
const base = process.env.QA_BASE_URL || 'http://127.0.0.1:5173'
const folder = process.env.QA_OUTPUT || '/tmp/medicinetrack-assistant-qa'
const fixture = JSON.parse(fs.readFileSync(process.env.QA_FIXTURE || path.join(folder, 'fixture.json'), 'utf8'))
const password = process.env.DEMO_PASSWORD
assert(password, 'A local synthetic demo password is required.')
const require = createRequire(path.join(process.env.PLAYWRIGHT_PACKAGE_DIR || '/tmp/medicinetrack-browser-audit', 'package.json'))
const { chromium } = require('playwright')
fs.mkdirSync(folder, { recursive: true })
const report = { base, fixture_run: fixture.run_id, checks: [], browser_errors: [], server_errors: [] }
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] })
const contexts = []
async function check(name, operation) {
  try {
    const evidence = await operation()
    report.checks.push({ name, passed: true, evidence })
    console.log('PASS', name)
  } catch (error) {
    report.checks.push({ name, passed: false, error: String(error.message).replaceAll(password, '[redacted]') })
    throw error
  }
}
async function login(actor, slug) {
  const context = await browser.newContext({ viewport: { width: 1360, height: 960 }, timezoneId: 'Asia/Tashkent' })
  contexts.push(context)
  const page = await context.newPage()
  page.setDefaultTimeout(20_000)
  page.on('pageerror', (error) => report.browser_errors.push(error.message.replaceAll(password, '[redacted]')))
  page.on('response', (response) => { if (response.status() >= 500) report.server_errors.push({ status: response.status(), path: new URL(response.url()).pathname }) })
  await page.goto(base + '/login')
  await page.getByLabel('Login', { exact: true }).fill(fixture.users[actor].username)
  await page.getByLabel('Parol', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Kirish', exact: true }).click()
  await page.waitForURL((url) => url.pathname.replace(/\/$/, '') === '/kabinet/' + slug)
  return { page, context }
}
async function mutate(page, suffix, click, status = 200) {
  const pending = page.waitForResponse((response) => new URL(response.url()).pathname.endsWith(suffix) && response.request().method() === 'POST')
  await click()
  const result = await pending
  assert.equal(result.status(), status)
  return result.json()
}
async function message(page, text) {
  await page.getByLabel('Xabar', { exact: true }).fill(text)
  return mutate(page, `/conversations/${fixture.conversation_id}/messages`, () => page.getByRole('button', { name: 'Yuborish', exact: true }).click(), 201)
}
const latest = (page) => page.locator('section[aria-label="AI demo javobi"]').last()
try {
  const { page: patient, context } = await login('patient', 'bemor')
  await check('Primary frontend and backend expose the keyless demo', async () => {
    await patient.getByRole('region', { name: 'Shifokorlar bilan umumiy chat' }).waitFor()
    assert.equal(await patient.getByRole('complementary', { name: 'Suhbatlar ro‘yxati' }).count(), 0)
    await patient.getByLabel('Xabar', { exact: true }).waitFor()
    await patient.setViewportSize({ width: 360, height: 800 })
    assert.equal(await patient.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true)
    await patient.setViewportSize({ width: 1360, height: 960 })
    await patient.goto(`${base}/kabinet/bemor/suhbat/${fixture.conversation_id}`)
    await patient.getByLabel('Xabar', { exact: true }).waitFor()
    assert.equal(await patient.getByRole('link', { name: '103 · Telefon qilish', exact: true }).first().getAttribute('href'), 'tel:103')
  })
  await check('Symptom reply and contextual quick answer render in the real browser', async () => {
    const composer = patient.getByLabel('Xabar', { exact: true })
    await composer.fill('Boshim og‘riyapti')
    await composer.press('Shift+Enter')
    assert.equal(await composer.inputValue(), 'Boshim og‘riyapti\n')
    const response = await mutate(patient, `/conversations/${fixture.conversation_id}/messages`, () => composer.press('Enter'), 201)
    assert.equal(response.assistant.risk, 'DOCTOR_REVIEW')
    assert.equal(response.answered_at, null)
    await latest(patient).getByText('Og‘riq to‘satdan juda kuchli boshlandimi', { exact: false }).waitFor()
    const answer = await mutate(patient, `/conversations/${fixture.conversation_id}/messages`, () => latest(patient).getByRole('button', { name: 'Yo‘q', exact: true }).click(), 201)
    assert.equal(answer.assistant.question.key, 'duration_severity')
    await latest(patient).getByText('Masalan: «2 soatdan beri, 4/10, kuchaymoqda».', { exact: true }).waitFor()
    const details = await message(patient, '2 soatdan beri, 4/10, kuchaymoqda')
    assert.equal(details.assistant.risk, 'DOCTOR_REVIEW')
    assert.equal(details.assistant.question.key, 'additional_details')
  })
  let emergency
  await check('Danger automatically creates one clearly labelled demo SOS', async () => {
    const response = await message(patient, 'Nafas ololmayapman')
    assert.equal(response.assistant.risk, 'EMERGENCY')
    assert.equal(response.answered_at, null)
    emergency = response.assistant.emergency
    assert.equal(emergency.demo, true)
    assert.equal(emergency.location, null)
    assert.equal(emergency.state, 'DEMO_SIMULATED')
    assert.equal(emergency.events.length, 3)
    await latest(patient).getByText(emergency.notice, { exact: true }).waitFor()
    await patient.screenshot({ path: path.join(folder, 'web-emergency.png'), fullPage: true })
    return { incident_id: emergency.id, conversation_id: fixture.conversation_id }
  })
  await check('Cancelling consent sends no coordinates', async () => {
    await latest(patient).getByRole('button', { name: 'Lokatsiyani ulashish', exact: true }).click()
    await patient.getByRole('dialog').getByRole('button', { name: 'Bekor qilish', exact: true }).click()
    await latest(patient).getByText('Lokatsiya hali ulashilmagan.', { exact: false }).waitFor()
  })
  await check('Denied GPS permission reports an error without invented coordinates', async () => {
    const cdp = await context.newCDPSession(patient)
    await cdp.send('Browser.setPermission', { permission: { name: 'geolocation' }, setting: 'denied', origin: base })
    await latest(patient).getByRole('button', { name: 'Lokatsiyani ulashish', exact: true }).click()
    await patient.getByRole('dialog').getByRole('button', { name: 'Roziman, GPSni yuborish', exact: true }).click()
    await patient.getByRole('dialog').getByText('Hech qanday koordinata yuborilmadi.', { exact: false }).waitFor()
  })
  await check('Explicit demo location is marked as a demonstration', async () => {
    const result = await mutate(patient, `/assistant/emergencies/${emergency.id}/location`, () => patient.getByRole('dialog').getByRole('button', { name: 'Roziman, namoyish nuqtasini yuborish', exact: true }).click())
    assert.equal(result.location.source, 'DEMO')
    await latest(patient).getByText('Namoyish lokatsiyasi · bemorning GPSi emas', { exact: true }).waitFor()
  })
  await check('Consented browser GPS is saved as device coordinates', async () => {
    await context.setGeolocation({ latitude: 41.312345, longitude: 69.234567, accuracy: 17 })
    await context.grantPermissions(['geolocation'], { origin: base })
    await latest(patient).getByRole('button', { name: 'Lokatsiyani ulashish', exact: true }).click()
    const result = await mutate(patient, `/assistant/emergencies/${emergency.id}/location`, () => patient.getByRole('dialog').getByRole('button', { name: 'Roziman, GPSni yuborish', exact: true }).click())
    assert.equal(result.location.source, 'DEVICE')
    assert.equal(result.location.latitude, 41.312345)
    assert.equal(result.location.accuracy_m, 17)
    await latest(patient).getByText('Bemor ulashgan qurilma lokatsiyasi', { exact: true }).waitFor()
  })
  const { page: doctor } = await login('doctor', 'shifokor')
  await check('Assigned doctor sees the same SOS and patient GPS', async () => {
    const board = doctor.getByRole('region', { name: 'Demo SOS kuzatuvi' })
    await board.getByText(emergency.reference, { exact: true }).waitFor()
    await board.getByText('41.312345, 69.234567', { exact: false }).waitFor()
    await doctor.screenshot({ path: path.join(folder, 'web-doctor-sos.png'), fullPage: true })
  })
  const { page: coordinator } = await login('coordinator', 'koordinator')
  await check('Territory coordinator sees and acknowledges the demo SOS', async () => {
    const board = coordinator.getByRole('region', { name: 'Demo SOS kuzatuvi' })
    await board.getByText(emergency.reference, { exact: true }).waitFor()
    const result = await mutate(coordinator, `/assistant/emergencies/${emergency.id}/acknowledge`, () => board.getByRole('button', { name: 'SOSni ko‘rdim', exact: true }).click())
    assert(result.acknowledged_at)
    await board.getByText('Tibbiyot xodimi ko‘rdi:', { exact: false }).waitFor()
  })
  await check('Demo SOS notification reaches the real notification worker', async () => {
    await doctor.reload()
    await doctor.getByRole('button', { name: /^Bildirishnomalar/ }).click()
    await doctor.getByText('DEMO SOS · bemor shoshilinch belgi bildirgan', { exact: true }).waitFor()
    await doctor.getByRole('link', { name: 'Demo SOSni ochish', exact: true }).click()
    assert(new URL(doctor.url()).hash === '#demo-sos')
  })
  await check('360px mobile web keeps emergency actions within the viewport', async () => {
    await patient.setViewportSize({ width: 360, height: 800 })
    assert.equal(await patient.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true)
    await patient.screenshot({ path: path.join(folder, 'web-mobile-sos.png'), fullPage: true })
  })
  await check('Doctor reply stays separate and closes the real response episode', async () => {
    await doctor.goto(`${base}/kabinet/shifokor/suhbat/${fixture.conversation_id}`)
    const response = await message(doctor, 'Sintetik shifokor tekshiruvi yakunlandi.')
    assert.equal(response.assistant, null)
    await patient.reload()
    await patient.getByText('Sintetik shifokor tekshiruvi yakunlandi.', { exact: true }).waitFor()
    assert((await patient.getByText('Javob berildi', { exact: false }).count()) > 0)
  })
  assert.deepEqual(report.browser_errors, [])
  assert.deepEqual(report.server_errors, [])
} finally {
  fs.writeFileSync(path.join(folder, 'browser-report.json'), JSON.stringify(report, null, 2) + '\n')
  await Promise.all(contexts.map((context) => context.close()))
  await browser.close()
}
