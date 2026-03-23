

# Kibbo — MVP: Sistema de Aprendizaje Corporativo Gamificado

## Visión General
Plataforma de capacitación corporativa inspirada en Duolingo, con estilo SaaS premium (morado + gradientes). MVP enfocado en el flujo core: autenticación, creación de cursos, experiencia de aprendizaje y progreso.

---

## 1. Identidad Visual & Design System
- Paleta: morado profundo como primario, gradientes modernos (morado → azul), fondos claros, acentos vibrantes para gamificación (verde éxito, amarillo XP)
- Tipografía limpia tipo Inter/Plus Jakarta Sans
- Cards redondeadas, sombras suaves, iconografía Lucide
- Estilo inspirado en Linear + Notion + Duolingo

## 2. Landing Page Pública
- Hero con propuesta de valor: "Capacita a tu equipo como un juego"
- Secciones: Features, Cómo funciona, CTA de registro
- Diseño moderno con gradientes morado

## 3. Autenticación y Onboarding
- Registro/Login por correo (Supabase Auth)
- 2 roles: **Admin** y **Colaborador**
- Flujo de onboarding: crear empresa (nombre, logo), invitar colaboradores
- Dashboard diferenciado según rol

## 4. Base de Datos (Supabase)
Entidades principales:
- **companies** — empresa/tenant
- **profiles** — usuarios con referencia a company
- **user_roles** — roles (admin, collaborator)
- **courses** — cursos con título, descripción, nivel, duración, imagen
- **modules** — módulos dentro de un curso (ordenados)
- **lessons** — lecciones dentro de un módulo (texto, video, contenido)
- **quizzes** — evaluaciones por módulo
- **questions** — preguntas (múltiple opción, V/F)
- **user_progress** — progreso por lección/módulo/curso
- **user_xp** — puntos XP y streak
- RLS por company_id para aislamiento multi-tenant

## 5. Panel Admin — Creación de Cursos
- Listado de cursos con estado (borrador/publicado)
- Crear/editar curso: título, descripción, nivel, imagen, duración
- Agregar módulos ordenables (drag & drop)
- Dentro de cada módulo: agregar lecciones con contenido (texto rico, video embed, imágenes)
- Agregar quiz al módulo: preguntas de opción múltiple y verdadero/falso
- Publicar/despublicar curso
- Asignar curso a todos los colaboradores

## 6. Experiencia del Colaborador
- **Dashboard**: progreso general, cursos asignados, XP actual, streak, cursos en progreso
- **Catálogo de cursos**: cards visuales con filtro por nivel
- **Vista de curso**: módulos con progreso visual (estilo Duolingo path)
- **Vista de lección**: contenido paso a paso, botón "Completar"
- **Quiz interactivo**: preguntas una por una, feedback inmediato, resultado final
- **Progreso**: barra de avance por módulo y curso

## 7. Gamificación Básica
- XP por lección completada (+10 XP) y quiz aprobado (+25 XP)
- Streak diario (días consecutivos de aprendizaje)
- Barra de nivel del usuario
- Ranking simple entre colaboradores de la misma empresa

## 8. Perfil del Usuario
- Nombre, avatar, empresa
- XP total, nivel, streak actual
- Cursos completados y en progreso
- Historial de quizzes

## 9. Navegación
- Sidebar moderna con iconos (estilo Linear)
- Admin: Dashboard, Cursos, Usuarios, Configuración
- Colaborador: Dashboard, Mis Cursos, Ranking, Perfil
- Responsive: sidebar colapsable, experiencia mobile optimizada

---

## Pantallas a construir (15 vistas)
1. Landing page pública
2. Login / Registro
3. Onboarding empresa (solo admin)
4. Dashboard colaborador
5. Dashboard admin
6. Catálogo de cursos
7. Vista detalle de curso (con path de módulos)
8. Vista de lección
9. Quiz interactivo
10. Perfil del usuario
11. Ranking / Leaderboard
12. Panel de creación de cursos (admin)
13. Editor de módulo/lección (admin)
14. Editor de quiz (admin)
15. Configuración de empresa (admin)

