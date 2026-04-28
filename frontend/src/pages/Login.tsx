import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GraduationCap, Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react'
import { authApi } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'
import { Spinner } from '@/components/ui'

export default function Login() {
  const navigate = useNavigate()
  const setAuth = useAuthStore(s => s.setAuth)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await authApi.login(email, password)
      setAuth(data.user, data.access_token, data.refresh_token)
      toast.success(`¡Bienvenido, ${data.user.full_name.split(' ')[0]}!`)
      navigate('/dashboard')
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Credenciales incorrectas'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const demoLogin = (role: 'admin' | 'docente' | 'estudiante') => {
    const creds = {
      admin:      { email: 'admin@eureka.edu.co',      password: 'Admin123!' },
      docente:    { email: 'docente@eureka.edu.co',    password: 'Admin123!' },
      estudiante: { email: 'estudiante@eureka.edu.co', password: 'Admin123!' },
    }
    setEmail(creds[role].email)
    setPassword(creds[role].password)
  }

  return (
    <div className="min-h-screen flex">
      {/* Panel derecho — formulario */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-stone-50">
        <div className="w-full max-w-md">

          {/* Logo móvil */}
          <div className="flex items-center gap-3 mb-10 lg:hidden">
            <div className="w-9 h-9 border-2 border-navy-700 flex items-center justify-center">
              <GraduationCap size={18} className="text-navy-800" />
            </div>
            <span className="font-display text-xl text-navy-900">Eureka ICFES</span>
          </div>

          <div className="mb-8">
            <h1 className="font-display text-3xl text-navy-900 mb-1">Iniciar sesión</h1>
            <div className="w-12 h-0.5 bg-gold-600 mt-2 mb-4" />
            <p className="text-stone-500 text-sm">Ingresa a tu cuenta institucional para continuar</p>
          </div>

          {error && (
            <div className="bg-red-50 border-l-4 border-red-700 text-red-800 px-4 py-3 text-sm mb-6">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label">Correo electrónico</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
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
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                >
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5 mt-2">
              {loading ? <Spinner size="sm" /> : <ArrowRight size={15} />}
              {loading ? 'Ingresando...' : 'Ingresar'}
            </button>
          </form>

          {/* Demo logins */}
          <div className="mt-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-stone-300" />
              <span className="text-xs text-stone-400 font-semibold uppercase tracking-widest">Cuentas demo</span>
              <div className="flex-1 h-px bg-stone-300" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(['estudiante', 'docente', 'admin'] as const).map(role => (
                <button
                  key={role}
                  onClick={() => demoLogin(role)}
                  className="px-3 py-2 text-xs font-semibold rounded-sm border border-stone-300 text-stone-600
                             hover:border-navy-600 hover:text-navy-700 hover:bg-stone-100 transition-all capitalize tracking-wide"
                >
                  {role}
                </button>
              ))}
            </div>
            <p className="text-xs text-stone-400 mt-2 text-center">Clic para prellenar credenciales de prueba</p>
          </div>

        </div>
      </div>
    </div>
  )
}
