import json
from typing import Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.core.config import settings
from app.core.database import get_db
from app.domain.models import (
    Question, QuestionOption, QuestionStatus, QuestionArea,
    AIJob, AIJobType, AIJobStatus, User, UserRole
)
from app.api.auth import get_current_user, require_role

router = APIRouter(prefix="/ai", tags=["ai"])

# ── AI client (lazy init, multi-provider) ─────────────────────────────────

_openai_client = None
_anthropic_client = None
_gemini_client = None


def get_ai_provider() -> str:
    """Determine which AI provider to use based on available keys."""
    if settings.OPENAI_API_KEY:
        return "openai"
    if settings.ANTHROPIC_API_KEY:
        return "anthropic"
    if settings.GEMINI_API_KEY:
        return "gemini"
    raise HTTPException(
        503,
        "No hay API key de IA configurada. "
        "Configure OPENAI_API_KEY, ANTHROPIC_API_KEY o GEMINI_API_KEY en .env"
    )


def get_openai_client():
    global _openai_client
    if _openai_client is None:
        from openai import AsyncOpenAI
        _openai_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    return _openai_client


def get_anthropic_client():
    global _anthropic_client
    if _anthropic_client is None:
        import anthropic
        _anthropic_client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
    return _anthropic_client


def get_gemini_client():
    global _gemini_client
    if _gemini_client is None:
        import google.generativeai as genai
        genai.configure(api_key=settings.GEMINI_API_KEY)
        _gemini_client = genai.GenerativeModel(settings.GEMINI_MODEL)
    return _gemini_client


def _recover_partial_questions(text: str) -> dict:
    """
    Fallback for token-limit truncation: extract any complete question objects
    from an otherwise unparseable AI response.
    Scans for JSON objects containing "enunciado" that closed properly.
    """
    questions, search_from = [], 0
    while True:
        key_pos = text.find('"enunciado"', search_from)
        if key_pos == -1:
            break
        brace = text.rfind('{', 0, key_pos)
        if brace == -1:
            search_from = key_pos + 1
            continue
        depth, in_str, esc = 1, False, False
        j = brace + 1
        while j < len(text) and depth > 0:
            ch = text[j]
            if esc:
                esc = False
            elif ch == '\\' and in_str:
                esc = True
            elif ch == '"':
                in_str = not in_str
            elif not in_str:
                if ch == '{':
                    depth += 1
                elif ch == '}':
                    depth -= 1
            j += 1
        if depth == 0:
            try:
                obj = json.loads(text[brace:j])
                if isinstance(obj, dict) and 'enunciado' in obj:
                    questions.append(obj)
                search_from = j
            except json.JSONDecodeError:
                search_from = key_pos + 11
        else:
            break  # truncated — stop
    return {"preguntas_encontradas": questions, "total_encontradas": len(questions)}


def _robust_json_parse(text: str) -> dict:
    """
    Parse JSON from an AI response that may be:
      - wrapped in markdown fences
      - truncated mid-string (token limit hit inside a string value)
      - truncated after the last complete object (trailing garbage)

    Falls back to partial question recovery when full parsing fails.
    Raises json.JSONDecodeError only if nothing can be recovered.
    """
    text = text.strip()

    # 1. Strip markdown fences
    if text.startswith("```"):
        parts = text.split("```")
        inner = parts[1] if len(parts) > 1 else text
        text = inner[4:].strip() if inner.startswith("json") else inner.strip()

    # 2. Direct parse (happy path)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # 3. Trailing garbage — find the outermost complete {…} by brace counting
    depth, start_i, end_i = 0, -1, -1
    in_str, esc = False, False
    for i, ch in enumerate(text):
        if esc:
            esc = False
            continue
        if ch == '\\' and in_str:
            esc = True
            continue
        if ch == '"':
            in_str = not in_str
            continue
        if in_str:
            continue
        if ch == '{':
            if depth == 0:
                start_i = i
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0:
                end_i = i
                break
    if start_i != -1 and end_i != -1:
        try:
            return json.loads(text[start_i:end_i + 1])
        except json.JSONDecodeError:
            pass

    # 4. Mid-string truncation — salvage any complete question objects
    partial = _recover_partial_questions(text)
    if partial["total_encontradas"] > 0:
        return partial

    # 5. Nothing recoverable
    raise json.JSONDecodeError(
        f"No valid JSON found in AI response (first 200 chars): {text[:200]}",
        text, 0,
    )


async def call_ai_json(
    prompt: str,
    system: str,
    max_tokens: int = 1500,
) -> tuple[dict, int]:
    """Call the configured AI provider and return parsed JSON + token count.

    Args:
        max_tokens: Increase to 4000 for OCR requests that produce long responses.
    """
    provider = get_ai_provider()

    if provider == "openai":
        client = get_openai_client()
        response = await client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": prompt},
            ],
            max_tokens=max_tokens,
            temperature=0.7,
        )
        tokens = response.usage.total_tokens
        return _robust_json_parse(response.choices[0].message.content), tokens

    elif provider == "anthropic":
        client = get_anthropic_client()
        full_system = (
            system
            + "\n\nIMPORTANTE: Responde ÚNICAMENTE con JSON válido, "
            "sin texto adicional, sin bloques de código, sin explicaciones."
        )
        response = await client.messages.create(
            model=settings.ANTHROPIC_MODEL,
            max_tokens=max_tokens,
            system=full_system,
            messages=[{"role": "user", "content": prompt}],
        )
        tokens = response.usage.input_tokens + response.usage.output_tokens
        return _robust_json_parse(response.content[0].text.strip()), tokens

    elif provider == "gemini":
        import asyncio
        import google.generativeai as genai
        genai.configure(api_key=settings.GEMINI_API_KEY)
        model = genai.GenerativeModel(
            model_name=settings.GEMINI_MODEL,
            generation_config=genai.GenerationConfig(
                response_mime_type="application/json",
                max_output_tokens=max_tokens,
                temperature=0.7,
            ),
            system_instruction=(
                system
                + "\n\nResponde ÚNICAMENTE con JSON válido y completo. No cortes la respuesta."
            ),
        )
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(None, lambda: model.generate_content(prompt))
        tokens = getattr(response.usage_metadata, "total_token_count", 0)
        return _robust_json_parse(response.text.strip()), tokens

    raise HTTPException(500, f"Proveedor no soportado: {provider}")


# Keep backward-compatible alias
async def call_openai_json(prompt: str, system: str) -> tuple[dict, int]:
    return await call_ai_json(prompt, system)


# ── Schemas ────────────────────────────────────────────────────────────────

class GenerateQuestionRequest(BaseModel):
    area: QuestionArea
    competencia: Optional[str] = None
    componente: Optional[str] = None
    difficulty: str = "3"
    topic: Optional[str] = None
    context: Optional[str] = None
    save_as_draft: bool = True


class ReformulateRequest(BaseModel):
    question_id: str
    instructions: Optional[str] = "Reformula manteniendo el mismo concepto pero con diferente contexto"


class ExplainRequest(BaseModel):
    question_id: str
    student_answer: Optional[str] = None


class ClassifyRequest(BaseModel):
    enunciado: str
    opciones: Optional[list] = None


AREA_NAMES = {
    "matematicas": "Matemáticas",
    "lectura_critica": "Lectura Crítica",
    "sociales_ciudadanas": "Sociales y Ciudadanas",
    "ciencias_naturales": "Ciencias Naturales",
    "ingles": "Inglés",
}

QUESTION_SCHEMA = {
    "type": "object",
    "properties": {
        "enunciado": {"type": "string"},
        "opcion_a": {"type": "string"},
        "opcion_b": {"type": "string"},
        "opcion_c": {"type": "string"},
        "opcion_d": {"type": "string"},
        "respuesta_correcta": {"type": "string", "enum": ["A", "B", "C", "D"]},
        "explicacion": {"type": "string"},
        "competencia": {"type": "string"},
        "componente": {"type": "string"},
        "difficulty": {"type": "string", "enum": ["1", "2", "3", "4", "5"]},
    },
    "required": ["enunciado", "opcion_a", "opcion_b", "opcion_c", "opcion_d",
                 "respuesta_correcta", "explicacion"],
}


# ── Endpoints ──────────────────────────────────────────────────────────────

@router.get("/provider")
async def get_provider_info():
    """Returns which AI provider is currently active."""
    try:
        provider = get_ai_provider()
        if provider == "openai":
            model = settings.OPENAI_MODEL
        elif provider == "anthropic":
            model = settings.ANTHROPIC_MODEL
        else:
            model = settings.GEMINI_MODEL
        return {"provider": provider, "model": model, "status": "configured"}
    except HTTPException:
        return {"provider": None, "model": None, "status": "not_configured"}


@router.post("/generate-question")
async def generate_question(
    req: GenerateQuestionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.docente, UserRole.admin)),
):
    area_name = AREA_NAMES.get(req.area.value, req.area.value)
    difficulty_desc = {
        "1": "muy fácil (básico)", "2": "fácil", "3": "medio",
        "4": "difícil", "5": "muy difícil (avanzado)"
    }.get(req.difficulty, "medio")

    system = (
        "Eres un experto en evaluación educativa para el examen ICFES Saber 11 de Colombia. "
        "Crea preguntas originales, rigurosas y pedagógicamente sólidas. "
        "Responde SIEMPRE en formato JSON válido según el esquema solicitado."
    )
    prompt = f"""Genera una pregunta de selección múltiple (4 opciones) para el ICFES Saber 11 con estas características:

Área: {area_name}
Competencia: {req.competencia or "general"}
Componente: {req.componente or "general"}
Dificultad: {difficulty_desc}
Tema específico: {req.topic or "cualquier tema del área"}
{f"Contexto adicional: {req.context}" if req.context else ""}

La pregunta debe:
- Ser original y no copiada
- Tener 4 opciones (A, B, C, D) plausibles, con solo UNA correcta
- Incluir una explicación pedagógica detallada de la respuesta correcta
- Seguir el estilo de preguntas reales del ICFES

Responde con JSON así:
{{
  "enunciado": "texto del enunciado...",
  "opcion_a": "texto opción A",
  "opcion_b": "texto opción B",
  "opcion_c": "texto opción C",
  "opcion_d": "texto opción D",
  "respuesta_correcta": "A|B|C|D",
  "explicacion": "explicación pedagógica detallada",
  "competencia": "nombre de la competencia",
  "componente": "nombre del componente",
  "difficulty": "{req.difficulty}"
}}"""

    job = AIJob(
        requester_id=current_user.id,
        job_type=AIJobType.generar_pregunta,
        status=AIJobStatus.procesando,
        input_data={"area": req.area.value, "difficulty": req.difficulty, "topic": req.topic},
        started_at=datetime.utcnow(),
    )
    db.add(job)
    await db.flush()

    try:
        result, tokens = await call_ai_json(prompt, system)
        job.status = AIJobStatus.completado
        job.output_data = result
        job.tokens_used = tokens
        job.model_used = settings.OPENAI_MODEL if settings.OPENAI_API_KEY else (
            settings.ANTHROPIC_MODEL if settings.ANTHROPIC_API_KEY else settings.GEMINI_MODEL
        )
        job.finished_at = datetime.utcnow()

        if req.save_as_draft:
            q = Question(
                author_id=current_user.id,
                institution_id=current_user.institution_id,
                area=req.area,
                competencia=result.get("competencia", req.competencia),
                componente=result.get("componente", req.componente),
                difficulty=result.get("difficulty", req.difficulty),
                enunciado=result["enunciado"],
                respuesta_correcta=result["respuesta_correcta"],
                explicacion=result.get("explicacion"),
                status=QuestionStatus.borrador,
                source="ia",
                ai_job_id=job.id,
            )
            db.add(q)
            await db.flush()
            for letra, key in [("A", "opcion_a"), ("B", "opcion_b"), ("C", "opcion_c"), ("D", "opcion_d")]:
                if result.get(key):
                    db.add(QuestionOption(question_id=q.id, letra=letra, texto=result[key]))

            job.output_data = {**result, "question_id": str(q.id)}
        await db.commit()
        return {
            "success": True,
            "job_id": str(job.id),
            "question_id": str(q.id) if req.save_as_draft else None,
            "generated": result,
        }
    except Exception as e:
        job.status = AIJobStatus.fallido
        job.error_msg = str(e)
        job.finished_at = datetime.utcnow()
        await db.commit()
        raise HTTPException(500, f"Error generando pregunta: {str(e)}")


@router.post("/reformulate")
async def reformulate_question(
    req: ReformulateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.docente, UserRole.admin)),
):
    q_result = await db.execute(
        select(Question).where(Question.id == req.question_id)
    )
    q = q_result.scalar_one_or_none()
    if not q:
        raise HTTPException(404, "Pregunta no encontrada")

    system = (
        "Eres experto en ICFES Saber 11. Reformula preguntas educativas manteniendo "
        "el concepto evaluado pero cambiando el contexto. Responde en JSON."
    )
    prompt = f"""Reformula esta pregunta ICFES con nuevas palabras y contexto diferente:

PREGUNTA ORIGINAL:
{q.enunciado}

INSTRUCCIONES: {req.instructions}

Responde en JSON:
{{
  "enunciado": "nueva versión del enunciado",
  "opcion_a": "...", "opcion_b": "...", "opcion_c": "...", "opcion_d": "...",
  "respuesta_correcta": "A|B|C|D",
  "explicacion": "explicación actualizada"
}}"""

    result, tokens = await call_ai_json(prompt, system)
    return {"reformulated": result, "original_id": req.question_id}


@router.post("/explain")
async def generate_explanation(
    req: ExplainRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from sqlalchemy.orm import selectinload
    q_result = await db.execute(
        select(Question)
        .options(Question.options if False else __import__('sqlalchemy.orm', fromlist=['selectinload']).selectinload(Question.options))
        .where(Question.id == req.question_id)
    )
    q = q_result.scalar_one_or_none()
    if not q:
        raise HTTPException(404, "Pregunta no encontrada")

    system = (
        "Eres un tutor experto en ICFES Saber 11. Explica las respuestas de forma "
        "clara, pedagógica y motivadora para estudiantes colombianos de grado 11. "
        "Responde en JSON."
    )
    opciones_text = "\n".join([f"{o.letra}. {o.texto}" for o in q.options]) if q.options else ""
    student_part = f"\nEl estudiante respondió: {req.student_answer}" if req.student_answer else ""

    prompt = f"""Explica detalladamente por qué la respuesta correcta es {q.respuesta_correcta}.

Pregunta: {q.enunciado}
Opciones:
{opciones_text}
Respuesta correcta: {q.respuesta_correcta}{student_part}

Responde en JSON:
{{
  "explicacion_principal": "...",
  "por_que_correcta": "...",
  "por_que_incorrectas": {{"A": "...", "B": "...", "C": "...", "D": "..."}},
  "tip_recordatorio": "...",
  "concepto_clave": "..."
}}"""

    result, _ = await call_ai_json(prompt, system)
    return result


@router.post("/classify")
async def classify_question(
    req: ClassifyRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.docente, UserRole.admin)),
):
    system = "Eres experto en taxonomía educativa ICFES. Clasifica preguntas. Responde en JSON."
    prompt = f"""Clasifica esta pregunta según el marco ICFES Saber 11:

{req.enunciado}

Responde en JSON:
{{
  "area": "matematicas|lectura_critica|sociales_ciudadanas|ciencias_naturales|ingles",
  "competencia": "nombre de la competencia",
  "componente": "nombre del componente",
  "difficulty": "1|2|3|4|5",
  "justificacion": "breve justificación"
}}"""

    result, _ = await call_ai_json(prompt, system)
    return result


@router.post("/ocr-import")
async def ocr_import(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.docente, UserRole.admin)),
):
    """OCR pipeline: image/PDF → text extraction → LaTeX detection → AI classification → draft questions."""
    import io
    from PIL import Image
    import pytesseract

    if file.content_type not in ["image/jpeg", "image/png", "image/webp", "application/pdf"]:
        raise HTTPException(400, "Formato no soportado. Use JPG, PNG o PDF.")

    content = await file.read()

    try:
        image = Image.open(io.BytesIO(content))
        custom_config = r'--oem 3 --psm 6 -l spa'
        ocr_text = pytesseract.image_to_string(image, config=custom_config)
    except Exception as e:
        raise HTTPException(500, f"Error en OCR: {str(e)}")

    if not ocr_text.strip():
        raise HTTPException(422, "No se pudo extraer texto de la imagen")

    # Sanitize before embedding: raw OCR contains quotes and control chars
    # that break JSON when the model echoes them back inside a string field.
    import re as _re
    clean_ocr = _re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', ocr_text)
    clean_ocr = clean_ocr.replace('\\', ' ').replace('"', "'").replace('\r', '')
    clean_ocr = _re.sub(r'\n{3,}', '\n\n', clean_ocr).strip()

    # ── Pass 1: plain-text extraction ─────────────────────────────────────
    # Ask the model to identify questions as numbered plain text — no JSON yet.
    # This avoids the main failure mode: the model forgetting to escape quotes
    # inside JSON string values, which produces unparseable output.
    system_p1 = (
        "Eres experto en lectura de exámenes ICFES. "
        "Extrae el contenido de las preguntas tal como aparece, sin reformular."
    )
    prompt_p1 = f"""El siguiente texto fue extraído por OCR de un documento con preguntas de examen.
Lista TODAS las preguntas de selección múltiple que encuentres.

Para cada pregunta usa exactamente este formato de texto plano:
---
PREGUNTA: <enunciado completo>
A: <texto opción A>
B: <texto opción B>
C: <texto opción C>
D: <texto opción D>
CORRECTA: <A|B|C|D o DESCONOCIDA>
---

TEXTO OCR:
{clean_ocr[:4000]}

Responde SOLO con el listado en el formato indicado. Nada más."""

    job = AIJob(
        requester_id=current_user.id,
        job_type=AIJobType.ocr,
        status=AIJobStatus.procesando,
        input_data={"filename": file.filename, "size": len(content)},
        started_at=datetime.utcnow(),
    )
    db.add(job)
    await db.flush()

    try:
        provider = get_ai_provider()
        # Pass 1: get plain text — no JSON parsing, just raw text output
        if provider == "openai":
            p1_resp = await get_openai_client().chat.completions.create(
                model=settings.OPENAI_MODEL,
                messages=[
                    {"role": "system", "content": system_p1},
                    {"role": "user",   "content": prompt_p1},
                ],
                max_tokens=4000,
                temperature=0.2,
            )
            extracted_text = p1_resp.choices[0].message.content or ""
            p1_tokens = p1_resp.usage.total_tokens
        elif provider == "anthropic":
            p1_resp = await get_anthropic_client().messages.create(
                model=settings.ANTHROPIC_MODEL,
                max_tokens=4000,
                system=system_p1,
                messages=[{"role": "user", "content": prompt_p1}],
            )
            extracted_text = p1_resp.content[0].text or ""
            p1_tokens = p1_resp.usage.input_tokens + p1_resp.usage.output_tokens
        else:  # gemini
            import asyncio
            import google.generativeai as genai
            genai.configure(api_key=settings.GEMINI_API_KEY)
            gmodel = genai.GenerativeModel(
                model_name=settings.GEMINI_MODEL,
                system_instruction=system_p1,
            )
            loop = asyncio.get_event_loop()
            p1_resp = await loop.run_in_executor(None, lambda: gmodel.generate_content(prompt_p1))
            extracted_text = p1_resp.text or ""
            p1_tokens = getattr(p1_resp.usage_metadata, "total_token_count", 0)

        if not extracted_text.strip():
            raise ValueError("El modelo no encontró preguntas en el texto OCR")

        # ── Pass 2: structure as JSON ───────────────────────────────────────
        # The extracted_text now has clean prose — no raw OCR garbage.
        # Converting prose→JSON is much less likely to produce malformed output.
        system_p2 = (
            "Conviertes texto estructurado de preguntas ICFES a JSON. "
            "Responde ÚNICAMENTE con JSON válido."
        )
        prompt_p2 = f"""Convierte este listado de preguntas al formato JSON indicado.
El texto ya viene limpio: copia los valores exactamente, no los reformules.

PREGUNTAS:
{extracted_text[:5000]}

JSON de salida (un objeto por pregunta, dentro del array):
{{
  "preguntas_encontradas": [
    {{
      "enunciado": "texto exacto del enunciado",
      "opcion_a": "texto exacto",
      "opcion_b": "texto exacto",
      "opcion_c": "texto exacto",
      "opcion_d": "texto exacto",
      "respuesta_correcta": "A|B|C|D|null",
      "area": "matematicas|lectura_critica|sociales_ciudadanas|ciencias_naturales|ingles",
      "difficulty": "1|2|3|4|5",
      "latex_content": null,
      "tiene_imagen": false
    }}
  ],
  "total_encontradas": 0
}}"""

        result, p2_tokens = await call_ai_json(prompt_p2, system_p2, max_tokens=4000)

        total_tokens = p1_tokens + p2_tokens
        job.status = AIJobStatus.completado
        job.output_data = result
        job.tokens_used = total_tokens
        job.finished_at = datetime.utcnow()
        await db.commit()

        return {
            "job_id":   str(job.id),
            "ocr_text": ocr_text[:500] + "..." if len(ocr_text) > 500 else ocr_text,
            "preguntas": result.get("preguntas_encontradas", []),
            "total":    result.get("total_encontradas", 0),
        }
    except Exception as e:
        job.status = AIJobStatus.fallido
        job.error_msg = str(e)
        await db.commit()
        raise HTTPException(500, f"Error en pipeline IA: {str(e)}")


@router.post("/ocr-save-question")
async def save_ocr_question(
    req: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.docente, UserRole.admin)),
):
    """Save a question that was reviewed from OCR import."""
    try:
        area = QuestionArea(req.get("area", "matematicas"))
    except ValueError:
        area = QuestionArea.matematicas

    q = Question(
        author_id=current_user.id,
        institution_id=current_user.institution_id,
        area=area,
        competencia=req.get("competencia"),
        componente=req.get("componente"),
        difficulty=str(req.get("difficulty", "3")),
        enunciado=req["enunciado"],
        respuesta_correcta=req.get("respuesta_correcta", "A"),
        explicacion=req.get("explicacion"),
        latex_content=req.get("latex_content"),
        status=QuestionStatus.borrador,
        source="ocr",
    )
    db.add(q)
    await db.flush()

    for letra, key in [("A", "opcion_a"), ("B", "opcion_b"), ("C", "opcion_c"), ("D", "opcion_d")]:
        texto = req.get(key, f"Opción {letra}")
        db.add(QuestionOption(question_id=q.id, letra=letra, texto=texto))

    await db.commit()
    return {"id": str(q.id), "status": "borrador"}
