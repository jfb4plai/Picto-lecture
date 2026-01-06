import { useRef, useState, useEffect } from 'react';
import { Save, Download, FileText, AlertCircle, Edit2, RefreshCw, X } from 'lucide-react';
import html2pdf from 'html2pdf.js';

type ProcessedWord = {
  original: string;
  pictogramId?: number;
  pictogramUrl?: string;
  shouldReplace: boolean;
  type?: string;
  isLineBreak?: boolean;
  isAmbiguous?: boolean;
};

type StoryDisplayProps = {
  title: string;
  processedWords: ProcessedWord[];
  fontSize: number;
  lineSpacing: number;
  onSave: () => void;
  saving: boolean;
  language: string;
  hideTextUnderPictograms: boolean;
};

type AlternativePictogram = {
  id: number;
  url: string;
  keywords: string[];
};

export const StoryDisplay = ({
  title,
  processedWords,
  fontSize,
  lineSpacing,
  onSave,
  saving,
  language,
  hideTextUnderPictograms,
}: StoryDisplayProps) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [alternatives, setAlternatives] = useState<AlternativePictogram[]>([]);
  const [loadingAlternatives, setLoadingAlternatives] = useState(false);
  const [modifiedWords, setModifiedWords] = useState<ProcessedWord[]>(processedWords);
  const pictogramSize = fontSize * 2.5;

  useEffect(() => {
    setModifiedWords(processedWords);
  }, [processedWords]);

  const hasAmbiguousWords = modifiedWords.some(w => w.isAmbiguous && w.shouldReplace);

  const handleEditWord = async (index: number) => {
    setEditingIndex(index);
    setAlternatives([]);

    const word = modifiedWords[index];
    if (word.original) {
      await searchAlternatives(word.original);
    }
  };

  const searchAlternatives = async (word: string) => {
    setLoadingAlternatives(true);
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/search-pictograms`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ word, language }),
      });

      if (response.ok) {
        const data = await response.json();
        setAlternatives(data.pictograms || []);
      }
    } catch (error) {
      console.error('Error searching alternatives:', error);
    } finally {
      setLoadingAlternatives(false);
    }
  };

  const handleSelectAlternative = (pictogram: AlternativePictogram) => {
    if (editingIndex === null) return;

    const newWords = [...modifiedWords];
    newWords[editingIndex] = {
      ...newWords[editingIndex],
      pictogramId: pictogram.id,
      pictogramUrl: pictogram.url,
      isAmbiguous: false,
    };
    setModifiedWords(newWords);
    setEditingIndex(null);
  };

  const handleChangeType = async (newType: string) => {
    if (editingIndex === null) return;

    const word = modifiedWords[editingIndex];
    const newWords = [...modifiedWords];
    newWords[editingIndex] = {
      ...newWords[editingIndex],
      type: newType,
    };
    setModifiedWords(newWords);

    if (word.original) {
      await searchAlternatives(word.original);
    }
  };

  const handleExportText = () => {
    const content = modifiedWords.map((w) => w.original).join('');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPDF = async () => {
    if (!contentRef.current) return;

    setExporting(true);
    try {
      const element = contentRef.current.cloneNode(true) as HTMLElement;

      const editButtons = element.querySelectorAll('button');
      editButtons.forEach(btn => btn.remove());

      const modals = element.querySelectorAll('[class*="absolute"]');
      modals.forEach(modal => modal.remove());

      const ambiguousBoxes = element.querySelectorAll('[class*="border-amber"]');
      ambiguousBoxes.forEach(box => {
        const el = box as HTMLElement;
        el.classList.remove('p-1', 'border-2', 'border-amber-400', 'rounded-lg', 'bg-amber-50');
      });

      const pictogramImages = element.querySelectorAll('img');
      pictogramImages.forEach(img => {
        const currentWidth = parseInt(img.style.width || '0');
        const currentHeight = parseInt(img.style.height || '0');
        img.style.width = `${currentWidth * 0.78}px`;
        img.style.height = `${currentHeight * 0.78}px`;
        img.style.marginBottom = '2px';
        img.style.display = 'block';
      });

      const pictogramContainers = element.querySelectorAll('span.inline-flex');
      pictogramContainers.forEach(container => {
        const span = container as HTMLElement;
        span.style.display = 'inline-flex';
        span.style.flexDirection = 'column';
        span.style.alignItems = 'center';
        span.style.verticalAlign = 'bottom';
        span.style.margin = '0 4px';

        const innerDiv = span.querySelector('div');
        if (innerDiv) {
          innerDiv.style.display = 'flex';
          innerDiv.style.flexDirection = 'column';
          innerDiv.style.alignItems = 'center';
        }

        const textSpan = span.querySelector('span');
        if (textSpan) {
          const textEl = textSpan as HTMLElement;
          textEl.style.fontSize = `${fontSize * 0.75}px`;
          textEl.style.marginTop = '0px';
          textEl.style.lineHeight = '1.1';

          if (hideTextUnderPictograms) {
            textEl.style.color = 'transparent';
            textEl.style.opacity = '0';
          }
        }
      });

      element.style.lineHeight = `${lineSpacing * 2.8}`;

      const wrapper = document.createElement('div');
      wrapper.style.padding = '20px';
      wrapper.style.backgroundColor = 'white';

      const titleElement = document.createElement('h1');
      titleElement.textContent = title;
      titleElement.style.fontSize = '24px';
      titleElement.style.fontWeight = 'bold';
      titleElement.style.marginBottom = '20px';
      titleElement.style.color = '#1f2937';

      wrapper.appendChild(titleElement);
      wrapper.appendChild(element);

      const opt = {
        margin: [15, 15],
        filename: `${title}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          logging: false,
          allowTaint: true,
          backgroundColor: '#ffffff',
        },
        jsPDF: {
          unit: 'mm',
          format: 'a4',
          orientation: 'portrait'
        },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
      };

      await html2pdf().set(opt).from(wrapper).save();
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Erreur lors de l\'export PDF');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold text-gray-800">{title}</h2>
          {hideTextUnderPictograms && (
            <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">
              Mode sans texte
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={onSave}
            disabled={saving}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Sauvegarde...' : 'Sauvegarder'}
          </button>
          <button
            onClick={handleExportPDF}
            disabled={exporting}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
          >
            <FileText className="w-4 h-4 mr-2" />
            {exporting ? 'Export...' : 'PDF'}
          </button>
          <button
            onClick={handleExportText}
            className="flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
          >
            <Download className="w-4 h-4 mr-2" />
            Texte
          </button>
        </div>
      </div>

      {hasAmbiguousWords && (
        <div className="mb-4 flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-amber-800">
            <strong>Mots ambigus détectés :</strong> Cliquez sur un mot marqué en orange pour choisir un autre pictogramme.
          </div>
        </div>
      )}

      <div
        ref={contentRef}
        className="prose max-w-none"
        style={{
          fontSize: `${fontSize}px`,
          lineHeight: lineSpacing,
        }}
      >
        {modifiedWords.map((word, index) => {
          if (word.isLineBreak) {
            return <div key={index} className="w-full h-0" />;
          }

          if (word.shouldReplace && word.pictogramUrl) {
            const isEditing = editingIndex === index;
            return (
              <span key={index} className="inline-flex flex-col items-center mx-1 relative">
                <div className={`flex flex-col items-center ${word.isAmbiguous ? 'p-1 border-2 border-amber-400 rounded-lg bg-amber-50' : ''}`}>
                  <img
                    src={word.pictogramUrl}
                    alt={word.original}
                    className="object-contain"
                    style={{
                      width: `${pictogramSize}px`,
                      height: `${pictogramSize}px`,
                      marginBottom: '2px',
                    }}
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                  {!hideTextUnderPictograms && (
                    <span
                      className="text-gray-800 text-center font-medium"
                      style={{ fontSize: `${fontSize}px` }}
                      title={word.isAmbiguous ? `Mot ambigu (${word.type})` : word.type}
                    >
                      {word.original}
                    </span>
                  )}
                  {word.isAmbiguous && (
                    <button
                      onClick={() => handleEditWord(index)}
                      className="absolute -top-2 -right-2 bg-amber-500 text-white rounded-full p-1 hover:bg-amber-600 transition"
                      title="Corriger"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {isEditing && (
                  <div className="absolute top-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg p-4 z-10 min-w-[300px]">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-gray-800">Corriger "{word.original}"</h3>
                      <button
                        onClick={() => setEditingIndex(null)}
                        className="text-gray-500 hover:text-gray-700"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="mb-3">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Type de mot :
                      </label>
                      <div className="flex gap-2">
                        {['noun', 'verb', 'adjective'].map((type) => (
                          <button
                            key={type}
                            onClick={() => handleChangeType(type)}
                            className={`px-3 py-1 rounded-lg text-sm ${
                              word.type === type
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {type === 'noun' ? 'Nom' : type === 'verb' ? 'Verbe' : 'Adjectif'}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Pictogrammes alternatifs :
                      </label>
                      {loadingAlternatives ? (
                        <div className="flex items-center justify-center py-4">
                          <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
                        </div>
                      ) : alternatives.length > 0 ? (
                        <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                          {alternatives.map((alt) => (
                            <button
                              key={alt.id}
                              onClick={() => handleSelectAlternative(alt)}
                              className="flex flex-col items-center p-2 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition"
                            >
                              <img
                                src={alt.url}
                                alt={alt.keywords.join(', ')}
                                className="w-16 h-16 object-contain"
                              />
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">Aucune alternative trouvée</p>
                      )}
                    </div>
                  </div>
                )}
              </span>
            );
          }

          return (
            <span key={index} className="text-gray-800">
              {word.original}
            </span>
          );
        })}
      </div>
    </div>
  );
};
