import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, FileText, Wand2, Trash2, Eye, Clock,
  Users, BookOpen, CheckCircle2, ToggleLeft, ToggleRight
} from 'lucide-react'
import clsx from 'clsx'
import { examsApi, questionsApi } from '@/lib/api'
import {
  AppLayout, TopHeader, Modal, Spinner, EmptyState, ConfirmDialog
} from '@/components/ui'
import { AREA_LABELS, type QuestionArea } from '@/types'
import toast from 'react-hot-toast'

const AREAS: QuestionArea[] = ['matematicas', 'lectura_critica', 'sociales_ciudadanas', 'ciencias_naturales', 'ingles']

// ── Auto Exam Form ─────────────────────────────────────────────────────────
function AutoExamForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [title, setTitle] = useState('')
  const [durationMin, setDurationMin] = useState(180)
  const [isPublic, setIsPublic] = useState(true)
  const [config, setConfig] = useState<Record<string, number>>({
    matematicas: 10, lectura_critica: 10,
    sociales_ciudadanas: 10, ciencias_naturales: 10, ingles: 5,
  })
  const [loading, setLoading] = useState(false)

  const total = Object.values(config).reduce((a, b) => a + b, 0)

  const handleCreate = async () => {
    if (!title.trim()) { toast.error('El título es requerido'); return }
    setLoading(true)
    try {
      await examsApi.createAuto({
        title, duration_min: durationMin, is_public: isPublic,
        areas_config: config,
      })
      toast.success('Simulacro automático creado correctamente')
      qc.invalidateQueries({ queryKey: ['exams'] })
      onClose()
    } catch (err: any) {
      toast.error(err?.response?.data?.detail ?? 'Error al crear el simulacro')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="p-3 bg-purple-50 border border-purple-100 rounded-xl text-xs text-purple-700">
        El sistema seleccionará preguntas aprobadas aleatoriamente según la distribución que definas.
      </div>

      <div>
        <label className="label">Título del simulacro</label>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)}
          placeholder="Ej: Simulacro ICFES Junio 2025" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Duración (minutos)</label>
          <input type="number" className="input" value={durationMin}
            onChange={(e) => setDurationMin(Number(e.target.value))} min={30} max={360} />
        </div>
        <div className="flex items-end pb-1">
          <button
            type="button"
            onClick={() => setIsPublic(!isPublic)}
            className="flex items-center gap-2 text-sm text-slate-600"
          >
            {isPublic
              ? <ToggleRight size={22} className="text-primary-600" />
              : <ToggleLeft size={22} className="text-slate-400" />
            }
            {isPublic ? 'Público' : 'Solo con enlace'}
          </button>
        </div>
      </div>

      <div>
        <div className="flex justify-between mb-2">
          <label className="label mb-0">Preguntas por área</label>
          <span className="text-xs text-slate-400">Total: <strong>{total}</strong> preguntas</span>
        </div>
        <div className="space-y-3">
          {AREAS.map((a) => (
            <div key={a} className="flex items-center gap-3">
              <span className="text-sm text-slate-600 w-44 flex-shrink-0">{AREA_LABELS[a]}</span>
              <input
                type="range" min={0} max={25} value={config[a] ?? 0}
                onChange={(e) => setConfig({ ...config, [a]: Number(e.target.value) })}
                className="flex-1 accent-primary-600"
              />
              <span className="w-8 text-center text-sm font-semibold text-navy-900">{config[a] ?? 0}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3 justify-end pt-2">
        <button onClick={onClose} className="btn-secondary">Cancelar</button>
        <button onClick={handleCreate} disabled={loading || total === 0} className="btn bg-purple-600 text-white hover:bg-purple-700">
          {loading ? <Spinner size="sm" /> : <><Wand2 size={15} /> Generar simulacro</>}
        </button>
      </div>
    </div>
  )
}

// ── Manual Exam Form ───────────────────────────────────────────────────────
function ManualExamForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [durationMin, setDurationMin] = useState(180)
  const [isPublic, setIsPublic] = useState(true)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [filterArea, setFilterArea] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)

  const { data: qData } = useQuery({
    queryKey: ['questions-for-exam', filterArea, search],
    queryFn: () => questionsApi.list({ status: 'aprobado', limit: 50, area: filterArea || undefined, search: search || undefined }),
    staleTime: 30_000,
  })

  const toggle = (id: string) =>
    setSelectedIds((ids) => ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id])

  const handleCreate = async () => {
    if (!title.trim()) { toast.error('El título es requerido'); return }
    if (selectedIds.length === 0) { toast.error('Selecciona al menos una pregunta'); return }
    setLoading(true)
    try {
      await examsApi.create({ title, description, duration_min: durationMin, is_public: isPublic, question_ids: selectedIds })
      toast.success('Simulacro creado correctamente')
      qc.invalidateQueries({ queryKey: ['exams'] })
      onClose()
    } catch (err: any) {
      toast.error(err?.response?.data?.detail ?? 'Error al crear el simulacro')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="label">Título</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título del simulacro" />
        </div>
        <div>
          <label className="label">Duración (min)</label>
          <input type="number" className="input" value={durationMin} onChange={(e) => setDurationMin(Number(e.target.value))} />
        </div>
        <div className="flex items-end pb-1">
          <button type="button" onClick={() => setIsPublic(!isPublic)} className="flex items-center gap-2 text-sm text-slate-600">
            {isPublic ? <ToggleRight size={22} className="text-primary-600" /> : <ToggleLeft size={22} className="text-slate-400" />}
            {isPublic ? 'Público' : 'Privado'}
          </button>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="label mb-0">Seleccionar preguntas</label>
          <span className="text-xs text-slate-400">{selectedIds.length} seleccionadas</span>
        </div>
        <div className="flex gap-2 mb-3">
          <input className="input text-sm flex-1" placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className="input text-sm w-auto" value={filterArea} onChange={(e) => setFilterArea(e.target.value)}>
            <option value="">Todas</option>
            {AREAS.map((a) => <option key={a} value={a}>{AREA_LABELS[a].split(' ')[0]}</option>)}
          </select>
        </div>
        <div className="max-h-52 overflow-y-auto space-y-1.5 border border-slate-100 rounded-xl p-2">
          {(qData?.items ?? []).map((q: any) => (
            <label key={q.id} className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-slate-50 cursor-pointer">
              <input type="checkbox" checked={selectedIds.includes(q.id)}
                onChange={() => toggle(q.id)} className="mt-0.5 accent-primary-600" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-700 line-clamp-1">{q.enunciado}</p>
                <div className="flex gap-1.5 mt-0.5">
                  <span className="text-[10px] text-slate-400">{AREA_LABELS[q.area as QuestionArea]?.split(' ')[0]}</span>
                  <span className="text-[10px] text-slate-300">·</span>
                  <span className="text-[10px] text-slate-400">Dif. {q.difficulty}</span>
                </div>
              </div>
            </label>
          ))}
          {(qData?.items ?? []).length === 0 && (
            <p className="text-center text-xs text-slate-400 py-4">No hay preguntas aprobadas disponibles</p>
          )}
        </div>
      </div>

      <div className="flex gap-3 justify-end pt-2">
        <button onClick={onClose} className="btn-secondary">Cancelar</button>
        <button onClick={handleCreate} disabled={loading} className="btn-primary">
          {loading ? <Spinner size="sm" /> : <><CheckCircle2 size={15} /> Crear simulacro</>}
        </button>
      </div>
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────
export default function TeacherExams() {
  const qc = useQueryClient()
  const [showManual, setShowManual] = useState(false)
  const [showAuto, setShowAuto] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [viewExam, setViewExam] = useState<any>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['exams'],
    queryFn: () => examsApi.list({ limit: 50 }),
    staleTime: 30_000,
  })

  const deleteMut = useMutation({
    mutationFn: examsApi.delete,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['exams'] }); setDeleteId(null); toast.success('Simulacro eliminado') },
  })

  const visibilityMut = useMutation({
    mutationFn: ({ id, is_public }: { id: string; is_public: boolean }) =>
      examsApi.updateVisibility(id, is_public),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['exams'] })
      toast.success(vars.is_public ? 'Simulacro publicado ✓' : 'Simulacro ocultado')
    },
    onError: () => toast.error('Error al cambiar visibilidad'),
  })

  const { data: viewData, isLoading: loadingView } = useQuery({
    queryKey: ['exam-detail', viewExam?.id],
    queryFn: () => examsApi.get(viewExam.id),
    enabled: !!viewExam,
  })

  const exams = data?.items ?? []

  return (
    <AppLayout>
      <TopHeader
        title="Simulacros"
        subtitle={`${exams.length} simulacros creados`}
        actions={
          <div className="flex gap-2">
            <button onClick={() => setShowAuto(true)} className="btn bg-purple-600 text-white hover:bg-purple-700 text-sm">
              <Wand2 size={15} /> Automático
            </button>
            <button onClick={() => setShowManual(true)} className="btn-primary text-sm">
              <Plus size={15} /> Manual
            </button>
          </div>
        }
      />

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : exams.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<FileText size={40} />}
            title="Sin simulacros"
            subtitle="Crea tu primer simulacro manual o automático"
            action={
              <div className="flex gap-3">
                <button onClick={() => setShowManual(true)} className="btn-outline text-sm">Manual</button>
                <button onClick={() => setShowAuto(true)} className="btn-primary text-sm">
                  <Wand2 size={14} /> Automático
                </button>
              </div>
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {exams.map((exam: any) => (
            <div key={exam.id} className="card-hover">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  {exam.auto_generated
                    ? <div className="w-8 h-8 bg-purple-100 rounded-xl flex items-center justify-center"><Wand2 size={15} className="text-purple-600" /></div>
                    : <div className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center"><FileText size={15} className="text-blue-600" /></div>
                  }
                  <button
                    onClick={() => visibilityMut.mutate({ id: exam.id, is_public: !exam.is_public })}
                    disabled={visibilityMut.isPending}
                    title={exam.is_public ? 'Clic para ocultar' : 'Clic para publicar para estudiantes'}
                    className={clsx(
                      'badge text-xs cursor-pointer border transition-colors',
                      exam.is_public
                        ? 'badge-green border-emerald-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200'
                        : 'badge-gray border-slate-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300'
                    )}
                  >
                    {exam.is_public ? '● Público' : '○ Privado — publicar'}
                  </button>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => setViewExam(exam)} className="btn-ghost p-1.5 rounded-lg text-slate-400 hover:text-primary-600">
                    <Eye size={14} />
                  </button>
                  <button onClick={() => setDeleteId(exam.id)} className="btn-ghost p-1.5 rounded-lg text-slate-400 hover:text-red-500">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <h3 className="font-semibold text-navy-900 mb-1 line-clamp-2">{exam.title}</h3>
              {exam.description && <p className="text-xs text-slate-400 mb-3 line-clamp-2">{exam.description}</p>}

              <div className="flex items-center gap-4 text-xs text-slate-500 border-t border-slate-100 pt-3 mt-auto">
                <span className="flex items-center gap-1"><BookOpen size={12} /> {exam.question_count} preg.</span>
                <span className="flex items-center gap-1"><Clock size={12} /> {exam.duration_min} min</span>
                {exam.auto_generated && (
                  <span className="badge-purple badge text-[10px] ml-auto">Auto</span>
                )}
              </div>

              {exam.areas_config && Object.keys(exam.areas_config).length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {Object.entries(exam.areas_config).map(([a, n]) => (
                    <span key={a} className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">
                      {AREA_LABELS[a as QuestionArea]?.split(' ')[0]}: {n as number}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      <Modal open={showManual} onClose={() => setShowManual(false)} title="Crear Simulacro Manual" size="xl">
        <ManualExamForm onClose={() => setShowManual(false)} />
      </Modal>

      <Modal open={showAuto} onClose={() => setShowAuto(false)} title="Crear Simulacro Automático ✨" size="md">
        <AutoExamForm onClose={() => setShowAuto(false)} />
      </Modal>

      {/* View Exam detail */}
      <Modal open={!!viewExam} onClose={() => setViewExam(null)} title={viewExam?.title ?? ''} size="xl">
        {loadingView ? (
          <div className="flex justify-center py-8"><Spinner size="lg" /></div>
        ) : viewData ? (
          <div>
            <div className="flex gap-3 mb-4 flex-wrap">
              <span className="badge badge-gray flex items-center gap-1"><Clock size={11} /> {viewData.duration_min} min</span>
              <span className="badge badge-gray flex items-center gap-1"><BookOpen size={11} /> {viewData.question_count} preguntas</span>
              {viewData.auto_generated && <span className="badge badge-purple">Auto-generado</span>}
            </div>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {(viewData.questions ?? []).map((q: any, i: number) => (
                <div key={q.id} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50">
                  <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-600 text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                  <div>
                    <p className="text-sm text-slate-700 line-clamp-2">{q.enunciado}</p>
                    <div className="flex gap-2 mt-1">
                      <span className="text-[10px] text-slate-400">{AREA_LABELS[q.area as QuestionArea]}</span>
                      <span className="text-[10px] text-slate-300">·</span>
                      <span className="text-[10px] text-slate-400">Dif. {q.difficulty}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteMut.mutate(deleteId)}
        title="Eliminar simulacro"
        message="¿Estás seguro? Se eliminarán también los intentos asociados."
        loading={deleteMut.isPending}
      />
    </AppLayout>
  )
}
