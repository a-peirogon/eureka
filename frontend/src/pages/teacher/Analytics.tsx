import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart3, TrendingUp, Users, Target, AlertCircle,
  Trophy, ChevronDown, BookOpen, Award
} from 'lucide-react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, Cell
} from 'recharts'
import clsx from 'clsx'
import { analyticsApi } from '@/lib/api'
import {
  AppLayout, TopHeader, StatCard, LoadingPage,
  EmptyState, ProgressBar, AreaBadge
} from '@/components/ui'
import { AREA_LABELS, AREA_COLORS, type QuestionArea } from '@/types'

const DEMO_COURSE_ID = '00000000-0000-0000-0000-000000000020'

const RANK_COLORS = ['text-amber-500', 'text-[var(--text-muted)]', 'text-amber-700']
const RANK_ICONS = ['🥇', '🥈', '🥉']

export default function TeacherAnalytics() {
  const [courseId] = useState(DEMO_COURSE_ID)

  const { data: stats, isLoading } = useQuery({
    queryKey: ['course-analytics', courseId],
    queryFn: () => analyticsApi.courseStats(courseId),
    staleTime: 60_000,
  })

  if (isLoading) return <AppLayout><LoadingPage /></AppLayout>

  const areaData = Object.entries(stats?.por_area ?? {}).map(([k, v]) => ({
    area: AREA_LABELS[k as QuestionArea]?.split(' ')[0] ?? k,
    fullName: AREA_LABELS[k as QuestionArea] ?? k,
    pct: Number(v),
    color: AREA_COLORS[k as QuestionArea] ?? '#6366f1',
  }))

  const weeklyData = (stats?.evolucion_semanal ?? []).map((w: any) => ({
    semana: w.semana?.split('W')[1] ? `Sem ${w.semana.split('W')[1]}` : w.semana,
    promedio: w.promedio,
    intentos: w.intentos,
  }))

  const radarData = areaData.map((d) => ({
    subject: d.area,
    value: d.pct,
    fullMark: 100,
  }))

  return (
    <AppLayout>
      <TopHeader
        title="Analíticas"
        subtitle="Desempeño y tendencias de tus estudiantes"
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={<Users size={20} />}
          label="Estudiantes"
          value={stats?.student_count ?? 0}
          iconBg="bg-blue-100" iconColor="text-blue-600"
        />
        <StatCard
          icon={<Target size={20} />}
          label="Promedio del curso"
          value={stats?.promedio_curso ? `${stats.promedio_curso}%` : '—'}
          iconBg="bg-blue-100" iconColor="text-blue-600"
        />
        <StatCard
          icon={<BarChart3 size={20} />}
          label="Total intentos"
          value={stats?.total_intentos ?? 0}
          iconBg="bg-emerald-100" iconColor="text-emerald-600"
        />
        <StatCard
          icon={<TrendingUp size={20} />}
          label="Tasa de mejora"
          value={stats?.tasa_mejora != null ? `${stats.tasa_mejora > 0 ? '+' : ''}${stats.tasa_mejora}%` : '—'}
          sub="vs período anterior"
          iconBg={stats?.tasa_mejora > 0 ? 'bg-emerald-100' : 'bg-red-100'}
          iconColor={stats?.tasa_mejora > 0 ? 'text-emerald-600' : 'text-red-500'}
        />
      </div>

      {!stats?.total_intentos ? (
        <div className="card">
          <EmptyState
            icon={<BarChart3 size={40} />}
            title="Sin datos aún"
            subtitle="Cuando tus estudiantes presenten simulacros, verás la analítica aquí."
          />
        </div>
      ) : (
        <>
          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            {/* Weekly evolution */}
            <div className="card lg:col-span-2">
              <h3 className="font-semibold text-[var(--text)] mb-1">Evolución semanal</h3>
              <p className="text-xs text-[var(--text-subtle)] mb-4">Promedio del curso por semana</p>
              {weeklyData.length > 1 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={weeklyData}>
                    <XAxis dataKey="semana" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,.08)' }}
                      formatter={(v: number) => [`${v}%`, 'Promedio']}
                    />
                    <Line type="monotone" dataKey="promedio" stroke="#4f46e5" strokeWidth={2.5}
                      dot={{ fill: '#4f46e5', r: 4 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState icon={<TrendingUp size={28} />} title="Pocos datos" subtitle="Necesitas al menos 2 semanas de datos" />
              )}
            </div>

            {/* Radar */}
            <div className="card">
              <h3 className="font-semibold text-[var(--text)] mb-4">Puntaje por área</h3>
              {radarData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <RadarChart data={radarData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10 }} />
                    <Radar dataKey="value" stroke="#4f46e5" fill="#4f46e5" fillOpacity={0.25} />
                    <Tooltip formatter={(v: number) => [`${v}%`]} />
                  </RadarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState icon={<Target size={28} />} title="Sin datos" />
              )}
            </div>
          </div>

          {/* Area breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="card">
              <h3 className="font-semibold text-[var(--text)] mb-4">Desempeño por área</h3>
              <div className="space-y-4">
                {areaData.map((d) => (
                  <div key={d.area}>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="text-slate-600">{d.fullName}</span>
                      <span className={clsx('font-semibold',
                        d.pct >= 70 ? 'text-emerald-600' : d.pct >= 50 ? 'text-amber-600' : 'text-red-500'
                      )}>
                        {d.pct}%
                      </span>
                    </div>
                    <ProgressBar
                      value={d.pct} max={100}
                      color={d.pct >= 70 ? 'bg-emerald-500' : d.pct >= 50 ? 'bg-amber-500' : 'bg-red-500'}
                    />
                  </div>
                ))}
              </div>

              {stats?.area_mas_debil && (
                <div className="mt-4 p-3 bg-amber-50 border border-amber-200 flex items-start gap-2">
                  <AlertCircle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700">
                    Área más débil: <strong>{AREA_LABELS[stats.area_mas_debil as QuestionArea]}</strong>.
                    Considera crear más preguntas y simulacros enfocados en esta área.
                  </p>
                </div>
              )}
            </div>

            {/* Most failed questions */}
            <div className="card">
              <h3 className="font-semibold text-[var(--text)] mb-4 flex items-center gap-2">
                <AlertCircle size={17} className="text-red-500" />
                Preguntas más falladas
              </h3>
              {(stats?.preguntas_mas_falladas ?? []).length === 0 ? (
                <EmptyState icon={<BookOpen size={28} />} title="Sin datos" subtitle="Las preguntas falladas aparecerán aquí" />
              ) : (
                <div className="space-y-3">
                  {stats.preguntas_mas_falladas.slice(0, 8).map((q: any, i: number) => (
                    <div key={q.question_id} className="flex items-center gap-3 p-2.5 hover:bg-[var(--surface-2)] transition-colors">
                      <div className={clsx(
                        'w-8 h-8 flex items-center justify-center text-xs font-bold flex-shrink-0',
                        q.tasa_error >= 70 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                      )}>
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-700 line-clamp-2">{q.enunciado_preview}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <AreaBadge area={q.area} />
                          <span className="text-xs text-[var(--text-subtle)]">{q.total_intentos} intentos</span>
                        </div>
                      </div>
                      <span className={clsx(
                        'text-sm font-bold flex-shrink-0',
                        q.tasa_error >= 70 ? 'text-red-600' : 'text-amber-600'
                      )}>
                        {q.tasa_error}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Ranking */}
          <div className="card">
            <h3 className="font-semibold text-[var(--text)] mb-6 flex items-center gap-2">
              <Trophy size={18} className="text-amber-500" />
              Ranking de estudiantes
            </h3>
            {(stats?.ranking ?? []).length === 0 ? (
              <EmptyState icon={<Users size={28} />} title="Sin datos de ranking" />
            ) : (
              <div className="space-y-2">
                {stats.ranking.slice(0, 15).map((student: any) => (
                  <div
                    key={student.student_id}
                    className={clsx(
                      'flex items-center gap-4 p-3 transition-colors',
                      student.posicion <= 3 ? 'bg-amber-100 border border-amber-400' : 'hover:bg-[var(--surface-2)]'
                    )}
                  >
                    <div className={clsx(
                      'w-8 h-8 flex items-center justify-center text-sm font-bold flex-shrink-0',
                      student.posicion === 1 ? 'bg-amber-100 text-white'
                      : student.posicion === 2 ? 'bg-slate-400 text-white'
                      : student.posicion === 3 ? 'bg-amber-600 text-white'
                      : 'bg-[var(--surface-2)] text-slate-600'
                    )}>
                      {student.posicion <= 3 ? RANK_ICONS[student.posicion - 1] : student.posicion}
                    </div>

                    <div className="w-9 h-9 bg-blue-100 flex items-center justify-center text-sm font-bold text-blue-600 flex-shrink-0">
                      {student.full_name?.charAt(0).toUpperCase()}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--text)] truncate">{student.full_name}</p>
                      <p className="text-xs text-[var(--text-subtle)]">{student.simulacros} simulacro(s)</p>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <p className={clsx(
                        'text-lg font-bold',
                        student.promedio >= 70 ? 'text-emerald-600'
                        : student.promedio >= 50 ? 'text-amber-600'
                        : 'text-red-500'
                      )}>
                        {student.promedio}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </AppLayout>
  )
}
