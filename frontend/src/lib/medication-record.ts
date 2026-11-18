import { parseTashkentInput, tashkentInputValue } from './date.ts'

export function takenInputValue(reportedAt: string | null | undefined, now = new Date()) {
  return tashkentInputValue(reportedAt ? new Date(reportedAt) : now)
}

export function takenDateForCorrection(
  input: string,
  initial: string,
  reportedAt: string | null | undefined,
) {
  // datetime-local displays whole seconds; an unchanged field must retain the
  // original timestamp, including any fractional seconds from another client.
  return reportedAt && input === initial ? new Date(reportedAt) : parseTashkentInput(input)
}
