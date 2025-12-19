/*
  # Add hide text under pictograms option

  1. Changes
    - Add `hide_text_under_pictograms` column to `user_preferences` table
      - Type: boolean
      - Default: false
      - Description: When enabled, hides the text labels under pictograms for oral exercises or dictation
  
  2. Purpose
    - Enables teachers to create exercises where students only see pictograms without text
    - Useful for oral exercises and dictation activities
    - Helps students practice writing words illustrated by pictograms
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_preferences' AND column_name = 'hide_text_under_pictograms'
  ) THEN
    ALTER TABLE user_preferences ADD COLUMN hide_text_under_pictograms boolean DEFAULT false;
  END IF;
END $$;