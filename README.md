# 🎓 ICFES Eureka — Plataforma de Simulacros Inteligentes

> Plataforma educativa completa para preparación ICFES Saber 11 con IA generativa, OCR, analítica en tiempo real y administración docente.

---

## 📋 Tabla de Contenidos

- [Características](#características)
- [Stack Tecnológico](#stack-tecnológico)
- [Arquitectura](#arquitectura)
- [Instalación rápida](#instalación-rápida)
- [Variables de entorno](#variables-de-entorno)
- [Credenciales demo](#credenciales-demo)
- [Módulos del sistema](#módulos-del-sistema)
- [API Docs](#api-docs)
- [DevOps](#devops)

---

## ✨ Características

| Módulo | Descripción |
|--------|-------------|
| 🔐 **Autenticación** | JWT + refresh tokens, roles (estudiante/docente/admin) |
| 📚 **Banco de preguntas** | CRUD completo, 5 áreas ICFES, LaTeX, imágenes |
| 📝 **Simulacros** | Manual o automático balanceado por IA |
| ⏱️ **Examen en vivo** | Cronómetro, navegación, guardado automático |
| 📊 **Resultados** | Puntaje por área, revisión pregunta a pregunta |
| 🤖 **IA Académica** | Genera, reformula, explica y clasifica preguntas |
| 📄 **OCR + Import** | Extrae preguntas de imágenes/PDFs con pipeline IA |
| 📈 **Analítica** | Dashboard docente con ranking, tendencias y alertas |
| 👥 **Admin usuarios** | Gestión completa de la institución |

---

## 🛠 Stack Tecnológico

### Frontend
- **React 18 + TypeScript** con Vite
- **TailwindCSS** + diseño propio (sin dependencia de shadcn)
- **React Query** (caché + fetching)
- **Zustand** (estado global persistido)
- **Recharts** (gráficas educativas)
- **KaTeX** (fórmulas matemáticas)

### Backend
- **FastAPI** (async, OpenAPI automático)
- **SQLAlchemy 2** async + **PostgreSQL 16**
- **JWT** con refresh token rotation
- **OpenAI API** (GPT-4o-mini por defecto)
- **Tesseract OCR** + OpenCV

### Infraestructura
- **Docker Compose** (todos los servicios)
- **Nginx** (reverse proxy + rate limiting)
- **Redis** (caché + colas Celery)
- **MinIO** (almacenamiento S3-compatible)
- **GitHub Actions** CI/CD

---

## 🏗 Arquitectura

```
┌─────────────────────────────────────────────────────────┐
│  Nginx (80/443)  ←  Rate limiting, SSL, proxy           │
├───────────────┬─────────────────────────────────────────┤
│  Frontend     │  Backend (FastAPI)                       │
│  React/Vite   │  /api/auth   /api/questions              │
│  Port 3000    │  /api/exams  /api/ai  /api/analytics     │
└───────────────┴─────────┬────────────┬──────────────────┘
                          │            │
                    PostgreSQL      Redis
                    Port 5432       Port 6379
                          │
                      MinIO (S3)
                      Port 9000
```

---

## 🚀 Instalación rápida

### Prerrequisitos
- Docker + Docker Compose v2
- 4 GB RAM mínimo
- OpenAI API key (para features de IA)

### 1. Clonar y configurar

```bash
git clone https://github.com/tu-org/icfes-eureka.git
cd icfes-eureka

# Configurar backend
cp backend/.env.example backend/.env
# Editar backend/.env — OBLIGATORIO cambiar SECRET_KEY y OPENAI_API_KEY
```

### 2. Levantar todo con Docker Compose

```bash
docker compose up -d --build
```

### 3. Verificar servicios

```bash
# Salud del backend
curl http://localhost/health

# API Docs
open http://localhost/api/docs

# Frontend
open http://localhost

# MinIO Console
open http://localhost:9001  # admin/minioadmin
```

### Desarrollo local (sin Docker)

```bash
# Backend
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # editar según tu config local
uvicorn app.main:app --reload --port 8000

# Frontend (otra terminal)
cd frontend
npm install
npm run dev   # http://localhost:5173
```

---

## ⚙️ Variables de entorno

Archivo: `backend/.env`

| Variable | Descripción | Requerida |
|----------|-------------|-----------|
| `SECRET_KEY` | Clave JWT (32 bytes hex) | ✅ |
| `OPENAI_API_KEY` | API Key de OpenAI | Para IA |
| `DATABASE_URL` | PostgreSQL async URL | ✅ |
| `REDIS_URL` | URL de Redis | ✅ |
| `SENTRY_DSN` | DSN de Sentry | Opcional |
| `SMTP_HOST` | Servidor SMTP | Opcional |

---

## 👤 Credenciales demo

| Rol | Correo | Contraseña |
|-----|--------|------------|
| Docente/Admin | `docente@eureka.edu.co` | `Docente123!` |
| Estudiante | `estudiante@eureka.edu.co` | `Estudiante123!` |
| Admin | `admin@eureka.edu.co` | (bcrypt hash) |

---

## 📦 Módulos del sistema

### Banco de preguntas
- 5 áreas: Matemáticas, Lectura Crítica, Sociales, Ciencias Naturales, Inglés
- Estados: borrador → aprobado → archivado
- Soporte LaTeX para fórmulas
- Estadísticas de uso y tasa de acierto
- Tags y filtros avanzados

### Pipeline IA / OCR
```
Imagen/PDF → Tesseract OCR → Limpieza texto
→ GPT-4o-mini → Estructura preguntas
→ Clasificación área/dificultad
→ Borrador para revisión docente
→ Aprobación → Banco de preguntas
```

### Simulacros automáticos
El sistema selecciona preguntas aprobadas aleatoriamente por área según la distribución configurada:
```json
{
  "matematicas": 10,
  "lectura_critica": 10,
  "sociales_ciudadanas": 10,
  "ciencias_naturales": 10,
  "ingles": 5
}
```

### Analítica educativa
- Evolución de puntajes semana a semana
- Ranking de estudiantes por curso
- Preguntas más falladas (con tasa de error)
- Radar de competencias por área
- Identificación automática del área más débil
- Tasa de mejora vs período anterior

---

## 📖 API Docs

Una vez en ejecución:
- **Swagger UI**: http://localhost/api/docs
- **ReDoc**: http://localhost/api/redoc
- **OpenAPI JSON**: http://localhost/api/openapi.json

### Endpoints principales

```
POST /api/auth/login           # Login
POST /api/auth/register        # Registro
POST /api/auth/refresh         # Renovar token

GET  /api/questions            # Listar preguntas (paginado, filtrado)
POST /api/questions            # Crear pregunta
PATCH /api/questions/{id}/status # Aprobar/archivar

GET  /api/exams                # Listar simulacros
POST /api/exams/auto           # Crear simulacro automático
POST /api/exams/{id}/attempts  # Iniciar/reanudar intento
POST /api/exams/{id}/attempts/{aid}/submit  # Entregar

POST /api/ai/generate-question # Generar pregunta con IA
POST /api/ai/ocr-import        # OCR pipeline
POST /api/ai/explain           # Explicar respuesta

GET  /api/analytics/student/me     # Analytics personal
GET  /api/analytics/course/{id}    # Analytics del curso
```

---

## 🔧 DevOps

### GitHub Actions
El pipeline CI/CD incluye:
1. Lint y type-check (Python + TypeScript)
2. Build del frontend
3. Build y push de imágenes Docker a GHCR
4. Deploy automático por SSH a producción

### Observabilidad
- **Sentry**: errores en tiempo real (`SENTRY_DSN`)
- **Prometheus**: métricas en `/metrics`
- **Logs estructurados**: via `logging` estándar Python

### Escalado
Para escalar el backend horizontalmente:
```bash
docker compose up -d --scale backend=3
```

---

## 📄 Licencia

MIT © 2025 — Construido con ❤️ para la educación colombiana
