

# Plan: Landing Page Rediseñada — Impactante y Comunicativa

## Problemas Actuales
- Hero demasiado generico y plano, no muestra el producto
- No hay una seccion visual que enseñe como se ve la app (mockup/preview)
- Los floating cards son pequeños y se pierden
- No hay seccion "Como funciona" (paso a paso)
- No hay testimonios ni social proof real
- La mascota Kibbo (ya existe como componente) no aparece en la landing
- El CTA final es muy basico
- Falta seccion que diferencie Admin vs Colaborador

## Rediseño Propuesto

### 1. Hero Mejorado
- Mascota Kibbo animada al lado del texto hero (usando `KibboMascot.tsx` existente)
- Subtitulo mas concreto: "Crea cursos, lanza quizzes, mide resultados. Tu equipo sube de nivel mientras aprende."
- Animated counter en el badge: "Usado por +500 equipos"
- Background con patron de puntos/grid sutil en vez de gradient plano

### 2. Nueva Seccion: App Preview / Mockup
- Despues del hero, un browser mockup estilizado que muestra una captura simulada del dashboard/course path
- Construido con divs/CSS (no imagen externa): simula cards de XP, un path de curso con nodos, una barra de progreso
- Animacion: los elementos del mockup aparecen uno por uno con stagger

### 3. Seccion "Como funciona" (3 pasos)
- Paso 1: "Crea cursos" — icono + descripcion corta
- Paso 2: "Tu equipo aprende jugando" — icono + descripcion
- Paso 3: "Mide el impacto" — icono + descripcion
- Layout horizontal con linea conectora entre los pasos
- Numeros grandes animados (1, 2, 3)

### 4. Seccion "Para Admins y Colaboradores"
- Dos columnas lado a lado mostrando las dos experiencias:
  - Admin: "Crea cursos, gestiona equipos, revisa analytics"
  - Colaborador: "Aprende con lecciones, gana XP, compite en el ranking"
- Iconos y mini-features bullet list

### 5. Features Mejoradas
- Mantener las 6 features pero con hover effects mas pronunciados (gradient border on hover)
- Agregar un icono animado (pulse) en el feature destacado

### 6. Stats con AnimatedCounter
- Usar el componente `AnimatedCounter` existente para que los numeros se cuenten al entrar en viewport

### 7. CTA Final con Mascota
- Kibbo mascota al lado del CTA final con un speech bubble: "¿Listo para empezar?"
- Gradient mas vibrante

### 8. Footer expandido
- Links a secciones de la pagina (Features, Como funciona, etc)
- Link a "Unirse a empresa" (`/join`)

## Archivos a modificar

| Archivo | Accion |
|---|---|
| `src/pages/Landing.tsx` | Reescribir completo con todas las nuevas secciones |

Solo se modifica un archivo. Se reutilizan componentes existentes: `KibboMascot`, `AnimatedCounter`.

