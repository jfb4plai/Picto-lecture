import { useState, useEffect } from 'react';
import { Settings, Save, Plus, Trash2, X } from 'lucide-react';
import { supabase, UserPreferences, CustomWordList } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

type PreferencesPanelProps = {
  onPreferencesChange: (prefs: UserPreferences) => void;
};

export const PreferencesPanel = ({ onPreferencesChange }: PreferencesPanelProps) => {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [wordLists, setWordLists] = useState<CustomWordList[]>([]);
  const [newListName, setNewListName] = useState('');
  const [newWord, setNewWord] = useState('');
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPreferences();
    loadWordLists();
  }, [user]);

  const loadPreferences = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (data) {
      const prefsWithDefaults = {
        ...data,
        hide_text_under_pictograms: data.hide_text_under_pictograms ?? false
      };
      setPreferences(prefsWithDefaults);
      onPreferencesChange(prefsWithDefaults);
    }
    setLoading(false);
  };

  const loadWordLists = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('custom_word_lists')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (data) {
      setWordLists(data);
    }
  };

  const savePreferences = async () => {
    if (!user || !preferences) return;
    setSaving(true);

    await supabase
      .from('user_preferences')
      .update({
        language: preferences.language,
        replace_nouns: preferences.replace_nouns,
        replace_verbs: preferences.replace_verbs,
        replace_adjectives: preferences.replace_adjectives,
        font_size: preferences.font_size,
        line_spacing: preferences.line_spacing,
        hide_text_under_pictograms: preferences.hide_text_under_pictograms,
      })
      .eq('user_id', user.id);

    onPreferencesChange(preferences);
    setSaving(false);
  };

  const createWordList = async () => {
    if (!user || !newListName.trim()) return;

    const { data } = await supabase
      .from('custom_word_lists')
      .insert({
        user_id: user.id,
        name: newListName,
        words: [],
      })
      .select()
      .single();

    if (data) {
      setWordLists([data, ...wordLists]);
      setNewListName('');
    }
  };

  const addWordToList = async (listId: string) => {
    if (!newWord.trim()) return;

    const list = wordLists.find((l) => l.id === listId);
    if (!list) return;

    const existingWords = list.words || [];
    const newNormalizedWords = newWord
      .split(',')
      .map((w) => w.trim().toLowerCase())
      .filter((w) => w.length > 0);

    const wordsToAdd = [...new Set(newNormalizedWords)].filter(
      (w) => !existingWords.includes(w)
    );

    if (wordsToAdd.length === 0) {
      alert('Ce(s) mot(s) sont déjà dans la liste');
      return;
    }

    const updatedWords = [...existingWords, ...wordsToAdd];

    await supabase
      .from('custom_word_lists')
      .update({ words: updatedWords })
      .eq('id', listId);

    setWordLists(
      wordLists.map((l) =>
        l.id === listId ? { ...l, words: updatedWords } : l
      )
    );
    setNewWord('');
  };

  const removeWordFromList = async (listId: string, word: string) => {
    const list = wordLists.find((l) => l.id === listId);
    if (!list) return;

    const updatedWords = (list.words || []).filter((w) => w !== word);

    await supabase
      .from('custom_word_lists')
      .update({ words: updatedWords })
      .eq('id', listId);

    setWordLists(
      wordLists.map((l) =>
        l.id === listId ? { ...l, words: updatedWords } : l
      )
    );
  };

  const deleteWordList = async (listId: string) => {
    await supabase.from('custom_word_lists').delete().eq('id', listId);
    setWordLists(wordLists.filter((l) => l.id !== listId));
    if (selectedListId === listId) setSelectedListId(null);
  };

  const toggleListEnabled = async (listId: string, enabled: boolean) => {
    await supabase
      .from('custom_word_lists')
      .update({ enabled })
      .eq('id', listId);

    setWordLists(
      wordLists.map((l) =>
        l.id === listId ? { ...l, enabled } : l
      )
    );
  };

  if (loading || !preferences) {
    return <div className="plai-card">Chargement...</div>;
  }

  return (
    <div className="plai-card">
      <div className="flex items-center mb-6">
        <Settings className="w-5 h-5 text-[var(--teal)] mr-2" />
        <h2 className="font-serif text-xl text-[var(--text)]">Paramètres</h2>
      </div>

      <div className="space-y-6">
        <div className="rounded-lg p-4" style={{ background: 'var(--teal-bg)', border: '1px solid var(--teal-border)' }}>
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <h3 className="text-sm font-semibold text-[var(--text)] mb-1">Masquer le texte sous les pictogrammes</h3>
              <p className="text-xs text-[var(--text2)]">Pour les exercices oraux ou les dictées où l'apprenant doit uniquement voir l'image</p>
            </div>
            <input
              type="checkbox"
              checked={preferences.hide_text_under_pictograms ?? false}
              onChange={(e) =>
                setPreferences({ ...preferences, hide_text_under_pictograms: e.target.checked })
              }
              className="w-5 h-5 rounded focus:ring-2"
              style={{ accentColor: 'var(--teal)' }}
            />
          </label>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-[var(--text2)] mb-3">Langue</h3>
          <select
            value={preferences.language}
            onChange={(e) =>
              setPreferences({ ...preferences, language: e.target.value })
            }
            className="plai-input"
          >
            <option value="fr">Français</option>
            <option value="en">English</option>
          </select>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-[var(--text2)] mb-3">Remplacer par nature</h3>
          <div className="space-y-2">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={preferences.replace_nouns}
                onChange={(e) =>
                  setPreferences({ ...preferences, replace_nouns: e.target.checked })
                }
                className="w-4 h-4 rounded focus:ring-2"
                style={{ accentColor: 'var(--teal)' }}
              />
              <span className="ml-3 text-[var(--text)]">Noms</span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={preferences.replace_verbs}
                onChange={(e) =>
                  setPreferences({ ...preferences, replace_verbs: e.target.checked })
                }
                className="w-4 h-4 rounded focus:ring-2"
                style={{ accentColor: 'var(--teal)' }}
              />
              <span className="ml-3 text-[var(--text)]">Verbes</span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={preferences.replace_adjectives}
                onChange={(e) =>
                  setPreferences({ ...preferences, replace_adjectives: e.target.checked })
                }
                className="w-4 h-4 rounded focus:ring-2"
                style={{ accentColor: 'var(--teal)' }}
              />
              <span className="ml-3 text-[var(--text)]">Adjectifs</span>
            </label>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-[var(--text2)] mb-2">Listes de mots personnalisées</h3>
          <p className="text-xs text-[var(--text3)] mb-3">
            Créez des listes et ajoutez les mots que vous souhaitez remplacer par des pictogrammes. Les expressions multi-mots sont supportées (ex: "Père Noël", "salle de bains"). Cochez les listes que vous souhaitez activer.
          </p>

          <div className="mb-4 flex gap-2">
            <input
              type="text"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              placeholder="Nom de la liste"
              className="plai-input flex-1 text-sm"
            />
            <button
              onClick={createWordList}
              className="plai-btn"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3">
            {wordLists.map((list) => (
              <div key={list.id} className="border rounded-lg p-3" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="checkbox"
                      checked={list.enabled}
                      onChange={() => toggleListEnabled(list.id, !list.enabled)}
                      className="w-4 h-4 rounded focus:ring-2"
                      style={{ accentColor: 'var(--teal)' }}
                    />
                    <button
                      onClick={() => setSelectedListId(selectedListId === list.id ? null : list.id)}
                      className="font-medium transition"
                      style={{ color: list.enabled ? 'var(--text)' : 'var(--text3)' }}
                    >
                      {list.name} ({(list.words || []).length})
                    </button>
                  </div>
                  <button
                    onClick={() => deleteWordList(list.id)}
                    className="text-red-500 hover:text-red-700 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {selectedListId === list.id && (
                  <div className="space-y-2 mt-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newWord}
                        onChange={(e) => setNewWord(e.target.value)}
                        placeholder="Tapez un ou plusieurs mots séparés par des virgules, puis Entrée"
                        className="plai-input flex-1 text-sm"
                        style={{ padding: '4px 12px' }}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addWordToList(list.id);
                          }
                        }}
                      />
                      <button
                        onClick={() => addWordToList(list.id)}
                        className="plai-btn flex items-center whitespace-nowrap"
                        style={{ padding: '4px 12px' }}
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Ajouter
                      </button>
                    </div>
                    {(list.words || []).length === 0 && (
                      <p className="text-xs italic" style={{ color: 'var(--text3)' }}>
                        Aucun mot dans cette liste. Ajoutez des mots ci-dessus.
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {(list.words || []).map((word) => (
                        <span
                          key={word}
                          className="inline-flex items-center px-2 py-1 rounded text-sm"
                          style={{ background: 'var(--teal-bg)', color: 'var(--teal)' }}
                        >
                          {word}
                          <button
                            onClick={() => removeWordFromList(list.id, word)}
                            className="ml-2 hover:opacity-70"
                            style={{ color: 'var(--teal)' }}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={savePreferences}
          disabled={saving}
          className="plai-btn w-full flex items-center justify-center py-3"
        >
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Sauvegarde...' : 'Sauvegarder les paramètres'}
        </button>
      </div>
    </div>
  );
};
