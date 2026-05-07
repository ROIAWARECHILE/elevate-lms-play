## Objetivo

Integrar **LlamaParse** como motor de parseo profesional para PDFs, imágenes y documentos en Course Studio, reemplazando la "extracción por visión" actual que está fallando con catálogos, tablas y documentos densos.

## Por qué LlamaParse soluciona el problema

Hoy los PDFs se mandan en base64 al modelo y se le pide que "interprete". Eso falla con:

- Catálogos visuales (Smartpools, jacuzzis, etc.)
- Tablas y comparativas
- PDFs escaneados o con diseño complejo
- Documentos largos donde el modelo trunca

LlamaParse devuelve **markdown estructurado** por página, con tablas reales, listas, headings, y permite OCR en escaneados. Eso da:

- Brief mucho más rico (más conceptos, hechos, comparativas).
- Outline más realista (la IA ya no "inventa" tablas vacías).
- Lecciones tipo `comparison`, `steps` y `case_study` con datos reales que pasan validación.

## Arquitectura propuesta

```text
PDF / imagen / docx / xlsx
     |
     v
[ Edge Function: parse-source ]  --->  LlamaParse API
     |                                    |
     |  markdown + metadata por página    |
     v
[ Course Studio cliente ]
     |
     |  agrega "fuente parseada" como text/markdown
     v
[ generate-course ]
     |
     |  Usa el markdown estructurado en vez de PDF crudo
     v
brief mejor -> outline mejor -> lecciones válidas
```

## Cambios concretos

### 1. Secret y configuración

- Pedir al usuario su `LLAMAPARSE_API_KEY` y guardarla como secret en Supabase.
- Verificar disponibilidad en runtime con `Deno.env.get("LLAMAPARSE_API_KEY")`.

### 2. Nueva Edge Function `parse-source`

Archivo: `supabase/functions/parse-source/index.ts`

Funciones:

- Recibe `{ kind, name, payload (base64) }` para PDF/imagen/excel/docx.
- Llama a LlamaParse:
  - `POST https://api.cloud.llamaindex.ai/api/v1/parsing/upload` con el archivo.
  - Polling a `GET /api/v1/parsing/job/{id}` hasta `SUCCESS`.
  - `GET /api/v1/parsing/job/{id}/result/markdown` para obtener el markdown final.
- Configura modo de parseo:
  - `result_type=markdown`
  - `parsing_instruction` orientada a LMS: "extrae todas las tablas, listas, especificaciones técnicas, comparativas y procedimientos. Mantén estructura y headings."
  - OCR habilitado para escaneados.
  - Idioma: español.
- Devuelve:
  ```json
  {
    "markdown": "...",
    "pages": 12,
    "job_id": "...",
    "warnings": []
  }
  ```
- Manejo de errores:
  - Timeout (max 90s) con respuesta clara.
  - 401 -> "API key inválida".
  - 402/429 -> mensaje accionable al admin.
  - Tope de tamaño (15MB) y validación de tipos.

### 3. Course Studio: usar parse-source antes de extraer

`src/pages/admin/CourseStudio.tsx`:

- Al subir PDF/imagen/docx:
  1. Mostrar estado "Parseando con LlamaParse...".
  2. Llamar `supabase.functions.invoke("parse-source", ...)`.
  3. Guardar la fuente como `kind: "text"` con el markdown devuelto, conservando `metadata.original_kind = "pdf"` para trazabilidad.
- Excel sigue usando `xlsx` local (más rápido, ya funciona).
- URL sigue usando `fetch-source`.
- Si LlamaParse falla, fallback al método actual (mandar base64 al modelo) con un warning.

### 4. `generate-course`: optimizar para markdown estructurado

`supabase/functions/generate-course/index.ts`:

- En `buildContentParts`, ya no mandar PDFs como `image_url`; el contenido ya viene como texto markdown.
- En `stepExtract`, nuevo prompt orientado a markdown:
  - "El material viene como markdown ya parseado. Extrae todas las tablas como `comparisons`, todas las listas numeradas como `procedures`, todas las definiciones como `key_concepts`."
- En `stepOutline`, aprovechar comparativas reales:
  - Si hay tablas en el brief, permitir `comparison`.
  - Si no, prohibirlo y degradar a `reading`.
- Cambiar default model a `google/gemini-3-flash-preview` (más barato y rápido) ya que el contenido ya está estructurado y no necesita visión.
- Mantener `gemini-2.5-pro` solo como fallback si parse-source no estuvo disponible.

### 5. Robustecer materialización (parche del error actual)

Independiente de LlamaParse, añadir en `stepMaterializeLesson`:

- Coerción para `comparison`:
  - `type: "comparison"` con `headers` y `rows` -> `comparison_table`.
  - Filas como arrays planos -> `{ label, cells }`.
  - Aceptar también `columns` en lugar de `headers`.
- Fallback determinístico para `comparison`:
  - Si el título contiene "vs" o "comparativa", construir tabla mínima desde la evidencia.
  - Si no hay datos suficientes, **degradar la lección a `reading**` en vez de fallar.
- Frontend `CourseStudio.tsx`: si una lección falla, no abortar todo el curso. Reintentar como `reading`, y si aún falla, omitir solo esa lección y continuar.

### 6. Persistir trazabilidad

En `course_sources.metadata` guardar:

```json
{
  "parser": "llamaparse",
  "job_id": "...",
  "pages": 12,
  "parsed_at": "..."
}
```

Para auditoría futura.

### 7. UI: feedback claro al admin

En el paso "Fuentes":

- Spinner por archivo "Parseando con LlamaParse..."
- Badge verde "Parseado: 12 páginas, 8 tablas detectadas"
- Si falló parseo: badge ámbar "Usando modo visión (sin LlamaParse)"

## Archivos a crear / modificar

- **Crear**: `supabase/functions/parse-source/index.ts`
- **Modificar**: `supabase/functions/generate-course/index.ts`
- **Modificar**: `src/pages/admin/CourseStudio.tsx`
- **Secret**: `LLAMAPARSE_API_KEY`

## Plan de ejecución (orden)

1. Pedir y configurar `LLAMAPARSE_API_KEY` como secret.
2. Crear `parse-source` Edge Function con LlamaParse.
3. Integrar en CourseStudio (parsing antes de extract).
4. Adaptar `generate-course` para input markdown.
5. Aplicar parche de `comparison` + tolerancia a fallos en frontend.
6. Probar con el caso "Smartpools" de las capturas.

## Resultado esperado

- Catálogos y PDFs complejos se convierten en markdown limpio antes de tocar la IA.
- Las comparativas reales se generan como tablas válidas.
- Las lecciones avanzadas dejan de fallar por formato.
- Una lección con problemas no destruye todo el curso.
- El error actual `0 bloques válidos para tipo comparison` desaparece.

LlamaParse docs  
  
En el ultimo paso del CORE studio donde se generan los cursos, hay un error de non status edge fuction, seguramente hay algun time-out o se satura de llamadas a API, corrige ese error para que se puedan generar bien los cursos sin ningun error, si es necesario separa en varias capas la generacion