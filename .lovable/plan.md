

# Plan: Insertar curso demo de IA para trayenkooliva@gmail.com

## Problema
El usuario no tiene `company_id` asignado, y no existen companies ni courses en la base de datos. Las políticas RLS requieren que `company_id` del curso coincida con el del usuario.

## Pasos

### 1. Crear company demo
Insertar una company "Kibbo Demo" con slug `kibbo-demo`.

### 2. Asignar usuario a la company
Actualizar el perfil de `trayenkooliva@gmail.com` con el `company_id` de la nueva company, y asignarle rol `admin`.

### 3. Insertar curso "Introducción a la IA"
Curso publicado con 3 módulos, cada uno con 2 lecciones y 1 quiz (4 preguntas cada uno):

- **Módulo 1: ¿Qué es la IA?** — Definición y tipos / Historia breve + Quiz
- **Módulo 2: IA en el mundo real** — IA en empresas / ChatGPT y LLMs + Quiz  
- **Módulo 3: Primeros pasos con IA** — Cómo escribir prompts / Herramientas de IA + Quiz

### Implementación
Todo se hará via SQL inserts (usando el insert tool para datos, no migraciones). Se usarán UUIDs generados para referenciar entre tablas.

