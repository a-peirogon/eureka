from typing import Optional, List, Dict
from uuid import UUID
from datetime import datetime
import random
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from sqlalchemy.orm import selectinload
from pydantic import BaseModel

from app.core.database import get_db
from app.domain.models import (
    MockExam, MockExamQuestion, Attempt, AttemptAnswer,
    Question, QuestionStatus, QuestionArea,
    User, UserRole, ExamStatus
)
from app.api.auth import get_current_user, require_role

router = APIRouter(prefix="/exams", tags=["exams"])


# ── Schemas ────────────────────────────────────────────────────────────────

class ExamCreate(BaseModel):
    title: str
    description: Optional[str] = None
    duration_min: int = 180
    course_id: Optional[str] = None
    is_public: bool = False
    question_ids: List[str]
    available_from: Optional[datetime] = None
    available_until: Optional[datetime] = None


class AutoExamCreate(BaseModel):
    title: str
    description: Optional[str] = None
    duration_min: int = 210
    course_id: Optional[str] = None
    is_public: bool = False
    areas_config: Dict[str, int] = {
        "matematicas": 10,
        "lectura_critica": 10,
        "sociales_ciudadanas": 10,
        "ciencias_naturales": 10,
        "ingles": 5,
    }
    difficulty_range: Optional[List[str]] = None
    available_from: Optional[datetime] = None
    available_until: Optional[datetime] = None


class AnswerSubmit(BaseModel):
    question_id: str
    answer_given: Optional[str] = None
    time_spent: Optional[int] = None
    flagged: bool = False


class AttemptSubmit(BaseModel):
    answers: List[AnswerSubmit]
    time_spent_sec: Optional[int] = None


def exam_to_dict(exam: MockExam, include_questions: bool = False) -> dict:
    d = {
        "id": str(exam.id),
        "title": exam.title,
        "description": exam.description,
        "duration_min": exam.duration_min,
        "is_public": exam.is_public,
        "auto_generated": exam.auto_generated,
        "areas_config": exam.areas_config,
        "course_id": str(exam.course_id) if exam.course_id else None,
        "available_from": exam.available_from.isoformat() if exam.available_from else None,
        "available_until": exam.available_until.isoformat() if exam.available_until else None,
        "question_count": len(exam.exam_questions) if exam.exam_questions else 0,
        "created_at": exam.created_at.isoformat() if exam.created_at else None,
    }
    if include_questions and exam.exam_questions:
        d["questions"] = []
        for eq in sorted(exam.exam_questions, key=lambda x: x.orden):
            q = eq.question
            d["questions"].append({
                "id": str(q.id),
                "orden": eq.orden,
                "area": q.area.value if q.area else None,
                "difficulty": q.difficulty,
                "enunciado": q.enunciado,
                "opciones": [{"letra": o.letra, "texto": o.texto} for o in sorted(q.options, key=lambda x: x.letra)],
                "tiempo_estimado": q.tiempo_estimado,
            })
    return d


# ── Exam Endpoints ─────────────────────────────────────────────────────────

@router.get("")
async def list_exams(
    course_id: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = (
        select(MockExam)
        .options(selectinload(MockExam.exam_questions))
        .order_by(MockExam.created_at.desc())
    )
    if current_user.role == UserRole.estudiante:
        query = query.where(
            and_(MockExam.is_public == True) if not course_id else
            MockExam.course_id == course_id
        )
    if course_id:
        query = query.where(MockExam.course_id == course_id)

    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar()
    result = await db.execute(query.offset((page - 1) * limit).limit(limit))
    exams = result.scalars().all()

    return {
        "total": total,
        "page": page,
        "items": [exam_to_dict(e) for e in exams],
    }


@router.post("", status_code=201)
async def create_exam(
    req: ExamCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.docente, UserRole.admin)),
):
    exam = MockExam(
        creator_id=current_user.id,
        institution_id=current_user.institution_id,
        course_id=req.course_id,
        title=req.title,
        description=req.description,
        duration_min=req.duration_min,
        is_public=req.is_public,
        available_from=req.available_from,
        available_until=req.available_until,
        auto_generated=False,
    )
    db.add(exam)
    await db.flush()

    for idx, qid in enumerate(req.question_ids):
        db.add(MockExamQuestion(exam_id=exam.id, question_id=qid, orden=idx + 1))

    await db.commit()
    return {"id": str(exam.id), "title": exam.title}


@router.post("/auto", status_code=201)
async def create_auto_exam(
    req: AutoExamCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.docente, UserRole.admin)),
):
    """Generate a balanced exam automatically from the question bank."""
    selected_ids = []
    areas_config_stored = {}

    for area_str, count in req.areas_config.items():
        try:
            area = QuestionArea(area_str)
        except ValueError:
            raise HTTPException(400, f"Área inválida: {area_str}")

        q_query = select(Question.id).where(
            and_(
                Question.area == area,
                Question.status == QuestionStatus.aprobado,
            )
        )
        if req.difficulty_range:
            q_query = q_query.where(Question.difficulty.in_(req.difficulty_range))

        result = await db.execute(q_query)
        ids = [str(r[0]) for r in result.fetchall()]

        if len(ids) < count:
            raise HTTPException(
                400,
                f"No hay suficientes preguntas aprobadas en {area_str}. "
                f"Se necesitan {count}, hay {len(ids)}.",
            )
        chosen = random.sample(ids, count)
        selected_ids.extend(chosen)
        areas_config_stored[area_str] = count

    random.shuffle(selected_ids)

    exam = MockExam(
        creator_id=current_user.id,
        institution_id=current_user.institution_id,
        course_id=req.course_id,
        title=req.title,
        description=req.description,
        duration_min=req.duration_min,
        is_public=req.is_public,
        areas_config=areas_config_stored,
        auto_generated=True,
        available_from=req.available_from,
        available_until=req.available_until,
    )
    db.add(exam)
    await db.flush()

    for idx, qid in enumerate(selected_ids):
        db.add(MockExamQuestion(exam_id=exam.id, question_id=qid, orden=idx + 1))

    await db.commit()
    return {
        "id": str(exam.id),
        "title": exam.title,
        "total_questions": len(selected_ids),
        "areas_config": areas_config_stored,
    }


@router.get("/{exam_id}")
async def get_exam(
    exam_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(MockExam)
        .options(
            selectinload(MockExam.exam_questions)
            .selectinload(MockExamQuestion.question)
            .selectinload(Question.options)
        )
        .where(MockExam.id == exam_id)
    )
    exam = result.scalar_one_or_none()
    if not exam:
        raise HTTPException(404, "Simulacro no encontrado")
    return exam_to_dict(exam, include_questions=True)


@router.delete("/{exam_id}", status_code=204)
async def delete_exam(
    exam_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.docente, UserRole.admin)),
):
    result = await db.execute(select(MockExam).where(MockExam.id == exam_id))
    exam = result.scalar_one_or_none()
    if not exam:
        raise HTTPException(404, "Simulacro no encontrado")
    await db.delete(exam)
    await db.commit()


# ── Attempt Endpoints ──────────────────────────────────────────────────────

@router.post("/{exam_id}/attempts", status_code=201)
async def start_attempt(
    exam_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Check for existing in-progress attempt
    existing = await db.execute(
        select(Attempt).where(
            and_(
                Attempt.exam_id == exam_id,
                Attempt.student_id == current_user.id,
                Attempt.status == ExamStatus.en_progreso,
            )
        )
    )
    attempt = existing.scalar_one_or_none()
    if attempt:
        return {"id": str(attempt.id), "status": "resumed", "current_q_index": attempt.current_q_index}

    exam = await db.execute(select(MockExam).where(MockExam.id == exam_id))
    if not exam.scalar_one_or_none():
        raise HTTPException(404, "Simulacro no encontrado")

    attempt = Attempt(
        exam_id=exam_id,
        student_id=current_user.id,
        status=ExamStatus.en_progreso,
        started_at=datetime.utcnow(),
    )
    db.add(attempt)
    await db.commit()
    return {"id": str(attempt.id), "status": "started", "current_q_index": 0}


@router.patch("/{exam_id}/attempts/{attempt_id}/answer")
async def save_answer(
    exam_id: UUID,
    attempt_id: UUID,
    req: AnswerSubmit,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    attempt = await db.execute(
        select(Attempt).where(
            and_(Attempt.id == attempt_id, Attempt.student_id == current_user.id)
        )
    )
    att = attempt.scalar_one_or_none()
    if not att:
        raise HTTPException(404, "Intento no encontrado")
    if att.status != ExamStatus.en_progreso:
        raise HTTPException(400, "El simulacro no está en progreso")

    # Get correct answer
    q_result = await db.execute(select(Question).where(Question.id == req.question_id))
    q = q_result.scalar_one_or_none()
    if not q:
        raise HTTPException(404, "Pregunta no encontrada")

    is_correct = req.answer_given == q.respuesta_correcta if req.answer_given else None

    # Upsert answer
    existing = await db.execute(
        select(AttemptAnswer).where(
            and_(
                AttemptAnswer.attempt_id == attempt_id,
                AttemptAnswer.question_id == req.question_id,
            )
        )
    )
    ans = existing.scalar_one_or_none()
    if ans:
        ans.answer_given = req.answer_given
        ans.is_correct = is_correct
        ans.time_spent = req.time_spent
        ans.flagged = req.flagged
        ans.answered_at = datetime.utcnow()
    else:
        db.add(AttemptAnswer(
            attempt_id=attempt_id,
            question_id=req.question_id,
            answer_given=req.answer_given,
            is_correct=is_correct,
            time_spent=req.time_spent,
            flagged=req.flagged,
        ))

    await db.commit()
    return {"saved": True, "is_correct": is_correct}


@router.post("/{exam_id}/attempts/{attempt_id}/submit")
async def submit_attempt(
    exam_id: UUID,
    attempt_id: UUID,
    req: AttemptSubmit,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    att_result = await db.execute(
        select(Attempt)
        .options(selectinload(Attempt.answers))
        .where(and_(Attempt.id == attempt_id, Attempt.student_id == current_user.id))
    )
    att = att_result.scalar_one_or_none()
    if not att:
        raise HTTPException(404, "Intento no encontrado")

    # Save any remaining answers
    for answer_in in req.answers:
        q_result = await db.execute(select(Question).where(Question.id == answer_in.question_id))
        q = q_result.scalar_one_or_none()
        if not q:
            continue
        is_correct = answer_in.answer_given == q.respuesta_correcta if answer_in.answer_given else False
        existing = await db.execute(
            select(AttemptAnswer).where(
                and_(AttemptAnswer.attempt_id == attempt_id, AttemptAnswer.question_id == answer_in.question_id)
            )
        )
        ans = existing.scalar_one_or_none()
        if ans:
            ans.answer_given = answer_in.answer_given
            ans.is_correct = is_correct
        else:
            db.add(AttemptAnswer(
                attempt_id=attempt_id,
                question_id=answer_in.question_id,
                answer_given=answer_in.answer_given,
                is_correct=is_correct,
                time_spent=answer_in.time_spent,
            ))

    await db.flush()

    # Calculate scores
    all_answers = await db.execute(
        select(AttemptAnswer).where(AttemptAnswer.attempt_id == attempt_id)
    )
    answers = all_answers.scalars().all()

    correct_total = sum(1 for a in answers if a.is_correct)
    total_q = len(answers)
    score_global = round((correct_total / total_q) * 100, 2) if total_q > 0 else 0

    score_by_area: Dict[str, dict] = {}
    for ans in answers:
        q_r = await db.execute(select(Question.area).where(Question.id == ans.question_id))
        area = q_r.scalar_one_or_none()
        if not area:
            continue
        area_val = area.value
        if area_val not in score_by_area:
            score_by_area[area_val] = {"correct": 0, "total": 0}
        score_by_area[area_val]["total"] += 1
        if ans.is_correct:
            score_by_area[area_val]["correct"] += 1

    score_by_area_pct = {
        k: round(v["correct"] / v["total"] * 100, 1) if v["total"] > 0 else 0
        for k, v in score_by_area.items()
    }

    att.status = ExamStatus.completado
    att.score_global = score_global
    att.score_by_area = score_by_area_pct
    att.finished_at = datetime.utcnow()
    att.time_spent_sec = req.time_spent_sec

    await db.commit()

    return {
        "attempt_id": str(att.id),
        "score_global": score_global,
        "score_by_area": score_by_area_pct,
        "correct_total": correct_total,
        "total_questions": total_q,
        "status": "completado",
    }


@router.get("/{exam_id}/attempts/{attempt_id}/results")
async def get_attempt_results(
    exam_id: UUID,
    attempt_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    att_result = await db.execute(
        select(Attempt)
        .options(
            selectinload(Attempt.answers)
            .selectinload(AttemptAnswer.question)
            .selectinload(Question.options)
        )
        .where(and_(Attempt.id == attempt_id, Attempt.student_id == current_user.id))
    )
    att = att_result.scalar_one_or_none()
    if not att:
        raise HTTPException(404, "Intento no encontrado")

    answers_detail = []
    for ans in att.answers:
        q = ans.question
        answers_detail.append({
            "question_id": str(q.id),
            "enunciado": q.enunciado,
            "area": q.area.value if q.area else None,
            "opciones": [{"letra": o.letra, "texto": o.texto} for o in sorted(q.options, key=lambda x: x.letra)],
            "respuesta_correcta": q.respuesta_correcta,
            "respuesta_dada": ans.answer_given,
            "is_correct": ans.is_correct,
            "explicacion": q.explicacion,
            "time_spent": ans.time_spent,
            "flagged": ans.flagged,
        })

    return {
        "attempt_id": str(att.id),
        "exam_id": str(att.exam_id),
        "status": att.status.value,
        "score_global": float(att.score_global) if att.score_global else 0,
        "score_by_area": att.score_by_area,
        "started_at": att.started_at.isoformat() if att.started_at else None,
        "finished_at": att.finished_at.isoformat() if att.finished_at else None,
        "time_spent_sec": att.time_spent_sec,
        "answers": answers_detail,
    }


@router.get("/my/attempts")
async def my_attempts(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Attempt)
        .options(selectinload(Attempt.exam))
        .where(Attempt.student_id == current_user.id)
        .order_by(Attempt.created_at.desc())
        .limit(20)
    )
    attempts = result.scalars().all()
    return [
        {
            "id": str(a.id),
            "exam_id": str(a.exam_id),
            "exam_title": a.exam.title if a.exam else None,
            "status": a.status.value,
            "score_global": float(a.score_global) if a.score_global else None,
            "score_by_area": a.score_by_area,
            "started_at": a.started_at.isoformat() if a.started_at else None,
            "finished_at": a.finished_at.isoformat() if a.finished_at else None,
            "time_spent_sec": a.time_spent_sec,
        }
        for a in attempts
    ]
