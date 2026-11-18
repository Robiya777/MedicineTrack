export class IdempotencyAttempt {
  private current: { payload: string; key: string } | null = null
  private newKey: () => string

  constructor(newKey: () => string = () => crypto.randomUUID()) {
    this.newKey = newKey
  }

  async run<Input, Result>(input: Input, submit: (input: Input, key: string) => Promise<Result>) {
    const payload = JSON.stringify(input) ?? ''
    if (this.current?.payload !== payload) {
      this.current = { payload, key: this.newKey() }
    }
    const attempt = this.current
    const result = await submit(input, attempt.key)
    // Keep a failed attempt for retries, but a later deliberate action is new,
    // even when its text/body is identical to the last successful action.
    if (this.current === attempt) this.current = null
    return result
  }
}
