#!/usr/bin/env python3
"""
Seeder demo robusto para plataforma ICFES.

Qué hace:
1. Login como docente
2. Crea preguntas demo
3. Intenta aprobarlas
4. Verifica preguntas existentes
5. Detecta estados disponibles
6. Crea simulacro automático
7. Verifica simulacros visibles

Uso:
python seed_demo.py
"""

import asyncio
import os
import sys
import json
import httpx

BASE_URL = os.getenv("API_BASE", "http://localhost:8000/api")

DOCENTE_EMAIL = "docente@eureka.edu.co"
DOCENTE_PASSWORD = "Docente123!"


DEMO_QUESTIONS = [
    {
        "area": "matematicas",
        "difficulty": "3",
        "competencia": "Razonamiento cuantitativo",
        "componente": "Álgebra",
        "enunciado": "Si f(x)=2x²-3x+1, ¿cuál es f(2)?",
        "opciones": [
            {"letra": "A", "texto": "3"},
            {"letra": "B", "texto": "5"},
            {"letra": "C", "texto": "7"},
            {"letra": "D", "texto": "9"},
        ],
        "respuesta_correcta": "A",
        "explicacion": "2(4)-3(2)+1=3",
        "tags": ["funciones"],
    },
    {
        "area": "lectura_critica",
        "difficulty": "3",
        "competencia": "Comprensión lectora",
        "componente": "Inferencia",
        "enunciado": "La expresión 'por otro lado' sirve para:",
        "opciones": [
            {"letra": "A", "texto": "Contrastar ideas"},
            {"letra": "B", "texto": "Concluir"},
            {"letra": "C", "texto": "Definir"},
            {"letra": "D", "texto": "Enumerar"},
        ],
        "respuesta_correcta": "A",
        "explicacion": "Introduce contraste.",
        "tags": ["lectura"],
    },
    {
        "area": "ingles",
        "difficulty": "2",
        "competencia": "Comunicación en inglés",
        "componente": "Grammar",
        "enunciado": "She ___ to school every day.",
        "opciones": [
            {"letra": "A", "texto": "go"},
            {"letra": "B", "texto": "goes"},
            {"letra": "C", "texto": "going"},
            {"letra": "D", "texto": "gone"},
        ],
        "respuesta_correcta": "B",
        "explicacion": "Third person singular.",
        "tags": ["english"],
    },
]


def pretty(obj):
    print(json.dumps(obj, indent=2, ensure_ascii=False))


async def login(client):
    print("Iniciando sesión...")

    resp = await client.post(
        "/auth/login",
        json={
            "email": DOCENTE_EMAIL,
            "password": DOCENTE_PASSWORD,
        },
    )

    if resp.status_code != 200:
        print("Error de login")
        print(resp.status_code)
        print(resp.text)
        sys.exit(1)

    token = resp.json()["access_token"]
    print("Login correcto")

    return {"Authorization": f"Bearer {token}"}


async def create_questions(client, headers):
    print("\nCreando preguntas demo...\n")

    for i, q in enumerate(DEMO_QUESTIONS, start=1):
        resp = await client.post("/questions", json=q, headers=headers)

        if resp.status_code in (200, 201):
            data = resp.json()
            qid = data["id"]

            print(f"[{i}] Pregunta creada: {qid}")

            patch = await client.patch(
                f"/questions/{qid}/status",
                json={"status": "aprobado"},
                headers=headers,
            )

            print("PATCH:", patch.status_code)

        else:
            print(f"[{i}] Error creando pregunta")
            print(resp.status_code)
            print(resp.text[:500])


async def inspect_questions(client, headers):
    print("\nConsultando preguntas...\n")

    resp = await client.get("/questions?limit=100", headers=headers)

    print("HTTP:", resp.status_code)

    if resp.status_code != 200:
        print(resp.text)
        return

    data = resp.json()
    items = data.get("items", [])

    print("Total preguntas:", len(items))

    states = {}
    for q in items:
        st = q.get("status", "SIN_STATUS")
        states[st] = states.get(st, 0) + 1

    print("Estados:")
    pretty(states)


async def create_exam(client, headers):
    print("\nCreando simulacro...\n")

    payload = {
        "title": "Simulacro Demo",
        "description": "Simulacro generado por seed_demo.py",
        "duration_min": 45,
        "is_public": True,
        "areas_config": {
            "matematicas": 1,
            "lectura_critica": 1,
            "ingles": 1,
        },
    }

    resp = await client.post("/exams/auto", json=payload, headers=headers)

    print("HTTP:", resp.status_code)

    if resp.status_code in (200, 201):
        print("Simulacro creado")
        pretty(resp.json())
    else:
        print("Error creando simulacro")
        print(resp.text)


async def verify_exams(client, headers):
    print("\nConsultando simulacros visibles...\n")

    resp = await client.get("/exams?limit=20", headers=headers)

    print("HTTP:", resp.status_code)

    try:
        pretty(resp.json())
    except Exception:
        print(resp.text)


async def main():
    print("Seeder iniciado\n")

    async with httpx.AsyncClient(base_url=BASE_URL, timeout=60) as client:
        headers = await login(client)
        await create_questions(client, headers)
        await inspect_questions(client, headers)
        await create_exam(client, headers)
        await verify_exams(client, headers)

    print("\nProceso finalizado.")


if __name__ == "__main__":
    asyncio.run(main())
