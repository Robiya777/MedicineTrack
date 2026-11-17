import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { signOut } from '../api/session'

export function useLogout() {
  const navigate = useNavigate()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  async function handleLogout() {
    setPending(true)
    setError('')
    try {
      await signOut()
      await navigate({ to: '/login', search: {}, replace: true })
    } catch {
      setError('Chiqish amalga oshmadi. Ulanishni tekshirib, qayta urinib ko‘ring.')
    } finally {
      setPending(false)
    }
  }

  return { handleLogout, pending, error }
}
