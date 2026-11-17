import { createFileRoute } from '@tanstack/react-router'
import { TaskDetail } from './-components/task-detail'

export const Route = createFileRoute('/(app)/kabinet/$role/chaqiruv/$taskId/')({
  component: TaskDetail,
})
