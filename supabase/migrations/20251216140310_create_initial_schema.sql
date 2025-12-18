/*
  # Schema initial pour l'application de pictogrammes

  ## Vue d'ensemble
  Cette migration crée la structure de base pour une application d'aide à la lecture
  qui remplace des mots par des pictogrammes ARASAAC pour les apprenants en difficulté.

  ## Nouvelles Tables
  
  ### `user_preferences`
  Stocke les préférences de remplacement par utilisateur
  - `id` (uuid, clé primaire)
  - `user_id` (uuid, référence auth.users)
  - `language` (text) - langue par défaut (fr, en, etc.)
  - `replace_nouns` (boolean) - remplacer les noms
  - `replace_verbs` (boolean) - remplacer les verbes
  - `replace_adjectives` (boolean) - remplacer les adjectifs
  - `font_size` (integer) - taille de police (défaut: 14)
  - `line_spacing` (decimal) - interligne (défaut: 1.5)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### `custom_word_lists`
  Listes de mots personnalisées par utilisateur
  - `id` (uuid, clé primaire)
  - `user_id` (uuid, référence auth.users)
  - `name` (text) - nom de la liste
  - `words` (jsonb) - tableau de mots à remplacer
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### `stories`
  Histoires téléversées et traitées par les utilisateurs
  - `id` (uuid, clé primaire)
  - `user_id` (uuid, référence auth.users)
  - `title` (text) - titre de l'histoire
  - `original_text` (text) - texte original
  - `processed_text` (jsonb) - texte traité avec métadonnées des pictogrammes
  - `language` (text) - langue du texte
  - `settings_snapshot` (jsonb) - snapshot des paramètres utilisés
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ## Sécurité
  - RLS activé sur toutes les tables
  - Policies pour lecture/écriture basées sur user_id
  - Les utilisateurs ne peuvent accéder qu'à leurs propres données

  ## Notes importantes
  1. Les préférences sont créées automatiquement lors de l'inscription
  2. Le format JSONB permet de stocker des structures complexes pour les pictogrammes
  3. Le settings_snapshot permet de recréer l'affichage exact d'une histoire sauvegardée
*/

-- Table des préférences utilisateur
CREATE TABLE IF NOT EXISTS user_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  language text DEFAULT 'fr' NOT NULL,
  replace_nouns boolean DEFAULT true,
  replace_verbs boolean DEFAULT true,
  replace_adjectives boolean DEFAULT false,
  font_size integer DEFAULT 14,
  line_spacing decimal DEFAULT 1.5,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table des listes de mots personnalisées
CREATE TABLE IF NOT EXISTS custom_word_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  words jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table des histoires
CREATE TABLE IF NOT EXISTS stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  original_text text NOT NULL,
  processed_text jsonb,
  language text DEFAULT 'fr',
  settings_snapshot jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_custom_word_lists_user_id ON custom_word_lists(user_id);
CREATE INDEX IF NOT EXISTS idx_stories_user_id ON stories(user_id);
CREATE INDEX IF NOT EXISTS idx_stories_created_at ON stories(user_id, created_at DESC);

-- Activer RLS sur toutes les tables
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_word_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE stories ENABLE ROW LEVEL SECURITY;

-- Policies pour user_preferences
CREATE POLICY "Users can view own preferences"
  ON user_preferences FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences"
  ON user_preferences FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
  ON user_preferences FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own preferences"
  ON user_preferences FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Policies pour custom_word_lists
CREATE POLICY "Users can view own word lists"
  ON custom_word_lists FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own word lists"
  ON custom_word_lists FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own word lists"
  ON custom_word_lists FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own word lists"
  ON custom_word_lists FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Policies pour stories
CREATE POLICY "Users can view own stories"
  ON stories FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own stories"
  ON stories FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own stories"
  ON stories FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own stories"
  ON stories FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Fonction pour mettre à jour automatiquement updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers pour updated_at
CREATE TRIGGER update_user_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_custom_word_lists_updated_at
  BEFORE UPDATE ON custom_word_lists
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stories_updated_at
  BEFORE UPDATE ON stories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();