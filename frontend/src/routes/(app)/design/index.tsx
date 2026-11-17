import { createFileRoute } from '@tanstack/react-router'
import { DesignGallery } from './-components/design-gallery'

export const Route = createFileRoute('/(app)/design/')({
  component: DesignGallery,
})
