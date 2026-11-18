import { useMutation, type UseMutationOptions } from '@tanstack/react-query'
import { useRef } from 'react'
import { IdempotencyAttempt } from '@/lib/idempotency'

export function useIdempotentMutation<Input, Result>(
  submit: (input: Input, key: string) => Promise<Result>,
  options?: Omit<UseMutationOptions<Result, Error, Input>, 'mutationFn'>,
) {
  const attempt = useRef(new IdempotencyAttempt())

  return useMutation({
    ...options,
    mutationFn: (input: Input) => attempt.current.run(input, submit),
  })
}
