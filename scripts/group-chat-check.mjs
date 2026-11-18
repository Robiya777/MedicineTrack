// Synthetic local demo only; exercises real HTTP, browser presence and the Celery timer.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
process.loadEnvFile(path.join(root, 'backend/.env'))
const base = process.env.QA_BASE_URL || 'http://127.0.0.1:5173'
const output = process.env.QA_OUTPUT || '/tmp/medicinetrack-group-qa/chat'
const fixture = JSON.parse(fs.readFileSync(process.env.QA_FIXTURE || path.join(output, 'fixture.json'), 'utf8'))
const password = process.env.DEMO_PASSWORD
assert(password)
const require = createRequire('/tmp/medicinetrack-browser-audit/package.json')
const { chromium } = require('playwright')
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] })
const sessions = []
const secrets = new Set([password])
const clean = (value) => [...secrets].reduce((text, secret) => text.replaceAll(secret, '[redacted]'), String(value))
const report = { base, fixture_run: fixture.run_id, checks: [], browser_errors: [], server_errors: [] }
fs.mkdirSync(output, { recursive: true })
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function check(name, run) {
  try {
    const evidence = await run()
    report.checks.push({ name, passed: true, evidence })
    console.log('PASS', name)
  } catch (error) {
    report.checks.push({ name, passed: false, error: clean(error.stack || error) })
    for (const session of sessions) if (!session.page.isClosed()) await session.page.screenshot({ path: path.join(output, `failure-${session.actor}.png`), fullPage: true }).catch(() => {})
    throw error
  }
}
async function login(actor, slug) {
  const context = await browser.newContext({ viewport: { width: 1360, height: 960 }, timezoneId: 'Asia/Tashkent' })
  const page = await context.newPage()
  page.setDefaultTimeout(20_000)
  const session = { actor, context, page, access: '' }
  sessions.push(session)
  page.on('pageerror', (error) => report.browser_errors.push(clean(error.message)))
  page.on('response', (response) => { if (response.status() >= 500) report.server_errors.push({ path: new URL(response.url()).pathname, status: response.status() }) })
  await page.goto(base + '/login')
  await page.getByLabel('Login', { exact: true }).fill(fixture.users[actor].username)
  await page.getByLabel('Parol', { exact: true }).fill(password)
  for (let attempt = 0; attempt < 3; attempt++) {
    const pending = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/v1/auth/login' && response.request().method() === 'POST')
    await page.getByRole('button', { name: 'Kirish', exact: true }).click()
    const response = await pending
    if (response.status() === 429) { await pause(Math.min(60, Number(response.headers()['retry-after'] || 10) + 1) * 1000); continue }
    assert.equal(response.status(), 200)
    session.access = (await response.json()).access
    secrets.add(session.access)
    break
  }
  await page.waitForURL((url) => url.pathname.replace(/\/$/, '') === '/kabinet/' + slug)
  return session
}
async function post(page, suffix, act, status = 200) {
  const pending = page.waitForResponse((response) => new URL(response.url()).pathname.endsWith(suffix) && response.request().method() === 'POST')
  await act()
  const response = await pending
  assert.equal(response.status(), status)
  return response.json()
}
async function message(page, text) {
  await page.getByLabel('Xabar', { exact: true }).fill(text)
  return post(page, `/conversations/${fixture.conversation_id}/messages`, () => page.getByRole('button', { name: 'Yuborish', exact: true }).click(), 201)
}
async function messages(session) {
  const response = await session.context.request.get(`${base}/api/v1/conversations/${fixture.conversation_id}/messages`, { headers: { Authorization: `Bearer ${session.access}` } })
  assert.equal(response.status(), 200)
  return (await response.json()).results
}
async function openChat(page, slug) {
  await page.goto(`${base}/kabinet/${slug}/suhbat/${fixture.conversation_id}`)
  await page.getByLabel('Xabar', { exact: true }).waitFor()
}

try {
  const patient = await login('patient', 'bemor')
  await check('Patient opens a common chat directly without doctor profiles or selection', async () => {
    await patient.page.getByRole('region', { name: 'Shifokorlar bilan umumiy chat' }).waitFor()
    await patient.page.getByLabel('Xabar', { exact: true }).waitFor()
    assert.equal(await patient.page.getByRole('complementary', { name: 'Suhbatlar ro‘yxati' }).count(), 0)
    assert.equal(await patient.page.getByPlaceholder('Ism bo‘yicha qidirish').count(), 0)
    await patient.page.screenshot({ path: path.join(output, 'patient-simple-chat.png'), fullPage: true })
  })
  await check('No online doctors produces an immediate labelled AI response', async () => {
    const response = await message(patient.page, 'Boshim og‘riyapti')
    assert.equal(response.assistant.reply_reason, 'DOCTORS_OFFLINE')
    assert.equal(response.answered_at, null)
    await patient.page.getByText('Shifokorlar hozir oflayn bo‘lgani uchun yordamchi javob berdi.', { exact: true }).waitFor()
  })
  const doctor = await login('doctor', 'shifokor')
  await openChat(doctor.page, 'shifokor')
  await message(doctor.page, 'Birinchi murojaatingizni ko‘rdim.')
  await check('Primary doctor adds a second treating doctor through the team dialog', async () => {
    await doctor.page.getByRole('button', { name: 'Chat jamoasi', exact: true }).click()
    const dialog = doctor.page.getByRole('dialog')
    await dialog.getByLabel('Shifokorni tanlang', { exact: true }).selectOption(fixture.users.clinician.id)
    const team = await post(doctor.page, `/patients/${fixture.patient_id}/chat-doctors`, () => dialog.getByRole('button', { name: 'Shifokorni chatga qo‘shish', exact: true }).click())
    assert.equal(team.members.length, 2)
    await dialog.getByText(fixture.users.clinician.username, { exact: true }).waitFor()
    await dialog.getByRole('button', { name: 'Yopish', exact: true }).click()
    await patient.page.getByText('2 shifokor', { exact: false }).waitFor()
  })
  const colleague = await login('clinician', 'shifokor')
  await openChat(colleague.page, 'shifokor')
  await check('Second doctor participates in the same chat with a distinct sender name', async () => {
    assert.equal(await colleague.page.getByRole('button', { name: 'Chat jamoasi', exact: true }).count(), 0)
    const response = await message(colleague.page, 'Jamoaning ikkinchi shifokori ham chatga ulandi.')
    assert.equal(response.sender, fixture.users.clinician.id)
    assert.equal(response.sender_role, 'DOCTOR')
    await patient.page.locator(`[data-message-id="${response.id}"]`).getByText(fixture.users.clinician.username, { exact: true }).waitFor()
  })
  await check('A team doctor replying within one minute cancels the pending AI response', async () => {
    const sent = await message(patient.page, 'Dori jadvalim bo‘yicha savolim bor')
    assert.equal(sent.assistant, null)
    assert.equal(sent.assistant_status, 'WAITING')
    await message(colleague.page, 'Jadval bo‘yicha savolingizga shifokor javob bermoqda.')
    const row = (await messages(patient)).find((item) => item.id === sent.id)
    assert.equal(row.assistant, null)
    assert.equal(row.assistant_status, 'CANCELLED')
    assert.equal(row.delivery_status, 'ANSWERED')
  })
  await check('Real Celery worker releases AI after sixty seconds while doctors remain online', async () => {
    const sent = await message(patient.page, 'Keyingi ko‘rik bo‘yicha savolim bor')
    assert.equal(sent.assistant, null)
    assert.equal(sent.assistant_status, 'WAITING')
    console.log('WAIT Real 60-second server deadline; foreground doctor heartbeats stay active.')
    await pause(50_000)
    const pending = (await messages(patient)).find((item) => item.id === sent.id)
    assert.equal(pending.assistant_status, 'WAITING', 'AI must not answer before the deadline')
    const bubble = patient.page.locator(`[data-message-id="${sent.id}"]`)
    await bubble.getByText('Shifokorlardan 1 daqiqada javob kelmagani uchun yordamchi javob berdi.', { exact: true }).waitFor({ timeout: 25_000 })
    const result = (await messages(patient)).find((item) => item.id === sent.id)
    assert.equal(result.assistant.reply_reason, 'NO_REPLY_60S')
    const seconds = (Date.parse(result.assistant.reply_at) - Date.parse(result.sent_at)) / 1000
    assert(seconds >= 60 && seconds < 70, `Observed server delay: ${seconds}s`)
    assert.equal(result.answered_at, null)
    assert.equal(await bubble.evaluate((element) => {
      const area = element.closest('section[aria-label="Suhbat xabarlari"]').getBoundingClientRect()
      const item = element.getBoundingClientRect()
      return item.bottom <= area.bottom + 1 && item.bottom > area.top
    }), true, 'New AI response must automatically remain in the visible message area')
    await patient.page.screenshot({ path: path.join(output, 'patient-timed-ai.png'), fullPage: true })
    return { message_id: sent.id, server_delay_seconds: seconds }
  })
  await message(doctor.page, 'Kutishni yakunlab, shifokor javob bermoqda.')
  await check('Doctors going offline release a waiting AI response immediately', async () => {
    const sent = await message(patient.page, 'Navbatdagi savolimni yozmoqchiman')
    assert.equal(sent.assistant_status, 'WAITING')
    await colleague.page.getByRole('button', { name: 'Chiqish', exact: true }).first().click()
    await colleague.page.waitForURL('**/login')
    await doctor.page.getByRole('button', { name: 'Chiqish', exact: true }).first().click()
    await doctor.page.waitForURL('**/login')
    const bubble = patient.page.locator(`[data-message-id="${sent.id}"]`)
    await bubble.getByText('Shifokorlar hozir oflayn bo‘lgani uchun yordamchi javob berdi.', { exact: true }).waitFor()
    const result = (await messages(patient)).find((item) => item.id === sent.id)
    assert.equal(result.assistant.reply_reason, 'DOCTORS_OFFLINE')
    assert(Date.parse(result.assistant.reply_at) - Date.parse(result.sent_at) < 60_000)
  })
  const primaryAgain = await login('doctor', 'shifokor')
  await openChat(primaryAgain.page, 'shifokor')
  await check('Emergency symptoms produce SOS without waiting for an online doctor', async () => {
    const response = await message(patient.page, 'Nafas ololmayapman')
    assert.equal(response.assistant.risk, 'EMERGENCY')
    assert.equal(response.assistant.reply_reason, 'EMERGENCY')
    assert.equal(response.assistant.emergency.demo, true)
    assert.equal(response.assistant.emergency.location, null)
  })
  const secondAgain = await login('clinician', 'shifokor')
  await openChat(secondAgain.page, 'shifokor')
  await check('Removing a doctor revokes chat access even for an existing session', async () => {
    await primaryAgain.page.getByRole('button', { name: 'Chat jamoasi', exact: true }).click()
    const dialog = primaryAgain.page.getByRole('dialog')
    const result = await post(primaryAgain.page, `/patients/${fixture.patient_id}/chat-doctors`, () => dialog.getByRole('button', { name: 'Chatdan chiqarish', exact: true }).click())
    assert.equal(result.members.length, 1)
    const denied = await secondAgain.context.request.get(`${base}/api/v1/conversations/${fixture.conversation_id}/messages`, { headers: { Authorization: `Bearer ${secondAgain.access}` } })
    assert.equal(denied.status(), 404)
    await dialog.getByRole('button', { name: 'Yopish', exact: true }).click()
  })
  await check('Patient common chat fits a 360px screen without profiles', async () => {
    await patient.page.setViewportSize({ width: 360, height: 800 })
    assert.equal(await patient.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true)
    assert.equal(await patient.page.getByRole('complementary', { name: 'Suhbatlar ro‘yxati' }).count(), 0)
    await patient.page.screenshot({ path: path.join(output, 'patient-mobile-chat.png'), fullPage: true })
  })
  assert.deepEqual(report.browser_errors, [])
  assert.deepEqual(report.server_errors, [])
} finally {
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n')
  await Promise.all(sessions.map((session) => session.context.close()))
  await browser.close()
}
