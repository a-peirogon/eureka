import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Search, Filter, Wand2, CheckCircle, Archive,
  Edit3, Trash2, Eye, RefreshCw, ChevronLeft, ChevronRight, BookOpen
} from 'lucide-react'
import clsx from 'clsx'
import { questionsApi, aiApi } from '@/lib/api'
import { AppLayout, TopHeader, Modal, Spinner, AreaBadge, DifficultyBadge, QuestionStatusBadge, ConfirmDialog, EmptyState } from '@/components/ui'
import { AREA_LABELS, type QuestionArea, type Question, type QuestionStatus } from '@/types'
import toast from 'react-hot-toast'

const AREAS: QuestionArea[] = ['matematicas', 'lectura_critica', 'sociales_ciudadanas', 'ciencias_naturales', 'ingles']

// ── Question Form ──────────────────────────────────────────────────────────
function QuestionForm({ initial, onSave, onClose }: {
  initial?: Partial<Question>; onSave: (data: any) => Promise<void>; onClose: () => void
}) {
  const [area, setArea] = useState<QuestionArea>(initial?.area ?? 'matematicas')
  const [enunciado, setEnunciado] = useState(initial?.enunciado ?? '')
  const [competencia, setCompetencia] = useState(initial?.competencia ?? '')
  const [difficulty, setDifficulty] = useState<string>(initial?.difficulty ?? '3')
  const [explicacion, setExplicacion] = useState(initial?.explicacion ?? '')
  const [correcta, setCorrecta] = useState(initial?.respuesta_correcta ?? 'A')
  const [opts, setOpts] = useState(
    initial?.opciones ?? [
      { letra: 'A', texto: '' }, { letra: 'B', texto: '' },
      { letra: 'C', texto: '' }, { letra: 'D', texto: '' },
    ]
  )
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!enunciado.trim()) { toast.error('El enunciado es requerido'); return }
    if (opts.some((o) => !o.texto.trim())) { toast.error('Completa todas las opciones'); return }
    setLoading(true)
    try {
      await onSave({ area, enunciado, competencia, difficulty, explicacion, respuesta_correcta: correcta, opciones: opts, tags: [] })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Área</label>
          <select value={area} onChange={(e) => setArea(e.target.value as QuestionArea)} className="input">
            {AREAS.map((a) => <option key={a} value={a}>{AREA_LABELS[a]}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Dificultad</label>
          <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="input">
            {['1','2','3','4','5'].map((d) => (
              <option key={d} value={d}>{d} - {['Muy fácil','Fácil','Medio','Difícil','Muy difícil'][+d-1]}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="label">Competencia</label>
        <input className="input" value={competencia} onChange={(e) => setCompetencia(e.target.value)} placeholder="Ej: Razonamiento cuantitativo" />
      </div>

      <div>
        <label className="label">Enunciado <span className="text-red-500">*</span></label>
        <textarea
          className="input min-h-[100px] resize-none"
          value={enunciado}
          onChange={(e) => setEnunciado(e.target.value)}
          placeholder="Escribe el enunciado de la pregunta..."
          rows={4}
        />
      </div>

      <div className="space-y-2">
        <label className="label">Opciones</label>
        {opts.map((opt, i) => (
          <div key={opt.letra} className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setCorrecta(opt.letra)}
              className={clsx(
                'w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold text-sm flex-shrink-0',
                correcta === opt.letra
                  ? 'border-emerald-500 bg-emerald-500 text-white'
                  : 'border-slate-300 text-slate-500 hover:border-emerald-400'
              )}
              title={`Marcar ${opt.letra} como correcta`}
            >
              {opt.letra}
            </button>
            <input
              className="input flex-1"
              value={opt.texto}
              onChange={(e) => {
                const n = [...opts]; n[i] = { ...n[i], texto: e.target.value }; setOpts(n)
              }}
              placeholder={`Opción ${opt.letra}`}
            />
          </div>
        ))}
        <p className="text-xs text-slate-400">Haz clic en la letra para marcarla como respuesta correcta</p>
      </div>

      <div>
        <label className="label">Explicación</label>
        <textarea
          className="input resize-none"
          value={explicacion}
          onChange={(e) => setExplicacion(e.target.value)}
          placeholder="Explica por qué la respuesta es correcta..."
          rows={3}
        />
      </div>

      <div className="flex gap-3 justify-end pt-2">
        <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? <Spinner size="sm" /> : <><CheckCircle size={15} /> Guardar pregunta</>}
        </button>
      </div>
    </form>
  )
}

// ── AI Generate Form ───────────────────────────────────────────────────────
function AIGenerateForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [area, setArea] = useState<QuestionArea>('matematicas')
  const [difficulty, setDifficulty] = useState('3')
  const [topic, setTopic] = useState('')
  const [loading, setLoading] = useState(false)

  const handleGenerate = async () => {
    setLoading(true)
    try {
      const res = await aiApi.generateQuestion({ area, difficulty, topic: topic || undefined, save_as_draft: true })
      toast.success('Pregunta generada y guardada como borrador ✨')
      qc.invalidateQueries({ queryKey: ['questions'] })
      onClose()
    } catch (err: any) {
      toast.error(err?.response?.data?.detail ?? 'Error generando pregunta')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="p-4 bg-blue-600 rounded-2xl border border-blue-400 text-sm text-blue-600">
        La IA generará una pregunta original basada en los parámetros que definas. Se guardará como <strong>borrador</strong> para que la revises antes de aprobarla.
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Área</label>
          <select value={area} onChange={(e) => setArea(e.target.value as QuestionArea)} className="input">
            {AREAS.map((a) => <option key={a} value={a}>{AREA_LABELS[a]}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Dificultad</label>
          <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="input">
            {['1','2','3','4','5'].map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="label">Tema específico (opcional)</label>
        <input className="input" value={topic} onChange={(e) => setTopic(e.target.value)}
          placeholder="Ej: Estadística descriptiva, Fotosíntesis, Segunda Guerra Mundial..." />
      </div>
      <div className="flex gap-3 justify-end">
        <button onClick={onClose} className="btn-secondary">Cancelar</button>
        <button onClick={handleGenerate} disabled={loading} className="btn bg-blue-600 text-white hover:bg-blue-600 gap-2">
          {loading ? <><Spinner size="sm" /> Generando...</> : <><Wand2 size={15} /> Generar con IA</>}
        </button>
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function TeacherQuestions() {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [filterArea, setFilterArea] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterDiff, setFilterDiff] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [showAI, setShowAI] = useState(false)
  const [editQ, setEditQ] = useState<Question | null>(null)
  const [viewQ, setViewQ] = useState<Question | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['questions', { page, search, filterArea, filterStatus, filterDiff }],
    queryFn: () => questionsApi.list({
      page, limit: 15,
      ...(search ? { search } : {}),
      ...(filterArea ? { area: filterArea } : {}),
      ...(filterStatus ? { status: filterStatus } : {}),
      ...(filterDiff ? { difficulty: filterDiff } : {}),
    }),
    staleTime: 30_000,
  })

  const createMut = useMutation({
    mutationFn: questionsApi.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['questions'] }); setShowCreate(false); toast.success('Pregunta creada') },
    onError: () => toast.error('Error al crear la pregunta'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: any) => questionsApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['questions'] }); setEditQ(null); toast.success('Pregunta actualizada') },
  })

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => questionsApi.updateStatus(id, status),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['questions'] }); toast.success('Estado actualizado') },
  })

  const deleteMut = useMutation({
    mutationFn: questionsApi.delete,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['questions'] }); setDeleteId(null); toast.success('Pregunta eliminada') },
  })

  const questions: Question[] = data?.items ?? []
  const totalPages = data?.pages ?? 1

  return (
    <AppLayout>
      <TopHeader
        title="Banco de Preguntas"
        subtitle={`${data?.total ?? 0} preguntas en total`}
        actions={
          <div className="flex gap-2">
            <button onClick={() => setShowAI(true)} className="btn bg-purple-600 text-white hover:bg-purple-700">
              <Wand2 size={15} /> Generar con IA
            </button>
            <button onClick={() => setShowCreate(true)} className="btn-primary">
              <Plus size={15} /> Nueva pregunta
            </button>
          </div>
        }
      />

      {/* Filters */}
      <div className="card mb-6">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="input pl-9"
              placeholder="Buscar por enunciado o competencia..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            />
          </div>
          <select className="input w-auto" value={filterArea} onChange={(e) => { setFilterArea(e.target.value); setPage(1) }}>
            <option value="">Todas las áreas</option>
            {AREAS.map((a) => <option key={a} value={a}>{AREA_LABELS[a]}</option>)}
          </select>
          <select className="input w-auto" value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(1) }}>
            <option value="">Todos los estados</option>
            <option value="borrador">Borrador</option>
            <option value="aprobado">Aprobado</option>
            <option value="archivado">Archivado</option>
          </select>
          <select className="input w-auto" value={filterDiff} onChange={(e) => { setFilterDiff(e.target.value); setPage(1) }}>
            <option value="">Toda dificultad</option>
            {['1','2','3','4','5'].map((d) => <option key={d} value={d}>Dif. {d}</option>)}
          </select>
          {(search || filterArea || filterStatus || filterDiff) && (
            <button onClick={() => { setSearch(''); setFilterArea(''); setFilterStatus(''); setFilterDiff(''); setPage(1) }}
              className="btn-ghost text-slate-500 text-sm">
              <RefreshCw size={13} /> Limpiar
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : questions.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<BookOpen size={40} />}
            title="No hay preguntas"
            subtitle="Crea preguntas manualmente o usa la IA para generar"
            action={<button onClick={() => setShowCreate(true)} className="btn-primary">Crear primera pregunta</button>}
          />
        </div>
      ) : (
        <>
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Enunciado</th>
                  <th>Área</th>
                  <th>Dificultad</th>
                  <th>Estado</th>
                  <th>Uso</th>
                  <th>Fuente</th>
                  <th className="text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {questions.map((q) => (
                  <tr key={q.id}>
                    <td className="max-w-xs">
                      <p className="line-clamp-2 text-sm">{q.enunciado}</p>
                      {q.competencia && <p className="text-xs text-slate-400 mt-0.5">{q.competencia}</p>}
                    </td>
                    <td><AreaBadge area={q.area} /></td>
                    <td><DifficultyBadge difficulty={q.difficulty} /></td>
                    <td><QuestionStatusBadge status={q.status} /></td>
                    <td>
                      <span className="text-xs text-slate-500">
                        {q.times_used > 0 ? `${q.accuracy_rate ?? 0}% (${q.times_used})` : '—'}
                      </span>
                    </td>
                    <td>
                      <span className={clsx('badge text-xs',
                        q.source === 'ia' ? 'badge-purple'
                        : q.source === 'ocr' ? 'badge-blue'
                        : 'badge-gray'
                      )}>
                        {q.source === 'ia' ? '✨ IA' : q.source === 'ocr' ? '📄 OCR' : '✍️ Manual'}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => setViewQ(q)} className="btn-ghost p-1.5 rounded-lg" title="Ver">
                          <Eye size={14} />
                        </button>
                        <button onClick={() => setEditQ(q)} className="btn-ghost p-1.5 rounded-lg" title="Editar">
                          <Edit3 size={14} />
                        </button>
                        {q.status === 'borrador' && (
                          <button
                            onClick={() => statusMut.mutate({ id: q.id, status: 'aprobado' })}
                            className="btn-ghost p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50"
                            title="Aprobar"
                          >
                            <CheckCircle size={14} />
                          </button>
                        )}
                        {q.status === 'aprobado' && (
                          <button
                            onClick={() => statusMut.mutate({ id: q.id, status: 'archivado' })}
                            className="btn-ghost p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"
                            title="Archivar"
                          >
                            <Archive size={14} />
                          </button>
                        )}
                        <button
                          onClick={() => setDeleteId(q.id)}
                          className="btn-ghost p-1.5 rounded-lg text-red-400 hover:bg-red-50"
                          title="Eliminar"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-6">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary py-1.5 px-3">
                <ChevronLeft size={15} />
              </button>
              <span className="text-sm text-slate-600">Pág {page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="btn-secondary py-1.5 px-3">
                <ChevronRight size={15} />
              </button>
            </div>
          )}
        </>
      )}

      {/* Modals */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Nueva Pregunta" size="xl">
        <QuestionForm onSave={(data) => createMut.mutateAsync(data)} onClose={() => setShowCreate(false)} />
      </Modal>

      <Modal open={!!editQ} onClose={() => setEditQ(null)} title="Editar Pregunta" size="xl">
        {editQ && (
          <QuestionForm
            initial={editQ}
            onSave={(data) => updateMut.mutateAsync({ id: editQ.id, data })}
            onClose={() => setEditQ(null)}
          />
        )}
      </Modal>

      <Modal open={showAI} onClose={() => setShowAI(false)} title="Generar Pregunta con IA ✨" size="md">
        <AIGenerateForm onClose={() => setShowAI(false)} />
      </Modal>

      {/* View Question */}
      <Modal open={!!viewQ} onClose={() => setViewQ(null)} title="Detalle de Pregunta" size="lg">
        {viewQ && (
          <div className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              <AreaBadge area={viewQ.area} />
              <DifficultyBadge difficulty={viewQ.difficulty} />
              <QuestionStatusBadge status={viewQ.status} />
            </div>
            <p className="text-slate-800 leading-relaxed">{viewQ.enunciado}</p>
            <div className="space-y-2">
              {viewQ.opciones?.map((opt) => (
                <div key={opt.letra} className={clsx(
                  'flex items-start gap-3 p-3 rounded-2xl border',
                  opt.letra === viewQ.respuesta_correcta ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-100'
                )}>
                  <span className={clsx(
                    'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0',
                    opt.letra === viewQ.respuesta_correcta ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-600'
                  )}>{opt.letra}</span>
                  <span className="text-sm">{opt.texto}</span>
                </div>
              ))}
            </div>
            {viewQ.explicacion && (
              <div className="p-4 bg-blue-600 rounded-2xl border border-blue-400 text-sm text-slate-700">
                <p className="font-semibold text-blue-600 mb-1">💡 Explicación</p>
                {viewQ.explicacion}
              </div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteMut.mutate(deleteId)}
        title="Eliminar pregunta"
        message="¿Estás seguro de que quieres eliminar esta pregunta? Esta acción no se puede deshacer."
        loading={deleteMut.isPending}
      />
    </AppLayout>
  )
}
