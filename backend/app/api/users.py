from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from pydantic import BaseModel, EmailStr

from app.core.database import get_db
from app.domain.models import User, UserRole
from app.api.auth import get_current_user, require_role, hash_password

router = APIRouter(prefix="/users", tags=["users"])


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    grade: Optional[str] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None
    institution_id: Optional[str] = None


class PasswordChange(BaseModel):
    current_password: str
    new_password: str


def user_to_dict(u: User) -> dict:
    return {
        "id": str(u.id),
        "email": u.email,
        "full_name": u.full_name,
        "role": u.role.value,
        "grade": u.grade,
        "avatar_url": u.avatar_url,
        "institution_id": str(u.institution_id) if u.institution_id else None,
        "is_active": u.is_active,
        "is_verified": u.is_verified,
        "last_login": u.last_login.isoformat() if u.last_login else None,
        "created_at": u.created_at.isoformat() if u.created_at else None,
    }


@router.get("")
async def list_users(
    role: Optional[UserRole] = None,
    search: Optional[str] = None,
    is_active: Optional[bool] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin)),
):
    query = select(User).order_by(User.created_at.desc())
    filters = []

    if current_user.institution_id:
        filters.append(User.institution_id == current_user.institution_id)
    if role:
        filters.append(User.role == role)
    if is_active is not None:
        filters.append(User.is_active == is_active)
    if search:
        filters.append(
            or_(
                User.full_name.ilike(f"%{search}%"),
                User.email.ilike(f"%{search}%"),
            )
        )
    if filters:
        query = query.where(and_(*filters))

    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar()
    result = await db.execute(query.offset((page - 1) * limit).limit(limit))
    users = result.scalars().all()

    return {
        "total": total,
        "page": page,
        "items": [user_to_dict(u) for u in users],
    }


@router.get("/{user_id}")
async def get_user(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin)),
):
    result = await db.execute(select(User).where(User.id == user_id))
    u = result.scalar_one_or_none()
    if not u:
        raise HTTPException(404, "Usuario no encontrado")
    return user_to_dict(u)


@router.put("/{user_id}")
async def update_user(
    user_id: UUID,
    req: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin)),
):
    result = await db.execute(select(User).where(User.id == user_id))
    u = result.scalar_one_or_none()
    if not u:
        raise HTTPException(404, "Usuario no encontrado")

    for field in ["full_name", "grade", "role", "is_active", "institution_id"]:
        val = getattr(req, field, None)
        if val is not None:
            setattr(u, field, val)

    await db.commit()
    return user_to_dict(u)


@router.delete("/{user_id}", status_code=204)
async def delete_user(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin)),
):
    result = await db.execute(select(User).where(User.id == user_id))
    u = result.scalar_one_or_none()
    if not u:
        raise HTTPException(404, "Usuario no encontrado")
    if str(u.id) == str(current_user.id):
        raise HTTPException(400, "No puedes eliminar tu propia cuenta")
    u.is_active = False  # Soft delete
    await db.commit()


@router.get("/stats/summary")
async def user_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin)),
):
    results = await db.execute(
        select(User.role, func.count(User.id))
        .where(User.institution_id == current_user.institution_id)
        .group_by(User.role)
    )
    by_role = {row[0].value: row[1] for row in results.fetchall()}
    total = sum(by_role.values())
    return {"total": total, "by_role": by_role}
