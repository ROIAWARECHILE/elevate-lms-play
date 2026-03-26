

# Plan: Sistema de Generación de Cursos con OpenAI API

## Resumen

Crear un sistema donde el admin sube PDFs, imágenes e instrucciones, y una edge function usa la **API de OpenAI directamente** (no Lovable AI) para generar cursos completos con módulos, lecciones y quizzes.

## Requisito previo: API Key de OpenAI

Se necesita agregar el secret `OPENAI_API_KEY` al proyecto. El usuario debe obtenerlo desde [platform.openai.com/api-keys](https://platform.openai.com/api-keys).

## Arquitectura

```text
Admin UI (upload PDF + instrucciones)
        │
        ▼
Edge Function: generate-course
  1. Recibe PDF (base64), instrucciones, imágenes
  2. Envía a OpenAI API (gpt-4o) con tool calling
  3. Recibe estructura JSON del curso
  4. Inserta en Supabase (courses → modules → lessons → quizzes → questions)
  5. Retorna courseId
        │
        ▼
Redirige a EditCourse para revisar/ajustar
```

## Cambios

### 1. Secret: `OPENAI_API_KEY`

Solicitar al usuario su API key de OpenAI y guardarla como secret del proyecto.

### 2. Edge Function `generate-course`

**`supabase/functions/generate-course/index.ts`**

- Recibe: `{ title, instructions, level, pdfBase64?, imageBase64s?, companyId, userId }`
- Llama a `https://api.openai.com/v1/chat/completions` con:
  - Modelo: `gpt-4o` (soporta PDFs e imágenes como input multimodal)
  - **Tool calling** para obtener estructura JSON:
    ```json
    {
      "name": "generate_course_structure",
      "parameters": {
        "modules": [{
          "title": "...",
          "description": "...",
          "lessons": [{
            "title": "...",
            "content_blocks": [{ "type": "heading|paragraph", "text": "..." }]
          }],
          "quiz": {
            "questions": [{
              "question_text": "...",
              "question_type": "multiple_choice",
              "options": ["A", "B", "C", "D"],
              "correct_answer": "A"
            }]
          }
        }]
      }
    }
    ```
- PDFs e imágenes se envían como contenido multimodal (base64 en mensajes)
- Inserta en cascada usando `SUPABASE_SERVICE_ROLE_KEY`
- Maneja errores de rate limit (429) y quota (402)

### 3. Nueva página `src/pages/admin/GenerateCourse.tsx`

- Campo de título del curso
- Textarea de instrucciones al AI
- Selector de nivel (básico/intermedio/avanzado)
- Dropzone para PDF(s) — convierte a base64 en cliente
- Dropzone para imágenes (contexto adicional)
- Botón "Generar con IA" con estado de carga
- Al completar, redirige a `EditCourse`

### 4. Ruta en `App.tsx`

Agregar `<Route path="admin/courses/generate" element={<GenerateCourse />} />`

### 5. Botón en `AdminCourses.tsx`

Agregar botón "Generar con IA" junto a "Crear curso".

## Archivos

| Archivo | Acción |
|---|---|
| `supabase/functions/generate-course/index.ts` | Crear — edge function con OpenAI API directa |
| `src/pages/admin/GenerateCourse.tsx` | Crear — UI de generación |
| `src/App.tsx` | Agregar ruta |
| `src/pages/admin/AdminCourses.tsx` | Agregar botón "Generar con IA" |

## Detalles técnicos

- **Modelo**: `gpt-4o` — soporta texto, imágenes y PDFs nativamente, excelente en tool calling
- **Auth**: `Authorization: Bearer ${OPENAI_API_KEY}` directo a `api.openai.com`
- **PDF**: Se envía como base64 en el campo `content` del mensaje (gpt-4o soporta archivos)
- **Tool calling** para JSON estructurado (no parsear markdown)
- **Límite**: PDFs hasta ~20MB, edge function timeout ~60s

