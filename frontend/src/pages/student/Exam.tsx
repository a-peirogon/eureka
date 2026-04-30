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

  // Load exam
  const { data: exam, isLoading } = useQuery({
    queryKey: ['exam', examId],
    queryFn: () => examsApi.get(examId!),
    enabled: !!examId,
  })

  // Start / resume attempt
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

  // Submit
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

  // Auto-save answer
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

  // Timer
  useEffect(() => {
    if (!store.startedAt || store.finished) return
    const interval = setInterval(() => {
      const left = store.getTimeLeft()
      setTimeLeft(left)
      if (left <= 0) {
        clearInterval(interval)
        handleSubmit()
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [store.startedAt, store.finished])

  // Start exam on load
  useEffect(() => {
    if (!exam) return

      if (store.examId !== examId) {
        store.resetExam()
        startMutation.mutate()
        return
      }

      if (!store.attemptId) {
        startMutation.mutate()
      }
  }, [exam, examId])

  // Auto-save every 30s
  useEffect(() => {
    autoSaveRef.current = setInterval(() => {
      const q = store.questions[store.currentIndex]
      if (q && store.answers[q.id]?.answer) {
        saveAnswer(q.id, store.answers[q.id].answer)
      }
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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Spinner size="lg" className="mx-auto mb-3" />
          <p className="text-slate-500">Preparando simulacro...</p>
        </div>
      </div>
    )
  }

  const questions = store.questions
  const current = questions[store.currentIndex]
  const totalAnswered = store.getAnsweredCount()
  const flagged = store.getFlaggedIds()
  const warn = timeLeft < 300 // last 5 minutes

  if (!current) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-slate-400">No hay preguntas en este simulacro.</p>
    </div>
  )

  const currentAnswer = store.answers[current.id]?.answer
  const isFlagged = store.answers[current.id]?.flagged

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Bar */}
      <header className="bg-slate-900 text-white px-6 py-3 flex items-center gap-4 sticky top-0 z-20">
        <div className="flex items-center gap-2">
          <BookMarked size={18} className="text-amber-600" />
          <span className="font-semibold text-sm truncate max-w-[200px]">{exam?.title}</span>
        </div>

        <div className="flex-1" />

        {/* Progress */}
        <div className="hidden md:flex items-center gap-2 text-xs text-white/60">
          <span>{totalAnswered}/{questions.length}</span>
          <div className="w-24 h-1.5 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-100 rounded-full transition-all"
              style={{ width: `${(totalAnswered / questions.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Timer */}
        <div className={clsx(
          'flex items-center gap-2 px-3 py-1.5 rounded-2xl',
          warn ? 'bg-red-900/50' : 'bg-white/10'
        )}>
          {warn && <AlertTriangle size={14} className="text-red-400" />}
          <TimerDisplay seconds={timeLeft} warn={warn} />
        </div>

        {/* Nav toggle */}
        <button
          onClick={() => setShowNav(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-2xl text-sm transition-colors"
        >
          <Grid3x3 size={15} />
          <span className="hidden sm:inline">Mapa</span>
        </button>

        {/* Submit */}
        <button
          onClick={() => setShowConfirm(true)}
          className="btn-gold text-sm py-1.5"
          disabled={submitMutation.isPending}
        >
          <Send size={14} />
          <span className="hidden sm:inline">Entregar</span>
        </button>
      </header>

      {/* Main content */}
      <div className="flex-1 flex">
        {/* Question panel */}
        <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full p-6">
          {/* Question header */}
          <div className="flex items-center gap-3 mb-4">
            <span className="text-sm font-medium text-slate-500">
              Pregunta {store.currentIndex + 1} de {questions.length}
            </span>
            <AreaBadge area={current.area} />
            <span className="badge badge-gray text-xs">Dif. {current.difficulty}</span>
            {isFlagged && (
              <span className="badge badge-yellow flex items-center gap-1"><Flag size={10} /> Marcada</span>
            )}
          </div>

          {/* Enunciado */}
          <div className="card mb-6 flex-shrink-0">
            <p className="text-slate-800 leading-relaxed text-base">{current.enunciado}</p>
          </div>

          {/* Options */}
          <div className="space-y-3 flex-1">
            {current.opciones?.map((opt) => (
              <button
                key={opt.letra}
                onClick={() => handleSelect(opt.letra)}
                className={clsx(
                  'exam-option w-full text-left',
                  currentAnswer === opt.letra && 'exam-option-selected'
                )}
              >
                <div className={clsx(
                  'w-8 h-8 rounded-full border-2 flex items-center justify-center flex-shrink-0 font-bold text-sm',
                  currentAnswer === opt.letra
                    ? 'border-blue-400 bg-blue-600 text-white'
                    : 'border-slate-300 text-slate-500'
                )}>
                  {opt.letra}
                </div>
                <p className="text-slate-700 text-sm leading-relaxed">{opt.texto}</p>
              </button>
            ))}
          </div>

          {/* Bottom nav */}
          <div className="flex items-center justify-between pt-6 mt-4 border-t border-slate-200">
            <button
              onClick={() => store.setCurrentIndex(Math.max(0, store.currentIndex - 1))}
              disabled={store.currentIndex === 0}
              className="btn-secondary"
            >
              <ChevronLeft size={16} /> Anterior
            </button>

            <button
              onClick={handleFlag}
              className={clsx(
                'btn flex items-center gap-2',
                isFlagged ? 'text-amber-600 bg-amber-50 border border-amber-200' : 'btn-ghost text-slate-500'
              )}
            >
              <Flag size={15} />
              {isFlagged ? 'Desmarcar' : 'Marcar'}
            </button>

            {store.currentIndex < questions.length - 1 ? (
              <button
                onClick={() => store.setCurrentIndex(store.currentIndex + 1)}
                className="btn-primary"
              >
                Siguiente <ChevronRight size={16} />
              </button>
            ) : (
              <button onClick={() => setShowConfirm(true)} className="btn-gold">
                Entregar <Send size={15} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Question Navigator Modal */}
      <Modal open={showNav} onClose={() => setShowNav(false)} title="Mapa de preguntas" size="lg">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="text-center p-3 bg-slate-50 rounded-2xl">
            <p className="text-2xl font-bold text-slate-900">{totalAnswered}</p>
            <p className="text-xs text-slate-500">Respondidas</p>
          </div>
          <div className="text-center p-3 bg-slate-50 rounded-2xl">
            <p className="text-2xl font-bold text-amber-600">{flagged.length}</p>
            <p className="text-xs text-slate-500">Marcadas</p>
          </div>
        </div>

        <div className="grid grid-cols-8 gap-1.5 mb-4">
          {questions.map((q, idx) => {
            const ans = store.answers[q.id]
            const hasAnswer = !!ans?.answer
            const marked = !!ans?.flagged
            return (
              <button
                key={q.id}
                onClick={() => { store.setCurrentIndex(idx); setShowNav(false) }}
                className={clsx(
                  'h-9 rounded-lg text-xs font-semibold border-2 transition-all',
                  idx === store.currentIndex
                    ? 'border-blue-400 bg-blue-600 text-white'
                    : hasAnswer && marked
                    ? 'border-amber-400 bg-amber-100 text-amber-700'
                    : hasAnswer
                    ? 'border-emerald-400 bg-emerald-100 text-emerald-700'
                    : marked
                    ? 'border-amber-300 bg-amber-50 text-amber-600'
                    : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                )}
              >
                {idx + 1}
              </button>
            )
          })}
        </div>

        <div className="flex gap-4 text-xs text-slate-500 flex-wrap">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-emerald-100 border-2 border-emerald-400" />
            Respondida
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-amber-50 border-2 border-amber-300" />
            Marcada
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-white border-2 border-slate-200" />
            Sin responder
          </div>
        </div>
      </Modal>

      {/* Submit Confirm */}
      <Modal open={showConfirm} onClose={() => setShowConfirm(false)} title="Entregar simulacro" size="sm">
        <div className="space-y-3 mb-6">
          <div className="p-4 bg-slate-50 rounded-2xl">
            <div className="grid grid-cols-2 gap-3 text-center">
              <div>
                <p className="text-2xl font-bold text-slate-900">{totalAnswered}</p>
                <p className="text-xs text-slate-500">Respondidas</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-400">
                  {questions.length - totalAnswered}
                </p>
                <p className="text-xs text-slate-500">Sin responder</p>
              </div>
            </div>
          </div>

          {questions.length - totalAnswered > 0 && (
            <div className="flex items-center gap-2 text-amber-700 bg-amber-50 p-3 rounded-2xl text-sm">
              <AlertTriangle size={15} />
              Tienes {questions.length - totalAnswered} preguntas sin responder.
            </div>
          )}
        </div>

        <div className="flex gap-3 justify-end">
          <button onClick={() => setShowConfirm(false)} className="btn-secondary">
            Seguir revisando
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitMutation.isPending}
            className="btn-primary"
          >
            {submitMutation.isPending ? <Spinner size="sm" /> : (
              <><CheckCircle2 size={15} /> Confirmar entrega</>
            )}
          </button>
        </div>
      </Modal>
    </div>
  )
}
