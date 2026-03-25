

# Plan: Sistema de Invitaciones por Codigo + Aprobacion de Admin

## Resumen

Redisenar el flujo de registro/invitacion: el usuario elige si es **empresa** o **colaborador**. Las empresas reciben un **codigo unico** (6 caracteres). Los colaboradores ingresan el codigo y quedan **pendientes** hasta que un admin los apruebe. Todos los links usan `https://kibbolearn.online/`.

## Cambios en Base de Datos

### 1. Agregar columna `invite_code` a `companies`
Codigo alfanumerico de 6 caracteres, unico, generado automaticamente al crear empresa.

### 2. Agregar columna `status` a `profiles`
Para manejar el estado de aprobacion: `pending`, `active`, `rejected`. Default: `active` (para empresas que se crean a si mismas).

### 3. Actualizar funciones RPC

- **`create_company_for_user`**: generar `invite_code` aleatorio al crear la empresa.
- **`join_company_by_code(_code text)`**: nueva funcion que busca empresa por codigo, asigna `company_id` al perfil con `status = 'pending'`, y asigna rol `collaborator`.
- **`approve_user(_user_id uuid)`** y **`reject_user(_user_id uuid)`**: funciones SECURITY DEFINER para que admins aprueben/rechacen usuarios pendientes.

### 4. RLS para perfiles pendientes
Los usuarios con `status = 'pending'` no podran ver cursos ni contenido. Agregar condicion a las politicas SELECT de cursos/lecciones/quizzes: verificar que el perfil del usuario tenga `status = 'active'`.

```sql
-- Ejemplo de SQL a ejecutar
ALTER TABLE companies ADD COLUMN invite_code text UNIQUE;
ALTER TABLE profiles ADD COLUMN status text NOT NULL DEFAULT 'active';

-- Generar codigos para empresas existentes
UPDATE companies SET invite_code = upper(substr(md5(random()::text), 1, 6))
WHERE invite_code IS NULL;

-- Funcion para unirse por codigo
CREATE OR REPLACE FUNCTION public.join_company_by_code(_code text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _company_id uuid; _user_id uuid;
BEGIN
  _user_id := auth.uid();
  IF get_user_company_id(_user_id) IS NOT NULL THEN
    RAISE EXCEPTION 'User already belongs to a company';
  END IF;
  SELECT id INTO _company_id FROM companies WHERE invite_code = upper(_code);
  IF _company_id IS NULL THEN RAISE EXCEPTION 'Invalid code'; END IF;
  UPDATE profiles SET company_id = _company_id, status = 'pending' WHERE id = _user_id;
  INSERT INTO user_roles (user_id, role) VALUES (_user_id, 'collaborator')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN _company_id;
END; $$;

-- Aprobar/rechazar usuario
CREATE OR REPLACE FUNCTION public.approve_user(_target_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Not admin'; END IF;
  UPDATE profiles SET status = 'active'
  WHERE id = _target_user_id
    AND company_id = get_user_company_id(auth.uid());
END; $$;

CREATE OR REPLACE FUNCTION public.reject_user(_target_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Not admin'; END IF;
  DELETE FROM user_roles WHERE user_id = _target_user_id;
  UPDATE profiles SET company_id = NULL, status = 'active'
  WHERE id = _target_user_id
    AND company_id = get_user_company_id(auth.uid());
END; $$;
```

## Cambios en Frontend

### 1. Actualizar `.env`
```
VITE_APP_URL="https://kibbolearn.online"
```

### 2. Redisenar `Auth.tsx`
Despues del registro, mostrar pantalla de eleccion:
- **"Soy empresa"** → redirige a `/onboarding` (crear empresa)
- **"Soy colaborador"** → redirige a `/join` (ingresar codigo)

### 3. Redisenar `JoinCompany.tsx` → nueva ruta `/join`
Ya no usa slug en URL. Muestra un formulario para ingresar el **codigo de 6 caracteres**. Al enviar, llama a `join_company_by_code`. Muestra pantalla de "Solicitud enviada, espera aprobacion".

### 4. Eliminar ruta `/join/:companySlug`
Reemplazar por `/join` sin parametros.

### 5. Actualizar `Onboarding.tsx`
Mostrar el codigo generado despues de crear empresa, para que el admin lo copie y comparta.

### 6. Actualizar `AdminUsers.tsx`
- Cambiar "Copiar enlace de invitacion" por **"Copiar codigo de invitacion"** (muestra el `invite_code`).
- Agregar seccion de **usuarios pendientes** con botones "Aprobar" / "Rechazar".
- Separar vista en tabs: "Activos" y "Pendientes".

### 7. Actualizar `AdminSettings.tsx`
- Mostrar el `invite_code` en vez del enlace slug.
- Cambiar texto de `Enlace: APP_URL/join/slug` por `Codigo: XXXXXX`.

### 8. Actualizar `AppLayout.tsx` / routing
- Usuarios con `status = 'pending'` ven pantalla de espera en vez del dashboard.
- Agregar estado `isPending` al AuthContext.

### 9. Actualizar `useAuth.tsx`
- Incluir `status` en el Profile interface.
- Exponer `isPending: profile?.status === 'pending'`.

### 10. Landing.tsx
- Quitar link `/join` del footer (ya no funciona con slug).
- Actualizar CTAs si necesario.

## Archivos

| Archivo | Accion |
|---|---|
| Migration SQL | Crear — invite_code, status, funciones RPC |
| `.env` | Modificar — VITE_APP_URL a kibbolearn.online |
| `src/hooks/useAuth.tsx` | Modificar — agregar status/isPending |
| `src/pages/Auth.tsx` | Modificar — selector empresa/colaborador post-registro |
| `src/pages/Onboarding.tsx` | Modificar — mostrar codigo al crear empresa |
| `src/pages/JoinCompany.tsx` | Reescribir — formulario de codigo sin slug |
| `src/pages/admin/AdminUsers.tsx` | Modificar — pendientes + codigo |
| `src/pages/admin/AdminSettings.tsx` | Modificar — mostrar codigo |
| `src/components/AppLayout.tsx` | Modificar — bloquear pendientes |
| `src/pages/Landing.tsx` | Modificar — quitar link /join del footer |
| `src/App.tsx` | Modificar — cambiar ruta /join/:slug a /join |

