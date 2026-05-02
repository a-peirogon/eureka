import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GraduationCap, Mail, Lock, Eye, EyeOff } from 'lucide-react'
import { authApi } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'
import { Spinner } from '@/components/ui'

const DEMO_ROLES = ['estudiante', 'docente', 'admin'] as const

export default function Login() {
  const navigate = useNavigate()
  const setAuth = useAuthStore(s => s.setAuth)
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await authApi.login(email, password)
      setAuth(data.user, data.access_token, data.refresh_token)
      toast.success(`Bienvenido, ${data.user.full_name.split(' ')[0]}`)
      navigate('/dashboard')
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Credenciales incorrectas')
    } finally {
      setLoading(false)
    }
  }

  const demoLogin = (role: typeof DEMO_ROLES[number]) => {
    const creds = {
      admin:      { email: 'admin@eureka.edu.co',      password: 'Admin123!' },
      docente:    { email: 'docente@eureka.edu.co',    password: 'Admin123!' },
      estudiante: { email: 'estudiante@eureka.edu.co', password: 'Admin123!' },
    }
    setEmail(creds[role].email)
    setPassword(creds[role].password)
  }

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg)' }}>
      {/* ── Right panel — form ──────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center p-8"
           style={{ background: 'var(--bg)' }}>
        <div className="w-full max-w-sm">

          {/* Mobile header */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="w-9 h-9 flex items-center justify-center"
                 style={{ background: 'var(--primary)', border: '2px solid var(--nav-active)' }}>
              <GraduationCap size={18} style={{ color: 'var(--nav-active)' }} />
            </div>
            <span className="text-lg font-semibold" style={{ fontFamily: 'EB Garamond, Georgia, serif', color: 'var(--primary)' }}>
              Sistema Eureka ICFES
            </span>
          </div>

          {/* Heading */}
          <div className="mb-7 pb-4" style={{ borderBottom: '2px solid var(--border)' }}>
            <h2 className="text-3xl mb-1" style={{ fontFamily: 'EB Garamond, Georgia, serif', color: 'var(--primary)' }}>
              Inicio de sesión
            </h2>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Ingrese sus credenciales institucionales
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 px-3 py-2.5 text-sm mb-5"
                 style={{ background: 'var(--danger-light)', border: '1px solid #d4b8b8', color: 'var(--danger)', borderLeft: '4px solid var(--danger)' }}>
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Correo electrónico</label>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                      style={{ color: 'var(--text-subtle)' }} />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="input pl-9"
                  placeholder="correo@institución.edu.co"
                  required
                />
              </div>
            </div>

            <div>
              <label className="label">Contraseña</label>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                      style={{ color: 'var(--text-subtle)' }} />
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="input pl-9 pr-10"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center transition-colors"
                  style={{ color: 'var(--text-subtle)' }}>
                  {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center py-2 mt-1"
              style={{ letterSpacing: '0.04em' }}>
              {loading ? <Spinner size="sm" /> : null}
              {loading ? 'Verificando...' : 'Ingresar al sistema'}
            </button>
          </form>

          {/* Demo accounts */}
          <div className="mt-8">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
              <span className="text-xs font-semibold uppercase tracking-widest"
                    style={{ color: 'var(--text-subtle)' }}>
                Cuentas de demostración
              </span>
              <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              {DEMO_ROLES.map(role => (
                <button
                  key={role}
                  onClick={() => demoLogin(role)}
                  className="btn-secondary py-2 text-xs justify-center capitalize">
                  {role}
                </button>
              ))}
            </div>
            <p className="text-[11px] mt-2 text-center" style={{ color: 'var(--text-subtle)' }}>
              Haga clic para prellenar las credenciales
            </p>
          </div>

        </div>
      </div>
    </div>
  )
}
