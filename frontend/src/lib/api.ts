import axios from 'axios'
import { useAuthStore } from '@/store/authStore'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
})

// ── Request interceptor: attach token ─────────────────────────────────────
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().access_token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// ── Response interceptor: auto-refresh on 401 ────────────────────────────
let refreshing = false
let waitQueue: Array<(token: string | null) => void> = []

function flushQueue(token: string | null) {
  waitQueue.forEach((cb) => cb(token))
  waitQueue = []
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true

      if (refreshing) {
        return new Promise((resolve, reject) => {
          waitQueue.push((token) => {
            if (token) {
              original.headers.Authorization = `Bearer ${token}`
              resolve(api(original))
            } else {
              reject(error)
            }
          })
        })
      }

      refreshing = true
      const { refresh_token, setAuth, clearAuth, user } = useAuthStore.getState()

      try {
        const res = await axios.post('/api/auth/refresh', { refresh_token })
        const { access_token, refresh_token: new_refresh, user: updatedUser } = res.data
        setAuth(updatedUser || user!, access_token, new_refresh)
        original.headers.Authorization = `Bearer ${access_token}`
        flushQueue(access_token)
        return api(original)
      } catch {
        clearAuth()
        flushQueue(null)
        window.location.href = '/login'
      } finally {
        refreshing = false
      }
    }

    return Promise.reject(error)
  }
)

export default api

// ── Typed API helpers ──────────────────────────────────────────────────────

export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }).then((r) => r.data),
  register: (data: object) =>
    api.post('/auth/register', data).then((r) => r.data),
  logout: (refresh_token: string) =>
    api.post('/auth/logout', { refresh_token }),
  me: () => api.get('/auth/me').then((r) => r.data),
}

export const questionsApi = {
  list: (params?: object) =>
    api.get('/questions', { params }).then((r) => r.data),
  get: (id: string) => api.get(`/questions/${id}`).then((r) => r.data),
  create: (data: object) => api.post('/questions', data).then((r) => r.data),
  update: (id: string, data: object) =>
    api.put(`/questions/${id}`, data).then((r) => r.data),
  updateStatus: (id: string, status: string) =>
    api.patch(`/questions/${id}/status`, { status }).then((r) => r.data),
  delete: (id: string) => api.delete(`/questions/${id}`),
  stats: () => api.get('/questions/stats/summary').then((r) => r.data),
}

export const examsApi = {
  list: (params?: object) =>
    api.get('/exams', { params }).then((r) => r.data),
  get: (id: string) => api.get(`/exams/${id}`).then((r) => r.data),
  create: (data: object) => api.post('/exams', data).then((r) => r.data),
  createAuto: (data: object) => api.post('/exams/auto', data).then((r) => r.data),
  delete: (id: string) => api.delete(`/exams/${id}`),
  updateVisibility: (id: string, is_public: boolean) =>
    api.patch(`/exams/${id}/visibility`, { is_public }).then((r) => r.data),
  startAttempt: (examId: string) =>
    api.post(`/exams/${examId}/attempts`).then((r) => r.data),
  saveAnswer: (examId: string, attemptId: string, data: object) =>
    api.patch(`/exams/${examId}/attempts/${attemptId}/answer`, data).then((r) => r.data),
  submitAttempt: (examId: string, attemptId: string, data: object) =>
    api.post(`/exams/${examId}/attempts/${attemptId}/submit`, data).then((r) => r.data),
  getResults: (examId: string, attemptId: string) =>
    api.get(`/exams/${examId}/attempts/${attemptId}/results`).then((r) => r.data),
  myAttempts: () => api.get('/exams/my/attempts').then((r) => r.data),
}

export const aiApi = {
  generateQuestion: (data: object) =>
    api.post('/ai/generate-question', data).then((r) => r.data),
  reformulate: (data: object) =>
    api.post('/ai/reformulate', data).then((r) => r.data),
  explain: (data: object) =>
    api.post('/ai/explain', data).then((r) => r.data),
  classify: (data: object) =>
    api.post('/ai/classify', data).then((r) => r.data),
  ocrImport: (file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return api.post('/ai/ocr-import', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000,
    }).then((r) => r.data)
  },
  saveOcrQuestion: (data: object) =>
    api.post('/ai/ocr-save-question', data).then((r) => r.data),
}

export const analyticsApi = {
  myStats: () => api.get('/analytics/student/me').then((r) => r.data),
  courseStats: (courseId: string) =>
    api.get(`/analytics/course/${courseId}`).then((r) => r.data),
  institutionSummary: () =>
    api.get('/analytics/institution/summary').then((r) => r.data),
}

export const usersApi = {
  list: (params?: object) =>
    api.get('/users', { params }).then((r) => r.data),
  get: (id: string) => api.get(`/users/${id}`).then((r) => r.data),
  update: (id: string, data: object) =>
    api.put(`/users/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/users/${id}`),
  stats: () => api.get('/users/stats/summary').then((r) => r.data),
}
