-- Bucket privado para staging de archivos antes del parsing con LlamaParse.
-- Los archivos son temporales: la edge function parse-source los elimina tras parsear.
-- Lifecycle rule: Supabase elimina automáticamente objetos >24h (configurar en Dashboard).

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'course-uploads',
  'course-uploads',
  false,
  55391232, -- 55 MB (55 * 1024 * 1024)
  ARRAY['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/tiff']
)
ON CONFLICT (id) DO NOTHING;

-- Usuarios autenticados pueden subir solo a su propio folder {userId}/...
CREATE POLICY "authenticated users upload own folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'course-uploads'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Usuarios autenticados pueden leer sus propios archivos (para signed URLs)
CREATE POLICY "authenticated users read own files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'course-uploads'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Service role puede leer y eliminar cualquier archivo (para parse-source edge function)
CREATE POLICY "service role full access"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'course-uploads')
WITH CHECK (bucket_id = 'course-uploads');
