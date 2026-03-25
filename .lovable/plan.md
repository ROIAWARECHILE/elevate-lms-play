

# Plan: Redisenar Path de Cursos (estilo Duolingo)

## Resumen

Reescribir el path visual de `CourseView.tsx` eliminando las lineas verticales que cruzan los nodos, implementando un zigzag sinusoidal con conectores SVG curvos, nodos mas grandes, mascota Kibbo junto al nodo activo, y banners de modulo mejorados.

## Cambios

### 1. `src/pages/CourseView.tsx` — Reescribir seccion del path

**Eliminar** lines 217-225 (las dos divs de linea vertical absoluta).

**Reemplazar PathNodeComponent** con version mejorada:
- Nodos `w-16 h-16` (antes `w-14 h-14`)
- Posicion X calculada con `Math.sin(i * 0.7) * 90` para efecto serpentina
- Nodo activo muestra label "EMPEZAR" debajo con efecto pulse-glow
- Nodos bloqueados con `opacity-50`

**Agregar conectores SVG curvos:**
- Un `<svg>` overlay absoluto sobre el contenedor del path
- Para cada par de nodos consecutivos, dibujar un `<path>` con curva bezier
- Color: `hsl(var(--success))` si ambos completados, `hsl(var(--border))` si no
- Calcular coordenadas Y basadas en spacing entre nodos (~80px cada uno)

**Agregar Kibbo junto al nodo activo:**
- Importar `KibboExpression` 
- Renderizar al lado opuesto del zigzag del nodo activo
- Expresion: `determined` por defecto, `celebrating` si modulo completado, `thumbsup` si progreso >50%
- Speech bubble opcional con texto motivacional

**Mejorar banners de modulo:**
- Modulo completado: card con gradiente verde, icono Trophy animado, XP del modulo, Kibbo celebrating
- Siguiente modulo: card con gradiente primary, titulo y descripcion del modulo
- Reemplazar el simple `<span>` badge gris actual (lines 242-244)

**Completion crown** al final se mantiene pero se agranda y agrega Kibbo celebrating.

### 2. `src/index.css` — Agregar animacion pulse-glow

```css
@keyframes pulse-glow {
  0%, 100% { box-shadow: 0 0 0 0 hsl(var(--primary) / 0.4); }
  50% { box-shadow: 0 0 0 12px hsl(var(--primary) / 0); }
}
.animate-pulse-glow {
  animation: pulse-glow 2s ease-in-out infinite;
}
```

## Arquitectura del zigzag

```text
  Modulo 1 Header
       ○          ← sin(0) = center
      / 
     ○             ← sin(0.7) = right
      \
       ○          ← sin(1.4) = center-left
      /
     ○  🦊        ← active node + Kibbo
  
  ══ Modulo 2 ══  ← banner completado / nuevo modulo
       ○
      ...
```

Cada nodo se posiciona con `style={{ marginLeft: calc(50% + xOffset) }}` y los conectores SVG se calculan entre los centros de nodos consecutivos.

## Archivos

| Archivo | Accion |
|---|---|
| `src/pages/CourseView.tsx` | Reescribir path completo |
| `src/index.css` | Agregar keyframe pulse-glow |

