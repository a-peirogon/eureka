// ── Auth ───────────────────────────────────────────────────────────────────

export type UserRole = 'estudiante' | 'docente' | 'admin'

export interface User {
  id: string
  email: string
  full_name: string
  role: UserRole
  grade?: string
  avatar_url?: string
  institution_id?: string
  last_login?: string
  created_at?: string
}

export interface AuthState {
  user: User | null
  access_token: string | null
  refresh_token: string | null
}

export interface LoginResponse {
  access_token: string
  refresh_token: string
  token_type: string
  user: User
}

// ── Questions ──────────────────────────────────────────────────────────────

export type QuestionArea =
  | 'matematicas'
  | 'lectura_critica'
  | 'sociales_ciudadanas'
  | 'ciencias_naturales'
  | 'ingles'

export type QuestionStatus = 'borrador' | 'aprobado' | 'archivado'
export type QuestionDifficulty = '1' | '2' | '3' | '4' | '5'

export interface QuestionOption {
  letra: string
  texto: string
}

export interface Question {
  id: string
  area: QuestionArea
  competencia?: string
  componente?: string
  difficulty: QuestionDifficulty
  enunciado: string
  opciones: QuestionOption[]
  respuesta_correcta: string
  explicacion?: string
  tiempo_estimado: number
  latex_content?: string
  status: QuestionStatus
  source: 'manual' | 'ia' | 'ocr' | 'import'
  times_used: number
  times_correct: number
  accuracy_rate?: number
  author_id?: string
  tags: string[]
  created_at: string
  updated_at: string
}

export interface QuestionsPage {
  total: number
  page: number
  limit: number
  pages: number
  items: Question[]
}

// ── Exams ──────────────────────────────────────────────────────────────────

export type ExamStatus = 'pendiente' | 'en_progreso' | 'completado' | 'abandonado'

export interface ExamQuestion {
  id: string
  orden: number
  area: QuestionArea
  difficulty: QuestionDifficulty
  enunciado: string
  opciones: QuestionOption[]
  tiempo_estimado: number
}

export interface MockExam {
  id: string
  title: string
  description?: string
  duration_min: number
  is_public: boolean
  auto_generated: boolean
  areas_config: Record<string, number>
  course_id?: string
  available_from?: string
  available_until?: string
  question_count: number
  questions?: ExamQuestion[]
  created_at: string
}

// ── Attempts ───────────────────────────────────────────────────────────────

export interface AnswerRecord {
  question_id: string
  answer_given: string | null
  is_correct: boolean | null
  time_spent: number | null
  flagged: boolean
}

export interface AttemptResult {
  attempt_id: string
  exam_id: string
  status: ExamStatus
  score_global: number
  score_by_area: Record<string, number>
  started_at: string
  finished_at?: string
  time_spent_sec?: number
  answers: {
    question_id: string
    enunciado: string
    area: QuestionArea
    opciones: QuestionOption[]
    respuesta_correcta: string
    respuesta_dada: string | null
    is_correct: boolean
    explicacion?: string
    time_spent?: number
    flagged: boolean
  }[]
}

export interface AttemptSummary {
  id: string
  exam_id: string
  exam_title?: string
  status: ExamStatus
  score_global?: number
  score_by_area: Record<string, number>
  started_at: string
  finished_at?: string
  time_spent_sec?: number
}

// ── Analytics ──────────────────────────────────────────────────────────────

export interface StudentAnalytics {
  total_simulacros: number
  puntaje_promedio?: number
  mejor_puntaje?: number
  evolucion: { fecha: string; score: number }[]
  por_area: Record<string, number>
  preguntas_respondidas: number
  tasa_acierto?: number
  tendencia: 'mejorando' | 'estable' | 'sin_datos'
  area_mas_debil?: QuestionArea
  semana_actual: { simulacros: number; promedio?: number }
}

export interface CourseAnalytics {
  course_id: string
  student_count: number
  total_intentos: number
  promedio_curso?: number
  por_area: Record<string, number>
  preguntas_mas_falladas: {
    question_id: string
    enunciado_preview: string
    area: QuestionArea
    tasa_error: number
    total_intentos: number
  }[]
  ranking: {
    student_id: string
    full_name: string
    promedio: number
    simulacros: number
    posicion: number
  }[]
  evolucion_semanal: { semana: string; promedio: number; intentos: number }[]
  area_mas_debil?: QuestionArea
  tasa_mejora?: number
}

// ── AI ─────────────────────────────────────────────────────────────────────

export interface GeneratedQuestion {
  enunciado: string
  opcion_a: string
  opcion_b: string
  opcion_c: string
  opcion_d: string
  respuesta_correcta: string
  explicacion: string
  competencia?: string
  componente?: string
  difficulty: string
}

export interface OCRQuestion {
  enunciado: string
  opcion_a: string
  opcion_b: string
  opcion_c: string
  opcion_d: string
  respuesta_correcta: string | null
  area: QuestionArea
  difficulty: string
  latex_content?: string
  tiene_imagen: boolean
}

// ── Pagination ─────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  total: number
  page: number
  items: T[]
}

// ── UI Helpers ─────────────────────────────────────────────────────────────

export const AREA_LABELS: Record<QuestionArea, string> = {
  matematicas: 'Matemáticas',
  lectura_critica: 'Lectura Crítica',
  sociales_ciudadanas: 'Sociales y Ciudadanas',
  ciencias_naturales: 'Ciencias Naturales',
  ingles: 'Inglés',
}

export const AREA_COLORS: Record<QuestionArea, string> = {
  matematicas: '#3b82f6',
  lectura_critica: '#8b5cf6',
  sociales_ciudadanas: '#f59e0b',
  ciencias_naturales: '#10b981',
  ingles: '#ef4444',
}

export const AREA_BG: Record<QuestionArea, string> = {
  matematicas: 'area-mat',
  lectura_critica: 'area-lc',
  sociales_ciudadanas: 'area-soc',
  ciencias_naturales: 'area-cn',
  ingles: 'area-ing',
}

export const DIFFICULTY_LABELS: Record<string, string> = {
  '1': 'Muy fácil',
  '2': 'Fácil',
  '3': 'Medio',
  '4': 'Difícil',
  '5': 'Muy difícil',
}

export const STATUS_LABELS: Record<QuestionStatus, string> = {
  borrador: 'Borrador',
  aprobado: 'Aprobado',
  archivado: 'Archivado',
}
