

# Plan: Rebranding Visual Completo — Identidad Kibbo

## Cambios Principales

La identidad de marca proporcionada cambia fundamentalmente el look de la app:
- **Paleta actual**: Morado (#7C3AED) como primario
- **Paleta nueva**: Naranja Kibbo (#FF6B35), Cyan (#00D4FF), Navy (#1E3A5F), Peach (#FFD4B8)
- **Mascota actual**: SVG generico (circulo con ojos)
- **Mascota nueva**: Zorro naranja con headband cyan (imagen real proporcionada)
- **Gradientes**: De morado-azul a naranja-cyan

## Implementacion

### 1. Copiar imagen de mascota al proyecto
Copiar `Zorro_saludando_fondo_blanco.jpg` a `src/assets/kibbo-mascot.png` para usarla como `<img>` en vez del SVG actual.

### 2. Actualizar paleta de colores (`src/index.css`)
Reemplazar las CSS variables:
- `--primary`: de morado a naranja (#FF6B35 → `21 100% 60%`)
- `--accent`: cyan (#00D4FF → `192 100% 50%`)
- Sidebar background: Navy (#1E3A5F → `210 52% 24%`)
- `--gradient-primary`: de morado-azul a naranja-cyan
- `--gradient-hero`: naranja a peach
- Mantener `--success`, `--destructive`, `--xp`, `--streak` (ya alineados con naranja)

### 3. Actualizar `KibboMascot.tsx`
Reemplazar el SVG generico por un componente que usa la imagen real del zorro. Mantener la animacion framer-motion de entrada.

### 4. Actualizar `Landing.tsx`
- Usar imagen real del zorro en el hero y CTA
- Ajustar textos del navbar logo (icono naranja en vez de morado)
- Los floating cards y mockup se adaptaran automaticamente via CSS variables

### 5. Actualizar `Auth.tsx`
- Logo/icono usa el nuevo color primario (automatico via CSS variables)
- Agregar imagen de mascota al lado del formulario

### 6. Actualizar `AppSidebar.tsx`
- Logo icon con nuevo color
- Sidebar background se actualiza automaticamente via CSS variables

### 7. Actualizar `tailwind.config.ts`
- Ajustar gradientes en keyframes si referencian colores hardcoded (verificar `pulse-glow`)

### 8. Actualizar `BottomTabBar.tsx`
- Los colores se adaptan automaticamente via `text-primary`

## Archivos a modificar

| Archivo | Accion |
|---|---|
| `src/assets/kibbo-mascot.png` | Crear — copiar imagen del zorro |
| `src/index.css` | Modificar — nueva paleta de colores completa |
| `src/components/KibboMascot.tsx` | Modificar — usar imagen real en vez de SVG |
| `src/pages/Landing.tsx` | Modificar — integrar mascota real, ajustar navbar |
| `src/pages/Auth.tsx` | Modificar — agregar mascota, nuevo icono |
| `tailwind.config.ts` | Modificar — actualizar colores hardcoded en keyframes |

## Notas
- La mayoria de la app se actualiza automaticamente al cambiar las CSS variables (botones, cards, sidebar, progress bars, badges)
- Los componentes que usan `gradient-primary`, `text-primary`, `bg-primary` heredan el nuevo naranja
- No se cambia estructura ni funcionalidad, solo identidad visual

