import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/(app)/kabinet/$role/chiqarish/yangi')({
  component: Outlet,
})
