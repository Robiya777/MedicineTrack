import { useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { useState, type ReactNode, type SubmitEvent } from 'react'
import { hospitalQueryKeys } from '../../api/hospital'
import { sendTaskCommand, taskKeys, type CareTask, type TaskCommand } from '../../api/tasks'
import { responseFieldErrors } from '../../lib/errors'
import { useIdempotentMutation } from '../../hooks/use-idempotent-mutation'
import { primaryButton, RequestError, secondaryButton } from '../../components/ui'

export function TaskActionForm({ task, submitLabel, cancel, onSaved, build, check, children, onPending, destructive = false }: {
  task: CareTask
  submitLabel: string
  destructive?: boolean
  cancel: () => void
  onSaved: () => void
  build: (form: FormData, version: number) => TaskCommand
  check?: (form: FormData) => Record<string, string>
  children: (errors: Record<string, string>, disabled: boolean) => ReactNode
  onPending?: (pending: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [version, setVersion] = useState(task.version)
  const [conflict, setConflict] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const mutation = useIdempotentMutation((command: TaskCommand, key) => sendTaskCommand(task.id, command, key))

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (mutation.isPending || conflict) return
    const form = new FormData(event.currentTarget)
    const issues = check?.(form) ?? {}
    setErrors(issues)
    mutation.reset()
    if (Object.keys(issues).length) return

    onPending?.(true)
    try {
      const saved = await mutation.mutateAsync(build(form, version))
      queryClient.setQueryData(taskKeys.detail(task.id), saved)
      queryClient.setQueryData(hospitalQueryKeys.dischargeTask(saved.discharge), saved)
      void queryClient.invalidateQueries({ queryKey: taskKeys.detail(task.id) })
      void queryClient.invalidateQueries({ queryKey: taskKeys.lists })
      void queryClient.invalidateQueries({ queryKey: taskKeys.metrics })
      void queryClient.invalidateQueries({ queryKey: ['hospital', 'doctor-name'] })
      onSaved()
    } catch (error) {
      if (isAxiosError(error) && [403, 404, 409].includes(error.response?.status ?? 0)) {
        if (error.response?.status === 409) setConflict(true)
        void queryClient.invalidateQueries({ queryKey: taskKeys.detail(task.id) })
      }
    } finally {
      onPending?.(false)
    }
  }

  return (
    <form className="space-y-5" onSubmit={submit} aria-busy={mutation.isPending}>
      {children({ ...responseFieldErrors(mutation.error), ...errors }, mutation.isPending || conflict)}
      {conflict ? (
        <div className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-4">
          <p role="alert" className="text-sm text-amber-950">Chaqiruv boshqa joyda yangilangan. Joriy holatni tekshiring.</p>
          <button
            type="button"
            className={secondaryButton}
            disabled={queryClient.isFetching({ queryKey: taskKeys.detail(task.id) }) > 0 || task.version === version}
            onClick={() => {
              setVersion(task.version)
              setConflict(false)
              mutation.reset()
            }}
          >
            Joriy holat bilan davom etish
          </button>
        </div>
      ) : mutation.error && <RequestError error={mutation.error} />}
      <div className="flex flex-wrap gap-3">
        <button type="submit" className={destructive ? 'mt-button mt-button-danger' : primaryButton} disabled={mutation.isPending || conflict}>
          {mutation.isPending ? 'Yuborilmoqda…' : submitLabel}
        </button>
        <button type="button" className={secondaryButton} onClick={cancel} disabled={mutation.isPending}>Bekor qilish</button>
      </div>
    </form>
  )
}
