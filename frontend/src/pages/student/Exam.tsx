import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  Flag, ChevronLeft, ChevronRight, CheckCircle2,
  AlertTriangle, Send, BookMarked, Grid3x3
} from 'lucide-react'
import clsx from 'clsx'
import { examsApi } from '@/lib/api'
import { useExamStore } from '@/store/examStore'
import { TimerDisplay, Spinner, Modal, AreaBadge } from '@/components/ui'
import { AREA_LABELS, type QuestionArea } from '@/types'
import toast from 'react-hot-toast'

export default function StudentExam() {
  const { examId } = useParams<{ examId: string }>()
  const navigate = useNavigate()
  const store = useExamStore()
  const [showNav, setShowNav] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [timeLeft, setTimeLeft] = useState(0)
  const autoSaveRef = useRef<ReturnType<typeof setTimeout>>()

  const { data: exam, isLoading } = useQuery({
    queryKey: ['exam', examId],
    queryFn: () => examsApi.get(examId!),
    enabled: !!examId,
  })

  const startMutation = useMutation({
    mutationFn: () => examsApi.startAttempt(examId!),
    onSuccess: (data) => {
      if (exam?.questions) {
        store.startExam(examId!, data.id, exam.questions, exam.duration_min)
        setTimeLeft(exam.duration_min * 60)
        if (data.current_q_index) store.setCurrentIndex(data.current_q_index)
      }
    },
  })

  const submitMutation = useMutation({
    mutationFn: (answers: any[]) =>
      examsApi.submitAttempt(examId!, store.attemptId!, {
        answers,
        time_spent_sec: store.getTimeElapsed(),
      }),
    onSuccess: (data) => {
      store.finishExam()
      navigate(`/student/results/${examId}/${data.attempt_id}`)
    },
    onError: () => toast.error('Error al enviar el simulacro'),
  })

  const saveAnswer = useCallback(
    async (questionId: string, answer: string | null) => {
      if (!store.attemptId) return
      try {
        await examsApi.saveAnswer(examId!, store.attemptId, {
          question_id: questionId,
          answer_given: answer,
          time_spent: null,
          flagged: store.answers[questionId]?.flagged ?? false,
        })
      } catch {}
    },
    [examId, store.attemptId, store.answers]
  )

  useEffect(() => {
    if (!store.startedAt || store.finished) return
    const interval = setInterval(() => {
      const left = store.getTimeLeft()
      setTimeLeft(left)
      if (left <= 0) { clearInterval(interval); handleSubmit() }
    }, 1000)
    return () => clearInterval(interval)
  }, [store.startedAt, store.finished])

  useEffect(() => {
    if (!exam) return
    if (store.examId !== examId) { store.resetExam(); startMutation.mutate(); return }
    if (!store.attemptId) startMutation.mutate()
  }, [exam, examId])

  useEffect(() => {
    autoSaveRef.current = setInterval(() => {
      const q = store.questions[store.currentIndex]
      if (q && store.answers[q.id]?.answer) saveAnswer(q.id, store.answers[q.id].answer)
    }, 30_000)
    return () => clearInterval(autoSaveRef.current)
  }, [store.currentIndex, store.answers])

  const handleSelect = (letter: string) => {
    const q = store.questions[store.currentIndex]
    if (!q) return
    store.setAnswer(q.id, letter)
    saveAnswer(q.id, letter)
  }

  const handleFlag = () => {
    const q = store.questions[store.currentIndex]
    if (!q) return
    store.toggleFlag(q.id)
  }

  const handleSubmit = () => {
    const answers = store.questions.map((q) => ({
      question_id: q.id,
      answer_given: store.answers[q.id]?.answer ?? null,
      time_spent: store.answers[q.id]?.timeSpent ?? null,
      flagged: store.answers[q.id]?.flagged ?? false,
    }))
    submitMutation.mutate(answers)
    setShowConfirm(false)
  }

  if (isLoading || startMutation.isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div className="text-center">
          <Spinner size="lg" className="mx-auto mb-3" />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Preparando simulacro...</p>
        </div>
      </div>
    )
  }

  const questions = store.questions
  const current = questions[store.currentIndex]
  const totalAnswered = store.getAnsweredCount()
  const flagged = store.getFlaggedIds()
  const warn = timeLeft < 300

  if (!current) return (
    <div className="min-h-screen flex items-center justify-center">
      <p style={{ color: 'var(--text-subtle)' }}>No hay preguntas en este simulacro.</p>
    </div>
  )

  const currentAnswer = store.answers[current.id]?.answer
  const isFlagged = store.answers[current.id]?.flagged

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>

      {/* ── Exam Header ─────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20">
        <div className="max-w-3xl mx-auto" style={{ background: 'var(--primary)', borderBottom: '3px solid var(--nav-active)' }}>
        {/* Top strip: title + timer */}
        <div className="px-5 py-2 flex items-center gap-4">
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <BookMarked size={15} style={{ color: 'var(--nav-active)', flexShrink: 0 }} />
            <span className="text-white text-sm font-semibold truncate"
                  style={{ fontFamily: 'EB Garamond, Georgia, serif', letterSpacing: '0.02em' }}>
              {exam?.title}
            </span>
          </div>

          {/* Progress pill */}
          <div className="hidden md:flex items-center gap-2 text-xs" style={{ color: 'rgba(216,228,240,0.7)' }}>
            <span>{totalAnswered} / {questions.length} respondidas</span>
            <div className="w-28 h-1.5 overflow-hidden" style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div className="h-full transition-all duration-500"
                   style={{ width: `${(totalAnswered / questions.length) * 100}%`, background: 'var(--nav-active)' }} />
            </div>
          </div>

          {/* Timer */}
          <div className="flex items-center gap-2 px-3 py-1"
               style={{ background: warn ? 'rgba(248,113,113,0.2)' : 'rgba(255,255,255,0.1)', border: `1px solid ${warn ? 'rgba(248,113,113,0.4)' : 'rgba(255,255,255,0.15)'}` }}>
            {warn && <AlertTriangle size={13} style={{ color: '#f87171' }} />}
            <TimerDisplay seconds={timeLeft} warn={warn} />
          </div>

          {/* Map button */}
          <button onClick={() => setShowNav(true)}
            className="flex items-center gap-1.5 px-3 py-1 text-sm font-medium transition-colors"
            style={{ color: 'var(--nav-text)', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.07)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.14)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}>
            <Grid3x3 size={13} />
            <span className="hidden sm:inline">Mapa</span>
          </button>

          {/* Submit */}
          <button onClick={() => setShowConfirm(true)} className="btn-gold text-sm py-1"
                  disabled={submitMutation.isPending}>
            <Send size={13} />
            <span className="hidden sm:inline">Entregar</span>
          </button>
        </div>

        {/* Sub-strip: question number breadcrumb */}
        <div className="px-5 pb-1.5 flex items-center gap-3 text-xs"
             style={{ color: 'rgba(216,228,240,0.55)', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <AreaBadge area={current.area} />
          <span>Pregunta {store.currentIndex + 1} de {questions.length}</span>
          <span style={{ color: 'var(--border)' }}>|</span>
          <span>Dificultad {current.difficulty}</span>
          {isFlagged && (
            <span style={{ color: 'var(--nav-active)' }}>▪ Marcada para revisión</span>
          )}
        </div>
        </div>{/* end max-w-3xl */}
      </header>

      {/* ── Main Content ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex">
        <div className="flex-1 max-w-3xl mx-auto w-full px-5 py-6">

          {/* Question number + stem */}
          <div className="mb-5 flex gap-4">
            {/* Big number */}
            <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center text-lg font-bold"
                 style={{ background: 'var(--primary)', color: 'var(--nav-active)', fontFamily: 'EB Garamond, Georgia, serif', border: '1px solid var(--primary-dark)' }}>
              {store.currentIndex + 1}
            </div>
            {/* Enunciado */}
            <div className="flex-1 card py-4">
              <p className="leading-relaxed" style={{ color: 'var(--text)', fontSize: '15px' }}>
                {current.enunciado}
              </p>
            </div>
          </div>

          {/* Options */}
          <div className="space-y-2 ml-14">
            {current.opciones?.map((opt) => (
              <button
                key={opt.letra}
                onClick={() => handleSelect(opt.letra)}
                className={clsx('exam-option w-full text-left', currentAnswer === opt.letra && 'exam-option-selected')}
              >
                {/* Letter circle */}
                <div className="w-7 h-7 flex items-center justify-center flex-shrink-0 text-sm font-bold"
                     style={{
                       background: currentAnswer === opt.letra ? 'var(--primary)' : 'var(--surface-2)',
                       color: currentAnswer === opt.letra ? 'white' : 'var(--primary)',
                       border: `1px solid ${currentAnswer === opt.letra ? 'var(--primary-dark)' : 'var(--border)'}`,
                       fontFamily: 'EB Garamond, Georgia, serif',
                     }}>
                  {opt.letra}
                </div>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>{opt.texto}</p>
              </button>
            ))}
          </div>

          {/* Bottom navigation */}
          <div className="flex items-center justify-between pt-6 mt-6"
               style={{ borderTop: '1px solid var(--border)' }}>
            <button
              onClick={() => store.setCurrentIndex(Math.max(0, store.currentIndex - 1))}
              disabled={store.currentIndex === 0}
              className="btn-secondary text-sm">
              <ChevronLeft size={15} /> Anterior
            </button>

            <button
              onClick={handleFlag}
              className="btn text-sm"
              style={{
                background: isFlagged ? 'var(--gold-light)' : 'transparent',
                color: isFlagged ? 'var(--gold)' : 'var(--text-subtle)',
                border: isFlagged ? '1px solid #d4b870' : '1px solid var(--border)',
              }}>
              <Flag size={13} />
              {isFlagged ? 'Desmarcar' : 'Marcar para revisión'}
            </button>

            {store.currentIndex < questions.length - 1 ? (
              <button
                onClick={() => store.setCurrentIndex(store.currentIndex + 1)}
                className="btn-primary text-sm">
                Siguiente <ChevronRight size={15} />
              </button>
            ) : (
              <button onClick={() => setShowConfirm(true)} className="btn-gold text-sm">
                Entregar <Send size={13} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Question Map Modal ──────────────────────────────────────────── */}
      <Modal open={showNav} onClose={() => setShowNav(false)} title="Mapa de preguntas" size="lg">
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2 mb-5">
          {[
            { label: 'Respondidas', value: totalAnswered, color: 'var(--success)' },
            { label: 'Sin responder', value: questions.length - totalAnswered, color: 'var(--text-muted)' },
            { label: 'Marcadas', value: flagged.length, color: 'var(--gold)' },
          ].map(s => (
            <div key={s.label} className="text-center py-3"
                 style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
              <p className="text-xl font-bold" style={{ fontFamily: 'EB Garamond, Georgia, serif', color: s.color }}>{s.value}</p>
              <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-10 gap-1 mb-4">
          {questions.map((q, idx) => {
            const ans = store.answers[q.id]
            const hasAnswer = !!ans?.answer
            const marked = !!ans?.flagged
            const isCurrent = idx === store.currentIndex
            return (
              <button
                key={q.id}
                onClick={() => { store.setCurrentIndex(idx); setShowNav(false) }}
                className="h-8 text-xs font-bold transition-all"
                style={{
                  background: isCurrent
                    ? 'var(--primary)'
                    : hasAnswer && marked
                    ? 'var(--gold-light)'
                    : hasAnswer
                    ? 'var(--success-light)'
                    : marked
                    ? '#fdf5e0'
                    : 'var(--surface)',
                  color: isCurrent
                    ? 'white'
                    : hasAnswer && marked
                    ? 'var(--gold)'
                    : hasAnswer
                    ? 'var(--success)'
                    : marked
                    ? 'var(--warning)'
                    : 'var(--text-subtle)',
                  border: `1px solid ${isCurrent ? 'var(--primary-dark)' : hasAnswer ? 'var(--border)' : 'var(--border)'}`,
                  fontFamily: 'Courier Prime, Courier New, monospace',
                }}>
                {idx + 1}
              </button>
            )
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 text-xs" style={{ color: 'var(--text-subtle)' }}>
          {[
            { bg: 'var(--primary)', color: 'white', label: 'Actual' },
            { bg: 'var(--success-light)', color: 'var(--success)', label: 'Respondida' },
            { bg: 'var(--gold-light)', color: 'var(--gold)', label: 'Marcada' },
            { bg: 'var(--surface)', color: 'var(--text-subtle)', label: 'Sin responder' },
          ].map(l => (
            <div key={l.label} className="flex items-center gap-1.5">
              <div className="w-4 h-4" style={{ background: l.bg, border: '1px solid var(--border)' }} />
              {l.label}
            </div>
          ))}
        </div>
      </Modal>

      {/* ── Submit Confirm Modal ────────────────────────────────────────── */}
      <Modal open={showConfirm} onClose={() => setShowConfirm(false)} title="Confirmar entrega" size="sm">
        <div className="space-y-3 mb-5">
          <div className="py-3" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            <div className="grid grid-cols-2 divide-x" style={{ borderColor: 'var(--border)' }}>
              <div className="text-center py-2 px-4">
                <p className="text-2xl font-bold" style={{ fontFamily: 'EB Garamond, Georgia, serif', color: 'var(--success)' }}>{totalAnswered}</p>
                <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>Respondidas</p>
              </div>
              <div className="text-center py-2 px-4">
                <p className="text-2xl font-bold" style={{ fontFamily: 'EB Garamond, Georgia, serif', color: 'var(--text-muted)' }}>
                  {questions.length - totalAnswered}
                </p>
                <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>Sin responder</p>
              </div>
            </div>
          </div>

          {questions.length - totalAnswered > 0 && (
            <div className="flex items-center gap-2 px-3 py-2.5 text-sm"
                 style={{ background: 'var(--warning-light)', border: '1px solid #d4c890', borderLeft: '4px solid var(--warning)', color: 'var(--warning)' }}>
              <AlertTriangle size={14} />
              Tiene {questions.length - totalAnswered} pregunta{questions.length - totalAnswered > 1 ? 's' : ''} sin responder.
            </div>
          )}
        </div>

        <div className="flex gap-2 justify-end">
          <button onClick={() => setShowConfirm(false)} className="btn-secondary text-sm">
            Seguir revisando
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitMutation.isPending}
            className="btn-primary text-sm">
            {submitMutation.isPending ? <Spinner size="sm" /> : <CheckCircle2 size={14} />}
            Confirmar entrega
          </button>
        </div>
      </Modal>
    </div>
  )
}
