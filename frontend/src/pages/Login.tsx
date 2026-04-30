import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GraduationCap, Mail, Lock, Eye, EyeOff, ArrowRight, Sparkles } from 'lucide-react'
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
      toast.success(`¡Bienvenido, ${data.user.full_name.split(' ')[0]}!`)
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
    <div className="min-h-screen flex" style={{ background: '#f0f4f9' }}>
      {/* ── Left panel ──────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-5/12 xl:w-1/2 relative overflow-hidden flex-col items-center justify-center p-12"
           style={{ background: 'linear-gradient(145deg, #0f172a 0%, #1e3a8a 60%, #1d4ed8 100%)' }}>

        {/* Background decoration */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[-10%] right-[-10%] w-80 h-80 rounded-full opacity-10"
               style={{ background: 'radial-gradient(circle, #60a5fa, transparent)' }} />
          <div className="absolute bottom-[-5%] left-[-8%] w-96 h-96 rounded-full opacity-10"
               style={{ background: 'radial-gradient(circle, #818cf8, transparent)' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-[.04]"
               style={{ border: '1px solid #ffffff' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full opacity-[.06]"
               style={{ border: '1px solid #ffffff' }} />
        </div>

        {/* Content */}
        <div className="relative z-10 max-w-sm text-center">
          <div className="w-20 h-20 mx-auto mb-8 rounded-3xl flex items-center justify-center"
               style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)', boxShadow: '0 0 40px rgba(99,102,241,.4)' }}>
            <GraduationCap size={36} className="text-white" />
          </div>
          <h1 className="text-4xl text-white mb-4" style={{ fontFamily: '"DM Serif Display", Georgia, serif' }}>
            Eureka ICFES
          </h1>
          <p className="text-blue-200 text-base leading-relaxed mb-10">
            Plataforma de preparación para el ICFES con simulacros adaptativos, analítica de rendimiento e IA.
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-2 justify-center">
            {['Simulacros adaptativos', 'IA generativa', 'Analítica en tiempo real'].map(f => (
              <span key={f} className="px-3 py-1.5 rounded-full text-xs font-medium text-blue-100"
                    style={{ background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.12)' }}>
                {f}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right panel — form ──────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-10 bg-white">
        <div className="w-full max-w-md">

          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-10 lg:hidden">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
                 style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}>
              <GraduationCap size={20} className="text-white" />
            </div>
            <span className="text-xl text-slate-900" style={{ fontFamily: '"DM Serif Display", Georgia, serif' }}>
              Eureka ICFES
            </span>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h2 className="text-3xl text-slate-900 mb-2" style={{ fontFamily: '"DM Serif Display", Georgia, serif' }}>
              Bienvenido de nuevo
            </h2>
            <p className="text-slate-500 text-sm">Ingresa a tu cuenta institucional para continuar</p>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl text-sm mb-6">
              <span className="flex-1">{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label">Correo electrónico</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="input pl-10"
                  placeholder="correo@institución.edu.co"
                  required
                />
              </div>
            </div>

            <div>
              <label className="label">Contraseña</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="input pl-10 pr-11"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
                >
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center py-3 text-sm mt-2"
            >
              {loading ? <Spinner size="sm" /> : <ArrowRight size={16} />}
              {loading ? 'Ingresando...' : 'Ingresar a mi cuenta'}
            </button>
          </form>

          {/* Demo accounts */}
          <div className="mt-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-slate-200" />
              <span className="flex items-center gap-1.5 text-xs text-slate-400 font-semibold uppercase tracking-widest whitespace-nowrap">
                <Sparkles size={12} /> Cuentas demo
              </span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>

            <div className="grid grid-cols-3 gap-2">
              {DEMO_ROLES.map(role => (
                <button
                  key={role}
                  onClick={() => demoLogin(role)}
                  className="px-3 py-2.5 text-xs font-semibold rounded-2xl border border-slate-200 text-slate-600
                             hover:border-blue-300 hover:text-blue-700 hover:bg-blue-50 transition-all capitalize"
                  style={{ boxShadow: '0 1px 2px rgba(0,0,0,.05)' }}
                >
                  {role}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-400 mt-2.5 text-center">
              Clic para prellenar credenciales de prueba
            </p>
          </div>

        </div>
      </div>
    </div>
  )
}
