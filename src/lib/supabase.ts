import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type UserPreferences = {
  id: string;
  user_id: string;
  language: string;
  replace_nouns: boolean;
  replace_verbs: boolean;
  replace_adjectives: boolean;
  font_size: number;
  line_spacing: number;
  created_at: string;
  updated_at: string;
};

export type CustomWordList = {
  id: string;
  user_id: string;
  name: string;
  words: string[];
  enabled: boolean;
  created_at: string;
  updated_at: string;
};

export type Story = {
  id: string;
  user_id: string;
  title: string;
  original_text: string;
  processed_text: any;
  language: string;
  settings_snapshot: any;
  created_at: string;
  updated_at: string;
};
