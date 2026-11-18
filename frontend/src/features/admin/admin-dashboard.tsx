import {useState} from 'react'
import {useQuery,useQueryClient} from '@tanstack/react-query'
import {accountsQuery,adminOrganizationsQuery,adminTerritoriesQuery,adminKeys,type Account,type Organization,type Territory} from '@/api/admin'
import {Field,inputStyle,primaryButton,secondaryButton,Notice,RequestError} from '@/components/ui'
import {AccountEditor} from './account-editor'
import {OrganizationEditor,TerritoryEditor} from './reference-editors'
import {roleLabels} from './labels'
type Editor =
  | { kind: 'account'; value: Account | null }
  | { kind: 'organization'; value: Organization | null }
  | { kind: 'territory'; value: Territory | null }
export function AdminDashboard() {
  const [tab, setTab] = useState<'account' | 'organization' | 'territory'>(
      'account',
    ),
    [editor, setEditor] = useState<Editor | null>(null),
    [search, setSearch] = useState(''),
    accounts = useQuery(accountsQuery()),
    organizations = useQuery(adminOrganizationsQuery()),
    territories = useQuery(adminTerritoriesQuery()),
    client = useQueryClient()
  async function saved() {
    await Promise.all([
      client.invalidateQueries({ queryKey: adminKeys }),
      client.invalidateQueries({ queryKey: ['hospital', 'territories'] }),
      client.invalidateQueries({ queryKey: ['care', 'doctors'] }),
      client.invalidateQueries({ queryKey: ['care', 'organizations'] }),
    ])
    setEditor(null)
  }
  const names = new Map(organizations.data?.map((o) => [o.id, o.name])),
    territoryNames = new Map(territories.data?.map((t) => [t.id, t.name]))
  const current =
    tab === 'account'
      ? accounts
      : tab === 'organization'
        ? organizations
        : territories
  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Texnik boshqaruv</h1>
          <p className="mt-2 text-sm text-muted">
            Xodim akkauntlari, klinik ruxsatlar va muassasa/hudud
            ma’lumotnomalari.
          </p>
        </div>
        <button
          type="button"
          className={secondaryButton}
          onClick={() => void current.refetch()}
          disabled={current.isFetching}
        >
          Yangilash
        </button>
      </div>
      <div
        className="flex flex-wrap gap-3"
        role="group"
        aria-label="Boshqaruv bo‘limi"
      >
        {(
          [
            ['account', 'Xodimlar'],
            ['organization', 'Muassasalar'],
            ['territory', 'Hududlar'],
          ] as const
        ).map(([value, label]) => (
          <button
            type="button"
            key={value}
            disabled={Boolean(editor)}
            className={tab === value ? primaryButton : secondaryButton}
            aria-pressed={tab === value}
            onClick={() => {
              setTab(value)
              setSearch('')
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {editor?.kind === 'account' && (
        <AccountEditor
          initial={editor.value}
          organizations={organizations.data || []}
          close={() => setEditor(null)}
          saved={saved}
        />
      )}
      {editor?.kind === 'organization' && (
        <OrganizationEditor
          initial={editor.value}
          territories={territories.data || []}
          close={() => setEditor(null)}
          saved={saved}
        />
      )}
      {editor?.kind === 'territory' && (
        <TerritoryEditor
          initial={editor.value}
          territories={territories.data || []}
          close={() => setEditor(null)}
          saved={saved}
        />
      )}
      {!editor && (
        <div className="flex flex-wrap items-end gap-4">
          <Field label="Ro‘yxatdan qidirish">
            {(a) => (
              <input
                {...a}
                className={inputStyle}
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            )}
          </Field>
          <button
            type="button"
            className={primaryButton}
            disabled={current.isPending || current.isError}
            onClick={() =>
              setEditor(
                tab === 'account'
                  ? { kind: 'account', value: null }
                  : tab === 'organization'
                    ? { kind: 'organization', value: null }
                    : { kind: 'territory', value: null },
              )
            }
          >
            {tab === 'account'
              ? 'Yangi xodim'
              : tab === 'organization'
                ? 'Yangi muassasa'
                : 'Yangi hudud'}
          </button>
        </div>
      )}
      {current.isPending && <Notice>Ma’lumotlar yuklanmoqda…</Notice>}
      {current.isError && (
        <RequestError
          error={current.error}
          retry={() => void current.refetch()}
        />
      )}
      {!current.isError && (
        <ul
          className="grid gap-4 lg:grid-cols-2"
          aria-label="Boshqaruv ro‘yxati"
        >
          {tab === 'account' &&
            accounts.data
              ?.filter((a) =>
                (a.username + ' ' + a.first_name + ' ' + a.last_name)
                  .toLocaleLowerCase()
                  .includes(search.toLocaleLowerCase()),
              )
              .map((account) => (
                <li key={account.id} className="mt-card space-y-3 p-5">
                  <h2 className="wrap-break-word text-lg font-semibold">
                    {[account.first_name, account.last_name]
                      .filter(Boolean)
                      .join(' ') || account.username}
                  </h2>
                  <p className="text-sm text-muted">
                    Login: {account.username}
                  </p>
                  <p>
                    {roleLabels[account.role]} ·{' '}
                    {account.is_active ? 'Faol' : 'Faol emas'}
                  </p>
                  <p className="text-sm">
                    Muassasa:{' '}
                    {account.organization
                      ? names.get(account.organization) || account.organization
                      : '—'}
                  </p>
                  {account.role === 'DOCTOR' && (
                    <p className="text-sm">
                      Klinik tasdiq:{' '}
                      {account.can_approve_medication_schedule
                        ? 'Ruxsat berilgan'
                        : 'Ruxsat berilmagan'}
                    </p>
                  )}
                  <button
                    type="button"
                    className={secondaryButton}
                    disabled={Boolean(editor)}
                    onClick={() =>
                      setEditor({ kind: 'account', value: account })
                    }
                  >
                    Xodimni tahrirlash
                  </button>
                </li>
              ))}
          {tab === 'organization' &&
            organizations.data
              ?.filter((o) =>
                o.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
              )
              .map((org) => (
                <li key={org.id} className="mt-card space-y-3 p-5">
                  <h2 className="wrap-break-word text-lg font-semibold">
                    {org.name}
                  </h2>
                  <p>
                    {org.type === 'HOSPITAL' ? 'Statsionar' : 'Poliklinika'} ·{' '}
                    {org.active ? 'Faol' : 'Faol emas'}
                  </p>
                  <p className="text-sm">
                    Hudud: {territoryNames.get(org.territory) || org.territory}
                  </p>
                  <button
                    className={secondaryButton}
                    disabled={Boolean(editor)}
                    onClick={() =>
                      setEditor({ kind: 'organization', value: org })
                    }
                  >
                    Muassasani tahrirlash
                  </button>
                </li>
              ))}
          {tab === 'territory' &&
            territories.data
              ?.filter((t) =>
                t.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
              )
              .map((territory) => (
                <li key={territory.id} className="mt-card space-y-3 p-5">
                  <h2 className="wrap-break-word text-lg font-semibold">
                    {territory.name}
                  </h2>
                  <p className="text-sm">
                    Yuqori hudud:{' '}
                    {territory.parent
                      ? territoryNames.get(territory.parent) || territory.parent
                      : '—'}
                  </p>
                  <button
                    className={secondaryButton}
                    disabled={Boolean(editor)}
                    onClick={() =>
                      setEditor({ kind: 'territory', value: territory })
                    }
                  >
                    Hududni tahrirlash
                  </button>
                </li>
              ))}
        </ul>
      )}
      {current.isSuccess && current.data?.length === 0 && (
        <Notice>Yozuvlar hali yo‘q.</Notice>
      )}
    </section>
  )
}
