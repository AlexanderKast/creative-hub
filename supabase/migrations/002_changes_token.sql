-- Agrega columna para Drive Changes API token
ALTER TABLE sync_state
  ADD COLUMN IF NOT EXISTS drive_changes_token TEXT;
