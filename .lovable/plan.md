

# Plan: Rediseño de Colores con Regla 60-30-10

## Análisis de la imagen

La imagen muestra 4 colores clave de la marca Kibbo:
- **Naranja (#FF6B35)** — CTAs principales (GET STARTED, Claim)
- **Cyan (#00D4FF)** — Elementos interactivos (CONTINUE LESSON, barras de progreso)
- **Navy (#1E3A5F)** — Estructura y peso visual (VIEW PROGRESS, streak badge, level up banner)
- **Blanco/Crema** — Fondos y espacios

## Regla 60-30-10 aplicada

| Proporción | Color | Uso |
|---|---|---|
| **60% — Navy + Blanco** | Navy para sidebar, headers de módulo, textos pesados. Blanco/crema para fondos, cards, espacios | Estructura visual dominante |
| **30% — Cyan** | Barras de progreso, nodos del path, badges, acentos de cards, hover states | Interactividad y frescura |
| **10% — Naranja** | CTAs principales ("Empezar"), nodo activo, XP, notificaciones, momentos de celebración | Puntos focales de acción |

## Cambios en `src/index.css`

### Variables CSS (light mode)
- `--primary`: Cambiar de `21 100% 60%` (naranja) → mantener naranja pero solo para CTAs
- **Nuevo** `--navy`: `210 52% 24%` (#1E3A5F) — para headers, módulos, sidebar
- `--accent`: Cambiar de `192 100% 95%` (cyan claro) → `192 100% 50%` (#00D4FF) — cyan vibrante
- `--accent-foreground`: `0 0% 100%` (blanco sobre cyan)
- `--gradient-primary`: Naranja sólido (se usa poco, solo CTAs)
- **Nuevo** `--gradient-navy`: `linear-gradient(135deg, hsl(210 52% 24%), hsl(210 52% 18%))` — para module headers
- **Nuevo** `--gradient-cyan`: `linear-gradient(135deg, hsl(192 100% 50%), hsl(192 100% 42%))` — para barras de progreso
- `--gradient-hero`: Navy a cyan (en vez de naranja a cyan)

### Variables CSS (dark mode)
- Ajustar `--accent` a cyan desaturado para dark mode
- Navy se aclara ligeramente para contraste

### Nuevas utility classes
- `.gradient-navy` — background navy gradient
- `.gradient-cyan` — background cyan gradient
- `.bg-navy` — solid navy background

## Cambios en `tailwind.config.ts`

Agregar colores `navy` al theme extend:
```
navy: {
  DEFAULT: "hsl(var(--navy))",
  foreground: "hsl(var(--navy-foreground))",
}
```

## Cambios en `src/pages/CourseView.tsx`

Aplicar la jerarquía de colores al path:

1. **CourseHeader** (line 44): Cambiar `gradient-primary` → `gradient-navy` (navy como fondo dominante, 60%)
2. **Progress bar** dentro del header (line 63): Cambiar `bg-primary-foreground` → cyan (`bg-accent`)
3. **ModuleHeader completado** (line 86): Mantener success green
4. **ModuleHeader activo** (line 108): Cambiar `gradient-primary` → `gradient-navy` (navy, 60%)
5. **Nodo activo** (line 146): Cambiar `gradient-primary` → `gradient-primary` (naranja, 10% — punto focal CTA)
6. **Nodos completados** (line 144): Cambiar `bg-success` → cyan con check (`bg-accent`)
7. **Label "Empezar"** (line 170): Mantener `bg-primary` naranja (CTA, 10%)
8. **Connectors SVG done** (line 236): Cambiar `--success` → `--accent` (cyan)
9. **Crown final** (line 412): Mantener gold/xp

## Cambios en `src/components/AppSidebar.tsx`

El sidebar ya usa navy (`--sidebar-background: 210 52% 14%`). Solo asegurar que el accent del sidebar use cyan.

## Archivos a modificar

| Archivo | Cambios |
|---|---|
| `src/index.css` | Agregar variables `--navy`, `--navy-foreground`, ajustar `--accent` a cyan vibrante, agregar gradientes navy/cyan, utility classes |
| `tailwind.config.ts` | Agregar color `navy` al theme |
| `src/pages/CourseView.tsx` | Aplicar 60-30-10: header y módulos navy, progreso y nodos completados cyan, nodo activo naranja |

