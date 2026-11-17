import { Link } from '@tanstack/react-router'
import { BackendReadiness } from './backend-readiness'

export function HomePage() {
  return (
    <div className="space-y-8">
      <Link
        to="/login"
        search={{}}
        className="inline-flex min-h-11 items-center rounded-lg bg-action px-4 font-medium text-white"
      >
        Kabinetga kirish
      </Link>
      <BackendReadiness />
    </div>
  )
}
