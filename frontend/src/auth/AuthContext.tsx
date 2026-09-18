import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { CurrentUser } from './types'

type AuthState = {
  user: CurrentUser | null
  loading: boolean
  error: string | null
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadCurrentUser = useCallback(async () => {
    try {
      const response = await fetch('/auth/me', { credentials: 'same-origin' })
      if (response.ok) {
        setUser(await response.json())
      } else {
        setUser(null)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadCurrentUser()
  }, [loadCurrentUser])

  const login = useCallback(async (email: string, password: string) => {
    setError(null)
    const response = await fetch('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ email, password }),
    })

    if (!response.ok) {
      const body = await response.json().catch(() => ({ error: 'Falha ao entrar.' }))
      setError(body.error ?? 'Falha ao entrar.')
      return
    }

    setUser(await response.json())
  }, [])

  const logout = useCallback(async () => {
    await fetch('/auth/logout', { method: 'POST', credentials: 'same-origin' })
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, error, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider')
  }
  return context
}
