import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { z } from 'zod'
import { apiClient } from '@/api/client'
import { messagingKeys, teamDoctorSchema } from '@/api/messaging'
import { useIdempotentMutation } from '@/hooks/use-idempotent-mutation'
import { Dialog, Field, Notice, RequestError, inputStyle, primaryButton, secondaryButton } from '@/components/ui'

const teamSchema = z.object({ members: z.array(teamDoctorSchema), available: z.array(teamDoctorSchema), can_manage: z.boolean() })
type Change = { doctor: string; action: 'ADD' | 'REMOVE' }

export function ChatTeam({ patientId }: { patientId: string }) {
  const [open, setOpen] = useState(false)
  return <><button type="button" className={secondaryButton} onClick={() => setOpen(true)}>Chat jamoasi</button>{open && <TeamDialog patientId={patientId} close={() => setOpen(false)} />}</>
}
function TeamDialog({ patientId, close }: { patientId: string; close: () => void }) {
  const client = useQueryClient()
  const [doctor, setDoctor] = useState('')
  const team = useQuery({
    queryKey: ['messaging', 'team', patientId], retry: false,
    queryFn: async ({ signal }) => teamSchema.parse((await apiClient.get(`/patients/${patientId}/chat-doctors`, { signal })).data),
  })
  const mutation = useIdempotentMutation(async (input: Change, key) => teamSchema.parse((await apiClient.post(`/patients/${patientId}/chat-doctors`, input, { headers: { 'Idempotency-Key': key } })).data), {
    onSuccess: async () => { setDoctor(''); await client.invalidateQueries({ queryKey: messagingKeys.all }) },
  })
  return <Dialog title="Bemorning chat jamoasi" close={close} pending={mutation.isPending} scrollBody>
    <p className="text-sm text-muted">Qo‘shilgan shifokor bemorning umumiy chatida qatnashadi. Patronaj va dori jadvali vakolatlari alohida saqlanadi.</p>
    {team.isPending && <Notice>Jamoa yuklanmoqda…</Notice>}
    {team.error && <RequestError error={team.error} retry={() => void team.refetch()} />}
    {team.data?.members.map((member) => <div key={member.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-line py-3"><div><p className="font-semibold">{member.name}</p><p className="text-xs text-muted">{member.primary ? 'Mas’ul shifokor' : 'Chat shifokori'} · {member.online ? 'Onlayn' : 'Oflayn'}</p></div>{team.data?.can_manage && !member.primary && <button type="button" className={secondaryButton} disabled={mutation.isPending} onClick={() => mutation.mutate({ doctor: member.id, action: 'REMOVE' })}>Chatdan chiqarish</button>}</div>)}
    {team.data?.can_manage && <div className="space-y-3"><Field label="Shifokorni tanlang">{(a) => <select {...a} className={inputStyle} value={doctor} onChange={(event) => setDoctor(event.target.value)} disabled={mutation.isPending}><option value="">Shifokor tanlang</option>{team.data.available.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select>}</Field><button type="button" className={primaryButton} disabled={!doctor || mutation.isPending} onClick={() => mutation.mutate({ doctor, action: 'ADD' })}>Shifokorni chatga qo‘shish</button></div>}
    {mutation.error && <RequestError error={mutation.error} />}
  </Dialog>
}
