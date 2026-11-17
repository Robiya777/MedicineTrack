import {queryOptions} from '@tanstack/react-query'
import {z} from 'zod'
import {apiClient} from './client'
const notification=z.object({id:z.uuid(),task:z.uuid().nullable(),conversation:z.uuid().nullable(),event_type:z.string(),read_at:z.iso.datetime({offset:true}).nullable(),created_at:z.iso.datetime({offset:true})})
export const notificationKey=['notifications'] as const
export function notificationsQuery(){return queryOptions({queryKey:notificationKey,queryFn:async({signal})=>{const rows:z.infer<typeof notification>[]=[];for(let page=1;;page++){const result=await apiClient.get('/notifications',{signal,params:{page,page_size:100}});const data=z.object({results:z.array(notification),next:z.string().nullable()}).parse(result.data);rows.push(...data.results);if(!data.next)return rows}},refetchInterval:15000,retry:false})}
export async function readNotification(id:string){return notification.parse((await apiClient.post(`/notifications/${id}/read`,{},{headers:{'Idempotency-Key':crypto.randomUUID()}})).data)}
