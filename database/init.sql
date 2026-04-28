-- ============================================================
-- ICFES SABER 11 - ESQUEMA POSTGRESQL COMPLETO
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE user_role AS ENUM ('estudiante', 'docente', 'admin');
CREATE TYPE question_area AS ENUM (
  'matematicas', 'lectura_critica', 'sociales_ciudadanas',
  'ciencias_naturales', 'ingles'
);
CREATE TYPE question_difficulty AS ENUM ('1','2','3','4','5');
CREATE TYPE question_status AS ENUM ('borrador', 'aprobado', 'archivado');
CREATE TYPE exam_status AS ENUM ('pendiente', 'en_progreso', 'completado', 'abandonado');
CREATE TYPE ai_job_status AS ENUM ('pendiente', 'procesando', 'completado', 'fallido');
CREATE TYPE ai_job_type AS ENUM ('generar_pregunta', 'reformular', 'explicacion', 'clasificar', 'ocr');

-- ============================================================
-- INSTITUTIONS
-- ============================================================

CREATE TABLE institutions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        VARCHAR(255) NOT NULL,
  nit         VARCHAR(30) UNIQUE,
  city        VARCHAR(100),
  department  VARCHAR(100),
  logo_url    TEXT,
  plan        VARCHAR(50) DEFAULT 'basico',
  active      BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- USERS
-- ============================================================

CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  institution_id  UUID REFERENCES institutions(id) ON DELETE SET NULL,
  email           VARCHAR(255) UNIQUE NOT NULL,
  hashed_password VARCHAR(255) NOT NULL,
  full_name       VARCHAR(255) NOT NULL,
  role            user_role NOT NULL DEFAULT 'estudiante',
  grade           VARCHAR(20),                   -- Grado (10°, 11°)
  avatar_url      TEXT,
  is_active       BOOLEAN DEFAULT TRUE,
  is_verified     BOOLEAN DEFAULT FALSE,
  last_login      TIMESTAMP WITH TIME ZONE,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_institution ON users(institution_id);
CREATE INDEX idx_users_role ON users(role);

-- ============================================================
-- REFRESH TOKENS
-- ============================================================

CREATE TABLE refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token       TEXT UNIQUE NOT NULL,
  expires_at  TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);

-- ============================================================
-- COURSES (GRUPOS)
-- ============================================================

CREATE TABLE courses (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  institution_id  UUID REFERENCES institutions(id) ON DELETE CASCADE,
  teacher_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  name            VARCHAR(100) NOT NULL,
  grade           VARCHAR(20),
  school_year     VARCHAR(10),
  description     TEXT,
  active          BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_courses_institution ON courses(institution_id);
CREATE INDEX idx_courses_teacher ON courses(teacher_id);

-- ============================================================
-- ENROLLMENTS
-- ============================================================

CREATE TABLE enrollments (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id   UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  student_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  active      BOOLEAN DEFAULT TRUE,
  UNIQUE(course_id, student_id)
);

CREATE INDEX idx_enrollments_course ON enrollments(course_id);
CREATE INDEX idx_enrollments_student ON enrollments(student_id);

-- ============================================================
-- FILES (S3/R2/MinIO)
-- ============================================================

CREATE TABLE files (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  filename    VARCHAR(255) NOT NULL,
  mime_type   VARCHAR(100),
  size_bytes  BIGINT,
  storage_key TEXT NOT NULL,      -- S3/R2 object key
  public_url  TEXT,
  purpose     VARCHAR(50),        -- 'question_image', 'import', 'avatar'
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- QUESTIONS
-- ============================================================

CREATE TABLE questions (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  author_id        UUID REFERENCES users(id) ON DELETE SET NULL,
  institution_id   UUID REFERENCES institutions(id) ON DELETE SET NULL,
  area             question_area NOT NULL,
  competencia      VARCHAR(255),
  componente       VARCHAR(255),
  difficulty       question_difficulty NOT NULL DEFAULT '3',
  enunciado        TEXT NOT NULL,
  respuesta_correcta CHAR(1) NOT NULL CHECK (respuesta_correcta IN ('A','B','C','D')),
  explicacion      TEXT,
  tiempo_estimado  INTEGER DEFAULT 90,             -- seconds
  imagen_id        UUID REFERENCES files(id),
  latex_content    TEXT,
  status           question_status DEFAULT 'borrador',
  source           VARCHAR(50) DEFAULT 'manual',   -- 'manual','ia','ocr','import'
  ai_job_id        UUID,
  times_used       INTEGER DEFAULT 0,
  times_correct    INTEGER DEFAULT 0,
  created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_questions_area ON questions(area);
CREATE INDEX idx_questions_status ON questions(status);
CREATE INDEX idx_questions_difficulty ON questions(difficulty);
CREATE INDEX idx_questions_author ON questions(author_id);
CREATE INDEX idx_questions_institution ON questions(institution_id);
CREATE INDEX idx_questions_enunciado_gin ON questions USING gin(to_tsvector('spanish', enunciado));

-- ============================================================
-- QUESTION OPTIONS
-- ============================================================

CREATE TABLE question_options (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question_id  UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  letra        CHAR(1) NOT NULL CHECK (letra IN ('A','B','C','D')),
  texto        TEXT NOT NULL,
  imagen_id    UUID REFERENCES files(id),
  UNIQUE(question_id, letra)
);

CREATE INDEX idx_question_options_question ON question_options(question_id);

-- ============================================================
-- QUESTION TAGS
-- ============================================================

CREATE TABLE tags (
  id    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name  VARCHAR(100) UNIQUE NOT NULL
);

CREATE TABLE question_tags (
  question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
  tag_id      UUID REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (question_id, tag_id)
);

-- ============================================================
-- MOCK EXAMS (SIMULACROS)
-- ============================================================

CREATE TABLE mock_exams (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  institution_id  UUID REFERENCES institutions(id) ON DELETE SET NULL,
  course_id       UUID REFERENCES courses(id) ON DELETE SET NULL,
  title           VARCHAR(255) NOT NULL,
  description     TEXT,
  duration_min    INTEGER DEFAULT 180,            -- minutes
  areas_config    JSONB DEFAULT '{}',             -- {area: num_questions}
  is_public       BOOLEAN DEFAULT FALSE,
  auto_generated  BOOLEAN DEFAULT FALSE,
  available_from  TIMESTAMP WITH TIME ZONE,
  available_until TIMESTAMP WITH TIME ZONE,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_mock_exams_creator ON mock_exams(creator_id);
CREATE INDEX idx_mock_exams_institution ON mock_exams(institution_id);

-- ============================================================
-- MOCK EXAM QUESTIONS (junction)
-- ============================================================

CREATE TABLE mock_exam_questions (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_id      UUID NOT NULL REFERENCES mock_exams(id) ON DELETE CASCADE,
  question_id  UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  orden        INTEGER NOT NULL,
  UNIQUE(exam_id, question_id),
  UNIQUE(exam_id, orden)
);

CREATE INDEX idx_meq_exam ON mock_exam_questions(exam_id);
CREATE INDEX idx_meq_question ON mock_exam_questions(question_id);

-- ============================================================
-- ATTEMPTS (INTENTOS DE SIMULACRO)
-- ============================================================

CREATE TABLE attempts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_id         UUID NOT NULL REFERENCES mock_exams(id) ON DELETE CASCADE,
  student_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status          exam_status DEFAULT 'pendiente',
  score_global    NUMERIC(5,2),
  score_by_area   JSONB DEFAULT '{}',
  score_by_comp   JSONB DEFAULT '{}',
  started_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  finished_at     TIMESTAMP WITH TIME ZONE,
  time_spent_sec  INTEGER,
  current_q_index INTEGER DEFAULT 0,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_attempts_student ON attempts(student_id);
CREATE INDEX idx_attempts_exam ON attempts(exam_id);
CREATE INDEX idx_attempts_status ON attempts(status);

-- ============================================================
-- ATTEMPT ANSWERS
-- ============================================================

CREATE TABLE attempt_answers (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  attempt_id   UUID NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  question_id  UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  answer_given CHAR(1) CHECK (answer_given IN ('A','B','C','D')),
  is_correct   BOOLEAN,
  time_spent   INTEGER,             -- seconds on this question
  flagged      BOOLEAN DEFAULT FALSE,
  answered_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(attempt_id, question_id)
);

CREATE INDEX idx_answers_attempt ON attempt_answers(attempt_id);
CREATE INDEX idx_answers_question ON attempt_answers(question_id);

-- ============================================================
-- ANALYTICS (aggregated cache)
-- ============================================================

CREATE TABLE analytics (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type     VARCHAR(50) NOT NULL,    -- 'student', 'course', 'institution', 'question'
  entity_id       UUID NOT NULL,
  metric_name     VARCHAR(100) NOT NULL,
  metric_value    NUMERIC,
  metric_json     JSONB,
  period          VARCHAR(20),             -- 'week', 'month', 'all'
  computed_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_analytics_entity ON analytics(entity_type, entity_id);
CREATE INDEX idx_analytics_metric ON analytics(metric_name);
CREATE INDEX idx_analytics_period ON analytics(period);

-- ============================================================
-- AI JOBS
-- ============================================================

CREATE TABLE ai_jobs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  requester_id  UUID REFERENCES users(id) ON DELETE SET NULL,
  job_type      ai_job_type NOT NULL,
  status        ai_job_status DEFAULT 'pendiente',
  input_data    JSONB NOT NULL,
  output_data   JSONB,
  error_msg     TEXT,
  model_used    VARCHAR(100),
  tokens_used   INTEGER,
  started_at    TIMESTAMP WITH TIME ZONE,
  finished_at   TIMESTAMP WITH TIME ZONE,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_ai_jobs_status ON ai_jobs(status);
CREATE INDEX idx_ai_jobs_requester ON ai_jobs(requester_id);

-- ============================================================
-- PASSWORD RESET TOKENS
-- ============================================================

CREATE TABLE password_resets (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token       VARCHAR(64) UNIQUE NOT NULL,
  expires_at  TIMESTAMP WITH TIME ZONE NOT NULL,
  used        BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- SEED DATA
-- ============================================================

INSERT INTO institutions (id, name, nit, city, department) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Colegio Eureka Demo', '900123456-1', 'Bogotá', 'Cundinamarca');

-- Admin user (password: Admin123!)
INSERT INTO users (id, institution_id, email, hashed_password, full_name, role, is_active, is_verified)
VALUES (
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000001',
  'admin@eureka.edu.co',
  '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW',
  'Administrador Eureka',
  'admin', TRUE, TRUE
);

-- Teacher user (password: Docente123!)
INSERT INTO users (id, institution_id, email, hashed_password, full_name, role, is_active, is_verified)
VALUES (
  '00000000-0000-0000-0000-000000000011',
  '00000000-0000-0000-0000-000000000001',
  'docente@eureka.edu.co',
  '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW',
  'María García Docente',
  'docente', TRUE, TRUE
);

-- Student user (password: Estudiante123!)
INSERT INTO users (id, institution_id, email, hashed_password, full_name, role, grade, is_active, is_verified)
VALUES (
  '00000000-0000-0000-0000-000000000012',
  '00000000-0000-0000-0000-000000000001',
  'estudiante@eureka.edu.co',
  '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW',
  'Carlos Rodríguez Estudiante',
  'estudiante', '11', TRUE, TRUE
);

-- Demo course
INSERT INTO courses (id, institution_id, teacher_id, name, grade, school_year)
VALUES (
  '00000000-0000-0000-0000-000000000020',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000011',
  'Grado 11 - 2025', '11', '2025'
);

INSERT INTO enrollments (course_id, student_id)
VALUES (
  '00000000-0000-0000-0000-000000000020',
  '00000000-0000-0000-0000-000000000012'
);

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_questions_updated BEFORE UPDATE ON questions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Update question usage stats when answer is inserted
CREATE OR REPLACE FUNCTION update_question_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE questions
  SET
    times_used = times_used + 1,
    times_correct = times_correct + (CASE WHEN NEW.is_correct THEN 1 ELSE 0 END)
  WHERE id = NEW.question_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_question_stats
AFTER INSERT ON attempt_answers
FOR EACH ROW EXECUTE FUNCTION update_question_stats();

-- Fix: difficulty como VARCHAR en lugar de enum para compatibilidad con SQLAlchemy
ALTER TABLE questions ALTER COLUMN difficulty TYPE VARCHAR(1) USING difficulty::text;

