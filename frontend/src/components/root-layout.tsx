import { Link, Outlet, useLocation } from '@tanstack/react-router'

export function RootLayout() {
  const pathname = useLocation({ select: (location) => location.pathname })

  if (pathname === '/login' || pathname === '/login/' || pathname.startsWith('/kabinet/')) {
    return <Outlet />
  }

  if ((import.meta.env.DEV || import.meta.env.VITE_ENABLE_DESIGN_PREVIEW === 'true') &&
      (pathname === '/design' || pathname.startsWith('/design/'))) {
    return <Outlet />
  }

  return (
    <>
      <header className="border-b border-line bg-white">
        <div className="mx-auto max-w-5xl px-5 py-5 sm:px-8">
          <Link to="/" className="rounded-sm text-lg font-semibold tracking-tight text-ink">
            MedicineTrack
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-5 py-12 sm:px-8 sm:py-20">
        <Outlet />
      </main>
    </>
  )
}

export function NotFoundPage() {
  return (
    <section className="grid justify-items-start gap-5">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Sahifa topilmadi</h1>
      <Link to="/" className="rounded-sm font-medium text-action underline underline-offset-4">
        Bosh sahifaga qaytish
      </Link>
    </section>
  )
}
