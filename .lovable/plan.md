

# Plan: Generar curso "Ventas High-Ticket para Piscinas de Fibra de Vidrio"

## Contexto

El intento anterior falló porque la clave de OpenAI no tiene crédito. Usaremos **Lovable AI** (ya configurada con `LOVABLE_API_KEY`) para generar la estructura del curso y luego insertarla en la base de datos.

**Usuario:** trayenkooliva@gmail.com  
**Company ID:** `a1b2c3d4-0001-4000-8000-000000000001`  
**User ID:** `ec62a31c-1587-47a7-b3f8-94e59de5015a`

## Estructura del curso (basada en el PDF)

8 módulos ("Mundos"), cada uno con 3 lecciones y un quiz:

1. Mentalidad y estándar comercial
2. Producto y ventaja competitiva
3. Psicología del comprador high-ticket
4. Diagnóstico consultivo
5. Narrativa de valor y storytelling
6. Objeciones y fricción de decisión
7. Cierre ético y avance de compromiso
8. Sistema, hábitos y excelencia

## Implementación

### 1. Actualizar edge function `generate-course` para usar Lovable AI

Modificar `supabase/functions/generate-course/index.ts`:
- Cambiar el endpoint de OpenAI (`api.openai.com`) a Lovable AI Gateway (`ai.gateway.lovable.dev/v1/chat/completions`)
- Cambiar `OPENAI_API_KEY` por `LOVABLE_API_KEY`
- Cambiar el modelo de `gpt-4o` a `google/gemini-2.5-pro` (necesita manejar contenido largo y estructurado)
- Mantener el mismo tool calling schema y toda la lógica de inserción en DB

### 2. Invocar la edge function con el contenido del PDF

Llamar `generate-course` con:
- Título: "Ventas High-Ticket para Piscinas de Fibra de Vidrio"
- Instrucciones: contenido completo del PDF como contexto
- Nivel: intermediate
- CompanyId y UserId del usuario

Esto generará los 8 módulos con lecciones detalladas y quizzes, y los insertará automáticamente en la base de datos.

## Archivos a modificar

| Archivo | Cambio |
|---|---|
| `supabase/functions/generate-course/index.ts` | Migrar de OpenAI a Lovable AI Gateway |

## Beneficio adicional

Al migrar a Lovable AI, **todas las futuras generaciones de cursos** funcionarán sin depender de créditos de OpenAI. Es una mejora permanente.

