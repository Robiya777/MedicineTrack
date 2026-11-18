// Live regression for messages hidden by long AI/SOS cards. Synthetic fixtures only.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
process.loadEnvFile(path.join(root, 'backend/.env'))
const base = process.env.QA_BASE_URL || 'http://127.0.0.1:5173'
const output = process.env.QA_OUTPUT || '/tmp/medicinetrack-chat-visibility'
const fixture = JSON.parse(fs.readFileSync(process.env.QA_FIXTURE || path.join(output, 'fixture.json'), 'utf8'))
const password = process.env.DEMO_PASSWORD
assert(password)
assert.match(fixture.users.patient.username, /^qa\./, 'Use synthetic accounts, never patient data')
const require = createRequire(path.join(process.env.PLAYWRIGHT_PACKAGE_DIR || '/tmp/medicinetrack-browser-audit', 'package.json'))
const { chromium } = require('playwright')
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] })
const sessions = []
const secrets = new Set([password])
const redact = (value) => [...secrets].reduce((text, secret) => text.replaceAll(secret, '[redacted]'), String(value))
const report = { base, fixture_run: fixture.run_id, checks: [], browser_errors: [], server_errors: [] }
const messagesPath = `/conversations/${fixture.conversation_id}/messages`
fs.mkdirSync(output, { recursive: true })

async function check(name, run) {
  try {
    const evidence = await run()
    report.checks.push({ name, passed: true, evidence })
    console.log('PASS', name)
  } catch (error) {
    report.checks.push({ name, passed: false, error: redact(error.message) })
    throw error
  }
}
async function login(actor, slug) {
  const context = await browser.newContext({ viewport: { width: 1360, height: 900 }, timezoneId: 'Asia/Tashkent', extraHTTPHeaders: { 'ngrok-skip-browser-warning': '1' } })
  const page = await context.newPage()
  page.setDefaultTimeout(20_000)
  const session = { context, page, access: '' }
  sessions.push(session)
  page.on('pageerror', (error) => report.browser_errors.push(redact(error.message)))
  page.on('response', (response) => { if (response.status() >= 500) report.server_errors.push({ path: new URL(response.url()).pathname, status: response.status() }) })
  await page.goto(base + '/login', { waitUntil: 'domcontentloaded' })
  await page.getByLabel('Login', { exact: true }).fill(fixture.users[actor].username)
  await page.getByLabel('Parol', { exact: true }).fill(password)
  const pending = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/v1/auth/login' && response.request().method() === 'POST')
  await page.getByRole('button', { name: 'Kirish', exact: true }).click()
  const response = await pending
  assert.equal(response.status(), 200)
  session.access = (await response.json()).access
  secrets.add(session.access)
  await page.waitForURL((url) => url.pathname.replace(/\/$/, '') === '/kabinet/' + slug)
  return session
}
async function mutation(page, suffix, action) {
  const pending = page.waitForResponse((response) => new URL(response.url()).pathname.endsWith(suffix) && response.request().method() === 'POST')
  await action()
  const response = await pending
  assert(response.ok(), `POST ${suffix}: HTTP ${response.status()}`)
  return response.json()
}
async function send(page, text) {
  await page.getByLabel('Xabar', { exact: true }).fill(text)
  return mutation(page, messagesPath, () => page.getByLabel('Xabar', { exact: true }).press('Enter'))
}
function row(page, id) { return page.locator(`[data-message-id="${id}"]`) }
async function textIsVisible(page, id) {
  // DOM presence and isVisible alone do not prove the text is inside the chat viewport.
  await page.waitForFunction((id) => {
    const message = document.querySelector(`[data-message-id="${id}"] [data-message-bubble] p.whitespace-pre-wrap`)
    const area = document.querySelector('[aria-label="Suhbat xabarlari"]')
    if (!message || !area) return false
    const text = message.getBoundingClientRect(), viewport = area.getBoundingClientRect()
    const bubble = message.closest('[data-message-bubble]')
    const target = document.elementFromPoint(text.left + Math.min(10, text.width / 2), text.top + Math.min(8, text.height / 2))
    return text.top >= viewport.top && text.bottom <= viewport.bottom &&
      Number(getComputedStyle(bubble).opacity) >= 0.99 && message.contains(target)
  }, id, { timeout: 10_000 })
}
async function openDoctorChat(session) {
  await session.page.getByRole('link', { name: 'Suhbatlar', exact: true }).first().click()
  await session.page.getByRole('button', { name: new RegExp(fixture.patient_name) }).click()
  await session.page.getByLabel('Xabar', { exact: true }).waitFor()
}

try {
  const patient = await login('patient', 'bemor')
  let latest
  await check('A large SOS with a shared location cannot hide the next patient message', async () => {
    const emergency = await send(patient.page, 'Nafas ololmayapman')
    assert(emergency.assistant.emergency)
    const details = row(patient.page, emergency.id).getByText('SOS tafsilotlari va lokatsiya', { exact: true })
    await details.click()
    await row(patient.page, emergency.id).getByRole('button', { name: 'Lokatsiyani ulashish', exact: true }).click()
    const location = await mutation(patient.page, `/assistant/emergencies/${emergency.assistant.emergency.id}/location`, () => patient.page.getByRole('dialog').getByRole('button', { name: 'Roziman, namoyish nuqtasini yuborish', exact: true }).click())
    assert.equal(location.location.source, 'DEMO')
    latest = await send(patient.page, `Sintetik yangi xabar ${fixture.run_id}`)
    await textIsVisible(patient.page, latest.id)
    assert.equal(await patient.page.getByText('Xabar yuborildi', { exact: true }).count(), 0, 'Message delivery is shown in the chat without covering it with a toast')
    assert.equal(await row(patient.page, latest.id).locator('[data-message-bubble] [aria-label="AI demo javobi"]').count(), 0, 'AI has its own bubble')
    assert.equal(await row(patient.page, latest.id).locator('details[open]').count(), 0, 'Long SOS details start collapsed')
    await patient.page.screenshot({ path: path.join(output, 'patient-visible.png') })
    return { message_id: latest.id }
  })

  const doctor = await login('doctor', 'shifokor')
  await check('The primary doctor receives the same message through the conversation list', async () => {
    await openDoctorChat(doctor)
    await textIsVisible(doctor.page, latest.id)
    assert.equal(await row(doctor.page, latest.id).locator('[data-message-bubble] p.whitespace-pre-wrap').innerText(), latest.text)
  })
  await check('A second assigned doctor receives the same common-chat message', async () => {
    const response = await doctor.context.request.post(`${base}/api/v1/patients/${fixture.patient_id}/chat-doctors`, {
      headers: { Authorization: `Bearer ${doctor.access}`, 'Idempotency-Key': crypto.randomUUID() },
      data: { doctor: fixture.users.doctor2.id, action: 'ADD' },
    })
    assert.equal(response.status(), 200)
    const colleague = await login('doctor2', 'shifokor')
    await openDoctorChat(colleague)
    await textIsVisible(colleague.page, latest.id)
    await colleague.context.close()
  })
  await check('Doctor replies appear in the patient chat without a reload', async () => {
    const reply = await send(doctor.page, `Sintetik shifokor javobi ${fixture.run_id}`)
    assert.equal(reply.sender, fixture.users.doctor.id)
    await textIsVisible(patient.page, reply.id)
  })
  await check('A confirmed message appears immediately while the subsequent history request is delayed', async () => {
    let release
    const gate = new Promise((resolve) => { release = resolve })
    const pattern = `**/api/v1${messagesPath}*`
    const pendingRoutes = []
    const handler = (route) => {
      const pending = (async () => {
        if (route.request().method() === 'GET') await gate
        try {
          await route.continue()
        } catch (error) {
          // Sending cancels an older poll; Playwright may already have released that route.
          if (!error.message.includes('Route is already handled')) throw error
        }
      })()
      pendingRoutes.push(pending)
      return pending
    }
    await patient.page.route(pattern, handler)
    try {
      latest = await send(patient.page, `Sintetik sekin tarmoq ${fixture.run_id}`)
      await textIsVisible(patient.page, latest.id)
    } finally {
      release()
      await patient.page.unroute(pattern, handler)
      await Promise.all(pendingRoutes)
    }
  })
  await check('Reading history survives polling and the latest-message button reveals a new reply', async () => {
    const area = patient.page.getByRole('region', { name: 'Suhbat xabarlari', exact: true })
    await area.evaluate((node) => { node.scrollTop = 0 })
    await patient.page.getByRole('button', { name: 'Oxirgi xabarga o‘tish', exact: true }).waitFor()
    const reply = await send(doctor.page, `Sintetik keyingi javob ${fixture.run_id}`)
    await row(patient.page, reply.id).waitFor()
    assert((await area.evaluate((node) => node.scrollTop)) < 80, 'Incoming messages must not move a reader out of history')
    await patient.page.getByRole('button', { name: 'Oxirgi xabarga o‘tish', exact: true }).click()
    await textIsVisible(patient.page, reply.id)
  })
  await check('A 360px mobile chat shows new text even after an expanded emergency card', async () => {
    await patient.page.setViewportSize({ width: 360, height: 800 })
    const emergency = await send(patient.page, 'Nafas ololmayapman')
    await row(patient.page, emergency.id).getByText('SOS tafsilotlari va lokatsiya', { exact: true }).click()
    latest = await send(patient.page, `Sintetik mobil xabar ${fixture.run_id}`)
    await textIsVisible(patient.page, latest.id)
    const overflow = await patient.page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    assert.equal(overflow, false)
    await patient.page.screenshot({ path: path.join(output, 'patient-mobile-visible.png'), fullPage: true })
  })
  await check('Reload keeps the latest patient text visible on mobile', async () => {
    await patient.page.reload({ waitUntil: 'domcontentloaded' })
    await textIsVisible(patient.page, latest.id)
  })
  assert.deepEqual(report.browser_errors, [])
  assert.deepEqual(report.server_errors, [])
} catch (error) {
  console.error(redact(error.message).slice(0, 1000))
  process.exitCode = 1
  for (let index = 0; index < sessions.length; index++) {
    const { page } = sessions[index]
    if (!page.isClosed() && !page.url().includes('/login')) await page.screenshot({ path: path.join(output, `failure-${index}.png`), fullPage: true }).catch(() => {})
  }
} finally {
  fs.writeFileSync(path.join(output, 'browser-report.json'), JSON.stringify(report, null, 2) + '\n')
  await Promise.all(sessions.map(({ context }) => context.close()))
  await browser.close()
}
