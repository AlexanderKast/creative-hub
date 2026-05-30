-- Thumbnail cache column — almacena la URL pública de Supabase Storage
-- cuando el thumbnail ya fue descargado de Drive y subido al bucket.
ALTER TABLE creatives ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
