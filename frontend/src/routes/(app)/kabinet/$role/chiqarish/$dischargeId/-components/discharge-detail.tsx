import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { dischargeQuery } from '../../../../../../../api/hospital'
import {
  Notice,
  PageHeader,
  RequestError,
} from '../../../../../../../components/ui'
import { DischargeSummary } from './discharge-summary'

const detailRoute = getRouteApi('/(app)/kabinet/$role/chiqarish/$dischargeId/')

export function DischargeDetail() {
  const { dischargeId } = detailRoute.useParams()
  const discharge = useQuery(dischargeQuery(dischargeId))

  return (
    <section className="max-w-4xl space-y-6">
      <PageHeader
        title="Chiqarish tafsiloti"
        backTo={{
          to: '/kabinet/$role',
          params: { role: 'statsionar' },
          label: 'Chiqarishlarga qaytish',
        }}
      />
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
