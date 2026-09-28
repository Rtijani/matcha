-- Normalize values that may exist in older databases.
UPDATE profiles
SET sexual_preference = 'everyone'
WHERE sexual_preference IN (
  'both',
  'bisexual',
  'all',
  ''
);

ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS
    profiles_preference_check;

ALTER TABLE profiles
  ADD CONSTRAINT
    profiles_preference_check
  CHECK (
    sexual_preference IN (
      'male',
      'female',
      'everyone'
    )
  );