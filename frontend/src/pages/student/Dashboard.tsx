import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  TrendingUp, Target, BookOpen, Clock,
  ArrowRight, Award, Flame, AlertCircle, ChevronRight
} from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { analyticsApi, examsApi } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { AppLayout, StatCard, ScoreRing, ProgressBar, LoadingPage, EmptyState } from '@/components/ui'
import { AREA_LABELS, AREA_COLORS, type QuestionArea } from '@/types'
import clsx from 'clsx'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

export default function StudentDashboard() {
  const { user } = useAuthStore()

  const { data: stats, isLoading } = useQuery({
    queryKey: ['student-analytics'],
    queryFn:  analyticsApi.myStats,
    staleTime: 60_000,
  })
  const { data: attemptsData } = useQuery({
    queryKey: ['my-attempts'],
    queryFn:  examsApi.myAttempts,
    staleTime: 30_000,
  })

  if (isLoading) return <AppLayout><LoadingPage /></AppLayout>

  const evolData = (stats?.evolucion ?? []).map((e: any) => ({
    fecha: e.fecha?.slice(5) ?? '',
    score: e.score,
  }))
  const recentAttempts = (attemptsData ?? []).slice(0, 5)

  return (
    <AppLayout>
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="page-title">
            ¡Hola, {user?.full_name?.split(' ')[0]}! 👋
          </h1>
          <p className="page-subtitle">
            {stats?.total_simulacros === 0
              ? 'Aún no has presentado ningún simulacro. ¡Empieza hoy!'
              : `Has presentado ${stats?.total_simulacros} simulacros. ¡Sigue así!`}
          </p>
        </div>
        {stats?.tendencia === 'mejorando' && (
          <span className="badge badge-green flex items-center gap-1 mt-1">
            <TrendingUp size={11} /> Mejorando
          </span>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={<Target size={20} />}  label="Puntaje promedio"
          value={stats?.puntaje_promedio ? `${stats.puntaje_promedio}%` : '—'}
          iconBg="bg-blue-100" iconColor="text-blue-600" />
        <StatCard icon={<Award size={20} />}   label="Mejor puntaje"
          value={stats?.mejor_puntaje ? `${stats.mejor_puntaje}%` : '—'}
          iconBg="bg-amber-100" iconColor="text-amber-600" />
        <StatCard icon={<BookOpen size={20} />} label="Simulacros"
          value={stats?.total_simulacros ?? 0}
          iconBg="bg-indigo-100" iconColor="text-indigo-600" />
        <StatCard icon={<Flame size={20} />}   label="Tasa de acierto"
          value={stats?.tasa_acierto ? `${stats.tasa_acierto}%` : '—'}
          iconBg="bg-emerald-100" iconColor="text-emerald-600"
          sub={`${stats?.preguntas_respondidas ?? 0} preguntas`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Evolution chart */}
        <div className="card lg:col-span-2">
          <h3 className="font-semibold text-slate-900 mb-5">Evolución de puntajes</h3>
          {evolData.length > 1 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={evolData}>
                <XAxis dataKey="fecha" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 16, border: 'none',
                    boxShadow: '0 10px 25px rgba(0,0,0,.10)',
                    fontSize: 12,
                  }}
                  formatter={(v: number) => [`${v}%`, 'Puntaje']}
                />
                <Line
                  type="monotone" dataKey="score"
                  stroke="#6366f1" strokeWidth={2.5}
                  dot={{ fill: '#6366f1', r: 4, strokeWidth: 0 }}
                  activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState
              icon={<TrendingUp size={32} />}
              title="Sin historial aún"
              subtitle="Presenta tu primer simulacro para ver tu evolución"
            />
          )}
        </div>

        {/* Score ring + area breakdown */}
        <div className="card flex flex-col">
          <h3 className="font-semibold text-slate-900 mb-4">Puntaje global</h3>
          {stats?.puntaje_promedio ? (
            <>
              <div className="flex justify-center mb-5">
                <ScoreRing score={stats.puntaje_promedio} size={120} />
              </div>
              <div className="space-y-2.5 flex-1">
                {Object.entries(stats.por_area ?? {}).map(([area, pct]) => (
                  <div key={area}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-500">{AREA_LABELS[area as QuestionArea] ?? area}</span>
                      <span className="font-semibold text-slate-700">{Number(pct).toFixed(0)}%</span>
                    </div>
                    <ProgressBar value={Number(pct)} max={100} className="h-1.5"
                      color={Number(pct) >= 70 ? 'bg-emerald-500' : Number(pct) >= 50 ? 'bg-amber-400' : 'bg-red-400'} />
                  </div>
                ))}
              </div>
            </>
          ) : (
            <EmptyState icon={<Target size={32} />} title="Sin datos" subtitle="Presenta un simulacro" />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weak area */}
        {stats?.area_mas_debil && (
          <div className="card border-l-4 border-amber-400 bg-amber-50/50">
            <div className="flex items-start gap-3">
              <AlertCircle size={20} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-slate-900 mb-1">Área a reforzar</h4>
                <p className="text-slate-600 text-sm leading-relaxed">
                  Tu puntaje más bajo es en{' '}
                  <span className="font-semibold text-amber-700">
                    {AREA_LABELS[stats.area_mas_debil as QuestionArea]}
                  </span>.
                  Te recomendamos practicar más en esta área.
                </p>
                <Link to="/student/exams" className="btn-secondary mt-3 inline-flex text-xs py-1.5">
                  Ver simulacros <ArrowRight size={13} />
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Recent attempts */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900">Últimos simulacros</h3>
            <Link to="/student/results" className="text-blue-600 text-xs hover:underline font-medium flex items-center gap-1">
              Ver todos <ChevronRight size={14} />
            </Link>
          </div>
          {recentAttempts.length === 0 ? (
            <EmptyState icon={<BookOpen size={28} />} title="Sin intentos" subtitle="Presenta tu primer simulacro" />
          ) : (
            <div className="space-y-2">
              {recentAttempts.map((a: any) => (
                <div key={a.id} className="flex items-center gap-3 p-3 rounded-2xl hover:bg-slate-50 transition-colors">
                  <ScoreRing score={a.score_global ?? 0} size={44} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{a.exam_title ?? 'Simulacro'}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {a.finished_at
                        ? formatDistanceToNow(new Date(a.finished_at), { addSuffix: true, locale: es })
                        : 'En progreso'}
                    </p>
                  </div>
                  <Link to={`/student/results/${a.exam_id}/${a.id}`} className="text-slate-300 hover:text-blue-500 transition-colors">
                    <ChevronRight size={16} />
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* CTA banner */}
      <div className="mt-6 rounded-2xl p-6 flex items-center justify-between gap-4 overflow-hidden relative"
           style={{ background: 'linear-gradient(135deg, #2563eb 0%, #6366f1 100%)' }}>
        {/* Decoration */}
        <div className="absolute right-0 top-0 w-64 h-full opacity-10"
             style={{ background: 'radial-gradient(circle at 100% 50%, #fff, transparent)' }} />
        <div className="relative">
          <h3 className="text-xl text-white mb-1" style={{ fontFamily: '"DM Serif Display", Georgia, serif' }}>
            ¿Listo para practicar?
          </h3>
          <p className="text-blue-200 text-sm">Presenta un simulacro y mejora tu puntaje hoy.</p>
        </div>
        <Link to="/student/exams" className="btn-gold flex-shrink-0 relative">
          Ir a simulacros <ArrowRight size={16} />
        </Link>
      </div>
    </AppLayout>
  )
}
