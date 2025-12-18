import { useState } from 'react';
import { LogOut, BookOpen } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, UserPreferences, Story } from '../lib/supabase';
import { TextInput } from './TextInput';
import { PreferencesPanel } from './PreferencesPanel';
import { StoryDisplay } from './StoryDisplay';
import { StoriesList } from './StoriesList';

type ProcessedWord = {
  original: string;
  pictogramId?: number;
  pictogramUrl?: string;
  shouldReplace: boolean;
  type?: string;
  isLineBreak?: boolean;
  isAmbiguous?: boolean;
};

export const Dashboard = () => {
  const { user, signOut } = useAuth();
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentStory, setCurrentStory] = useState<{
    title: string;
    originalText: string;
    processedWords: ProcessedWord[];
  } | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [customWords, setCustomWords] = useState<string[]>([]);

  const handleTextSubmit = async (text: string, title: string) => {
    if (!preferences) return;

    setProcessing(true);

    try {
      const { data: wordLists } = await supabase
        .from('custom_word_lists')
        .select('words')
        .eq('user_id', user!.id)
        .eq('enabled', true);

      const allCustomWords = wordLists
        ? wordLists.flatMap((list) => list.words || [])
        : [];

      setCustomWords(allCustomWords);

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-text`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          language: preferences.language,
          replaceNouns: preferences.replace_nouns,
          replaceVerbs: preferences.replace_verbs,
          replaceAdjectives: preferences.replace_adjectives,
          customWords: allCustomWords,
        }),
      });

      if (!response.ok) {
        throw new Error('Erreur lors du traitement du texte');
      }

      const { processedWords } = await response.json();

      setCurrentStory({
        title,
        originalText: text,
        processedWords,
      });
    } catch (error) {
      console.error('Error processing text:', error);
      alert('Erreur lors du traitement du texte. Veuillez réessayer.');
    } finally {
      setProcessing(false);
    }
  };

  const handleSaveStory = async () => {
    if (!currentStory || !preferences || !user) return;

    setSaving(true);

    try {
      await supabase.from('stories').insert({
        user_id: user.id,
        title: currentStory.title,
        original_text: currentStory.originalText,
        processed_text: currentStory.processedWords,
        language: preferences.language,
        settings_snapshot: {
          replace_nouns: preferences.replace_nouns,
          replace_verbs: preferences.replace_verbs,
          replace_adjectives: preferences.replace_adjectives,
          font_size: preferences.font_size,
          line_spacing: preferences.line_spacing,
          custom_words: customWords,
        },
      });

      setRefreshTrigger((prev) => prev + 1);
      alert('Histoire sauvegardée avec succès !');
    } catch (error) {
      console.error('Error saving story:', error);
      alert('Erreur lors de la sauvegarde. Veuillez réessayer.');
    } finally {
      setSaving(false);
    }
  };

  const handleStorySelect = (story: Story) => {
    setCurrentStory({
      title: story.title,
      originalText: story.original_text,
      processedWords: story.processed_text,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center flex-1">
            <div className="bg-blue-600 p-2 rounded-lg mr-3">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800">Picto Lecture</h1>
              <p className="text-xs text-gray-600">{user?.email}</p>
            </div>
          </div>

          <div className="flex-1 flex justify-center">
            <img
              src="/nouveau_logo_plai_(1).jpg"
              alt="Logo PLAI"
              className="h-16 object-contain"
            />
          </div>

          <div className="flex-1 flex justify-end">
            <button
              onClick={() => signOut()}
              className="flex items-center px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Déconnexion
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <TextInput onTextSubmit={handleTextSubmit} loading={processing} />

            {currentStory && preferences && (
              <StoryDisplay
                title={currentStory.title}
                processedWords={currentStory.processedWords}
                fontSize={preferences.font_size || 14}
                lineSpacing={preferences.line_spacing || 1.5}
                onSave={handleSaveStory}
                saving={saving}
                language={preferences.language}
              />
            )}

            <StoriesList
              onStorySelect={handleStorySelect}
              refreshTrigger={refreshTrigger}
            />
          </div>

          <div>
            <PreferencesPanel onPreferencesChange={setPreferences} />
          </div>
        </div>
      </main>
    </div>
  );
};
