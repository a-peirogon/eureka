#!/usr/bin/env python3
"""
Demo data seeder — generates sample questions for each area using OpenAI.
Run: python seed_demo.py
Requires: OPENAI_API_KEY in environment
"""
import asyncio
import os
import sys
import json
import httpx

BASE_URL = os.getenv("API_BASE", "http://localhost:8000/api")

DEMO_QUESTIONS = [
    # Matemáticas
    {
        "area": "matematicas", "difficulty": "3", "competencia": "Razonamiento cuantitativo",
        "componente": "Álgebra",
        "enunciado": "Si f(x) = 2x² - 3x + 1, ¿cuál es el valor de f(2)?",
        "opciones": [
            {"letra": "A", "texto": "3"},
            {"letra": "B", "texto": "5"},
            {"letra": "C", "texto": "7"},
            {"letra": "D", "texto": "9"},
        ],
        "respuesta_correcta": "A",
        "explicacion": "f(2) = 2(4) - 3(2) + 1 = 8 - 6 + 1 = 3",
        "tags": ["funciones", "álgebra"],
    },
    {
        "area": "matematicas", "difficulty": "2", "competencia": "Razonamiento cuantitativo",
        "componente": "Estadística",
        "enunciado": "En un grupo de 20 estudiantes, 12 aprobaron matemáticas. ¿Qué porcentaje reprobó?",
        "opciones": [
            {"letra": "A", "texto": "40%"},
            {"letra": "B", "texto": "60%"},
            {"letra": "C", "texto": "20%"},
            {"letra": "D", "texto": "30%"},
        ],
        "respuesta_correcta": "A",
        "explicacion": "8 estudiantes reprobaron (20-12). Porcentaje: (8/20) × 100 = 40%",
        "tags": ["estadística", "porcentajes"],
    },
    {
        "area": "matematicas", "difficulty": "4", "competencia": "Razonamiento cuantitativo",
        "componente": "Geometría",
        "enunciado": "¿Cuánto mide el área de un triángulo con base 8 cm y altura 5 cm?",
        "opciones": [
            {"letra": "A", "texto": "20 cm²"},
            {"letra": "B", "texto": "40 cm²"},
            {"letra": "C", "texto": "13 cm²"},
            {"letra": "D", "texto": "80 cm²"},
        ],
        "respuesta_correcta": "A",
        "explicacion": "Área = (base × altura) / 2 = (8 × 5) / 2 = 20 cm²",
        "tags": ["geometría", "área"],
    },
    # Lectura Crítica
    {
        "area": "lectura_critica", "difficulty": "3", "competencia": "Comprensión lectora",
        "componente": "Texto argumentativo",
        "enunciado": "Cuando un autor utiliza la frase 'por otro lado' en un texto, su propósito principal es:",
        "opciones": [
            {"letra": "A", "texto": "Presentar una perspectiva diferente o contraria"},
            {"letra": "B", "texto": "Concluir el argumento principal"},
            {"letra": "C", "texto": "Introducir una definición técnica"},
            {"letra": "D", "texto": "Enumerar características de un objeto"},
        ],
        "respuesta_correcta": "A",
        "explicacion": "'Por otro lado' es un conector adversativo que introduce una perspectiva diferente o contrastante.",
        "tags": ["conectores", "argumentación"],
    },
    {
        "area": "lectura_critica", "difficulty": "4", "competencia": "Comprensión lectora",
        "componente": "Inferencia",
        "enunciado": "Un texto que comienza con 'A pesar de los avances tecnológicos, muchos problemas sociales persisten' tiene como propósito principal:",
        "opciones": [
            {"letra": "A", "texto": "Celebrar el progreso científico"},
            {"letra": "B", "texto": "Contrastar el progreso técnico con la persistencia de problemas sociales"},
            {"letra": "C", "texto": "Describir nuevas tecnologías"},
            {"letra": "D", "texto": "Explicar causas históricas de la pobreza"},
        ],
        "respuesta_correcta": "B",
        "explicacion": "La estructura adversativa 'A pesar de... persisten' establece un contraste entre tecnología y problemas sociales.",
        "tags": ["comprensión", "inferencia"],
    },
    # Ciencias Naturales
    {
        "area": "ciencias_naturales", "difficulty": "3", "competencia": "Indagación científica",
        "componente": "Biología",
        "enunciado": "La fotosíntesis es el proceso mediante el cual las plantas producen glucosa. ¿Cuáles son los reactivos necesarios para este proceso?",
        "opciones": [
            {"letra": "A", "texto": "CO₂ + H₂O + luz solar"},
            {"letra": "B", "texto": "O₂ + glucosa + luz solar"},
            {"letra": "C", "texto": "N₂ + H₂O + minerales"},
            {"letra": "D", "texto": "CO₂ + O₂ + calor"},
        ],
        "respuesta_correcta": "A",
        "explicacion": "La ecuación es: 6CO₂ + 6H₂O + luz → C₆H₁₂O₆ + 6O₂. Los reactivos son CO₂, H₂O y luz.",
        "tags": ["fotosíntesis", "biología", "plantas"],
    },
    {
        "area": "ciencias_naturales", "difficulty": "2", "competencia": "Indagación científica",
        "componente": "Física",
        "enunciado": "¿Cuál es la unidad del Sistema Internacional para medir la fuerza?",
        "opciones": [
            {"letra": "A", "texto": "Joule"},
            {"letra": "B", "texto": "Newton"},
            {"letra": "C", "texto": "Pascal"},
            {"letra": "D", "texto": "Watt"},
        ],
        "respuesta_correcta": "B",
        "explicacion": "El Newton (N) es la unidad de fuerza en el SI. Joule mide energía, Pascal presión y Watt potencia.",
        "tags": ["física", "unidades", "fuerza"],
    },
    # Sociales y Ciudadanas
    {
        "area": "sociales_ciudadanas", "difficulty": "3", "competencia": "Pensamiento social",
        "componente": "Historia de Colombia",
        "enunciado": "¿En qué año se firmó la Constitución Política de Colombia vigente?",
        "opciones": [
            {"letra": "A", "texto": "1886"},
            {"letra": "B", "texto": "1991"},
            {"letra": "C", "texto": "1976"},
            {"letra": "D", "texto": "2003"},
        ],
        "respuesta_correcta": "B",
        "explicacion": "La Constitución Política de Colombia de 1991 reemplazó a la de 1886 y sigue vigente.",
        "tags": ["constitución", "colombia", "historia"],
    },
    {
        "area": "sociales_ciudadanas", "difficulty": "3", "competencia": "Pensamiento social",
        "componente": "Geografía",
        "enunciado": "¿Cuál es el río más largo de Colombia?",
        "opciones": [
            {"letra": "A", "texto": "Río Cauca"},
            {"letra": "B", "texto": "Río Magdalena"},
            {"letra": "C", "texto": "Río Meta"},
            {"letra": "D", "texto": "Río Atrato"},
        ],
        "respuesta_correcta": "B",
        "explicacion": "El Río Magdalena, con ~1.528 km, es el más largo e importante de Colombia.",
        "tags": ["geografía", "ríos", "colombia"],
    },
    # Inglés
    {
        "area": "ingles", "difficulty": "2", "competencia": "Comunicación en inglés",
        "componente": "Gramática",
        "enunciado": "Choose the correct sentence: 'She ___ to school every day.'",
        "opciones": [
            {"letra": "A", "texto": "go"},
            {"letra": "B", "texto": "goes"},
            {"letra": "C", "texto": "going"},
            {"letra": "D", "texto": "gone"},
        ],
        "respuesta_correcta": "B",
        "explicacion": "Third person singular (she/he/it) requires adding -s/-es to the verb: 'goes'.",
        "tags": ["grammar", "present-simple", "verbs"],
    },
    {
        "area": "ingles", "difficulty": "3", "competencia": "Comunicación en inglés",
        "componente": "Vocabulario",
        "enunciado": "What does 'ubiquitous' mean?",
        "opciones": [
            {"letra": "A", "texto": "Very rare and unusual"},
            {"letra": "B", "texto": "Present, appearing, or found everywhere"},
            {"letra": "C", "texto": "Extremely dangerous"},
            {"letra": "D", "texto": "Related to technology only"},
        ],
        "respuesta_correcta": "B",
        "explicacion": "'Ubiquitous' means present or found everywhere. E.g., 'Smartphones are ubiquitous in modern society.'",
        "tags": ["vocabulary", "advanced"],
    },
]


async def seed():
    print("🌱 Iniciando seed de datos demo...")

    async with httpx.AsyncClient(base_url=BASE_URL, timeout=30) as client:
        # Login as docente
        resp = await client.post("/auth/login", json={
            "email": "docente@eureka.edu.co",
            "password": "Docente123!",
        })
        if resp.status_code != 200:
            print(f"❌ Error de login: {resp.text}")
            sys.exit(1)

        token = resp.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        print(f"✅ Login como docente")

        # Create questions
        created = 0
        for q in DEMO_QUESTIONS:
            resp = await client.post("/questions", json=q, headers=headers)
            if resp.status_code == 201:
                qid = resp.json()["id"]
                # Auto-approve
                await client.patch(
                    f"/questions/{qid}/status",
                    json={"status": "aprobado"},
                    headers=headers,
                )
                created += 1
                print(f"  ✅ {q['area'][:3].upper()} | {q['enunciado'][:50]}...")
            else:
                print(f"  ❌ Error: {resp.text[:100]}")

        print(f"\n✅ {created}/{len(DEMO_QUESTIONS)} preguntas creadas y aprobadas")

        # Create a demo exam
        all_q = await client.get("/questions?status=aprobado&limit=50", headers=headers)
        q_ids = [q["id"] for q in all_q.json()["items"]]

        if q_ids:
            resp = await client.post("/exams/auto", json={
                "title": "Simulacro Demo — Todas las Áreas",
                "description": "Simulacro de demostración con preguntas de todas las áreas ICFES",
                "duration_min": 45,
                "is_public": True,
                "areas_config": {
                    "matematicas": 3,
                    "lectura_critica": 2,
                    "sociales_ciudadanas": 2,
                    "ciencias_naturales": 2,
                    "ingles": 2,
                },
            }, headers=headers)

            if resp.status_code == 201:
                print(f"\n✅ Simulacro demo creado: '{resp.json().get('title', 'Demo')}'")
            else:
                print(f"\n⚠️  Error creando simulacro: {resp.text[:100]}")

    print("\n🎉 Seed completado. Inicia sesión en http://localhost para ver los datos.")


if __name__ == "__main__":
    asyncio.run(seed())
