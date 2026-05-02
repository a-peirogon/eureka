import React, { useState, useRef, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, BookOpen, FileText, BarChart3, Users,
  Upload, LogOut, GraduationCap, ChevronDown, Menu, X
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { authApi } from '@/lib/api'
import clsx from 'clsx'

// ── Spinner ────────────────────────────────────────────────────────────────
export function Spinner({ size = 'md', className = '' }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const s = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-10 h-10' }[size]
  return (
    <div className={clsx('animate-spin border-2', s, className)}
         style={{ borderColor: 'var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%' }} />
  )
}

// ── Loading Page ────────────────────────────────────────────────────────────
export function LoadingPage() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center">
        <Spinner size="md" className="mx-auto mb-3" />
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Cargando...</p>
      </div>
    </div>
  )
}

// ── Empty State ────────────────────────────────────────────────────────────
export function EmptyState({ icon, title, subtitle, action }: {
  icon?: React.ReactNode; title: string; subtitle?: string; action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-4">
      {icon && (
        <div className="w-14 h-14 flex items-center justify-center mb-4"
             style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-subtle)' }}>
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--text)' }}>{title}</h3>
      {subtitle && <p className="text-sm mb-6 max-w-xs" style={{ color: 'var(--text-subtle)' }}>{subtitle}</p>}
      {action}
    </div>
  )
}

// ── Area Badge ─────────────────────────────────────────────────────────────
const AREA_MAP: Record<string, { label: string; cls: string }> = {
  matematicas:         { label: 'Matemáticas',     cls: 'area-mat' },
  lectura_critica:     { label: 'Lectura Crítica', cls: 'area-lc'  },
  sociales_ciudadanas: { label: 'Sociales',        cls: 'area-soc' },
  ciencias_naturales:  { label: 'Ciencias',        cls: 'area-cn'  },
  ingles:              { label: 'Inglés',          cls: 'area-ing' },
}
export function AreaBadge({ area }: { area: string }) {
  const info = AREA_MAP[area] ?? { label: area, cls: 'badge-gray' }
  return <span className={clsx('badge text-xs', info.cls)}>{info.label}</span>
}

// ── Difficulty Badge ───────────────────────────────────────────────────────
const DIFF_COLORS: Record<string, string> = {
  '1': 'badge-green', '2': 'badge-blue',
  '3': 'badge-yellow', '4': 'badge-red',
  '5': 'badge-red',
}
const DIFF_LABELS: Record<string, string> = {
  '1': 'Muy fácil', '2': 'Fácil', '3': 'Medio', '4': 'Difícil', '5': 'Muy difícil'
}
export function DifficultyBadge({ difficulty }: { difficulty: string }) {
  return <span className={clsx('badge', DIFF_COLORS[difficulty] ?? 'badge-gray')}>{DIFF_LABELS[difficulty] ?? difficulty}</span>
}

// ── Score Ring ─────────────────────────────────────────────────────────────
export function ScoreRing({ score, size = 80 }: { score: number; size?: number }) {
  const r = (size - 12) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (score / 100) * circ
  const color = score >= 70 ? '#2d5a3d' : score >= 50 ? '#8b6914' : '#7a1f1f'
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#ede9df" strokeWidth={8} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={8}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="square"
        transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{ transition: 'stroke-dashoffset 0.7s ease' }} />
      <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle"
        fontSize={size * 0.21} fontWeight="700" fill="#1a1712">{score.toFixed(0)}%</text>
    </svg>
  )
}

// ── Progress Bar ───────────────────────────────────────────────────────────
export function ProgressBar({ value, max = 100, color = 'bg-blue-600', className = '' }: {
  value: number; max?: number; color?: string; className?: string
}) {
  const pct = Math.min(100, (value / max) * 100)
  return (
    <div className={clsx('progress-bar', className)}>
      <div className={clsx('progress-fill', color)} style={{ width: `${pct}%`, background: 'var(--primary)' }} />
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
      <div className="modal-overlay absolute inset-0" style={{ background: 'rgba(10,8,6,0.6)' }} onClick={onClose} />
      <div className={clsx('modal-panel relative w-full overflow-hidden', widths[size])}
           style={{ background: 'var(--surface)', border: '1px solid var(--border-strong)', boxShadow: '4px 4px 0 rgba(0,0,0,0.2)' }}>
        {/* Modal header — classic horizontal rule style */}
        <div className="flex items-center justify-between px-5 py-3"
             style={{ background: 'var(--primary)', borderBottom: '2px solid var(--primary-dark)' }}>
          <h3 className="text-base font-semibold text-white" style={{ fontFamily: 'EB Garamond, Georgia, serif', letterSpacing: '0.02em' }}>{title}</h3>
          <button onClick={onClose}
            className="w-7 h-7 flex items-center justify-center text-white/70 hover:text-white transition-colors">
            <X size={15} />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
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
      <p className="text-sm mb-5 leading-relaxed" style={{ color: 'var(--text-muted)' }}>{message}</p>
      <div className="flex gap-2 justify-end">
        <button className="btn-secondary" onClick={onClose} disabled={loading}>Cancelar</button>
        <button className="btn-danger" onClick={onConfirm} disabled={loading}>
          {loading ? <Spinner size="sm" /> : 'Confirmar'}
        </button>
      </div>
    </Modal>
  )
}

// ── Nav items ──────────────────────────────────────────────────────────────
interface NavItem { to: string; icon: React.ReactNode; label: string; roles: string[] }

const NAV: NavItem[] = [
  { to: '/student/dashboard', icon: <LayoutDashboard size={14} />, label: 'Panel',          roles: ['estudiante'] },
  { to: '/student/exams',     icon: <FileText size={14} />,        label: 'Simulacros',     roles: ['estudiante'] },
  { to: '/student/results',   icon: <BarChart3 size={14} />,       label: 'Resultados',     roles: ['estudiante'] },
  { to: '/teacher/dashboard', icon: <LayoutDashboard size={14} />, label: 'Dashboard',      roles: ['docente', 'admin'] },
  { to: '/teacher/questions', icon: <BookOpen size={14} />,        label: 'Preguntas',      roles: ['docente', 'admin'] },
  { to: '/teacher/exams',     icon: <FileText size={14} />,        label: 'Simulacros',     roles: ['docente', 'admin'] },
  { to: '/teacher/courses',   icon: <GraduationCap size={14} />,   label: 'Cursos',         roles: ['docente', 'admin'] },
  { to: '/teacher/import',    icon: <Upload size={14} />,          label: 'Importar / OCR', roles: ['docente', 'admin'] },
  { to: '/teacher/analytics', icon: <BarChart3 size={14} />,       label: 'Analítica',      roles: ['docente', 'admin'] },
  { to: '/admin/users',       icon: <Users size={14} />,           label: 'Usuarios',       roles: ['admin'] },
]

// ── Top Navbar ─────────────────────────────────────────────────────────────
function TopNavbar() {
  const location   = useLocation()
  const navigate   = useNavigate()
  const { user, refresh_token, clearAuth } = useAuthStore()
  const [menuOpen,    setMenuOpen]    = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userRef = useRef<HTMLDivElement>(null)

  const visibleNav = NAV.filter(n => user && n.roles.includes(user.role))

  const handleLogout = async () => {
    try { if (refresh_token) await authApi.logout(refresh_token) } catch {}
    clearAuth()
    navigate('/login')
  }

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (userRef.current && !userRef.current.contains(e.target as Node)) setUserMenuOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  return (
    <header className="fixed top-0 left-0 right-0 z-30">
      <div className="max-w-6xl mx-auto" style={{ background: 'var(--nav-bg)', borderBottom: '3px solid var(--nav-active)' }}>
      {/* Institution banner */}
      <div className="hidden md:block text-xs"
           style={{ background: 'var(--primary-dark)', borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'rgba(216,228,240,0.7)' }}>
        <div className="px-4 py-1.5 flex items-center">
          <GraduationCap size={11} className="mr-1.5 opacity-70" />
          Sistema de Preparación ICFES — Eureka
          <div className="ml-auto flex items-center gap-3">
            {user && (
              <span style={{ color: 'var(--nav-active)' }}>
                {user.full_name}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main nav */}
      <div className="px-4 h-10 flex items-center gap-1">
        {/* Desktop nav links */}
        <nav className="hidden md:flex items-stretch h-full flex-1">
          {visibleNav.map(item => {
            const active = location.pathname === item.to || location.pathname.startsWith(item.to + '/')
            return (
              <Link key={item.to} to={item.to}
                className={clsx(
                  'flex items-center gap-1.5 px-3 h-full text-[13px] font-medium transition-colors duration-100 border-b-2',
                  active
                    ? 'border-[var(--nav-active)] text-white'
                    : 'border-transparent text-[var(--nav-text)] opacity-80 hover:opacity-100 hover:text-white'
                )}
                style={active ? { color: 'white' } : {}}
              >
                <span className="opacity-60">{item.icon}</span>
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* User menu */}
        <div className="ml-auto flex items-center gap-2">
          <div ref={userRef} className="relative hidden md:block">
            <button
              onClick={() => setUserMenuOpen(v => !v)}
              className="flex items-center gap-2 px-3 py-1 text-[13px] font-medium transition-colors"
              style={{ color: 'var(--nav-text)', border: '1px solid rgba(255,255,255,0.15)' }}>
              <div className="w-5 h-5 flex items-center justify-center text-[11px] font-bold"
                   style={{ background: 'var(--nav-active)', color: 'white' }}>
                {user?.full_name?.charAt(0).toUpperCase()}
              </div>
              <span className="max-w-[100px] truncate">{user?.full_name?.split(' ')[0]}</span>
              <ChevronDown size={12} className={clsx('opacity-60 transition-transform duration-150', userMenuOpen && 'rotate-180')} />
            </button>

            {userMenuOpen && (
              <div className="absolute right-0 top-full mt-0 w-52 animate-in"
                   style={{ background: 'var(--surface)', border: '1px solid var(--border-strong)', boxShadow: '3px 3px 0 rgba(0,0,0,0.15)', zIndex: 100 }}>
                <div className="px-4 py-2.5" style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                  <p className="text-xs font-semibold truncate" style={{ color: 'var(--text)' }}>{user?.full_name}</p>
                  <p className="text-[11px] truncate mt-0.5" style={{ color: 'var(--text-subtle)' }}>{user?.email}</p>
                </div>
                <button onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors"
                  style={{ color: 'var(--danger)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--danger-light)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <LogOut size={13} /> Cerrar sesión
                </button>
              </div>
            )}
          </div>

          {/* Mobile burger */}
          <button
            onClick={() => setMenuOpen(v => !v)}
            className="md:hidden w-8 h-8 flex items-center justify-center transition-colors"
            style={{ color: 'var(--nav-text)' }}>
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="md:hidden animate-in px-4 py-2"
             style={{ background: 'var(--primary-dark)', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          {visibleNav.map(item => {
            const active = location.pathname === item.to || location.pathname.startsWith(item.to + '/')
            return (
              <Link key={item.to} to={item.to} onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-colors"
                style={{ color: active ? 'white' : 'var(--nav-text)', borderLeft: active ? '3px solid var(--nav-active)' : '3px solid transparent', paddingLeft: active ? '0.625rem' : '0.75rem' }}>
                <span className="opacity-60">{item.icon}</span>
                {item.label}
              </Link>
            )
          })}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: '0.5rem', paddingTop: '0.5rem' }}>
            <p className="text-xs px-3 py-1" style={{ color: 'var(--nav-text)', opacity: 0.6 }}>{user?.full_name}</p>
            <button onClick={handleLogout}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium"
              style={{ color: '#f0a0a0' }}>
              <LogOut size={13} /> Cerrar sesión
            </button>
          </div>
        </div>
      )}
      </div>{/* end max-w-6xl */}
    </header>
  )
}

// ── App Layout ─────────────────────────────────────────────────────────────
export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <TopNavbar />
      {/* pt accounts for banner + navbar height (~64px) */}
      <main className="pt-16 md:pt-[64px]">
        <div className="max-w-6xl mx-auto px-4 py-7">
          {children}
        </div>
      </main>
    </div>
  )
}

// ── Top Header ─────────────────────────────────────────────────────────────
export function TopHeader({ title, subtitle, actions }: {
  title: string; subtitle?: string; actions?: React.ReactNode
}) {
  return (
    <div className="page-header flex items-start justify-between">
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
    </div>
  )
}

// ── Stat Card ──────────────────────────────────────────────────────────────
export function StatCard({ icon, label, value, sub, iconBg = '', iconColor = '' }: {
  icon: React.ReactNode; label: string; value: string | number; sub?: string
  iconBg?: string; iconColor?: string
}) {
  return (
    <div className="stat-card">
      <div className={clsx('stat-icon', iconBg, iconColor)} style={{ color: 'var(--primary)' }}>{icon}</div>
      <div>
        <p className="stat-label">{label}</p>
        <p className="stat-value" style={{ color: 'var(--text)' }}>{value}</p>
        {sub && <p className="text-xs mt-0.5" style={{ color: 'var(--text-subtle)' }}>{sub}</p>}
      </div>
    </div>
  )
}

// ── Question Status Badge ──────────────────────────────────────────────────
export function QuestionStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = { borrador: 'badge-yellow', aprobado: 'badge-green', archivado: 'badge-gray' }
  const labels: Record<string, string> = { borrador: 'Borrador', aprobado: 'Aprobado', archivado: 'Archivado' }
  return <span className={clsx('badge', map[status] ?? 'badge-gray')}>{labels[status] ?? status}</span>
}

// ── Timer Display ──────────────────────────────────────────────────────────
export function TimerDisplay({ seconds, warn = false }: { seconds: number; warn?: boolean }) {
  const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60), s = seconds % 60
  const fmt = (n: number) => String(n).padStart(2, '0')
  return (
    <span className={clsx('font-mono font-bold text-lg tabular-nums',
      warn ? 'animate-[pulseSoft_2s_ease-in-out_infinite]' : '')}
      style={{ color: warn ? '#f87171' : 'inherit' }}>
      {h > 0 ? `${fmt(h)}:` : ''}{fmt(m)}:{fmt(s)}
    </span>
  )
}

// ── Alert ──────────────────────────────────────────────────────────────────
export function Alert({ type = 'info', title, message }: {
  type?: 'info' | 'success' | 'warn' | 'error'; title?: string; message: string
}) {
  const styleMap = {
    info:    { background: 'var(--primary-light)', border: '1px solid #b8c9de', color: 'var(--primary)' },
    success: { background: 'var(--success-light)', border: '1px solid #b8d4c0', color: 'var(--success)' },
    warn:    { background: 'var(--warning-light)', border: '1px solid #d4c890', color: 'var(--warning)' },
    error:   { background: 'var(--danger-light)', border: '1px solid #d4b8b8', color: 'var(--danger)' },
  }
  return (
    <div className="p-3.5 text-sm" style={styleMap[type]}>
      {title && <p className="font-semibold mb-0.5">{title}</p>}
      <p>{message}</p>
    </div>
  )
}
