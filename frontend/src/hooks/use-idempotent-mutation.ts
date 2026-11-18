import { useMutation, type UseMutationOptions } from '@tanstack/react-query'
import { useRef } from 'react'

export function useIdempotentMutation<Input, Result>(
  submit: (input: Input, key: string) => Promise<Result>,
  options?: Omit<UseMutationOptions<Result, Error, Input>, 'mutationFn'>,
) {
  const attempt = useRef<{ payload: string; key: string } | null>(null)

  return useMutation({
    ...options,
    mutationFn: (input: Input) => {
      const payload = JSON.stringify(input) ?? ''
      if (attempt.current?.payload !== payload) {
        attempt.current = { payload, key: crypto.randomUUID() }
      }
      return submit(input, attempt.current.key)
    },
  })
}
