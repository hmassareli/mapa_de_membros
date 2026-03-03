import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { ToastProvider } from './hooks/useToast'
import LoginPage from './pages/LoginPage'
import SetupPage from './pages/SetupPage'
import MainPage from './pages/MainPage'
import { api } from './lib/api'

function AuthGuard({ children }) {
  const [state, setState] = useState('loading')
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    let cancelled = false
    async function check() {
      try {
        const status = await api.authStatus()
        if (cancelled) return
        if (!status.configurado) {
          navigate('/setup', { replace: true })
          return
        }
        await api.authMe()
        if (cancelled) return
        setState('ok')
      } catch {
        if (!cancelled) navigate('/login', { replace: true })
      }
    }
    check()
    return () => { cancelled = true }
  }, [location.pathname])

  if (state === 'loading') return null
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/setup" element={<SetupPage />} />
          <Route
            path="/*"
            element={
              <AuthGuard>
                <MainPage />
              </AuthGuard>
            }
          />
        </Routes>
      </ToastProvider>
    </BrowserRouter>
  )
}
