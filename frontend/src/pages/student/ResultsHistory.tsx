import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { BarChart3, Clock, ChevronRight, CheckCircle2, XCircle } from 'lucide-react'
import clsx from 'clsx'
import { examsApi } from '@/lib/api'
import { AppLayout, TopHeader, LoadingPage, EmptyState, ScoreRing } from '@/components/ui'
import { AREA_LABELS, type QuestionArea } from '@/types'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

function fmtTime(s?: number) {
  if (!s) return '—'
  const m = Math.floor(s / 60), sec = s % 60
  return `${m}m ${sec}s`
}

export default function StudentResultsHistory() {
  const { data: attempts, isLoading } = useQuery({
    queryKey: ['my-attempts'],
    queryFn: examsApi.myAttempts,
    staleTime: 30_000,
  })

  if (isLoading) return <AppLayout><LoadingPage /></AppLayout>

  const completed = (attempts ?? []).filter((a: any) => a.status === 'completado')
  const scores = completed.map((a: any) => a.score_global ?? 0)
  const avgScore = scores.length > 0 ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length) : null
  const bestScore = scores.length > 0 ? Math.max(...scores) : null

  return (
    <AppLayout>
      <TopHeader
        title="Mis Resultados"
        subtitle={`${completed.length} simulacros completados`}
      />

      {/* Summary */}
      {completed.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="card text-center">
            <p className="text-3xl font-bold text-navy-900">{completed.length}</p>
            <p className="text-xs text-slate-500 mt-1">Completados</p>
          </div>
          <div className="card text-center">
            <p className={clsx('text-3xl font-bold',
              avgScore && avgScore >= 70 ? 'text-emerald-600' : avgScore && avgScore >= 50 ? 'text-amber-600' : 'text-red-500'
            )}>{avgScore ?? '—'}%</p>
            <p className="text-xs text-slate-500 mt-1">Promedio</p>
          </div>
          <div className="card text-center">
            <p className="text-3xl font-bold text-gold-500">{bestScore ?? '—'}%</p>
            <p className="text-xs text-slate-500 mt-1">Mejor puntaje</p>
          </div>
        </div>
      )}

      {(attempts ?? []).length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<BarChart3 size={40} />}
            title="Sin resultados aún"
            subtitle="Presenta tu primer simulacro para ver tus resultados aquí"
            action={<Link to="/student/exams" className="btn-primary">Ver simulacros</Link>}
          />
        </div>
      ) : (
        <div className="space-y-3">
          {(attempts ?? []).map((a: any) => (
            <div key={a.id} className={clsx(
              'card flex items-center gap-4',
              a.status !== 'completado' && 'opacity-75'
            )}>
              <ScoreRing score={a.score_global ?? 0} size={56} />

              <div className="flex-1 min-w-0">
                <p className="font-medium text-navy-900">{a.exam_title ?? 'Simulacro'}</p>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <span className={clsx(
                    'badge text-xs',
                    a.status === 'completado' ? 'badge-green' : 'badge-yellow'
                  )}>
                    {a.status === 'completado' ? '✓ Completado' : '⏸ En progreso'}
                  </span>
                  {a.time_spent_sec && (
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <Clock size={11} /> {fmtTime(a.time_spent_sec)}
                    </span>
                  )}
                  {a.finished_at && (
                    <span className="text-xs text-slate-400">
                      {formatDistanceToNow(new Date(a.finished_at), { addSuffix: true, locale: es })}
                    </span>
                  )}
                </div>

                {a.score_by_area && Object.keys(a.score_by_area).length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {Object.entries(a.score_by_area).map(([area, pct]) => (
                      <span key={area} className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                        {AREA_LABELS[area as QuestionArea]?.split(' ')[0]}: {Number(pct).toFixed(0)}%
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {a.status === 'completado' && (
                <Link
                  to={`/student/results/${a.exam_id}/${a.id}`}
                  className="btn-secondary text-sm flex-shrink-0"
                >
                  Ver detalle <ChevronRight size={14} />
                </Link>
              )}
              {a.status === 'en_progreso' && (
                <Link
                  to={`/student/exam/${a.exam_id}`}
                  className="btn-primary text-sm flex-shrink-0"
                >
                  Continuar
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </AppLayout>
  )
}
