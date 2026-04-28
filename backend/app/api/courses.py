from typing import Optional, List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from pydantic import BaseModel

from app.core.database import get_db
from app.domain.models import Course, Enrollment, User, UserRole
from app.api.auth import get_current_user, require_role

router = APIRouter(prefix="/courses", tags=["courses"])


class CourseCreate(BaseModel):
    name: str
    grade: Optional[str] = None
    school_year: Optional[str] = None
    description: Optional[str] = None


class EnrollRequest(BaseModel):
    student_ids: List[str]


def course_to_dict(c: Course, student_count: int = 0) -> dict:
    return {
        "id": str(c.id),
        "name": c.name,
        "grade": c.grade,
        "school_year": c.school_year,
        "description": c.description,
        "teacher_id": str(c.teacher_id) if c.teacher_id else None,
        "institution_id": str(c.institution_id) if c.institution_id else None,
        "active": c.active,
        "student_count": student_count,
        "created_at": c.created_at.isoformat() if c.created_at else None,
    }


@router.get("")
async def list_courses(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == UserRole.estudiante:
        # Students see only their enrolled courses
        result = await db.execute(
            select(Course)
            .join(Enrollment, Enrollment.course_id == Course.id)
            .where(Enrollment.student_id == current_user.id)
        )
    else:
        result = await db.execute(
            select(Course).where(
                Course.institution_id == current_user.institution_id
            )
        )
    courses = result.scalars().all()

    out = []
    for c in courses:
        count_result = await db.execute(
            select(func.count(Enrollment.id)).where(Enrollment.course_id == c.id)
        )
        out.append(course_to_dict(c, count_result.scalar() or 0))
    return out


@router.post("", status_code=201)
async def create_course(
    req: CourseCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.docente, UserRole.admin)),
):
    course = Course(
        institution_id=current_user.institution_id,
        teacher_id=current_user.id,
        name=req.name,
        grade=req.grade,
        school_year=req.school_year,
        description=req.description,
    )
    db.add(course)
    await db.commit()
    return course_to_dict(course)


@router.post("/{course_id}/enroll")
async def enroll_students(
    course_id: UUID,
    req: EnrollRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.docente, UserRole.admin)),
):
    result = await db.execute(select(Course).where(Course.id == course_id))
    course = result.scalar_one_or_none()
    if not course:
        raise HTTPException(404, "Curso no encontrado")

    enrolled = []
    for sid in req.student_ids:
        existing = await db.execute(
            select(Enrollment).where(
                Enrollment.course_id == course_id,
                Enrollment.student_id == sid,
            )
        )
        if not existing.scalar_one_or_none():
            db.add(Enrollment(course_id=course_id, student_id=sid))
            enrolled.append(sid)

    await db.commit()
    return {"enrolled": len(enrolled), "student_ids": enrolled}


@router.delete("/{course_id}", status_code=204)
async def delete_course(
    course_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.docente, UserRole.admin)),
):
    result = await db.execute(select(Course).where(Course.id == course_id))
    c = result.scalar_one_or_none()
    if not c:
        raise HTTPException(404, "Curso no encontrado")
    await db.delete(c)
    await db.commit()
