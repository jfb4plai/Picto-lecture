import { useState } from 'react';
import { Upload, FileText, X, AlertTriangle, Wand2 } from 'lucide-react';
import * as mammoth from 'mammoth/mammoth.browser';

type TextInputProps = {
  onTextSubmit: (text: string, title: string) => void;
  loading: boolean;
};

export const TextInput = ({ onTextSubmit, loading }: TextInputProps) => {
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [fileName, setFileName] = useState('');
  const [falcLoading, setFalcLoading] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setTitle(file.name.replace(/\.[^/.]+$/, ''));

    const fileExtension = file.name.split('.').pop()?.toLowerCase();

    if (fileExtension === 'docx' || fileExtension === 'doc') {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        setText(result.value);
      } catch (error) {
        console.error('Error reading Word file:', error);
        alert('Erreur lors de la lecture du fichier Word');
      }
    } else {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        setText(content);
      };
      reader.readAsText(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !title.trim()) return;
    onTextSubmit(text, title);
  };

  const handleClear = () => {
    setText('');
    setTitle('');
    setFileName('');
  };

  const handleFalcSimplify = async () => {
    if (!text.trim()) return;

    setFalcLoading(true);
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/falc-simplify`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la simplification FALC');
      }

      const { simplifiedText } = await response.json();
      if (simplifiedText) setText(simplifiedText);
    } catch (error) {
      console.error('Error simplifying FALC:', error);
      alert('Erreur lors de la simplification FALC. Veuillez réessayer.');
    } finally {
      setFalcLoading(false);
    }
  };

  return (
    <div className="plai-card">
      <h2 className="font-serif text-xl text-[var(--text)] mb-4">Nouvelle histoire</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="title" className="plai-label">
            Titre
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="plai-input"
            placeholder="Mon histoire"
            required
          />
        </div>

        <div>
          <label className="plai-label">
            Texte
          </label>

          <div className="mb-3">
            <label
              htmlFor="file-upload"
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition"
            >
              <Upload className="w-4 h-4 mr-2" />
              <span className="text-sm font-medium text-gray-700">
                Téléverser un fichier
              </span>
              <input
                id="file-upload"
                type="file"
                accept=".txt,.doc,.docx"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
            {fileName && (
              <span className="ml-3 text-sm text-gray-600 inline-flex items-center">
                <FileText className="w-4 h-4 mr-1" />
                {fileName}
              </span>
            )}
          </div>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="plai-input min-h-[200px]"
            placeholder="Collez ou saisissez votre texte ici..."
            required
          />
        </div>

        <div
          className="rounded-lg border p-3 flex gap-2"
          style={{ borderColor: '#e8d5a3', background: '#fdf8ec' }}
        >
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#a3760f' }} />
          <div className="text-xs" style={{ color: '#6b5216' }}>
            <strong>Simplification FALC — usage ponctuel, pas systématique.</strong> À réserver aux
            cas où la syntaxe elle-même fait obstacle (déficience intellectuelle, dyslexie sévère,
            allophone). L'exposition à des phrases de complexité croissante fait partie de
            l'apprentissage de la lecture : ne pas l'utiliser pour chaque histoire.
            <div className="mt-1 italic" style={{ color: '#8a6c22' }}>
              Fondé sur le corpus RISS (Balssa, 2024 — FALC et école inclusive).
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleFalcSimplify}
          disabled={falcLoading || !text.trim()}
          className="flex items-center justify-center gap-2 w-full py-2 rounded-lg border-2 border-dashed text-sm font-medium transition disabled:opacity-50"
          style={{ borderColor: '#d4af5a', color: '#8a6c22', background: '#fdf8ec' }}
        >
          <Wand2 className="w-4 h-4" />
          {falcLoading ? 'Simplification en cours...' : 'Simplifier en FALC avant génération'}
        </button>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading || !text.trim() || !title.trim()}
            className="plai-btn flex-1 py-3 text-base"
          >
            {loading ? 'Traitement en cours...' : 'Générer les pictogrammes'}
          </button>
          {(text || title) && (
            <button
              type="button"
              onClick={handleClear}
              className="plai-btn-ghost px-4 py-3"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          )}
        </div>
      </form>
    </div>
  );
};
