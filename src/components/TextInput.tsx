import { useState } from 'react';
import { Upload, FileText, X } from 'lucide-react';
import * as mammoth from 'mammoth/mammoth.browser';

type TextInputProps = {
  onTextSubmit: (text: string, title: string) => void;
  loading: boolean;
};

export const TextInput = ({ onTextSubmit, loading }: TextInputProps) => {
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [fileName, setFileName] = useState('');

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
