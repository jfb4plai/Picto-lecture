/*
  # Add enabled flag to custom_word_lists

  1. Changes
    - Add `enabled` column to `custom_word_lists` table
      - Type: boolean
      - Default: true (new lists are enabled by default)
      - Not null
  
  2. Notes
    - All existing lists will be enabled by default
    - Users can toggle lists on/off without deleting them
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'custom_word_lists' AND column_name = 'enabled'
  ) THEN
    ALTER TABLE custom_word_lists ADD COLUMN enabled boolean DEFAULT true NOT NULL;
  END IF;
END $$;