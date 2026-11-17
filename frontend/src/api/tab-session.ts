const storageKey = 'medicinetrack-tab-id'
const lifetime = globalThis as typeof globalThis & {
  medicineTrackTab?: Promise<string>
}

function readSelector() {
  try {
    const value = sessionStorage.getItem(storageKey)
    if (value && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value)) return value
  } catch { /* Restricted storage: the tab can still use an in-memory session. */ }
  return crypto.randomUUID()
}
function rememberSelector(value: string) {
  try { sessionStorage.setItem(storageKey, value) } catch { /* Keep the in-memory selector. */ }
  return value
}

async function selectTab() {
  const candidate = readSelector()
  if (!navigator.locks) return rememberSelector(candidate)
  // A duplicated tab may inherit sessionStorage. A lifetime lease keeps it from
  // rotating another tab's cookie. Reloading releases the previous document's lease.
  async function claim(id: string): Promise<string | null> {
    return new Promise((resolve, reject) => {
      void navigator.locks.request('medicinetrack-tab:' + id, { ifAvailable: true }, async lock => {
        if (!lock) { resolve(null); return }
        resolve(id)
        await new Promise<void>(() => { /* Released when this document closes. */ })
      }).catch(reject)
    })
  }
  const claimed = await claim(candidate) || await claim(crypto.randomUUID())
  return rememberSelector(claimed || crypto.randomUUID())
}

export function tabSessionId() {
  // Persist only a random selector across reloads; no access/refresh tokens or passwords.
  // The global promise also survives Vite hot updates within the same document.
  lifetime.medicineTrackTab ??= selectTab()
  return lifetime.medicineTrackTab
}
