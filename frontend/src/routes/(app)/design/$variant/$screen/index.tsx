import { createFileRoute } from '@tanstack/react-router'
import { DesignPreview } from '../../-components/design-preview'

export const Route = createFileRoute('/(app)/design/$variant/$screen/')({
  component: DesignPreview,
})
