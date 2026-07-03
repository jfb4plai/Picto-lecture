import { useRef, useState, useEffect } from 'react';
import { Save, Download, FileText, AlertCircle, Edit2, RefreshCw, X, Search, Plus, FileDown, Volume2, VolumeX } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import {
  Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, ImageRun,
  BorderStyle, WidthType, AlignmentType, VerticalAlign,
} from 'docx';

type ProcessedWord = {
  original: string;
  pictogramId?: number;
  pictogramUrl?: string;
  shouldReplace: boolean;
  type?: string;
  isLineBreak?: boolean;
  isAmbiguous?: boolean;
  customLabel?: string;
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
  const [searchQuery, setSearchQuery] = useState('');
  const [speaking, setSpeaking] = useState(false);
  const [speechRate, setSpeechRate] = useState(0.85);
  const pictogramSize = fontSize * 2.5;

  const ttsLang = language === 'fr' ? 'fr-FR' : 'en-US';

  const speak = (text: string) => {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = ttsLang;
    u.rate = speechRate;
    window.speechSynthesis.speak(u);
  };

  const speakAll = () => {
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const fullText = modifiedWords
      .filter(w => !w.isLineBreak)
      .map(w => w.customLabel ?? w.original)
      .join(' ');
    const u = new SpeechSynthesisUtterance(fullText);
    u.lang = ttsLang;
    u.rate = speechRate;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(u);
  };

  useEffect(() => {
    setModifiedWords(processedWords);
  }, [processedWords]);

  const normalizeDisplayText = (word: string, index: number): string => {
    if (!word) return word;

    const isStartOfSentence = index === 0 ||
      (index > 0 && modifiedWords[index - 1]?.original?.match(/[.!?]\s*$/));

    if (word.toUpperCase() === word && word.length > 1) {
      const normalized = word.toLowerCase();
      return isStartOfSentence ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : normalized;
    }

    if (!isStartOfSentence && word.charAt(0) === word.charAt(0).toUpperCase()) {
      return word.charAt(0).toLowerCase() + word.slice(1);
    }

    return word;
  };

  const getDisplayLabel = (word: ProcessedWord, index: number): string => {
    return word.customLabel ?? normalizeDisplayText(word.original, index);
  };

  const hasAmbiguousWords = modifiedWords.some(w => w.isAmbiguous && w.shouldReplace);

  const handleEditWord = async (index: number) => {
    const word = modifiedWords[index];
    setEditingIndex(index);
    setAlternatives([]);
    setSearchQuery(word.original);
    await searchAlternatives(word.original);
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
      shouldReplace: true,
      isAmbiguous: false,
    };
    setModifiedWords(newWords);
    setEditingIndex(null);
  };

  const handleDisablePictogram = () => {
    if (editingIndex === null) return;

    const newWords = [...modifiedWords];
    newWords[editingIndex] = {
      ...newWords[editingIndex],
      shouldReplace: false,
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

  const handleLabelChange = (label: string) => {
    if (editingIndex === null) return;
    const newWords = [...modifiedWords];
    newWords[editingIndex] = { ...newWords[editingIndex], customLabel: label };
    setModifiedWords(newWords);
  };

  const handleExportDocx = async () => {
    const NONE_BORDER = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
    const noBorders = { top: NONE_BORDER, bottom: NONE_BORDER, left: NONE_BORDER, right: NONE_BORDER };

    // Fetch an image URL and return its ArrayBuffer
    const fetchImage = async (url: string): Promise<ArrayBuffer | null> => {
      try {
        const res = await fetch(url);
        if (!res.ok) return null;
        return await res.arrayBuffer();
      } catch {
        return null;
      }
    };

    // Split words into lines using isLineBreak markers
    const lines: ProcessedWord[][] = [];
    let current: ProcessedWord[] = [];
    for (const word of modifiedWords) {
      if (word.isLineBreak) {
        if (current.length > 0) { lines.push(current); current = []; }
      } else {
        current.push(word);
      }
    }
    if (current.length > 0) lines.push(current);

    // Pre-fetch all pictogram images
    const imageCache = new Map<string, ArrayBuffer | null>();
    await Promise.all(
      modifiedWords
        .filter(w => w.shouldReplace && w.pictogramUrl)
        .map(async w => {
          if (!imageCache.has(w.pictogramUrl!)) {
            imageCache.set(w.pictogramUrl!, await fetchImage(w.pictogramUrl!));
          }
        })
    );

    const imgSize = Math.max(50, fontSize * 3);

    const buildCell = (word: ProcessedWord, idx: number): TableCell => {
      const imgData = word.shouldReplace && word.pictogramUrl ? imageCache.get(word.pictogramUrl!) : null;

      if (imgData) {
        const label = word.customLabel ?? normalizeDisplayText(word.original, idx);
        return new TableCell({
          borders: noBorders,
          verticalAlign: VerticalAlign.BOTTOM,
          width: { size: imgSize + 10, type: WidthType.DXA },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new ImageRun({ data: imgData, transformation: { width: imgSize, height: imgSize }, type: 'png' })],
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: label, size: fontSize * 1.5 })],
            }),
          ],
        });
      }

      return new TableCell({
        borders: noBorders,
        verticalAlign: VerticalAlign.BOTTOM,
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: normalizeDisplayText(word.original, idx), size: fontSize * 1.5 })],
          }),
        ],
      });
    };

    const tables = lines.map(line =>
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [new TableRow({ children: line.map((w, i) => buildCell(w, i)) })],
      })
    );

    const doc = new Document({
      sections: [{
        children: [
          new Paragraph({
            children: [new TextRun({ text: title, bold: true, size: 32 })],
            spacing: { after: 200 },
          }),
          ...tables,
        ],
      }],
    });

    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title}.docx`;
    a.click();
    URL.revokeObjectURL(url);
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

  const EditPanel = ({ word, index }: { word: ProcessedWord; index: number }) => (
    <div className="absolute top-full mt-2 bg-white border rounded-lg shadow-lg p-4 z-10 min-w-[320px]" style={{ borderColor: 'var(--border)' }}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-[var(--text)]">Modifier "{word.original}"</h3>
        <button onClick={() => setEditingIndex(null)} className="text-gray-500 hover:text-gray-700">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Label éditable */}
      {word.shouldReplace && word.pictogramUrl && (
        <div className="mb-3">
          <label className="plai-label">
            Label sous le pictogramme :
          </label>
          <input
            type="text"
            value={word.customLabel ?? normalizeDisplayText(word.original, index)}
            onChange={(e) => handleLabelChange(e.target.value)}
            className="plai-input text-sm"
            style={{ padding: '6px 12px' }}
          />
        </div>
      )}

      {/* Désactiver le pictogramme */}
      {word.shouldReplace && word.pictogramUrl && (
        <div className="mb-3">
          <button
            onClick={handleDisablePictogram}
            className="w-full px-4 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 transition text-sm font-medium"
          >
            Supprimer le pictogramme
          </button>
        </div>
      )}

      {/* Type de mot */}
      {word.shouldReplace && word.pictogramUrl && (
        <div className="mb-3">
          <label className="plai-label">Type de mot :</label>
          <div className="flex gap-2">
            {['noun', 'verb', 'adjective'].map((type) => (
              <button
                key={type}
                onClick={() => handleChangeType(type)}
                className="px-3 py-1 rounded-lg text-sm transition"
                style={
                  word.type === type
                    ? { background: 'var(--teal)', color: '#fff' }
                    : { background: 'var(--surface2)', color: 'var(--text2)' }
                }
              >
                {type === 'noun' ? 'Nom' : type === 'verb' ? 'Verbe' : 'Adjectif'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Recherche libre */}
      <div className="mb-3">
        <label className="plai-label">
          Rechercher un pictogramme :
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && searchAlternatives(searchQuery)}
            className="plai-input flex-1 text-sm"
            style={{ padding: '6px 12px' }}
            placeholder="Mot-clé..."
          />
          <button
            onClick={() => searchAlternatives(searchQuery)}
            className="plai-btn"
            style={{ padding: '6px 12px' }}
          >
            <Search className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Résultats */}
      <div>
        {loadingAlternatives ? (
          <div className="flex items-center justify-center py-4">
            <RefreshCw className="w-5 h-5 animate-spin" style={{ color: 'var(--teal)' }} />
          </div>
        ) : alternatives.length > 0 ? (
          <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
            {alternatives.map((alt) => (
              <button
                key={alt.id}
                onClick={() => handleSelectAlternative(alt)}
                className="flex flex-col items-center p-2 border rounded-lg transition hover:bg-[var(--teal-bg)]"
                style={{ borderColor: 'var(--border)' }}
                title={alt.keywords.join(', ')}
              >
                <img src={alt.url} alt={alt.keywords.join(', ')} className="w-16 h-16 object-contain" />
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">Aucun résultat</p>
        )}
      </div>
    </div>
  );

  return (
    <div className="plai-card">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h2 className="font-serif text-xl text-[var(--text)]">{title}</h2>
          {hideTextUnderPictograms && (
            <span className="px-2 py-1 text-xs font-medium rounded" style={{ background: 'var(--teal-bg)', color: 'var(--teal)' }}>
              Mode sans texte
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={speakAll}
              className={`flex items-center px-4 py-2 rounded-lg transition ${
                speaking
                  ? 'bg-orange-500 text-white hover:bg-orange-600'
                  : 'bg-purple-600 text-white hover:bg-purple-700'
              }`}
              title={speaking ? 'Arrêter la lecture' : 'Lire tout'}
            >
              {speaking ? <VolumeX className="w-4 h-4 mr-2" /> : <Volume2 className="w-4 h-4 mr-2" />}
              {speaking ? 'Arrêter' : 'Lire tout'}
            </button>
            <select
              value={speechRate}
              onChange={e => setSpeechRate(Number(e.target.value))}
              className="px-2 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 bg-white"
              title="Vitesse de lecture"
            >
              <option value={0.6}>Lent</option>
              <option value={0.85}>Normal</option>
              <option value={1.1}>Rapide</option>
            </select>
          </div>
          <button
            onClick={onSave}
            disabled={saving}
            className="plai-btn flex items-center"
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
            onClick={handleExportDocx}
            className="plai-btn-ghost flex items-center"
          >
            <FileDown className="w-4 h-4 mr-2" />
            Word
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
        style={{ fontSize: `${fontSize}px`, lineHeight: lineSpacing }}
      >
        {modifiedWords.map((word, index) => {
          if (word.isLineBreak) {
            return <div key={index} className="w-full h-0" />;
          }

          const isEditing = editingIndex === index;

          // Mot avec pictogramme
          if (word.shouldReplace && word.pictogramUrl) {
            return (
              <span key={index} className="inline-flex flex-col items-center mx-1 relative group">
                <div className={`flex flex-col items-center ${word.isAmbiguous ? 'p-1 border-2 border-amber-400 rounded-lg bg-amber-50' : ''}`}>
                  <img
                    src={word.pictogramUrl}
                    alt={word.original}
                    className="object-contain"
                    style={{ width: `${pictogramSize}px`, height: `${pictogramSize}px`, marginBottom: '2px' }}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                  {!hideTextUnderPictograms && (
                    <span
                      className="text-gray-800 text-center font-medium"
                      style={{ fontSize: `${fontSize}px` }}
                      title={word.isAmbiguous ? `Mot ambigu (${word.type})` : word.type}
                    >
                      {getDisplayLabel(word, index)}
                    </span>
                  )}
                  <button
                    onClick={() => speak(getDisplayLabel(word, index))}
                    className="absolute -top-2 -left-2 bg-purple-500 hover:bg-purple-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition"
                    title="Écouter"
                  >
                    <Volume2 className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => handleEditWord(index)}
                    className={`absolute -top-2 -right-2 text-white rounded-full p-1 transition ${
                      word.isAmbiguous
                        ? 'bg-amber-500 hover:bg-amber-600'
                        : 'opacity-0 group-hover:opacity-100'
                    }`}
                    style={word.isAmbiguous ? undefined : { background: 'var(--teal)' }}
                    title="Modifier"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                </div>
                {isEditing && <EditPanel word={word} index={index} />}
              </span>
            );
          }

          // Mot sans pictogramme — cliquable pour en ajouter un
          return (
            <span key={index} className="relative inline group">
              <span className="text-gray-800">{normalizeDisplayText(word.original, index)}</span>
              <button
                onClick={() => handleEditWord(index)}
                className="absolute -top-2 -right-3 bg-gray-400 hover:bg-[var(--teal)] text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition"
                title="Ajouter un pictogramme"
              >
                <Plus className="w-3 h-3" />
              </button>
              {isEditing && <EditPanel word={word} index={index} />}
            </span>
          );
        })}
      </div>
    </div>
  );
};
