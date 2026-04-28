import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  GraduationCap, Plus, Users, BookOpen,
  Trash2, UserPlus, CheckCircle2, Search
} from 'lucide-react'
import clsx from 'clsx'
import api from '@/lib/api'
import {
  AppLayout, TopHeader, Modal, Spinner, EmptyState, ConfirmDialog
} from '@/components/ui'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'

interface Course {
  id: string; name: string; grade?: string
  school_year?: string; description?: string
  student_count: number; teacher_id?: string
}

// ── Course Form ────────────────────────────────────────────────────────────
function CourseForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [grade, setGrade] = useState('11')
  const [schoolYear, setSchoolYear] = useState(new Date().getFullYear().toString())
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { toast.error('El nombre es requerido'); return }
    setLoading(true)
    try {
      await api.post('/courses', { name, grade, school_year: schoolYear, description })
      toast.success('Curso creado')
      qc.invalidateQueries({ queryKey: ['courses'] })
      onClose()
    } catch {
      toast.error('Error al crear el curso')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleCreate} className="space-y-4">
      <div>
        <label className="label">Nombre del grupo / curso *</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)}
          placeholder="Ej: Grado 11 — Mañana" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Grado</label>
          <select className="input" value={grade} onChange={(e) => setGrade(e.target.value)}>
            {['9','10','11'].map((g) => <option key={g} value={g}>Grado {g}°</option>)}
          </select>
        </div>
        <div>
          <label className="label">Año lectivo</label>
          <input className="input" value={schoolYear} onChange={(e) => setSchoolYear(e.target.value)}
            placeholder="2025" />
        </div>
      </div>
      <div>
        <label className="label">Descripción (opcional)</label>
        <textarea className="input resize-none" rows={2} value={description}
          onChange={(e) => setDescription(e.target.value)} placeholder="Notas sobre el grupo..." />
      </div>
      <div className="flex gap-3 justify-end pt-2">
        <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? <Spinner size="sm" /> : <><CheckCircle2 size={15} /> Crear curso</>}
        </button>
      </div>
    </form>
  )
}

// ── Enroll Modal ───────────────────────────────────────────────────────────
function EnrollModal({ course, onClose }: { course: Course; onClose: () => void }) {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [enrolling, setEnrolling] = useState(false)

  const { data: usersData } = useQuery({
    queryKey: ['students', search],
    queryFn: () => api.get('/users', { params: { role: 'estudiante', search: search || undefined, limit: 30 } }).then(r => r.data),
    staleTime: 30_000,
  })

  const toggle = (id: string) =>
    setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id])

  const handleEnroll = async () => {
    if (selected.length === 0) { toast.error('Selecciona estudiantes'); return }
    setEnrolling(true)
    try {
      const res = await api.post(`/courses/${course.id}/enroll`, { student_ids: selected })
      toast.success(`${res.data.enrolled} estudiante(s) inscritos`)
      onClose()
    } catch {
      toast.error('Error al inscribir')
    } finally {
      setEnrolling(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input className="input pl-9" placeholder="Buscar estudiantes..."
          value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="max-h-56 overflow-y-auto border border-slate-100 rounded-xl divide-y divide-slate-50">
        {(usersData?.items ?? []).map((u: any) => (
          <label key={u.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 cursor-pointer">
            <input type="checkbox" checked={selected.includes(u.id)} onChange={() => toggle(u.id)}
              className="accent-primary-600" />
            <div className="w-7 h-7 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
              {u.full_name?.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-medium text-navy-900">{u.full_name}</p>
              <p className="text-xs text-slate-400">{u.email}</p>
            </div>
          </label>
        ))}
        {(usersData?.items ?? []).length === 0 && (
          <p className="text-center text-xs text-slate-400 py-6">Sin estudiantes encontrados</p>
        )}
      </div>

      {selected.length > 0 && (
        <p className="text-xs text-primary-600 font-medium">{selected.length} seleccionado(s)</p>
      )}

      <div className="flex gap-3 justify-end">
        <button onClick={onClose} className="btn-secondary">Cancelar</button>
        <button onClick={handleEnroll} disabled={enrolling} className="btn-primary">
          {enrolling ? <Spinner size="sm" /> : <><UserPlus size={14} /> Inscribir</>}
        </button>
      </div>
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────
export default function TeacherCourses() {
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [enrollCourse, setEnrollCourse] = useState<Course | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const { data: courses, isLoading } = useQuery({
    queryKey: ['courses'],
    queryFn: () => api.get('/courses').then(r => r.data),
    staleTime: 60_000,
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/courses/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['courses'] }); setDeleteId(null); toast.success('Curso eliminado') },
  })

  return (
    <AppLayout>
      <TopHeader
        title="Mis Cursos"
        subtitle={`${(courses ?? []).length} grupos activos`}
        actions={
          <button onClick={() => setShowCreate(true)} className="btn-primary">
            <Plus size={15} /> Nuevo curso
          </button>
        }
      />

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : (courses ?? []).length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<GraduationCap size={40} />}
            title="Sin cursos aún"
            subtitle="Crea tu primer grupo para inscribir estudiantes y asignar simulacros"
            action={<button onClick={() => setShowCreate(true)} className="btn-primary">Crear primer curso</button>}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {(courses ?? []).map((c: Course) => (
            <div key={c.id} className="card flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <div className="w-10 h-10 bg-emerald-100 rounded-2xl flex items-center justify-center flex-shrink-0">
                  <GraduationCap size={18} className="text-emerald-600" />
                </div>
                <button onClick={() => setDeleteId(c.id)} className="btn-ghost p-1.5 rounded-lg text-slate-300 hover:text-red-400">
                  <Trash2 size={14} />
                </button>
              </div>

              <div>
                <h3 className="font-semibold text-navy-900">{c.name}</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {c.grade ? `Grado ${c.grade}°` : ''} {c.school_year ? `· ${c.school_year}` : ''}
                </p>
                {c.description && (
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">{c.description}</p>
                )}
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-500 border-t border-slate-100 pt-3">
                <Users size={12} />
                <span>{c.student_count} estudiante(s)</span>
              </div>

              <button
                onClick={() => setEnrollCourse(c)}
                className="btn-outline text-xs w-full justify-center"
              >
                <UserPlus size={13} /> Inscribir estudiantes
              </button>
            </div>
          ))}
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Nuevo Curso" size="sm">
        <CourseForm onClose={() => setShowCreate(false)} />
      </Modal>

      <Modal open={!!enrollCourse} onClose={() => setEnrollCourse(null)}
        title={`Inscribir en: ${enrollCourse?.name ?? ''}`} size="md">
        {enrollCourse && <EnrollModal course={enrollCourse} onClose={() => setEnrollCourse(null)} />}
      </Modal>

      <ConfirmDialog
        open={!!deleteId} onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteMut.mutate(deleteId)}
        title="Eliminar curso"
        message="¿Eliminar este curso? Los estudiantes serán desincritos."
        loading={deleteMut.isPending}
      />
    </AppLayout>
  )
}
