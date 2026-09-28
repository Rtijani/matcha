ALTER TABLE profile_pictures
  ADD COLUMN IF NOT EXISTS mime_type
    VARCHAR(100);

ALTER TABLE profile_pictures
  ADD COLUMN IF NOT EXISTS file_size
    INTEGER;

UPDATE profile_pictures
SET mime_type = 'image/jpeg'
WHERE mime_type IS NULL;

UPDATE profile_pictures
SET file_size = 0
WHERE file_size IS NULL;

ALTER TABLE profile_pictures
  ALTER COLUMN mime_type SET NOT NULL;

ALTER TABLE profile_pictures
  ALTER COLUMN file_size SET NOT NULL;

ALTER TABLE profile_pictures
  DROP CONSTRAINT IF EXISTS
    profile_pictures_file_size_check;

ALTER TABLE profile_pictures
  ADD CONSTRAINT profile_pictures_file_size_check
  CHECK (file_size >= 0);
