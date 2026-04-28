import React, { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, BookOpen, FileText, BarChart3, Users,
  Upload, LogOut, Menu, X, ChevronRight, Bell, Zap,
  GraduationCap, Settings, CircleCheck
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { authApi } from '@/lib/api'
import clsx from 'clsx'

// ── Spinner ────────────────────────────────────────────────────────────────
export function Spinner({ size = 'md', className = '' }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const s = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-10 h-10' }[size]
  return (
    <div className={clsx('animate-spin rounded-full border-2 border-primary-200 border-t-primary-600', s, className)} />
  )
}

// ── Loading Page ────────────────────────────────────────────────────────────
export function LoadingPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-100">
      <div className="text-center">
        <Spinner size="lg" className="mx-auto mb-3" />
        <p className="text-sm text-stone-400 font-body">Cargando...</p>
      </div>
    </div>
  )
}

// ── Empty State ────────────────────────────────────────────────────────────
export function EmptyState({ icon, title, subtitle, action }: {
  icon?: React.ReactNode
  title: string
  subtitle?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-4">
      {icon && <div className="text-slate-300 mb-4">{icon}</div>}
      <h3 className="text-lg font-semibold text-slate-600 mb-1">{title}</h3>
      {subtitle && <p className="text-sm text-slate-400 mb-6 max-w-xs">{subtitle}</p>}
      {action}
    </div>
  )
}

// ── Area Badge ─────────────────────────────────────────────────────────────
const AREA_MAP: Record<string, { label: string; cls: string }> = {
  matematicas:          { label: 'Matemáticas',        cls: 'area-mat' },
  lectura_critica:      { label: 'Lectura Crítica',    cls: 'area-lc' },
  sociales_ciudadanas:  { label: 'Sociales',           cls: 'area-soc' },
  ciencias_naturales:   { label: 'Ciencias',           cls: 'area-cn' },
  ingles:               { label: 'Inglés',             cls: 'area-ing' },
}

export function AreaBadge({ area }: { area: string }) {
  const info = AREA_MAP[area] ?? { label: area, cls: 'badge-gray' }
  return <span className={clsx('badge text-xs', info.cls)}>{info.label}</span>
}

// ── Difficulty Badge ───────────────────────────────────────────────────────
const DIFF_COLORS: Record<string, string> = {
  '1': 'bg-emerald-100 text-emerald-700',
  '2': 'bg-blue-100 text-blue-700',
  '3': 'bg-amber-100 text-amber-700',
  '4': 'bg-orange-100 text-orange-700',
  '5': 'bg-red-100 text-red-700',
}
const DIFF_LABELS: Record<string, string> = {
  '1': 'Muy fácil', '2': 'Fácil', '3': 'Medio', '4': 'Difícil', '5': 'Muy difícil'
}

export function DifficultyBadge({ difficulty }: { difficulty: string }) {
  return (
    <span className={clsx('badge', DIFF_COLORS[difficulty] ?? 'badge-gray')}>
      {DIFF_LABELS[difficulty] ?? difficulty}
    </span>
  )
}

// ── Score Ring ─────────────────────────────────────────────────────────────
export function ScoreRing({ score, size = 80 }: { score: number; size?: number }) {
  const r = (size - 12) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (score / 100) * circ
  const color = score >= 70 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444'

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={8} />
      <circle
        cx={size/2} cy={size/2} r={r} fill="none"
        stroke={color} strokeWidth={8}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{ transition: 'stroke-dashoffset 0.5s ease' }}
      />
      <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle"
        fontSize={size * 0.22} fontWeight="700" fill="#1a1d2e">
        {score.toFixed(0)}%
      </text>
    </svg>
  )
}

// ── Progress Bar ───────────────────────────────────────────────────────────
export function ProgressBar({ value, max = 100, color = 'bg-primary-500', className = '' }: {
  value: number; max?: number; color?: string; className?: string
}) {
  const pct = Math.min(100, (value / max) * 100)
  return (
    <div className={clsx('progress-bar', className)}>
      <div className={clsx('progress-fill', color)} style={{ width: `${pct}%` }} />
    </div>
  )
}

// ── Modal ──────────────────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, size = 'md' }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl'
}) {
  if (!open) return null
  const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className={clsx('relative bg-stone-50 rounded-sm shadow-2xl w-full animate-slide-up border border-stone-300', widths[size])}>
        <div className="flex items-center justify-between px-6 py-4 border-b-2 border-stone-300 bg-stone-100">
          <h3 className="text-base font-display text-navy-900 tracking-tight">{title}</h3>
          <button onClick={onClose} className="btn-ghost p-1">
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

// ── Confirm Dialog ─────────────────────────────────────────────────────────
export function ConfirmDialog({ open, onClose, onConfirm, title, message, loading }: {
  open: boolean; onClose: () => void; onConfirm: () => void
  title: string; message: string; loading?: boolean
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <p className="text-slate-600 text-sm mb-6">{message}</p>
      <div className="flex gap-3 justify-end">
        <button className="btn-secondary" onClick={onClose} disabled={loading}>Cancelar</button>
        <button className="btn-danger" onClick={onConfirm} disabled={loading}>
          {loading ? <Spinner size="sm" /> : 'Confirmar'}
        </button>
      </div>
    </Modal>
  )
}

// ── Sidebar ────────────────────────────────────────────────────────────────
interface NavItem {
  to: string
  icon: React.ReactNode
  label: string
  roles: string[]
}

const NAV: NavItem[] = [
  { to: '/student/dashboard', icon: <LayoutDashboard size={18} />, label: 'Panel', roles: ['estudiante'] },
  { to: '/student/exams',     icon: <FileText size={18} />,        label: 'Simulacros', roles: ['estudiante'] },
  { to: '/student/results',   icon: <BarChart3 size={18} />,       label: 'Resultados', roles: ['estudiante'] },
  { to: '/teacher/dashboard', icon: <LayoutDashboard size={18} />, label: 'Dashboard', roles: ['docente', 'admin'] },
  { to: '/teacher/questions', icon: <BookOpen size={18} />,        label: 'Preguntas', roles: ['docente', 'admin'] },
  { to: '/teacher/exams',     icon: <FileText size={18} />,        label: 'Simulacros', roles: ['docente', 'admin'] },
  { to: '/teacher/courses',   icon: <GraduationCap size={18} />,   label: 'Cursos', roles: ['docente', 'admin'] },
  { to: '/teacher/import',    icon: <Upload size={18} />,          label: 'Importar / OCR', roles: ['docente', 'admin'] },
  { to: '/teacher/analytics', icon: <BarChart3 size={18} />,       label: 'Analítica', roles: ['docente', 'admin'] },
  { to: '/admin/users',       icon: <Users size={18} />,           label: 'Usuarios', roles: ['admin'] },
]

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, refresh_token, clearAuth } = useAuthStore()

  const visibleNav = NAV.filter((n) => user && n.roles.includes(user.role))

  const handleLogout = async () => {
    try {
      if (refresh_token) await authApi.logout(refresh_token)
    } catch {}
    clearAuth()
    navigate('/login')
  }

  return (
    <aside className={clsx(
      'fixed left-0 top-0 h-full bg-navy-900 text-white flex flex-col z-30',
      'transition-all duration-300 border-r border-navy-800',
      collapsed ? 'w-16' : 'w-60'
    )}>
      {/* Línea dorada decorativa */}
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gold-600" />

      {/* Logo */}
      <div className="h-16 flex items-center gap-3 px-4 border-b border-white/10 flex-shrink-0">
        <div className="w-8 h-8 border-2 border-gold-500 flex items-center justify-center flex-shrink-0">
          <GraduationCap size={16} className="text-gold-400" />
        </div>
        {!collapsed && (
          <span className="font-display text-base text-white tracking-wide">Eureka</span>
        )}
        <button onClick={onToggle} className="ml-auto text-white/40 hover:text-white transition-colors">
          {collapsed ? <ChevronRight size={15} /> : <Menu size={15} />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-5 px-2 space-y-0.5 overflow-y-auto">
        {!collapsed && (
          <p className="px-3 py-1 text-xs font-bold text-white/25 uppercase tracking-widest mb-3">
            {user?.role === 'estudiante' ? 'Estudiante' : user?.role === 'docente' ? 'Docente' : 'Admin'}
          </p>
        )}
        {visibleNav.map((item) => {
          const active = location.pathname === item.to || location.pathname.startsWith(item.to + '/')
          return (
            <Link
              key={item.to}
              to={item.to}
              title={collapsed ? item.label : undefined}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-all rounded-sm',
                active
                  ? 'bg-white/15 text-white border-l-2 border-gold-500 pl-2.5'
                  : 'text-white/55 hover:bg-white/8 hover:text-white/90 border-l-2 border-transparent pl-2.5'
              )}
            >
              <span className="flex-shrink-0 opacity-80">{item.icon}</span>
              {!collapsed && <span className="tracking-wide">{item.label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* User & logout */}
      <div className="border-t border-white/10 p-3">
        {!collapsed ? (
          <div className="flex items-center gap-3 p-2 hover:bg-white/8 cursor-pointer group rounded-sm">
            <div className="w-8 h-8 border border-gold-600 bg-navy-700 flex items-center justify-center text-xs font-bold flex-shrink-0 text-gold-400">
              {user?.full_name?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.full_name}</p>
              <p className="text-xs text-white/35 truncate">{user?.email}</p>
            </div>
            <button onClick={handleLogout} className="text-white/25 hover:text-red-400 transition-colors">
              <LogOut size={14} />
            </button>
          </div>
        ) : (
          <button
            onClick={handleLogout}
            title="Cerrar sesión"
            className="w-full flex justify-center text-white/35 hover:text-red-400 p-2 transition-colors"
          >
            <LogOut size={17} />
          </button>
        )}
      </div>
    </aside>
  )
}

// ── Top Header ─────────────────────────────────────────────────────────────
export function TopHeader({ title, subtitle, actions }: {
  title: string; subtitle?: string; actions?: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between mb-8">
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
    </div>
  )
}

// ── Stat Card ──────────────────────────────────────────────────────────────
export function StatCard({ icon, label, value, sub, iconBg = 'bg-primary-100', iconColor = 'text-primary-600' }: {
  icon: React.ReactNode; label: string; value: string | number; sub?: string
  iconBg?: string; iconColor?: string
}) {
  return (
    <div className="stat-card">
      <div className={clsx('stat-icon', iconBg, iconColor)}>{icon}</div>
      <div>
        <p className="stat-label">{label}</p>
        <p className="stat-value">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ── App Layout ─────────────────────────────────────────────────────────────
export function AppLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="min-h-screen bg-stone-100">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      <main
        className={clsx(
          'transition-all duration-300 min-h-screen',
          collapsed ? 'ml-16' : 'ml-60'
        )}
      >
        <div className="p-6 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  )
}

// ── Question Card ──────────────────────────────────────────────────────────
export function QuestionStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    borrador: 'badge-yellow',
    aprobado: 'badge-green',
    archivado: 'badge-gray',
  }
  const labels: Record<string, string> = {
    borrador: 'Borrador', aprobado: 'Aprobado', archivado: 'Archivado'
  }
  return <span className={clsx('badge', map[status] ?? 'badge-gray')}>{labels[status] ?? status}</span>
}

// ── Timer Display ──────────────────────────────────────────────────────────
export function TimerDisplay({ seconds, warn = false }: { seconds: number; warn?: boolean }) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  const fmt = (n: number) => String(n).padStart(2, '0')

  return (
    <span className={clsx(
      'font-mono font-bold text-lg tabular-nums',
      warn ? 'text-red-500 animate-pulse-soft' : 'text-navy-900'
    )}>
      {h > 0 ? `${fmt(h)}:` : ''}{fmt(m)}:{fmt(s)}
    </span>
  )
}

// ── Alert ──────────────────────────────────────────────────────────────────
export function Alert({ type = 'info', title, message }: {
  type?: 'info' | 'success' | 'warn' | 'error'; title?: string; message: string
}) {
  const styles = {
    info:    'bg-blue-50 border-blue-200 text-blue-800',
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    warn:    'bg-amber-50 border-amber-200 text-amber-800',
    error:   'bg-red-50 border-red-200 text-red-800',
  }
  return (
    <div className={clsx('border rounded-xl p-4 text-sm', styles[type])}>
      {title && <p className="font-semibold mb-0.5">{title}</p>}
      <p>{message}</p>
    </div>
  )
}
