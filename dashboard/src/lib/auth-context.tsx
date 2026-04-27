'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { login as apiLogin } from '@/lib/api'

interface AuthContextType {
  token: string | null
  isLoading: boolean
  login: (password: string) => Promise<boolean>
  logout: () => void
}

const AuthContext = createContext<AuthContextType>({
  token: null,
  isLoading: true,
  login: async () => false,
  logout: () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem('token')
    if (stored) setToken(stored)
    setIsLoading(false)
  }, [])

  const login = async (password: string): Promise<boolean> => {
    try {
      const res = await apiLogin(password)
      localStorage.setItem('token', res.token)
      setToken(res.token)
      return true
    } catch {
      return false
    }
  }

  const logout = () => {
    localStorage.removeItem('token')
    setToken(null)
    window.location.href = '/login'
  }

  return (
    <AuthContext.Provider value={{ token, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
