import { ConfigProvider, notification } from 'antd'
import { LoaderCircle } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { feedbackEvent, type ActionFeedback } from '@/api/action-feedback'

function NotificationOutlet({children}: {children: ReactNode}) {
  const [api, holder] = notification.useNotification({placement:'topRight',stack:{threshold:3},maxCount:3})
  useEffect(()=> {
    const listener = (event: Event) => {
      const value = (event as CustomEvent<ActionFeedback>).detail
      if(value.state==='close') {api.destroy(value.key);return}
      const options = {key:value.key,title:value.title,description:value.description,duration:value.state==='loading'?0:value.state==='error'?5:3}
      if(value.state==='loading') api.open({...options,icon:<LoaderCircle size={22} className="motion-safe:animate-spin text-primary" aria-hidden="true" />})
      else api[value.state](options)
    }
    window.addEventListener(feedbackEvent,listener)
    return ()=>window.removeEventListener(feedbackEvent,listener)
  },[api])
  return <>{holder}{children}</>
}
export function ActionNotifications({children}: {children: ReactNode}) {
  return <ConfigProvider theme={{token:{colorPrimary:'#0f766e',colorSuccess:'#0f766e',colorInfo:'#245a94',colorWarning:'#92400e',colorError:'#b42318',colorText:'#18332f',colorTextSecondary:'#52645e',colorBgElevated:'#ffffff',borderRadius:14,fontFamily:"'DM Sans Variable', sans-serif"},components:{Notification:{width:360}}}}><NotificationOutlet>{children}</NotificationOutlet></ConfigProvider>
}
