import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { BarChart3, Clock, ChevronRight } from 'lucide-react'
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
    queryFn:  examsApi.myAttempts,
    staleTime: 30_000,
  })

  if (isLoading) return <AppLayout><LoadingPage /></AppLayout>

  const completed = (attempts ?? []).filter((a: any) => a.status === 'completado')
  const scores    = completed.map((a: any) => a.score_global ?? 0)
  const avgScore  = scores.length > 0 ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length) : null
  const bestScore = scores.length > 0 ? Math.max(...scores) : null

  return (
    <AppLayout>
      <TopHeader
        title="Mis Resultados"
        subtitle={`${completed.length} simulacros completados`}
      />

      {/* Summary cards */}
      {completed.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { value: completed.length, label: 'Completados', color: 'text-[var(--text)]' },
            {
              value: avgScore != null ? `${avgScore}%` : '—',
              label: 'Promedio',
              color: avgScore != null
                ? avgScore >= 70 ? 'text-emerald-600' : avgScore >= 50 ? 'text-amber-600' : 'text-red-500'
                : 'text-[var(--text-subtle)]',
            },
            { value: bestScore != null ? `${bestScore}%` : '—', label: 'Mejor puntaje', color: 'text-amber-500' },
          ].map(({ value, label, color }) => (
            <div key={label} className="card text-center py-5">
              <p className={clsx('text-3xl font-bold mb-1', color)}>{value}</p>
              <p className="text-xs text-[var(--text-muted)] font-medium uppercase tracking-wide">{label}</p>
            </div>
          ))}
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
              'card flex items-center gap-4 transition-all duration-200 hover:-translate-y-px',
              a.status !== 'completado' && 'opacity-75'
            )}>
              <ScoreRing score={a.score_global ?? 0} size={56} />

              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[var(--text)]">{a.exam_title ?? 'Simulacro'}</p>
                <div className="flex items-center gap-2.5 mt-1 flex-wrap">
                  <span className={clsx('badge text-xs',
                    a.status === 'completado' ? 'badge-green' : 'badge-yellow'
                  )}>
                    {a.status === 'completado' ? '✓ Completado' : '⏸ En progreso'}
                  </span>
                  {a.time_spent_sec && (
                    <span className="text-xs text-[var(--text-subtle)] flex items-center gap-1">
                      <Clock size={11} /> {fmtTime(a.time_spent_sec)}
                    </span>
                  )}
                  {a.finished_at && (
                    <span className="text-xs text-[var(--text-subtle)]">
                      {formatDistanceToNow(new Date(a.finished_at), { addSuffix: true, locale: es })}
                    </span>
                  )}
                </div>

                {a.score_by_area && Object.keys(a.score_by_area).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {Object.entries(a.score_by_area).map(([area, pct]) => (
                      <span key={area} className="text-[11px] bg-[var(--surface-2)] text-[var(--text-muted)] px-2 py-0.5 font-medium">
                        {AREA_LABELS[area as QuestionArea]?.split(' ')[0]}: {Number(pct).toFixed(0)}%
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {a.status === 'completado' ? (
                <Link to={`/student/results/${a.exam_id}/${a.id}`}
                      className="btn-secondary text-sm flex-shrink-0">
                  Ver detalle <ChevronRight size={14} />
                </Link>
              ) : (
                <Link to={`/student/exam/${a.exam_id}`}
                      className="btn-primary text-sm flex-shrink-0">
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
