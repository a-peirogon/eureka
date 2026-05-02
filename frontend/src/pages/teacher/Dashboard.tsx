import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  BookOpen, FileText, BarChart3, Users,
  Plus, Wand2, Upload, ArrowRight, CheckCircle, Clock
} from 'lucide-react'
import { questionsApi, examsApi, usersApi } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { AppLayout, StatCard, LoadingPage } from '@/components/ui'
import { AREA_LABELS, type QuestionArea } from '@/types'

export default function TeacherDashboard() {
  const { user } = useAuthStore()

  const { data: qStats } = useQuery({
    queryKey: ['question-stats'],
    queryFn:  questionsApi.stats,
    staleTime: 60_000,
  })
  const { data: examsData } = useQuery({
    queryKey: ['exams'],
    queryFn:  () => examsApi.list({ limit: 5 }),
    staleTime: 60_000,
  })
  const { data: userStats } = useQuery({
    queryKey: ['user-stats'],
    queryFn:  usersApi.stats,
    staleTime: 60_000,
  })

  const quickActions = [
    { icon: <Plus size={18} />,     label: 'Nueva pregunta',  to: '/teacher/questions', gradient: 'linear-gradient(135deg,#3b82f6,#2563eb)', shadow: 'rgba(37,99,235,.30)' },
    { icon: <Wand2 size={18} />,    label: 'Generar con IA',  to: '/teacher/questions', gradient: 'linear-gradient(135deg,#818cf8,#6366f1)', shadow: 'rgba(99,102,241,.30)' },
    { icon: <FileText size={18} />, label: 'Crear simulacro', to: '/teacher/exams',     gradient: 'linear-gradient(135deg,#34d399,#059669)', shadow: 'rgba(5,150,105,.25)' },
    { icon: <Upload size={18} />,   label: 'Importar OCR',    to: '/teacher/import',    gradient: 'linear-gradient(135deg,#fb923c,#ea580c)', shadow: 'rgba(234,88,12,.25)' },
  ]

  return (
    <AppLayout>
      {/* Header */}
      <div className="mb-8">
        <h1 className="page-title">
          Hola, {user?.full_name?.split(' ')[0]} 👋
        </h1>
        <p className="page-subtitle">Aquí tienes un resumen de tu actividad docente.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={<BookOpen size={20} />}    label="Total preguntas"
          value={qStats?.total ?? 0}        sub={`${qStats?.by_status?.aprobado ?? 0} aprobadas`}
          iconBg="bg-blue-100"             iconColor="text-blue-600"
        />
        <StatCard
          icon={<CheckCircle size={20} />} label="Borradores"
          value={qStats?.by_status?.borrador ?? 0} sub="Por revisar"
          iconBg="bg-amber-100"            iconColor="text-amber-600"
        />
        <StatCard
          icon={<FileText size={20} />}   label="Simulacros"
          value={examsData?.total ?? 0}
          iconBg="bg-indigo-100"           iconColor="text-indigo-600"
        />
        <StatCard
          icon={<Users size={20} />}      label="Estudiantes"
          value={userStats?.by_role?.estudiante ?? 0}
          iconBg="bg-emerald-100"          iconColor="text-emerald-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Quick actions */}
        <div className="card">
          <h3 className="font-semibold text-slate-800 mb-4 text-sm uppercase tracking-wide text-[var(--text-muted)]">Acciones rápidas</h3>
          <div className="space-y-2.5">
            {quickActions.map((a) => (
              <Link
                key={a.label}
                to={a.to}
                className="flex items-center gap-3 px-4 py-3 text-white text-sm font-semibold transition-all hover:-translate-y-px"
                style={{ background: a.gradient, boxShadow: `0 2px 8px ${a.shadow}` }}
              >
                <span className="opacity-90">{a.icon}</span>
                {a.label}
                <ArrowRight size={14} className="ml-auto opacity-70" />
              </Link>
            ))}
          </div>
        </div>

        {/* Questions by area */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-[var(--text)]">Preguntas por área</h3>
            <Link to="/teacher/questions" className="text-blue-600 text-xs hover:underline font-medium">Ver todas</Link>
          </div>
          <div className="space-y-3.5">
            {Object.entries(qStats?.by_area ?? {}).map(([area, count]) => {
              const pct = qStats?.total ? (Number(count) / qStats.total) * 100 : 0
              return (
                <div key={area}>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-slate-600">{AREA_LABELS[area as QuestionArea] ?? area}</span>
                    <span className="font-semibold text-slate-800">{count as number}</span>
                  </div>
                  <div className="h-1.5 bg-[var(--surface-2)] overflow-hidden">
                    <div
                      className="h-full transition-all duration-700"
                      style={{ width: `${pct}%`, background: 'linear-gradient(90deg,#3b82f6,#6366f1)' }}
                    />
                  </div>
                </div>
              )
            })}
            {Object.keys(qStats?.by_area ?? {}).length === 0 && (
              <p className="text-sm text-[var(--text-subtle)] text-center py-4">Sin preguntas aún</p>
            )}
          </div>
        </div>

        {/* Recent exams */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-[var(--text)]">Simulacros recientes</h3>
            <Link to="/teacher/exams" className="text-blue-600 text-xs hover:underline font-medium">Ver todos</Link>
          </div>
          <div className="space-y-2">
            {(examsData?.items ?? []).slice(0, 5).map((e: any) => (
              <div key={e.id} className="flex items-center gap-3 p-2.5 hover:bg-[var(--surface-2)] transition-colors cursor-pointer">
                <div className="w-9 h-9 bg-indigo-100 flex items-center justify-center flex-shrink-0">
                  <FileText size={15} className="text-indigo-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{e.title}</p>
                  <p className="text-xs text-[var(--text-subtle)] flex items-center gap-1 mt-0.5">
                    <Clock size={10} /> {e.duration_min} min · {e.question_count} preg.
                  </p>
                </div>
                <ArrowRight size={13} className="text-slate-300 flex-shrink-0" />
              </div>
            ))}
            {(examsData?.items ?? []).length === 0 && (
              <p className="text-sm text-[var(--text-subtle)] text-center py-4">Sin simulacros aún</p>
            )}
          </div>
        </div>
      </div>

      {/* Pending drafts alert */}
      {(qStats?.by_status?.borrador ?? 0) > 0 && (
        <div className="mt-6 border border-amber-200 overflow-hidden"
             style={{ background: 'linear-gradient(135deg, #fffbeb, #fef3c7)' }}>
          <div className="p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 flex items-center justify-center flex-shrink-0">
                <Clock size={18} className="text-amber-600" />
              </div>
              <div>
                <p className="font-semibold text-amber-900 text-sm">
                  {qStats.by_status.borrador} pregunta(s) pendientes de revisión
                </p>
                <p className="text-xs text-amber-700 mt-0.5">Aprueba los borradores para usarlos en simulacros</p>
              </div>
            </div>
            <Link to="/teacher/questions?status=borrador" className="btn-gold text-xs flex-shrink-0">
              Revisar ahora
            </Link>
          </div>
        </div>
      )}
    </AppLayout>
  )
}
