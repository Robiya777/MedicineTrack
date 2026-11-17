import { useMutation } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { useRef } from 'react'

export function useIdempotentMutation<Input, Result>(submit: (input: Input, key: string) => Promise<Result>) {
  const attempt = useRef<{ payload: string; key: string } | null>(null)

  return useMutation({
    mutationFn: (input: Input) => {
      const payload = JSON.stringify(input) ?? ''
      if (attempt.current?.payload !== payload) {
        attempt.current = { payload, key: crypto.randomUUID() }
      }
      return submit(input, attempt.current.key)
    },
  })
}

export function responseFieldErrors(error: unknown) {
  if (!isAxiosError(error)) return {}
  const fields: unknown = error.response?.data?.fields
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) return {}

  const messages: Record<string, string> = {}
  for (const [field, value] of Object.entries(fields)) {
    const message = Array.isArray(value) ? value.find((item) => typeof item === 'string') : value
    if (typeof message === 'string') messages[field] = message
  }
  return messages
}
