import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, ClipboardList } from 'lucide-react'
import { getRouteApi, Link } from '@tanstack/react-router'
import { dischargeQuery } from '@/api/hospital'
import {
  Notice,
  iconButton,
  RequestError,
} from '@/components/ui'
import { DischargeSummary } from './discharge-summary'

const detailRoute = getRouteApi('/(app)/kabinet/$role/chiqarish/$dischargeId/')

export function DischargeDetail() {
  const { dischargeId } = detailRoute.useParams()
  const discharge = useQuery(dischargeQuery(dischargeId))

  return (
    <section className="space-y-6">
      <header className="flex items-center gap-3 border-b border-line pb-5">
        <Link to="/kabinet/$role/chiqarish" params={{role:'koordinator'}} className={iconButton + ' shrink-0'} aria-label="Chiqarishlarga qaytish" title="Chiqarishlarga qaytish"><ArrowLeft size={19} aria-hidden="true" /></Link>
        <div><h1 className="text-2xl font-semibold tracking-tight">Chiqarish tafsiloti</h1><p className="mt-1 flex items-center gap-1.5 text-xs text-muted"><ClipboardList size={14} aria-hidden="true" />Bemor, tavsiyalar va davolash rejasi</p></div>
      </header>
      {discharge.isPending && <Notice>Chiqarish yuklanmoqda…</Notice>}
      {discharge.isError && (
        <RequestError
          error={discharge.error}
          retry={() => void discharge.refetch()}
        />
      )}
      {discharge.data && (
        <DischargeSummary
          key={discharge.data.id}
          discharge={discharge.data}
        />
      )}
    </section>
  )
}
