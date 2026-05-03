import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  CheckCircle2, XCircle, ArrowLeft, BarChart3,
  Clock, Flag, BookOpen, ChevronDown, ChevronUp,
  ExternalLink, Lightbulb,
} from 'lucide-react'
import { useState } from 'react'
import clsx from 'clsx'
import { examsApi, analyticsApi } from '@/lib/api'
import { AppLayout, ScoreRing, LoadingPage, AreaBadge, ProgressBar, EmptyState } from '@/components/ui'
import { AREA_LABELS, AREA_COLORS, type QuestionArea } from '@/types'
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from 'recharts'

function fmt(s: number) {
  const m = Math.floor(s / 60), sec = s % 60
  return `${m}m ${sec}s`
}

// ── Content catalog ────────────────────────────────────────────────────────
// Mirror of the backend CONTENT_CATALOG. The Results page uses this directly
// from the attempt's score_by_area to avoid an extra network request.
// Keep in sync with backend/app/api/analytics.py → CONTENT_CATALOG.

type Resource = {
  plataforma: 'khan_academy' | 'youtube' | 'duolingo'
  titulo: string
  descripcion: string
  url: string
}

const RESOURCES: Record<string, Resource[]> = {
  matematicas: [
    {
      plataforma: 'khan_academy',
      titulo: 'Estadística y probabilidad',
      descripcion: 'Distribuciones, probabilidad condicional y estadística descriptiva.',
      url: 'https://es.khanacademy.org/math/estadistica-y-probabilidad',
    },
    {
      plataforma: 'khan_academy',
      titulo: 'Álgebra — funciones y ecuaciones',
      descripcion: 'Ecuaciones de primer y segundo grado, funciones y sistemas.',
      url: 'https://es.khanacademy.org/math/algebra',
    },
    {
      plataforma: 'youtube',
      titulo: 'Unicoos — Matemáticas',
      descripcion: 'Vídeos cortos de álgebra, geometría analítica y cálculo diferencial.',
      url: 'https://www.youtube.com/@unicoos',
    },
  ],
  lectura_critica: [
    {
      plataforma: 'khan_academy',
      titulo: 'Comprensión lectora',
      descripcion: 'Estrategias para identificar idea central, inferir y analizar argumentos.',
      url: 'https://es.khanacademy.org/ela/cc-reading-lit',
    },
    {
      plataforma: 'youtube',
      titulo: 'Seprofe — Lectura Crítica ICFES',
      descripcion: 'Canal colombiano con ejercicios específicos para la prueba de lectura crítica.',
      url: 'https://www.youtube.com/@seprofe',
    },
  ],
  ciencias_naturales: [
    {
      plataforma: 'khan_academy',
      titulo: 'Biología',
      descripcion: 'Célula, genética, evolución, ecología y fisiología.',
      url: 'https://es.khanacademy.org/science/biologia',
    },
    {
      plataforma: 'khan_academy',
      titulo: 'Química general',
      descripcion: 'Tabla periódica, enlace químico, reacciones y estequiometría.',
      url: 'https://es.khanacademy.org/science/quimica-organica',
    },
    {
      plataforma: 'youtube',
      titulo: 'Unicoos — Física y Química',
      descripcion: 'Cinemática, termodinámica, electricidad y química inorgánica.',
      url: 'https://www.youtube.com/@unicoos',
    },
  ],
  sociales_ciudadanas: [
    {
      plataforma: 'khan_academy',
      titulo: 'Civismo y gobierno',
      descripcion: 'Sistemas democráticos, derechos fundamentales y participación ciudadana.',
      url: 'https://es.khanacademy.org/humanities/civics',
    },
    {
      plataforma: 'youtube',
      titulo: 'Guía ICFES — Sociales y Ciudadanas',
      descripcion: 'Revisión de la guía oficial del ICFES con los conceptos clave de la prueba.',
      url: 'https://www.youtube.com/results?search_query=ICFES+sociales+ciudadanas+guia',
    },
  ],
  ingles: [
    {
      plataforma: 'khan_academy',
      titulo: 'Inglés — Reading & Grammar',
      descripcion: 'Comprensión de textos, gramática y vocabulario en contexto.',
      url: 'https://www.khanacademy.org/ela/cc-reading-lit',
    },
    {
      plataforma: 'youtube',
      titulo: 'English with Lucy',
      descripcion: 'Gramática, pronunciación y comprensión auditiva en inglés real.',
      url: 'https://www.youtube.com/@EnglishwithLucy',
    },
    {
      plataforma: 'duolingo',
      titulo: 'Duolingo — Inglés',
      descripcion: 'Práctica diaria de vocabulario y gramática en formato gamificado.',
      url: 'https://www.duolingo.com/course/en/es/Learn-English',
    },
  ],
}

const PLATFORM_META: Record<string, { label: string; bg: string; text: string }> = {
  khan_academy: { label: 'Khan Academy', bg: 'bg-green-100',  text: 'text-green-700' },
  youtube:      { label: 'YouTube',       bg: 'bg-red-100',   text: 'text-red-600'   },
  duolingo:     { label: 'Duolingo',      bg: 'bg-blue-100',  text: 'text-blue-700'  },
}

// ── RecommendationPanel ────────────────────────────────────────────────────

function RecommendationPanel({
  scoreByArea,
  attemptId,
}: {
  scoreByArea: Record<string, number>
  attemptId: string
}) {
  // Find areas below 70%, sorted worst first. Cap at 3.
  const weak = Object.entries(scoreByArea)
    .filter(([, score]) => score < 70)
    .sort(([, a], [, b]) => a - b)
    .slice(0, 3)

  if (weak.length === 0) return null

  function handleOpen(area: string, resource: Resource) {
    // Fire-and-forget tracking; never blocks the user
    analyticsApi.trackRecommendation({
      area,
      plataforma: resource.plataforma,
      url: resource.url,
      attempt_id: attemptId,
    })
    window.open(resource.url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="card mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Lightbulb size={18} className="text-amber-500 flex-shrink-0" />
        <h3 className="font-semibold text-[var(--text)]">¿Qué estudiar ahora?</h3>
        <span className="ml-auto text-xs text-[var(--text-muted)]">
          Basado en este simulacro
        </span>
      </div>

      <div className="space-y-5">
        {weak.map(([area, score]) => {
          const recursos = (RESOURCES[area] ?? []).slice(0, 2)
          if (recursos.length === 0) return null

          const areaLabel = AREA_LABELS[area as QuestionArea] ?? area
          const prioridad = score < 40 ? 'alta' : score < 60 ? 'media' : 'baja'
          const prioridadCfg = {
            alta:  { label: 'Urgente',    bg: 'bg-red-100',    text: 'text-red-600'    },
            media: { label: 'Importante', bg: 'bg-amber-100',  text: 'text-amber-700'  },
            baja:  { label: 'Repasar',    bg: 'bg-blue-100',   text: 'text-blue-700'   },
          }[prioridad]

          return (
            <div key={area}>
              {/* Area header */}
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-medium text-[var(--text)]">{areaLabel}</span>
                <span className={clsx(
                  'text-xs font-medium px-2 py-0.5 rounded-full',
                  prioridadCfg.bg, prioridadCfg.text
                )}>
                  {prioridadCfg.label}
                </span>
                <span className={clsx(
                  'ml-auto text-sm font-semibold',
                  score < 40 ? 'text-red-500' : score < 60 ? 'text-amber-600' : 'text-blue-600'
                )}>
                  {score.toFixed(1)}%
                </span>
              </div>

              {/* Resource cards */}
              <div className="space-y-2">
                {recursos.map((r) => {
                  const platform = PLATFORM_META[r.plataforma] ?? {
                    label: r.plataforma, bg: 'bg-slate-100', text: 'text-slate-700',
                  }
                  return (
                    <button
                      key={r.url}
                      onClick={() => handleOpen(area, r)}
                      className="w-full flex items-start gap-3 p-3 bg-[var(--surface-2)] hover:bg-[var(--surface-3)] border border-[var(--border)] transition-colors text-left"
                    >
                      <span className={clsx(
                        'text-xs font-semibold px-2 py-1 rounded flex-shrink-0 mt-0.5',
                        platform.bg, platform.text
                      )}>
                        {platform.label}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[var(--text)] truncate">
                          {r.titulo}
                        </p>
                        <p className="text-xs text-[var(--text-muted)] mt-0.5 line-clamp-2">
                          {r.descripcion}
                        </p>
                      </div>
                      <ExternalLink
                        size={14}
                        className="text-[var(--text-subtle)] flex-shrink-0 mt-1"
                      />
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── AnswerCard ─────────────────────────────────────────────────────────────

function AnswerCard({ ans, index }: { ans: any; index: number }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className={clsx(
      'border-2 overflow-hidden transition-all',
      ans.is_correct ? 'border-emerald-200' : 'border-red-200'
    )}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-4 p-4 text-left hover:bg-[var(--surface-2)] transition-colors"
      >
        <div className={clsx(
          'w-8 h-8 flex items-center justify-center flex-shrink-0 text-sm font-bold',
          ans.is_correct ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
        )}>
          {index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-slate-700 line-clamp-2">{ans.enunciado}</p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <AreaBadge area={ans.area} />
          {ans.is_correct
            ? <CheckCircle2 size={18} className="text-emerald-500" />
            : <XCircle size={18} className="text-red-500" />
          }
          {expanded ? <ChevronUp size={16} className="text-[var(--text-subtle)]" /> : <ChevronDown size={16} className="text-[var(--text-subtle)]" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-[var(--border)]">
          {/* Options */}
          <div className="space-y-2 mt-4">
            {ans.opciones?.map((opt: any) => (
              <div key={opt.letra} className={clsx(
                'flex items-start gap-3 p-3 text-sm',
                opt.letra === ans.respuesta_correcta
                  ? 'bg-emerald-50 border border-emerald-200'
                  : opt.letra === ans.respuesta_dada && !ans.is_correct
                  ? 'bg-red-50 border border-red-200'
                  : 'bg-[var(--surface-2)] border border-transparent'
              )}>
                <span className={clsx(
                  'w-6 h-6 flex items-center justify-center flex-shrink-0 text-xs font-bold',
                  opt.letra === ans.respuesta_correcta
                    ? 'bg-emerald-500 text-white'
                    : opt.letra === ans.respuesta_dada
                    ? 'bg-red-500 text-white'
                    : 'bg-slate-200 text-slate-600'
                )}>
                  {opt.letra}
                </span>
                <span>{opt.texto}</span>
                {opt.letra === ans.respuesta_correcta && (
                  <CheckCircle2 size={14} className="text-emerald-500 ml-auto flex-shrink-0 mt-0.5" />
                )}
              </div>
            ))}
          </div>

          {ans.explicacion && (
            <div className="mt-4 p-4 bg-blue-600 border border-blue-400">
              <p className="text-xs font-semibold text-blue-600 mb-1">💡 Explicación</p>
              <p className="text-sm text-slate-700">{ans.explicacion}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function StudentResults() {
  const { examId, attemptId } = useParams<{ examId: string; attemptId: string }>()
  const [filter, setFilter] = useState<'all' | 'correct' | 'wrong'>('all')
  const [selectedArea, setSelectedArea] = useState<string>('all')

  const { data: result, isLoading } = useQuery({
    queryKey: ['attempt-results', examId, attemptId],
    queryFn: () => examsApi.getResults(examId!, attemptId!),
    enabled: !!examId && !!attemptId,
  })

  if (isLoading) return <AppLayout><LoadingPage /></AppLayout>
  if (!result) return <AppLayout><EmptyState icon={<BarChart3 size={36} />} title="Resultados no encontrados" /></AppLayout>

  const answers = (result.answers ?? [])
    .filter((a: any) => filter === 'all' || (filter === 'correct' ? a.is_correct : !a.is_correct))
    .filter((a: any) => selectedArea === 'all' || a.area === selectedArea)

  const scoreColor = result.score_global >= 70 ? 'text-emerald-600'
    : result.score_global >= 50 ? 'text-amber-600' : 'text-red-500'

  const areaData = Object.entries(result.score_by_area ?? {}).map(([k, v]) => ({
    subject: AREA_LABELS[k as QuestionArea]?.split(' ')[0] ?? k,
    value: Number(v),
    fullMark: 100,
  }))

  const areaKeys = [...new Set((result.answers ?? []).map((a: any) => a.area as string))] as string[]

  return (
    <AppLayout>
      <div className="mb-6">
        <Link to="/student/results" className="btn-ghost text-sm mb-4 inline-flex">
          <ArrowLeft size={15} /> Volver a resultados
        </Link>

        <h1 className="page-title">Resultados del simulacro</h1>
        <p className="page-subtitle">Revisa tu desempeño pregunta por pregunta</p>
      </div>

      {/* Score Summary */}
      <div className="card mb-6">
        <div className="flex flex-col md:flex-row items-center gap-8">
          <div className="text-center">
            <ScoreRing score={result.score_global} size={120} />
            <p className="text-sm text-[var(--text-muted)] mt-2">Puntaje Global</p>
          </div>

          <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-emerald-50">
              <p className="text-2xl font-bold text-emerald-700">
                {result.answers?.filter((a: any) => a.is_correct).length}
              </p>
              <p className="text-xs text-[var(--text-muted)]">Correctas</p>
            </div>
            <div className="text-center p-4 bg-red-50">
              <p className="text-2xl font-bold text-red-600">
                {result.answers?.filter((a: any) => !a.is_correct).length}
              </p>
              <p className="text-xs text-[var(--text-muted)]">Incorrectas</p>
            </div>
            <div className="text-center p-4 bg-[var(--surface-2)]">
              <p className="text-2xl font-bold text-[var(--text)]">{result.answers?.length}</p>
              <p className="text-xs text-[var(--text-muted)]">Total</p>
            </div>
            {result.time_spent_sec && (
              <div className="text-center p-4 bg-blue-50">
                <p className="text-2xl font-bold text-blue-700">{fmt(result.time_spent_sec)}</p>
                <p className="text-xs text-[var(--text-muted)]">Tiempo</p>
              </div>
            )}
          </div>

          {areaData.length > 0 && (
            <div className="w-48 h-48">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={areaData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10 }} />
                  <Radar dataKey="value" stroke="#4f46e5" fill="#4f46e5" fillOpacity={0.25} />
                  <Tooltip formatter={(v: number) => [`${v}%`]} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Score by area */}
      <div className="card mb-6">
        <h3 className="font-semibold text-[var(--text)] mb-4">Puntaje por área</h3>
        <div className="space-y-3">
          {Object.entries(result.score_by_area ?? {}).map(([area, pct]) => (
            <div key={area}>
              <div className="flex justify-between text-sm mb-1.5">
                <span className="text-slate-600">{AREA_LABELS[area as QuestionArea] ?? area}</span>
                <span className={clsx('font-semibold',
                  Number(pct) >= 70 ? 'text-emerald-600' : Number(pct) >= 50 ? 'text-amber-600' : 'text-red-500'
                )}>
                  {Number(pct).toFixed(1)}%
                </span>
              </div>
              <ProgressBar
                value={Number(pct)} max={100}
                color={Number(pct) >= 70 ? 'bg-emerald-500' : Number(pct) >= 50 ? 'bg-amber-500' : 'bg-red-500'}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Recommendations — only rendered when there are weak areas */}
      {result.score_by_area && attemptId && (
        <RecommendationPanel
          scoreByArea={result.score_by_area}
          attemptId={attemptId}
        />
      )}

      {/* Answers list */}
      <div className="card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h3 className="font-semibold text-[var(--text)]">Revisión de preguntas ({answers.length})</h3>
          <div className="flex gap-2 flex-wrap">
            {(['all', 'correct', 'wrong'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={clsx(
                  'btn text-xs py-1.5 px-3',
                  filter === f ? 'btn-primary' : 'btn-secondary'
                )}
              >
                {f === 'all' ? 'Todas' : f === 'correct' ? '✓ Correctas' : '✗ Incorrectas'}
              </button>
            ))}
            <select
              value={selectedArea}
              onChange={(e) => setSelectedArea(e.target.value)}
              className="input text-xs py-1.5 px-3 w-auto"
            >
              <option value="all">Todas las áreas</option>
              {areaKeys.map((a) => (
                <option key={a} value={a}>{AREA_LABELS[a as QuestionArea] ?? a}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-3">
          {answers.map((ans: any, i: number) => (
            <AnswerCard key={ans.question_id} ans={ans} index={i} />
          ))}
          {answers.length === 0 && (
            <EmptyState icon={<BookOpen size={32} />} title="Sin preguntas en este filtro" />
          )}
        </div>
      </div>
    </AppLayout>
  )
}
