from typing import Optional, List
from uuid import UUID
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, desc, text
from pydantic import BaseModel

from app.core.database import get_db
from app.domain.models import (
    Attempt, AttemptAnswer, Question, QuestionArea,
    User, UserRole, Course, Enrollment, MockExam, ExamStatus
)
from app.api.auth import get_current_user, require_role

router = APIRouter(prefix="/analytics", tags=["analytics"])


# ── Student Analytics ──────────────────────────────────────────────────────

@router.get("/student/me")
async def my_analytics(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Personal analytics for a student."""
    # All completed attempts
    result = await db.execute(
        select(Attempt)
        .where(
            and_(
                Attempt.student_id == current_user.id,
                Attempt.status == ExamStatus.completado,
            )
        )
        .order_by(Attempt.finished_at)
    )
    attempts = result.scalars().all()

    if not attempts:
        return {
            "total_simulacros": 0,
            "puntaje_promedio": None,
            "mejor_puntaje": None,
            "evolucion": [],
            "por_area": {},
            "preguntas_respondidas": 0,
            "tasa_acierto": None,
            "tendencia": "sin_datos",
        }

    scores = [float(a.score_global) for a in attempts if a.score_global is not None]
    avg_score = round(sum(scores) / len(scores), 1) if scores else 0
    best_score = max(scores) if scores else 0

    # Area breakdown aggregated
    por_area = {}
    for att in attempts:
        if att.score_by_area:
            for area, pct in att.score_by_area.items():
                if area not in por_area:
                    por_area[area] = []
                por_area[area].append(float(pct))

    por_area_avg = {k: round(sum(v) / len(v), 1) for k, v in por_area.items()}

    # Evolution over time
    evolucion = [
        {
            "fecha": a.finished_at.strftime("%Y-%m-%d") if a.finished_at else None,
            "score": float(a.score_global) if a.score_global else 0,
            "exam_title": None,
        }
        for a in attempts[-10:]
    ]

    # Total answers and accuracy
    answers_result = await db.execute(
        select(func.count(AttemptAnswer.id), func.sum(
            func.cast(AttemptAnswer.is_correct, type_=__import__('sqlalchemy').Integer)
        ))
        .join(Attempt, AttemptAnswer.attempt_id == Attempt.id)
        .where(Attempt.student_id == current_user.id)
    )
    row = answers_result.one()
    total_answers = row[0] or 0
    total_correct = row[1] or 0
    tasa_acierto = round(total_correct / total_answers * 100, 1) if total_answers > 0 else None

    # Trend
    if len(scores) >= 2:
        recent = scores[-3:] if len(scores) >= 3 else scores
        prev = scores[-6:-3] if len(scores) >= 6 else scores[:-len(recent)]
        if prev:
            tendencia = "mejorando" if sum(recent)/len(recent) > sum(prev)/len(prev) else "estable"
        else:
            tendencia = "sin_datos"
    else:
        tendencia = "sin_datos"

    # Weakest area
    weakest_area = None
    if por_area_avg:
        weakest_area = min(por_area_avg, key=por_area_avg.get)

    return {
        "total_simulacros": len(attempts),
        "puntaje_promedio": avg_score,
        "mejor_puntaje": round(best_score, 1),
        "evolucion": evolucion,
        "por_area": por_area_avg,
        "preguntas_respondidas": total_answers,
        "tasa_acierto": tasa_acierto,
        "tendencia": tendencia,
        "area_mas_debil": weakest_area,
        "semana_actual": _weekly_summary(attempts),
    }


def _weekly_summary(attempts: list) -> dict:
    week_ago = datetime.utcnow() - timedelta(days=7)
    week_attempts = [a for a in attempts if a.finished_at and a.finished_at > week_ago]
    if not week_attempts:
        return {"simulacros": 0, "promedio": None}
    scores = [float(a.score_global) for a in week_attempts if a.score_global]
    return {
        "simulacros": len(week_attempts),
        "promedio": round(sum(scores) / len(scores), 1) if scores else None,
    }


# ── Teacher / Course Analytics ─────────────────────────────────────────────

@router.get("/course/{course_id}")
async def course_analytics(
    course_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.docente, UserRole.admin)),
):
    """Analytics for a course (teacher view)."""
    # Get enrolled students
    enroll_result = await db.execute(
        select(Enrollment.student_id).where(Enrollment.course_id == course_id)
    )
    student_ids = [row[0] for row in enroll_result.fetchall()]

    if not student_ids:
        return {"student_count": 0, "message": "Sin estudiantes inscritos"}

    # Get all completed attempts for the course
    attempts_result = await db.execute(
        select(Attempt)
        .where(
            and_(
                Attempt.student_id.in_(student_ids),
                Attempt.status == ExamStatus.completado,
            )
        )
    )
    all_attempts = attempts_result.scalars().all()

    scores = [float(a.score_global) for a in all_attempts if a.score_global]
    promedio_curso = round(sum(scores) / len(scores), 1) if scores else None

    # Area breakdown across course
    area_breakdown: dict = {}
    for att in all_attempts:
        if att.score_by_area:
            for area, pct in att.score_by_area.items():
                if area not in area_breakdown:
                    area_breakdown[area] = []
                area_breakdown[area].append(float(pct))

    area_avgs = {k: round(sum(v) / len(v), 1) for k, v in area_breakdown.items()}

    # Most failed questions
    failed_result = await db.execute(
        select(
            AttemptAnswer.question_id,
            func.count(AttemptAnswer.id).label("total"),
            func.sum(
                func.cast(AttemptAnswer.is_correct == False, type_=__import__('sqlalchemy').Integer)
            ).label("wrong"),
        )
        .join(Attempt, AttemptAnswer.attempt_id == Attempt.id)
        .where(Attempt.student_id.in_(student_ids))
        .group_by(AttemptAnswer.question_id)
        .order_by(desc("wrong"))
        .limit(10)
    )
    failed_rows = failed_result.fetchall()

    most_failed = []
    for row in failed_rows:
        qid, total, wrong = row
        if total > 0:
            q_res = await db.execute(
                select(Question.enunciado, Question.area).where(Question.id == qid)
            )
            q_row = q_res.one_or_none()
            if q_row:
                most_failed.append({
                    "question_id": str(qid),
                    "enunciado_preview": q_row[0][:80] + "..." if len(q_row[0]) > 80 else q_row[0],
                    "area": q_row[1].value if q_row[1] else None,
                    "tasa_error": round((wrong or 0) / total * 100, 1),
                    "total_intentos": total,
                })

    # Student ranking
    student_scores = {}
    for att in all_attempts:
        sid = str(att.student_id)
        if sid not in student_scores:
            student_scores[sid] = []
        if att.score_global:
            student_scores[sid].append(float(att.score_global))

    ranking = []
    for sid, s_scores in student_scores.items():
        avg = round(sum(s_scores) / len(s_scores), 1) if s_scores else 0
        u_res = await db.execute(select(User.full_name).where(User.id == sid))
        u = u_res.scalar_one_or_none()
        ranking.append({
            "student_id": sid,
            "full_name": u or "Desconocido",
            "promedio": avg,
            "simulacros": len(s_scores),
        })

    ranking.sort(key=lambda x: x["promedio"], reverse=True)
    for i, r in enumerate(ranking):
        r["posicion"] = i + 1

    # Weekly evolution (last 8 weeks)
    weekly: dict = {}
    for att in all_attempts:
        if att.finished_at and att.score_global:
            week = att.finished_at.strftime("%Y-W%U")
            if week not in weekly:
                weekly[week] = []
            weekly[week].append(float(att.score_global))

    evolucion_semanal = [
        {"semana": k, "promedio": round(sum(v) / len(v), 1), "intentos": len(v)}
        for k, v in sorted(weekly.items())[-8:]
    ]

    return {
        "course_id": str(course_id),
        "student_count": len(student_ids),
        "total_intentos": len(all_attempts),
        "promedio_curso": promedio_curso,
        "por_area": area_avgs,
        "preguntas_mas_falladas": most_failed,
        "ranking": ranking[:20],
        "evolucion_semanal": evolucion_semanal,
        "area_mas_debil": min(area_avgs, key=area_avgs.get) if area_avgs else None,
        "tasa_mejora": _calc_improvement(evolucion_semanal),
    }


def _calc_improvement(evolucion: list) -> Optional[float]:
    if len(evolucion) < 2:
        return None
    first = evolucion[0]["promedio"]
    last = evolucion[-1]["promedio"]
    if first == 0:
        return None
    return round((last - first) / first * 100, 1)


@router.get("/institution/summary")
async def institution_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin)),
):
    """Institution-wide analytics summary."""
    inst_id = current_user.institution_id
    if not inst_id:
        raise HTTPException(400, "Usuario no tiene institución asignada")

    # Users count
    users_result = await db.execute(
        select(User.role, func.count(User.id))
        .where(User.institution_id == inst_id)
        .group_by(User.role)
    )
    user_counts = {row[0].value: row[1] for row in users_result.fetchall()}

    # Questions count
    from app.domain.models import Question, QuestionStatus
    q_result = await db.execute(
        select(func.count(Question.id))
        .where(Question.institution_id == inst_id)
    )
    total_questions = q_result.scalar() or 0

    # Active exams
    exams_result = await db.execute(
        select(func.count(MockExam.id))
        .where(MockExam.institution_id == inst_id)
    )
    total_exams = exams_result.scalar() or 0

    # Score distribution
    scores_result = await db.execute(
        select(Attempt.score_global)
        .join(User, Attempt.student_id == User.id)
        .where(
            and_(
                User.institution_id == inst_id,
                Attempt.status == ExamStatus.completado,
                Attempt.score_global != None,
            )
        )
    )
    all_scores = [float(r[0]) for r in scores_result.fetchall()]
    dist = {"0-20": 0, "21-40": 0, "41-60": 0, "61-80": 0, "81-100": 0}
    for s in all_scores:
        if s <= 20: dist["0-20"] += 1
        elif s <= 40: dist["21-40"] += 1
        elif s <= 60: dist["41-60"] += 1
        elif s <= 80: dist["61-80"] += 1
        else: dist["81-100"] += 1

    return {
        "usuarios": user_counts,
        "total_preguntas": total_questions,
        "total_simulacros": total_exams,
        "promedio_institucional": round(sum(all_scores) / len(all_scores), 1) if all_scores else None,
        "distribucion_puntajes": dist,
        "total_intentos": len(all_scores),
    }
