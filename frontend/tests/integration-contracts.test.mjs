import assert from 'node:assert/strict'
import test from 'node:test'
import { IdempotencyAttempt } from '../src/lib/idempotency.ts'
import { planSchema } from '../src/api/medication-schemas.ts'
import { getWorkspace, isHospitalWorkspaceUser } from '../src/lib/workspaces.ts'
import { takenDateForCorrection, takenInputValue } from '../src/lib/medication-record.ts'

function attempts() {
  let count = 0
  return new IdempotencyAttempt(() => `attempt-${++count}`)
}

test('a lost response retries with the same key, then a new successful message gets a new key', async () => {
  const state = attempts()
  const keys = []
  const submit = async (_input, key) => {
    keys.push(key)
    if (keys.length === 1) throw new Error('Response lost after server commit')
    return 'saved'
  }
  await assert.rejects(state.run({ text: 'Salom' }, submit))
  assert.equal(await state.run({ text: 'Salom' }, submit), 'saved')
  assert.equal(await state.run({ text: 'Salom' }, submit), 'saved')
  assert.deepEqual(keys, ['attempt-1', 'attempt-1', 'attempt-2'])
})

test('editing a failed payload creates a new attempt', async () => {
  const state = attempts()
  const keys = []
  const fail = async (_input, key) => { keys.push(key); throw new Error('Offline') }
  await assert.rejects(state.run({ text: 'First' }, fail))
  await assert.rejects(state.run({ text: 'Edited' }, fail))
  assert.deepEqual(keys, ['attempt-1', 'attempt-2'])
})

test('an earlier in-flight success does not erase the retry key of a later failed action', async () => {
  const state = attempts()
  const keys = []
  let finishFirst
  const first = state.run('first', (_input, key) => {
    keys.push(key)
    return new Promise((resolve) => { finishFirst = resolve })
  })
  await assert.rejects(state.run('second', async (_input, key) => { keys.push(key); throw new Error('Offline') }))
  finishFirst('saved')
  await first
  await state.run('second', async (_input, key) => { keys.push(key); return 'saved' })
  assert.deepEqual(keys, ['attempt-1', 'attempt-2', 'attempt-2'])
})

const id = '6b29fc40-ca47-4067-b31d-00dd010662da'
function draft() {
  return {
    id, patient: id, discharge: id, series_id: id, version: 1, lock_version: 1,
    status: 'DRAFT', approved_at: null, supersedes: null, stop_reason: '',
    created_at: '2026-11-18T05:00:00Z',
    items: [{
      id, name: null, prescribed_dose_text: null, route: null,
      instructions: '', source_reference: '', start_date: null, end_date: null,
      timezone: '', local_times: [], schedule_type: 'FIXED_TIMES',
      needs_clarification: true, clarification_reason: 'Synthetic incomplete source',
      missing_fields: ['name', 'prescribed_dose_text', 'route', 'local_times'],
    }],
  }
}

test('valid nullable medication drafts remain readable and editable without inventing values', () => {
  const result = planSchema.parse(draft())
  assert.equal(result.items[0].name, '')
  assert.equal(result.items[0].prescribed_dose_text, '')
  assert.equal(result.items[0].route, '')
  assert.deepEqual(result.items[0].missing_fields, ['name', 'prescribed_dose_text', 'route', 'local_times'])
  assert.equal(result.items[0].needs_clarification, true)
})

test('medication contracts still reject corrupt field types', () => {
  const value = draft()
  value.items[0].name = 42
  assert.equal(planSchema.safeParse(value).success, false)
})

test('hospital clinicians use hospital workspace while family doctors retain doctor workspace', () => {
  assert.equal(getWorkspace({ role: 'DOCTOR', organization_type: 'HOSPITAL' }).slug, 'statsionar')
  assert.equal(getWorkspace({ role: 'DOCTOR', organization_type: 'CLINIC' }).slug, 'shifokor')
  assert.equal(isHospitalWorkspaceUser({ role: 'DOCTOR', organization_type: 'HOSPITAL' }), true)
  assert.equal(isHospitalWorkspaceUser({ role: 'DOCTOR', organization_type: 'CLINIC' }), false)
})

test('other roles retain their assigned workspace', () => {
  assert.equal(getWorkspace({ role: 'HOSPITAL', organization_type: 'HOSPITAL' }).slug, 'statsionar')
  assert.equal(getWorkspace({ role: 'COORDINATOR', organization_type: 'HOSPITAL' }).slug, 'koordinator')
  assert.equal(getWorkspace({ role: 'PATIENT', organization_type: null }).slug, 'bemor')
  assert.equal(getWorkspace({ role: 'ADMIN', organization_type: null }).slug, 'admin')
})

test('note-only dose correction preserves original intake timestamp including milliseconds', () => {
  const reportedAt = '2026-11-17T03:02:03.456Z'
  const input = takenInputValue(reportedAt, new Date('2026-11-18T05:00:00Z'))
  assert.equal(input, '2026-11-17T08:02:03')
  assert.equal(takenDateForCorrection(input, input, reportedAt).toISOString(), reportedAt)
})

test('a deliberate corrected intake time is parsed in Tashkent time', () => {
  assert.equal(
    takenDateForCorrection('2026-11-17T09:00:00', '2026-11-17T08:02:03', '2026-11-17T03:02:03.456Z').toISOString(),
    '2026-11-17T04:00:00.000Z',
  )
})
