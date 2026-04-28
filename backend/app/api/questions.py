from typing import Optional, List
from uuid import UUID
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from sqlalchemy.orm import selectinload
from pydantic import BaseModel

from app.core.database import get_db
from app.domain.models import (
    Question, QuestionOption, QuestionStatus, QuestionArea,
    User, UserRole, Tag, QuestionTag
)
from app.api.auth import get_current_user, require_role

router = APIRouter(prefix="/questions", tags=["questions"])


# ── Schemas ────────────────────────────────────────────────────────────────

class OptionIn(BaseModel):
    letra: str
    texto: str


class QuestionCreate(BaseModel):
    area: QuestionArea
    competencia: Optional[str] = None
    componente: Optional[str] = None
    difficulty: str = "3"
    enunciado: str
    opciones: List[OptionIn]
    respuesta_correcta: str
    explicacion: Optional[str] = None
    tiempo_estimado: int = 90
    latex_content: Optional[str] = None
    tags: Optional[List[str]] = []


class QuestionUpdate(BaseModel):
    area: Optional[QuestionArea] = None
    competencia: Optional[str] = None
    componente: Optional[str] = None
    difficulty: Optional[str] = None
    enunciado: Optional[str] = None
    opciones: Optional[List[OptionIn]] = None
    respuesta_correcta: Optional[str] = None
    explicacion: Optional[str] = None
    tiempo_estimado: Optional[int] = None
    latex_content: Optional[str] = None
    status: Optional[QuestionStatus] = None
    tags: Optional[List[str]] = None


class QuestionStatusUpdate(BaseModel):
    status: QuestionStatus


def question_to_dict(q: Question) -> dict:
    return {
        "id": str(q.id),
        "area": q.area.value if q.area else None,
        "competencia": q.competencia,
        "componente": q.componente,
        "difficulty": q.difficulty,
        "enunciado": q.enunciado,
        "opciones": [
            {"letra": o.letra, "texto": o.texto}
            for o in sorted(q.options, key=lambda x: x.letra)
        ],
        "respuesta_correcta": q.respuesta_correcta,
        "explicacion": q.explicacion,
        "tiempo_estimado": q.tiempo_estimado,
        "latex_content": q.latex_content,
        "status": q.status.value if q.status else None,
        "source": q.source,
        "times_used": q.times_used,
        "times_correct": q.times_correct,
        "accuracy_rate": round(q.times_correct / q.times_used * 100, 1) if q.times_used > 0 else None,
        "author_id": str(q.author_id) if q.author_id else None,
        "tags": [qt.tag.name for qt in q.question_tags] if q.question_tags else [],
        "created_at": q.created_at.isoformat() if q.created_at else None,
        "updated_at": q.updated_at.isoformat() if q.updated_at else None,
    }


# ── Endpoints ──────────────────────────────────────────────────────────────

@router.get("")
async def list_questions(
    area: Optional[QuestionArea] = None,
    status: Optional[QuestionStatus] = None,
    difficulty: Optional[str] = None,
    search: Optional[str] = None,
    source: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = (
        select(Question)
        .options(selectinload(Question.options), selectinload(Question.question_tags).selectinload(QuestionTag.tag))
        .order_by(Question.created_at.desc())
    )

    filters = []
    if area:
        filters.append(Question.area == area)
    if status:
        filters.append(Question.status == status)
    elif current_user.role == UserRole.estudiante:
        filters.append(Question.status == QuestionStatus.aprobado)
    if difficulty:
        filters.append(Question.difficulty == difficulty)
    if source:
        filters.append(Question.source == source)
    if search:
        filters.append(
            or_(
                Question.enunciado.ilike(f"%{search}%"),
                Question.competencia.ilike(f"%{search}%"),
            )
        )
    if current_user.role not in [UserRole.admin]:
        if current_user.institution_id:
            filters.append(
                or_(
                    Question.institution_id == current_user.institution_id,
                    Question.institution_id == None,
                )
            )

    if filters:
        query = query.where(and_(*filters))

    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar()

    offset = (page - 1) * limit
    query = query.offset(offset).limit(limit)
    result = await db.execute(query)
    questions = result.scalars().all()

    return {
        "total": total,
        "page": page,
        "limit": limit,
        "pages": (total + limit - 1) // limit,
        "items": [question_to_dict(q) for q in questions],
    }


@router.post("", status_code=201)
async def create_question(
    req: QuestionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.docente, UserRole.admin)),
):
    if req.respuesta_correcta not in ["A", "B", "C", "D"]:
        raise HTTPException(400, "Respuesta correcta debe ser A, B, C o D")
    if len(req.opciones) != 4:
        raise HTTPException(400, "Se requieren exactamente 4 opciones")

    q = Question(
        author_id=current_user.id,
        institution_id=current_user.institution_id,
        area=req.area,
        competencia=req.competencia,
        componente=req.componente,
        difficulty=req.difficulty,
        enunciado=req.enunciado,
        respuesta_correcta=req.respuesta_correcta,
        explicacion=req.explicacion,
        tiempo_estimado=req.tiempo_estimado,
        latex_content=req.latex_content,
        status=QuestionStatus.borrador,
        source="manual",
    )
    db.add(q)
    await db.flush()

    for opt in req.opciones:
        db.add(QuestionOption(question_id=q.id, letra=opt.letra, texto=opt.texto))

    for tag_name in (req.tags or []):
        tag_result = await db.execute(select(Tag).where(Tag.name == tag_name.lower()))
        tag = tag_result.scalar_one_or_none()
        if not tag:
            tag = Tag(name=tag_name.lower())
            db.add(tag)
            await db.flush()
        db.add(QuestionTag(question_id=q.id, tag_id=tag.id))

    await db.commit()

    result = await db.execute(
        select(Question)
        .options(selectinload(Question.options), selectinload(Question.question_tags).selectinload(QuestionTag.tag))
        .where(Question.id == q.id)
    )
    return question_to_dict(result.scalar_one())


@router.get("/{question_id}")
async def get_question(
    question_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Question)
        .options(selectinload(Question.options), selectinload(Question.question_tags).selectinload(QuestionTag.tag))
        .where(Question.id == question_id)
    )
    q = result.scalar_one_or_none()
    if not q:
        raise HTTPException(404, "Pregunta no encontrada")
    return question_to_dict(q)


@router.put("/{question_id}")
async def update_question(
    question_id: UUID,
    req: QuestionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.docente, UserRole.admin)),
):
    result = await db.execute(
        select(Question)
        .options(selectinload(Question.options), selectinload(Question.question_tags).selectinload(QuestionTag.tag))
        .where(Question.id == question_id)
    )
    q = result.scalar_one_or_none()
    if not q:
        raise HTTPException(404, "Pregunta no encontrada")

    if current_user.role != UserRole.admin and q.author_id != current_user.id:
        raise HTTPException(403, "Solo el autor puede editar esta pregunta")

    for field in ["area", "competencia", "componente", "difficulty", "enunciado",
                  "respuesta_correcta", "explicacion", "tiempo_estimado", "latex_content", "status"]:
        val = getattr(req, field, None)
        if val is not None:
            setattr(q, field, val)

    q.updated_at = datetime.utcnow()

    if req.opciones is not None:
        for opt in q.options:
            await db.delete(opt)
        await db.flush()
        for opt in req.opciones:
            db.add(QuestionOption(question_id=q.id, letra=opt.letra, texto=opt.texto))

    await db.commit()
    result = await db.execute(
        select(Question)
        .options(selectinload(Question.options), selectinload(Question.question_tags).selectinload(QuestionTag.tag))
        .where(Question.id == q.id)
    )
    return question_to_dict(result.scalar_one())


@router.patch("/{question_id}/status")
async def update_question_status(
    question_id: UUID,
    req: QuestionStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.docente, UserRole.admin)),
):
    result = await db.execute(select(Question).where(Question.id == question_id))
    q = result.scalar_one_or_none()
    if not q:
        raise HTTPException(404, "Pregunta no encontrada")
    q.status = req.status
    q.updated_at = datetime.utcnow()
    await db.commit()
    return {"id": str(q.id), "status": q.status.value}


@router.delete("/{question_id}", status_code=204)
async def delete_question(
    question_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.docente, UserRole.admin)),
):
    result = await db.execute(select(Question).where(Question.id == question_id))
    q = result.scalar_one_or_none()
    if not q:
        raise HTTPException(404, "Pregunta no encontrada")
    if current_user.role != UserRole.admin and q.author_id != current_user.id:
        raise HTTPException(403, "Sin permisos")
    await db.delete(q)
    await db.commit()


@router.get("/stats/summary")
async def questions_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.docente, UserRole.admin)),
):
    total = (await db.execute(select(func.count(Question.id)))).scalar()
    by_area = {}
    for area in QuestionArea:
        count = (await db.execute(
            select(func.count(Question.id)).where(Question.area == area)
        )).scalar()
        by_area[area.value] = count

    by_status = {}
    for s in QuestionStatus:
        count = (await db.execute(
            select(func.count(Question.id)).where(Question.status == s)
        )).scalar()
        by_status[s.value] = count

    return {
        "total": total,
        "by_area": by_area,
        "by_status": by_status,
    }
