import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { FileText, Clock, BookOpen, Play, ChevronRight, Trophy } from 'lucide-react'
import clsx from 'clsx'
import { examsApi } from '@/lib/api'
import { AppLayout, TopHeader, LoadingPage, EmptyState, ScoreRing } from '@/components/ui'
import { AREA_LABELS, type QuestionArea } from '@/types'

export default function StudentExamsList() {
  const { data: examsData, isLoading: loadingExams } = useQuery({
    queryKey: ['exams', 'public'],
    queryFn: () => examsApi.list({ limit: 50 }),
    staleTime: 60_000,
  })

  const { data: attemptsData } = useQuery({
    queryKey: ['my-attempts'],
    queryFn: examsApi.myAttempts,
    staleTime: 30_000,
  })

  if (loadingExams) return <AppLayout><LoadingPage /></AppLayout>

  const exams = examsData?.items ?? []
  const attemptMap: Record<string, any> = {}
  for (const a of (attemptsData ?? [])) {
    if (!attemptMap[a.exam_id] || (a.score_global ?? 0) > (attemptMap[a.exam_id]?.score_global ?? 0)) {
      attemptMap[a.exam_id] = a
    }
  }

  return (
    <AppLayout>
      <TopHeader
        title="Simulacros disponibles"
        subtitle={`${exams.length} simulacros para practicar`}
      />

      {exams.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<FileText size={40} />}
            title="Sin simulacros disponibles"
            subtitle="Tu docente publicará simulacros pronto"
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {exams.map((exam: any) => {
            const attempt = attemptMap[exam.id]
            const completed = attempt?.status === 'completado'

            return (
              <div key={exam.id} className="card flex flex-col gap-4">
                {/* Header */}
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-primary-100 rounded-2xl flex items-center justify-center flex-shrink-0">
                    <FileText size={18} className="text-primary-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-navy-900 line-clamp-2">{exam.title}</h3>
                    {exam.description && (
                      <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{exam.description}</p>
                    )}
                  </div>
                  {completed && (
                    <ScoreRing score={attempt.score_global ?? 0} size={44} />
                  )}
                </div>

                {/* Area config */}
                {exam.areas_config && Object.keys(exam.areas_config).length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(exam.areas_config).map(([a, n]) => (
                      <span key={a} className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">
                        {AREA_LABELS[a as QuestionArea]?.split(' ')[0]}: {n as number}
                      </span>
                    ))}
                  </div>
                )}

                {/* Meta */}
                <div className="flex items-center gap-4 text-xs text-slate-400">
                  <span className="flex items-center gap-1"><BookOpen size={12} /> {exam.question_count} preguntas</span>
                  <span className="flex items-center gap-1"><Clock size={12} /> {exam.duration_min} min</span>
                </div>

                {/* Score by area if completed */}
                {completed && attempt.score_by_area && (
                  <div className="space-y-1.5 bg-slate-50 rounded-xl p-3">
                    {Object.entries(attempt.score_by_area).map(([area, pct]) => (
                      <div key={area} className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-500 w-20 truncate">
                          {AREA_LABELS[area as QuestionArea]?.split(' ')[0]}
                        </span>
                        <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className={clsx(
                              'h-full rounded-full',
                              Number(pct) >= 70 ? 'bg-emerald-500' : Number(pct) >= 50 ? 'bg-amber-500' : 'bg-red-400'
                            )}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-medium w-8 text-right">{Number(pct).toFixed(0)}%</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 mt-auto">
                  {completed ? (
                    <>
                      <Link
                        to={`/student/results/${exam.id}/${attempt.id}`}
                        className="btn-secondary text-xs flex-1 justify-center"
                      >
                        <Trophy size={13} /> Ver resultados
                      </Link>
                      <Link
                        to={`/student/exam/${exam.id}`}
                        className="btn-outline text-xs flex-1 justify-center"
                      >
                        Reintentar
                      </Link>
                    </>
                  ) : attempt?.status === 'en_progreso' ? (
                    <Link
                      to={`/student/exam/${exam.id}`}
                      className="btn-gold text-sm flex-1 justify-center"
                    >
                      <Play size={14} /> Continuar
                    </Link>
                  ) : (
                    <Link
                      to={`/student/exam/${exam.id}`}
                      className="btn-primary text-sm flex-1 justify-center"
                    >
                      <Play size={14} /> Iniciar simulacro
                    </Link>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </AppLayout>
  )
}
