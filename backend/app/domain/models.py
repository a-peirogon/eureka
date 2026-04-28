import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, Boolean, Integer, Text, Numeric,
    ForeignKey, DateTime, JSON, UniqueConstraint, Enum as SAEnum
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.core.database import Base
import enum


# ── Enums ──────────────────────────────────────────────────────────────────

class UserRole(str, enum.Enum):
    estudiante = "estudiante"
    docente = "docente"
    admin = "admin"


class QuestionArea(str, enum.Enum):
    matematicas = "matematicas"
    lectura_critica = "lectura_critica"
    sociales_ciudadanas = "sociales_ciudadanas"
    ciencias_naturales = "ciencias_naturales"
    ingles = "ingles"


class QuestionDifficulty(str, enum.Enum):
    d1 = "1"
    d2 = "2"
    d3 = "3"
    d4 = "4"
    d5 = "5"


class QuestionStatus(str, enum.Enum):
    borrador = "borrador"
    aprobado = "aprobado"
    archivado = "archivado"


class ExamStatus(str, enum.Enum):
    pendiente = "pendiente"
    en_progreso = "en_progreso"
    completado = "completado"
    abandonado = "abandonado"


class AIJobType(str, enum.Enum):
    generar_pregunta = "generar_pregunta"
    reformular = "reformular"
    explicacion = "explicacion"
    clasificar = "clasificar"
    ocr = "ocr"


class AIJobStatus(str, enum.Enum):
    pendiente = "pendiente"
    procesando = "procesando"
    completado = "completado"
    fallido = "fallido"


# ── Models ─────────────────────────────────────────────────────────────────

def gen_uuid():
    return str(uuid.uuid4())


class Institution(Base):
    __tablename__ = "institutions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    nit = Column(String(30), unique=True)
    city = Column(String(100))
    department = Column(String(100))
    logo_url = Column(Text)
    plan = Column(String(50), default="basico")
    active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    users = relationship("User", back_populates="institution")
    courses = relationship("Course", back_populates="institution")


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    institution_id = Column(UUID(as_uuid=True), ForeignKey("institutions.id", ondelete="SET NULL"))
    email = Column(String(255), unique=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(SAEnum(UserRole, name="user_role", values_callable=lambda x: [e.value for e in x]), nullable=False, default=UserRole.estudiante)
    grade = Column(String(20))
    avatar_url = Column(Text)
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    last_login = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    institution = relationship("Institution", back_populates="users")
    refresh_tokens = relationship("RefreshToken", back_populates="user", cascade="all, delete-orphan")
    questions = relationship("Question", back_populates="author")
    attempts = relationship("Attempt", back_populates="student")
    ai_jobs = relationship("AIJob", back_populates="requester")


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token = Column(Text, unique=True, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    user = relationship("User", back_populates="refresh_tokens")


class Course(Base):
    __tablename__ = "courses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    institution_id = Column(UUID(as_uuid=True), ForeignKey("institutions.id", ondelete="CASCADE"))
    teacher_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    name = Column(String(100), nullable=False)
    grade = Column(String(20))
    school_year = Column(String(10))
    description = Column(Text)
    active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    institution = relationship("Institution", back_populates="courses")
    enrollments = relationship("Enrollment", back_populates="course")
    mock_exams = relationship("MockExam", back_populates="course")


class Enrollment(Base):
    __tablename__ = "enrollments"
    __table_args__ = (UniqueConstraint("course_id", "student_id"),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    course_id = Column(UUID(as_uuid=True), ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    student_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    enrolled_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    active = Column(Boolean, default=True)

    course = relationship("Course", back_populates="enrollments")
    student = relationship("User")


class FileRecord(Base):
    __tablename__ = "files"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    uploaded_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    filename = Column(String(255), nullable=False)
    mime_type = Column(String(100))
    size_bytes = Column(Integer)
    storage_key = Column(Text, nullable=False)
    public_url = Column(Text)
    purpose = Column(String(50))
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)


class Question(Base):
    __tablename__ = "questions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    author_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    institution_id = Column(UUID(as_uuid=True), ForeignKey("institutions.id", ondelete="SET NULL"))
    area = Column(SAEnum(QuestionArea, name="question_area", values_callable=lambda x: [e.value for e in x]), nullable=False)
    competencia = Column(String(255))
    componente = Column(String(255))
    difficulty = Column(String(1), default="3")
    enunciado = Column(Text, nullable=False)
    respuesta_correcta = Column(String(1), nullable=False)
    explicacion = Column(Text)
    tiempo_estimado = Column(Integer, default=90)
    imagen_id = Column(UUID(as_uuid=True), ForeignKey("files.id"))
    latex_content = Column(Text)
    status = Column(SAEnum(QuestionStatus, name="question_status", values_callable=lambda x: [e.value for e in x]), default=QuestionStatus.borrador)
    source = Column(String(50), default="manual")
    ai_job_id = Column(UUID(as_uuid=True))
    times_used = Column(Integer, default=0)
    times_correct = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    author = relationship("User", back_populates="questions")
    options = relationship("QuestionOption", back_populates="question", cascade="all, delete-orphan")
    image = relationship("FileRecord", foreign_keys=[imagen_id])
    question_tags = relationship("QuestionTag", back_populates="question", cascade="all, delete-orphan")


class QuestionOption(Base):
    __tablename__ = "question_options"
    __table_args__ = (UniqueConstraint("question_id", "letra"),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    question_id = Column(UUID(as_uuid=True), ForeignKey("questions.id", ondelete="CASCADE"), nullable=False)
    letra = Column(String(1), nullable=False)
    texto = Column(Text, nullable=False)
    imagen_id = Column(UUID(as_uuid=True), ForeignKey("files.id"))

    question = relationship("Question", back_populates="options")


class Tag(Base):
    __tablename__ = "tags"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), unique=True, nullable=False)


class QuestionTag(Base):
    __tablename__ = "question_tags"
    __table_args__ = (UniqueConstraint("question_id", "tag_id"),)

    question_id = Column(UUID(as_uuid=True), ForeignKey("questions.id", ondelete="CASCADE"), primary_key=True)
    tag_id = Column(UUID(as_uuid=True), ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True)

    question = relationship("Question", back_populates="question_tags")
    tag = relationship("Tag")


class MockExam(Base):
    __tablename__ = "mock_exams"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    creator_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    institution_id = Column(UUID(as_uuid=True), ForeignKey("institutions.id", ondelete="SET NULL"))
    course_id = Column(UUID(as_uuid=True), ForeignKey("courses.id", ondelete="SET NULL"))
    title = Column(String(255), nullable=False)
    description = Column(Text)
    duration_min = Column(Integer, default=180)
    areas_config = Column(JSONB, default={})
    is_public = Column(Boolean, default=False)
    auto_generated = Column(Boolean, default=False)
    available_from = Column(DateTime(timezone=True))
    available_until = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    creator = relationship("User")
    course = relationship("Course", back_populates="mock_exams")
    exam_questions = relationship("MockExamQuestion", back_populates="exam", cascade="all, delete-orphan")
    attempts = relationship("Attempt", back_populates="exam")


class MockExamQuestion(Base):
    __tablename__ = "mock_exam_questions"
    __table_args__ = (
        UniqueConstraint("exam_id", "question_id"),
        UniqueConstraint("exam_id", "orden"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    exam_id = Column(UUID(as_uuid=True), ForeignKey("mock_exams.id", ondelete="CASCADE"), nullable=False)
    question_id = Column(UUID(as_uuid=True), ForeignKey("questions.id", ondelete="CASCADE"), nullable=False)
    orden = Column(Integer, nullable=False)

    exam = relationship("MockExam", back_populates="exam_questions")
    question = relationship("Question")


class Attempt(Base):
    __tablename__ = "attempts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    exam_id = Column(UUID(as_uuid=True), ForeignKey("mock_exams.id", ondelete="CASCADE"), nullable=False)
    student_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    status = Column(SAEnum(ExamStatus, name="exam_status", values_callable=lambda x: [e.value for e in x]), default=ExamStatus.pendiente)
    score_global = Column(Numeric(5, 2))
    score_by_area = Column(JSONB, default={})
    score_by_comp = Column(JSONB, default={})
    started_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    finished_at = Column(DateTime(timezone=True))
    time_spent_sec = Column(Integer)
    current_q_index = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    exam = relationship("MockExam", back_populates="attempts")
    student = relationship("User", back_populates="attempts")
    answers = relationship("AttemptAnswer", back_populates="attempt", cascade="all, delete-orphan")


class AttemptAnswer(Base):
    __tablename__ = "attempt_answers"
    __table_args__ = (UniqueConstraint("attempt_id", "question_id"),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    attempt_id = Column(UUID(as_uuid=True), ForeignKey("attempts.id", ondelete="CASCADE"), nullable=False)
    question_id = Column(UUID(as_uuid=True), ForeignKey("questions.id", ondelete="CASCADE"), nullable=False)
    answer_given = Column(String(1))
    is_correct = Column(Boolean)
    time_spent = Column(Integer)
    flagged = Column(Boolean, default=False)
    answered_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    attempt = relationship("Attempt", back_populates="answers")
    question = relationship("Question")


class AIJob(Base):
    __tablename__ = "ai_jobs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    requester_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    job_type = Column(SAEnum(AIJobType, name="ai_job_type", values_callable=lambda x: [e.value for e in x]), nullable=False)
    status = Column(SAEnum(AIJobStatus, name="ai_job_status", values_callable=lambda x: [e.value for e in x]), default=AIJobStatus.pendiente)
    input_data = Column(JSONB, nullable=False)
    output_data = Column(JSONB)
    error_msg = Column(Text)
    model_used = Column(String(100))
    tokens_used = Column(Integer)
    started_at = Column(DateTime(timezone=True))
    finished_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    requester = relationship("User", back_populates="ai_jobs")
