import { createFileRoute } from '@tanstack/react-router'
import { BackendReadiness } from './-components/backend-readiness'

export const Route = createFileRoute('/(app)/(home)/')({
  component: BackendReadiness,
})
