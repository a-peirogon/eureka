import React, { Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { useAuthStore } from '@/store/authStore'
import type { UserRole } from '@/types'
import { LoadingPage } from '@/components/ui'

// Pages (lazy loaded)
const Login = React.lazy(() => import('@/pages/Login'))
const StudentDashboard  = React.lazy(() => import('@/pages/student/Dashboard'))
const StudentExamsList  = React.lazy(() => import('@/pages/student/ExamsList'))
const StudentExam       = React.lazy(() => import('@/pages/student/Exam'))
const StudentResults    = React.lazy(() => import('@/pages/student/Results'))
const StudentResultsHistory = React.lazy(() => import('@/pages/student/ResultsHistory'))
const TeacherCourses    = React.lazy(() => import('@/pages/teacher/Courses'))
const TeacherDashboard  = React.lazy(() => import('@/pages/teacher/Dashboard'))
const TeacherQuestions  = React.lazy(() => import('@/pages/teacher/Questions'))
const TeacherExams      = React.lazy(() => import('@/pages/teacher/Exams'))
const TeacherImport     = React.lazy(() => import('@/pages/teacher/Import'))
const TeacherAnalytics  = React.lazy(() => import('@/pages/teacher/Analytics'))
const AdminUsers        = React.lazy(() => import('@/pages/admin/Users'))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
})

// ── Guards ─────────────────────────────────────────────────────────────────

function RequireAuth({ roles }: { roles?: UserRole[] }) {
  const { user, access_token } = useAuthStore()
  if (!access_token || !user) return <Navigate to="/login" replace />
  if (roles && !roles.includes(user.role)) {
    const fallback = user.role === 'estudiante' ? '/student/dashboard' : '/teacher/dashboard'
    return <Navigate to={fallback} replace />
  }
  return <Outlet />
}

function RedirectByRole() {
  const { user, isAuthenticated } = useAuthStore()
  if (!isAuthenticated()) return <Navigate to="/login" replace />
  if (user?.role === 'estudiante') return <Navigate to="/student/dashboard" replace />
  return <Navigate to="/teacher/dashboard" replace />
}

// ── App ────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Suspense fallback={<LoadingPage />}>
          <Routes>
            {/* Public */}
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<RedirectByRole />} />

            {/* Student routes */}
            <Route element={<RequireAuth roles={['estudiante']} />}>
              <Route path="/student/dashboard" element={<StudentDashboard />} />
              <Route path="/student/exams" element={<StudentExamsList />} />
              <Route path="/student/exam/:examId" element={<StudentExam />} />
              <Route path="/student/results" element={<StudentResultsHistory />} />
              <Route path="/student/results/:examId/:attemptId" element={<StudentResults />} />
            </Route>

            {/* Teacher routes */}
            <Route element={<RequireAuth roles={['docente', 'admin']} />}>
              <Route path="/teacher/courses"   element={<TeacherCourses />} />
              <Route path="/teacher/dashboard" element={<TeacherDashboard />} />
              <Route path="/teacher/questions" element={<TeacherQuestions />} />
              <Route path="/teacher/exams" element={<TeacherExams />} />
              <Route path="/teacher/import" element={<TeacherImport />} />
              <Route path="/teacher/analytics" element={<TeacherAnalytics />} />
            </Route>

            {/* Admin routes */}
            <Route element={<RequireAuth roles={['admin']} />}>
              <Route path="/admin/users" element={<AdminUsers />} />
            </Route>

            {/* 404 */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>

      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            borderRadius: '2px',
            fontSize: '14px',
            fontFamily: '"Source Sans 3", Georgia, serif',
            boxShadow: '0 2px 12px rgba(0,0,0,.12)',
            border: '1px solid #d8d0c0',
            background: '#fdfcf8',
            color: '#1c1a16',
          },
          success: { style: { background: '#f0f7f3', color: '#276749', border: '1px solid #a7d4b8' } },
          error:   { style: { background: '#fdf0f0', color: '#8b2c2c', border: '1px solid #d4a4a4' } },
        }}
      />
    </QueryClientProvider>
  )
}
