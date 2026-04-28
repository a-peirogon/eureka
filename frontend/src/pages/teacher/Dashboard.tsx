import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  BookOpen, FileText, BarChart3, Users,
  TrendingUp, Plus, Wand2, Upload, ArrowRight,
  CheckCircle, Clock
} from 'lucide-react'
import { questionsApi, examsApi, usersApi } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { AppLayout, StatCard, LoadingPage } from '@/components/ui'
import { AREA_LABELS, type QuestionArea } from '@/types'

export default function TeacherDashboard() {
  const { user } = useAuthStore()

  const { data: qStats } = useQuery({
    queryKey: ['question-stats'],
    queryFn: questionsApi.stats,
    staleTime: 60_000,
  })

  const { data: examsData } = useQuery({
    queryKey: ['exams'],
    queryFn: () => examsApi.list({ limit: 5 }),
    staleTime: 60_000,
  })

  const { data: userStats } = useQuery({
    queryKey: ['user-stats'],
    queryFn: usersApi.stats,
    staleTime: 60_000,
  })

  const quickActions = [
    { icon: <Plus size={18} />, label: 'Nueva pregunta', to: '/teacher/questions', color: 'bg-blue-600 hover:bg-blue-700' },
    { icon: <Wand2 size={18} />, label: 'Generar con IA', to: '/teacher/questions', color: 'bg-purple-600 hover:bg-purple-700' },
    { icon: <FileText size={18} />, label: 'Crear simulacro', to: '/teacher/exams', color: 'bg-primary-600 hover:bg-primary-700' },
    { icon: <Upload size={18} />, label: 'Importar OCR', to: '/teacher/import', color: 'bg-emerald-600 hover:bg-emerald-700' },
  ]

  return (
    <AppLayout>
      <div className="mb-8">
        <h1 className="page-title">Darshboard</h1>
        <p className="page-subtitle">Bienvenido, {user?.full_name?.split(' ')[0]}. Aquí tienes un resumen de tu actividad.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={<BookOpen size={20} />} label="Total preguntas"
          value={qStats?.total ?? 0} sub={`${qStats?.by_status?.aprobado ?? 0} aprobadas`}
          iconBg="bg-blue-100" iconColor="text-blue-600" />
        <StatCard icon={<CheckCircle size={20} />} label="Borradores"
          value={qStats?.by_status?.borrador ?? 0} sub="Por revisar"
          iconBg="bg-amber-100" iconColor="text-amber-600" />
        <StatCard icon={<FileText size={20} />} label="Simulacros"
          value={examsData?.total ?? 0}
          iconBg="bg-primary-100" iconColor="text-primary-600" />
        <StatCard icon={<Users size={20} />} label="Estudiantes"
          value={userStats?.by_role?.estudiante ?? 0}
          iconBg="bg-emerald-100" iconColor="text-emerald-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick actions */}
        <div className="card">
          <h3 className="font-semibold text-navy-900 mb-4">Acciones rápidas</h3>
          <div className="space-y-2">
            {quickActions.map((a) => (
              <Link
                key={a.label} to={a.to}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-white text-sm font-medium transition-all ${a.color}`}
              >
                {a.icon} {a.label}
                <ArrowRight size={14} className="ml-auto" />
              </Link>
            ))}
          </div>
        </div>

        {/* Questions by area */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-navy-900">Preguntas por área</h3>
            <Link to="/teacher/questions" className="text-primary-600 text-xs hover:underline">Ver todas</Link>
          </div>
          <div className="space-y-3">
            {Object.entries(qStats?.by_area ?? {}).map(([area, count]) => (
              <div key={area} className="flex items-center gap-3">
                <span className="text-sm text-slate-600 flex-1">{AREA_LABELS[area as QuestionArea] ?? area}</span>
                <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary-500 rounded-full"
                    style={{ width: `${qStats?.total ? (Number(count) / qStats.total) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-sm font-semibold text-navy-900 w-8 text-right">{count as number}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent exams */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-navy-900">Simulacros recientes</h3>
            <Link to="/teacher/exams" className="text-primary-600 text-xs hover:underline">Ver todos</Link>
          </div>
          <div className="space-y-3">
            {(examsData?.items ?? []).slice(0, 5).map((e: any) => (
              <div key={e.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition-colors">
                <div className="w-8 h-8 bg-primary-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <FileText size={14} className="text-primary-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-navy-900 truncate">{e.title}</p>
                  <p className="text-xs text-slate-400 flex items-center gap-1">
                    <Clock size={10} /> {e.duration_min} min · {e.question_count} preg.
                  </p>
                </div>
              </div>
            ))}
            {(examsData?.items ?? []).length === 0 && (
              <p className="text-sm text-slate-400 text-center py-4">Sin simulacros aún</p>
            )}
          </div>
        </div>
      </div>

      {/* Pending drafts alert */}
      {(qStats?.by_status?.borrador ?? 0) > 0 && (
        <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
              <Clock size={18} className="text-amber-600" />
            </div>
            <div>
              <p className="font-medium text-amber-800">
                {qStats.by_status.borrador} pregunta(s) pendientes de revisión
              </p>
              <p className="text-xs text-amber-600">Revisa y aprueba los borradores para usarlos en simulacros</p>
            </div>
          </div>
          <Link to="/teacher/questions?status=borrador" className="btn-gold text-sm flex-shrink-0">
            Revisar ahora
          </Link>
        </div>
      )}
    </AppLayout>
  )
}
