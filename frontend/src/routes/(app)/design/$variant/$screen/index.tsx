import { createFileRoute } from '@tanstack/react-router'
import { DesignPreview } from '@/routes/(app)/design/-components/design-preview'

export const Route = createFileRoute('/(app)/design/$variant/$screen/')({
  component: DesignPreview,
})
