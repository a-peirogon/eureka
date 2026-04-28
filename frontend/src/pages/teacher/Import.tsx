import { useState, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  Upload, FileImage, Wand2, CheckCircle2, Edit3,
  Trash2, AlertTriangle, ArrowRight, RefreshCw, X, FileText
} from 'lucide-react'
import clsx from 'clsx'
import { aiApi } from '@/lib/api'
import { AppLayout, TopHeader, Spinner, AreaBadge, DifficultyBadge, Modal } from '@/components/ui'
import { AREA_LABELS, type QuestionArea } from '@/types'
import toast from 'react-hot-toast'

const AREAS: QuestionArea[] = ['matematicas', 'lectura_critica', 'sociales_ciudadanas', 'ciencias_naturales', 'ingles']

interface OCRQuestion {
  enunciado: string
  opcion_a: string; opcion_b: string; opcion_c: string; opcion_d: string
  respuesta_correcta: string | null
  area: QuestionArea
  difficulty: string
  latex_content?: string
  tiene_imagen: boolean
  _saved?: boolean
  _error?: string
}

function QuestionEditor({ q, index, onUpdate, onSave, onRemove }: {
  q: OCRQuestion; index: number
  onUpdate: (q: OCRQuestion) => void
  onSave: (q: OCRQuestion) => Promise<void>
  onRemove: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [local, setLocal] = useState(q)

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(local)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={clsx(
      'border-2 rounded-2xl overflow-hidden',
      q._saved ? 'border-emerald-300 bg-emerald-50/30'
      : q._error ? 'border-red-300'
      : 'border-slate-200'
    )}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 border-b border-slate-100">
        <div className="w-7 h-7 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold">
          {index + 1}
        </div>
        <div className="flex gap-2">
          <AreaBadge area={local.area} />
          <DifficultyBadge difficulty={local.difficulty} />
          {local.latex_content && (
            <span className="badge badge-purple text-xs">∑ LaTeX</span>
          )}
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          {q._saved ? (
            <span className="badge badge-green flex items-center gap-1"><CheckCircle2 size={11} /> Guardada</span>
          ) : (
            <>
              <button onClick={() => setEditing(!editing)} className="btn-ghost p-1.5 rounded-lg text-xs">
                <Edit3 size={14} />
              </button>
              <button onClick={onRemove} className="btn-ghost p-1.5 rounded-lg text-red-400 hover:bg-red-50">
                <Trash2 size={14} />
              </button>
              <button onClick={handleSave} disabled={saving} className="btn-primary text-xs py-1.5 px-3">
                {saving ? <Spinner size="sm" /> : <><CheckCircle2 size={13} /> Guardar</>}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {!editing ? (
          <>
            <p className="text-sm text-slate-800 mb-3 leading-relaxed">{local.enunciado}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(['A','B','C','D'] as const).map((l) => (
                <div key={l} className={clsx(
                  'flex items-start gap-2 p-2.5 rounded-xl text-xs',
                  l === local.respuesta_correcta
                    ? 'bg-emerald-50 border border-emerald-200'
                    : 'bg-slate-50 border border-slate-100'
                )}>
                  <span className={clsx(
                    'w-5 h-5 rounded-full flex items-center justify-center font-bold flex-shrink-0',
                    l === local.respuesta_correcta ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-600'
                  )}>{l}</span>
                  <span>{local[`opcion_${l.toLowerCase()}` as keyof OCRQuestion] as string}</span>
                </div>
              ))}
            </div>
            {local.respuesta_correcta === null && (
              <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                <AlertTriangle size={12} /> Respuesta correcta no detectada. Selecciónala manualmente.
              </p>
            )}
          </>
        ) : (
          <div className="space-y-3">
            {/* Edit mode */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label text-xs">Área</label>
                <select className="input text-sm" value={local.area}
                  onChange={(e) => setLocal({...local, area: e.target.value as QuestionArea})}>
                  {AREAS.map((a) => <option key={a} value={a}>{AREA_LABELS[a]}</option>)}
                </select>
              </div>
              <div>
                <label className="label text-xs">Dificultad</label>
                <select className="input text-sm" value={local.difficulty}
                  onChange={(e) => setLocal({...local, difficulty: e.target.value})}>
                  {['1','2','3','4','5'].map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="label text-xs">Enunciado</label>
              <textarea className="input text-sm resize-none" rows={3}
                value={local.enunciado} onChange={(e) => setLocal({...local, enunciado: e.target.value})} />
            </div>
            {(['A','B','C','D'] as const).map((l) => (
              <div key={l} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setLocal({...local, respuesta_correcta: l})}
                  className={clsx(
                    'w-7 h-7 rounded-full border-2 flex items-center justify-center font-bold text-xs flex-shrink-0',
                    local.respuesta_correcta === l
                      ? 'border-emerald-500 bg-emerald-500 text-white'
                      : 'border-slate-300 text-slate-500'
                  )}
                >{l}</button>
                <input className="input text-sm flex-1"
                  value={local[`opcion_${l.toLowerCase()}` as keyof OCRQuestion] as string}
                  onChange={(e) => setLocal({...local, [`opcion_${l.toLowerCase()}`]: e.target.value})} />
              </div>
            ))}
            <div className="flex gap-2 justify-end">
              <button onClick={() => setEditing(false)} className="btn-secondary text-xs">Cancelar</button>
              <button onClick={() => { onUpdate(local); setEditing(false) }} className="btn-primary text-xs">
                Aplicar cambios
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function TeacherImport() {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [questions, setQuestions] = useState<OCRQuestion[]>([])
  const [ocrText, setOcrText] = useState('')
  const [jobId, setJobId] = useState('')
  const [step, setStep] = useState<'upload' | 'review' | 'done'>('upload')
  const [savedCount, setSavedCount] = useState(0)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f) selectFile(f)
  }

  const selectFile = (f: File) => {
    setFile(f)
    if (f.type.startsWith('image/')) {
      const url = URL.createObjectURL(f)
      setPreview(url)
    } else {
      setPreview(null)
    }
    setQuestions([])
    setStep('upload')
  }

  const handleProcess = async () => {
    if (!file) return
    setProcessing(true)
    try {
      const res = await aiApi.ocrImport(file)
      setJobId(res.job_id)
      setOcrText(res.ocr_text ?? '')
      setQuestions(res.preguntas ?? [])
      setStep('review')
      toast.success(`${res.total} pregunta(s) detectadas`)
    } catch (err: any) {
      toast.error(err?.response?.data?.detail ?? 'Error procesando el archivo')
    } finally {
      setProcessing(false)
    }
  }

  const handleSaveQuestion = async (q: OCRQuestion) => {
    try {
      await aiApi.saveOcrQuestion({
        enunciado: q.enunciado,
        opcion_a: q.opcion_a, opcion_b: q.opcion_b,
        opcion_c: q.opcion_c, opcion_d: q.opcion_d,
        respuesta_correcta: q.respuesta_correcta ?? 'A',
        area: q.area,
        difficulty: q.difficulty,
        latex_content: q.latex_content,
      })
      setQuestions((qs) => qs.map((x) => x === q ? { ...x, _saved: true } : x))
      setSavedCount((n) => n + 1)
      qc.invalidateQueries({ queryKey: ['questions'] })
      toast.success('Pregunta guardada como borrador')
    } catch {
      setQuestions((qs) => qs.map((x) => x === q ? { ...x, _error: 'Error al guardar' } : x))
      toast.error('Error al guardar la pregunta')
    }
  }

  const handleSaveAll = async () => {
    const unsaved = questions.filter((q) => !q._saved)
    for (const q of unsaved) await handleSaveQuestion(q)
    if (questions.every((q) => q._saved)) setStep('done')
  }

  const reset = () => {
    setFile(null); setPreview(null); setQuestions([])
    setOcrText(''); setStep('upload'); setSavedCount(0)
  }

  return (
    <AppLayout>
      <TopHeader
        title="Importar Preguntas"
        subtitle="Sube imágenes o PDFs y extrae preguntas automáticamente con IA"
      />

      {/* Pipeline steps */}
      <div className="card mb-6">
        <div className="flex items-center gap-0">
          {[
            { n: 1, label: 'Subir archivo', icon: Upload },
            { n: 2, label: 'OCR + IA', icon: Wand2 },
            { n: 3, label: 'Revisar', icon: Edit3 },
            { n: 4, label: 'Guardar', icon: CheckCircle2 },
          ].map((s, i, arr) => (
            <div key={s.n} className="flex items-center flex-1">
              <div className={clsx(
                'flex items-center gap-2 flex-1',
                i > 0 && 'border-t-2 border-dashed pt-0',
              )}>
                <div className={clsx(
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0',
                  (step === 'upload' && s.n === 1) || (step === 'review' && s.n <= 3) || (step === 'done')
                    ? 'bg-primary-600 text-white'
                    : 'bg-slate-100 text-slate-400'
                )}>
                  {s.n}
                </div>
                <span className="text-xs text-slate-500 hidden sm:block">{s.label}</span>
              </div>
              {i < arr.length - 1 && <div className="w-8 h-0.5 bg-slate-200 flex-shrink-0" />}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Upload panel */}
        <div className="lg:col-span-2 space-y-4">
          <div className="card">
            <h3 className="font-semibold text-navy-900 mb-4 flex items-center gap-2">
              <Upload size={16} /> Subir archivo
            </h3>

            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileRef.current?.click()}
              className={clsx(
                'border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all',
                file ? 'border-primary-400 bg-primary-50' : 'border-slate-200 hover:border-primary-300 hover:bg-slate-50'
              )}
            >
              <input
                ref={fileRef} type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && selectFile(e.target.files[0])}
              />
              {file ? (
                <div>
                  <FileImage size={32} className="mx-auto text-primary-500 mb-2" />
                  <p className="text-sm font-medium text-navy-900">{file.name}</p>
                  <p className="text-xs text-slate-400 mt-1">{(file.size / 1024).toFixed(0)} KB</p>
                </div>
              ) : (
                <div>
                  <Upload size={32} className="mx-auto text-slate-300 mb-3" />
                  <p className="text-sm font-medium text-slate-600">Arrastra o haz clic</p>
                  <p className="text-xs text-slate-400 mt-1">JPG, PNG, WEBP, PDF</p>
                </div>
              )}
            </div>

            {/* Preview */}
            {preview && (
              <div className="mt-3 rounded-xl overflow-hidden border border-slate-200">
                <img src={preview} alt="Vista previa" className="w-full max-h-48 object-contain bg-slate-50" />
              </div>
            )}

            {file && (
              <button
                onClick={handleProcess}
                disabled={processing}
                className="btn-primary w-full justify-center mt-4"
              >
                {processing ? (
                  <><Spinner size="sm" /> Procesando con IA...</>
                ) : (
                  <><Wand2 size={16} /> Extraer preguntas con IA</>
                )}
              </button>
            )}

            {step !== 'upload' && (
              <button onClick={reset} className="btn-secondary w-full mt-2">
                <RefreshCw size={14} /> Procesar otro archivo
              </button>
            )}
          </div>

          {/* How it works */}
          <div className="card bg-slate-50 border-slate-200">
            <h4 className="font-semibold text-slate-700 mb-3 text-sm">¿Cómo funciona?</h4>
            <ol className="space-y-2">
              {[
                'Sube una imagen o PDF con preguntas',
                'OCR extrae el texto (incluyendo fórmulas)',
                'La IA detecta y estructura cada pregunta',
                'Revisa y edita antes de guardar',
                'Las preguntas quedan como borradores',
              ].map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-slate-500">
                  <span className="w-4 h-4 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center font-bold flex-shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  {s}
                </li>
              ))}
            </ol>
          </div>

          {/* OCR text preview */}
          {ocrText && (
            <div className="card">
              <h4 className="font-semibold text-slate-700 mb-2 text-sm flex items-center gap-2">
                <FileText size={14} /> Texto OCR detectado
              </h4>
              <p className="text-xs text-slate-500 font-mono bg-slate-50 p-3 rounded-xl max-h-32 overflow-y-auto whitespace-pre-wrap">
                {ocrText}
              </p>
            </div>
          )}
        </div>

        {/* Review panel */}
        <div className="lg:col-span-3">
          {step === 'upload' && (
            <div className="card h-full flex items-center justify-center min-h-[400px]">
              <div className="text-center">
                <FileImage size={48} className="mx-auto text-slate-200 mb-4" />
                <p className="text-slate-400 font-medium">Sube un archivo para comenzar</p>
                <p className="text-xs text-slate-300 mt-1">Las preguntas extraídas aparecerán aquí</p>
              </div>
            </div>
          )}

          {step === 'review' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-navy-900">
                    {questions.length} pregunta(s) detectada(s)
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {savedCount} guardada(s) · {questions.length - savedCount} pendiente(s)
                  </p>
                </div>
                {questions.some((q) => !q._saved) && (
                  <button onClick={handleSaveAll} className="btn-primary text-sm">
                    <CheckCircle2 size={15} />
                    Guardar todas
                  </button>
                )}
              </div>

              {questions.length === 0 ? (
                <div className="card">
                  <div className="text-center py-8">
                    <AlertTriangle size={32} className="mx-auto text-amber-400 mb-3" />
                    <p className="text-slate-600 font-medium">No se detectaron preguntas</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Intenta con una imagen más clara o con mejor contraste.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {questions.map((q, i) => (
                    <QuestionEditor
                      key={i} q={q} index={i}
                      onUpdate={(updated) => setQuestions((qs) => qs.map((x, j) => j === i ? updated : x))}
                      onSave={handleSaveQuestion}
                      onRemove={() => setQuestions((qs) => qs.filter((_, j) => j !== i))}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 'done' && (
            <div className="card text-center py-12">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={32} className="text-emerald-600" />
              </div>
              <h3 className="font-display text-xl text-navy-900 mb-2">¡Importación completada!</h3>
              <p className="text-slate-500 text-sm mb-6">
                {savedCount} pregunta(s) guardadas como borradores en el banco de preguntas.
              </p>
              <div className="flex gap-3 justify-center">
                <button onClick={reset} className="btn-secondary">
                  Importar más
                </button>
                <a href="/teacher/questions" className="btn-primary">
                  Ver banco de preguntas <ArrowRight size={15} />
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
