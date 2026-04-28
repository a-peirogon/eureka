import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ExamQuestion, QuestionArea } from '@/types'

interface AnswerMap {
  [questionId: string]: {
    answer: string | null
    flagged: boolean
    timeSpent: number
    answeredAt?: string
  }
}

interface ExamStore {
  // Session
  examId: string | null
  attemptId: string | null
  questions: ExamQuestion[]
  answers: AnswerMap
  currentIndex: number
  startedAt: number | null   // timestamp
  durationSec: number        // exam duration in seconds
  finished: boolean

  // Actions
  startExam: (examId: string, attemptId: string, questions: ExamQuestion[], durationMin: number) => void
  setAnswer: (questionId: string, answer: string | null) => void
  toggleFlag: (questionId: string) => void
  setCurrentIndex: (idx: number) => void
  finishExam: () => void
  resetExam: () => void

  // Derived
  getTimeElapsed: () => number
  getTimeLeft: () => number
  getAnsweredCount: () => number
  getFlaggedIds: () => string[]
  getScoreByArea: () => Record<string, { answered: number; total: number }>
}

export const useExamStore = create<ExamStore>()(
  persist(
    (set, get) => ({
      examId: null,
      attemptId: null,
      questions: [],
      answers: {},
      currentIndex: 0,
      startedAt: null,
      durationSec: 10800,
      finished: false,

      startExam: (examId, attemptId, questions, durationMin) =>
        set({
          examId,
          attemptId,
          questions,
          answers: {},
          currentIndex: 0,
          startedAt: Date.now(),
          durationSec: durationMin * 60,
          finished: false,
        }),

      setAnswer: (questionId, answer) =>
        set((s) => ({
          answers: {
            ...s.answers,
            [questionId]: {
              ...s.answers[questionId],
              answer,
              answeredAt: new Date().toISOString(),
              flagged: s.answers[questionId]?.flagged ?? false,
              timeSpent: s.answers[questionId]?.timeSpent ?? 0,
            },
          },
        })),

      toggleFlag: (questionId) =>
        set((s) => ({
          answers: {
            ...s.answers,
            [questionId]: {
              ...s.answers[questionId],
              answer: s.answers[questionId]?.answer ?? null,
              flagged: !(s.answers[questionId]?.flagged ?? false),
              timeSpent: s.answers[questionId]?.timeSpent ?? 0,
            },
          },
        })),

      setCurrentIndex: (idx) => set({ currentIndex: idx }),

      finishExam: () => set({ finished: true }),

      resetExam: () =>
        set({
          examId: null,
          attemptId: null,
          questions: [],
          answers: {},
          currentIndex: 0,
          startedAt: null,
          finished: false,
        }),

      getTimeElapsed: () => {
        const { startedAt } = get()
        if (!startedAt) return 0
        return Math.floor((Date.now() - startedAt) / 1000)
      },

      getTimeLeft: () => {
        const { startedAt, durationSec } = get()
        if (!startedAt) return durationSec
        const elapsed = Math.floor((Date.now() - startedAt) / 1000)
        return Math.max(0, durationSec - elapsed)
      },

      getAnsweredCount: () => {
        const { answers } = get()
        return Object.values(answers).filter((a) => a.answer !== null).length
      },

      getFlaggedIds: () => {
        const { answers } = get()
        return Object.entries(answers)
          .filter(([, v]) => v.flagged)
          .map(([k]) => k)
      },

      getScoreByArea: () => {
        const { questions, answers } = get()
        const result: Record<string, { answered: number; total: number }> = {}
        for (const q of questions) {
          const area = q.area
          if (!result[area]) result[area] = { answered: 0, total: 0 }
          result[area].total++
          if (answers[q.id]?.answer !== null && answers[q.id]?.answer !== undefined) {
            result[area].answered++
          }
        }
        return result
      },
    }),
    {
      name: 'eureka-exam-session',
      partialize: (state) => ({
        examId: state.examId,
        answers: state.answers,
        currentIndex: state.currentIndex,
        startedAt: state.startedAt,
        durationSec: state.durationSec,
        finished: state.finished,
        questions: state.questions
      })
    }
  )
)
