import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ProcessRequest {
  text: string;
  language: string;
  replaceNouns: boolean;
  replaceVerbs: boolean;
  replaceAdjectives: boolean;
  customWords: string[];
}

interface ProcessedWord {
  original: string;
  pictogramId?: number;
  pictogramUrl?: string;
  shouldReplace: boolean;
  type?: string;
  isLineBreak?: boolean;
  isAmbiguous?: boolean;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { text, language, replaceNouns, replaceVerbs, replaceAdjectives, customWords }: ProcessRequest = await req.json();

    const multiWordPhrases = customWords.filter(w => w.trim().includes(' '));
    const singleWords = customWords.filter(w => !w.trim().includes(' '));

    multiWordPhrases.sort((a, b) => b.length - a.length);

    const lines = text.split('\n');
    const processedWords: ProcessedWord[] = [];

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      let line = lines[lineIndex];

      if (line.trim() === '') {
        processedWords.push({ original: '\n', shouldReplace: false, isLineBreak: true });
        continue;
      }

      const phraseMatches: Array<{ start: number; end: number; phrase: string; original: string }> = [];

      for (const phrase of multiWordPhrases) {
        const normalizedPhrase = phrase.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const normalizedLine = line.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

        let searchPos = 0;
        while (searchPos < normalizedLine.length) {
          const index = normalizedLine.indexOf(normalizedPhrase, searchPos);
          if (index === -1) break;

          const overlaps = phraseMatches.some(m =>
            (index >= m.start && index < m.end) ||
            (index + normalizedPhrase.length > m.start && index + normalizedPhrase.length <= m.end)
          );

          if (!overlaps) {
            phraseMatches.push({
              start: index,
              end: index + normalizedPhrase.length,
              phrase: normalizedPhrase,
              original: line.substring(index, index + normalizedPhrase.length)
            });
          }

          searchPos = index + 1;
        }
      }

      phraseMatches.sort((a, b) => a.start - b.start);

      let currentPos = 0;

      for (const match of phraseMatches) {
        if (currentPos < match.start) {
          const beforeText = line.substring(currentPos, match.start);
          await processTextSegment(
            beforeText,
            singleWords,
            language,
            replaceNouns,
            replaceVerbs,
            replaceAdjectives,
            processedWords
          );
        }

        const pictogram = await searchPictogram(match.phrase, language);
        processedWords.push({
          original: match.original,
          pictogramId: pictogram?.id,
          pictogramUrl: pictogram?.url,
          shouldReplace: true,
          type: 'custom',
          isAmbiguous: false,
        });

        currentPos = match.end;
      }

      if (currentPos < line.length) {
        const remainingText = line.substring(currentPos);
        await processTextSegment(
          remainingText,
          singleWords,
          language,
          replaceNouns,
          replaceVerbs,
          replaceAdjectives,
          processedWords
        );
      }

      if (lineIndex < lines.length - 1) {
        processedWords.push({ original: '\n', shouldReplace: false, isLineBreak: true });
      }
    }

    return new Response(
      JSON.stringify({ processedWords }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error processing text:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});

async function processTextSegment(
  text: string,
  singleWords: string[],
  language: string,
  replaceNouns: boolean,
  replaceVerbs: boolean,
  replaceAdjectives: boolean,
  processedWords: ProcessedWord[]
): Promise<void> {
  const tokens = tokenize(text);

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const word = token.word;
    const cleanWord = token.clean;

    if (!cleanWord || token.isPunctuation) {
      processedWords.push({ original: word, shouldReplace: false });
      continue;
    }

    let shouldReplace = false;
    let wordType: string | null = null;
    let isAmbiguous = false;

    const normalizedCustomWords = singleWords.map(w =>
      w.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    );

    if (singleWords && singleWords.length > 0 && normalizedCustomWords.includes(cleanWord)) {
      shouldReplace = true;
      wordType = 'custom';
    } else {
      const context = {
        prev: i > 0 ? tokens[i - 1].clean : null,
        next: i < tokens.length - 1 ? tokens[i + 1].clean : null,
        prevWord: i > 0 ? tokens[i - 1].word : null,
        nextWord: i < tokens.length - 1 ? tokens[i + 1].word : null,
      };

      const analysis = analyzeWordInContext(cleanWord, context, language);
      wordType = analysis.type;
      isAmbiguous = analysis.ambiguous;

      if (
        (wordType === 'noun' && replaceNouns) ||
        (wordType === 'potential-noun' && replaceNouns) ||
        (wordType === 'verb' && replaceVerbs) ||
        (wordType === 'adjective' && replaceAdjectives)
      ) {
        shouldReplace = true;
        if (wordType === 'potential-noun') {
          wordType = 'noun';
        }
      }
    }

    if (shouldReplace) {
      const pictogram = await searchPictogram(cleanWord, language);
      processedWords.push({
        original: word,
        pictogramId: pictogram?.id,
        pictogramUrl: pictogram?.url,
        shouldReplace: true,
        type: wordType || undefined,
        isAmbiguous,
      });
    } else {
      processedWords.push({
        original: word,
        shouldReplace: false,
        type: wordType || undefined,
      });
    }
  }
}

function tokenize(text: string): Array<{ word: string; clean: string; isPunctuation: boolean }> {
  const tokens: Array<{ word: string; clean: string; isPunctuation: boolean }> = [];
  const regex = /(\s+|[.,!?;:"'()[\]{}])/g;
  const parts = text.split(regex);

  for (const part of parts) {
    if (!part) continue;

    if (/^\s+$/.test(part)) {
      tokens.push({ word: part, clean: '', isPunctuation: false });
    } else if (/^[.,!?;:"'()[\]{}]$/.test(part)) {
      tokens.push({ word: part, clean: '', isPunctuation: true });
    } else {
      const clean = part.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      tokens.push({ word: part, clean, isPunctuation: false });
    }
  }

  return tokens;
}

function analyzeWordInContext(
  word: string,
  context: { prev: string | null; next: string | null; prevWord: string | null; nextWord: string | null },
  language: string
): { type: string; ambiguous: boolean } {

  const dictionaries = {
    fr: {
      nouns: [
        'maison', 'chat', 'chien', 'enfant', 'ecole', 'livre', 'table', 'chaise', 'porte', 'fenetre',
        'voiture', 'arbre', 'fleur', 'soleil', 'lune', 'eau', 'pain', 'ami', 'famille', 'jour',
        'nuit', 'main', 'pied', 'tete', 'corps', 'coeur', 'yeux', 'bouche', 'nez', 'oreille',
        'cheval', 'garcon', 'fille', 'homme', 'femme', 'pere', 'mere', 'frere', 'soeur', 'roi',
        'reine', 'prince', 'princesse', 'chateau', 'jardin', 'foret', 'montagne', 'mer', 'riviere',
        'ville', 'pays', 'monde', 'ciel', 'etoile', 'nuage', 'pluie', 'vent', 'neige', 'professeur',
        'lunette', 'lunettes', 'sac', 'chemin', 'sable', 'route', 'sentier', 'pierre', 'roche',
        'terre', 'sol', 'herbe', 'plage', 'desert'
      ],
      verbs: [
        'est', 'sont', 'etre', 'suis', 'es', 'sommes', 'etes', 'etait', 'etaient', 'sera', 'seront',
        'a', 'as', 'ont', 'avoir', 'avons', 'avez', 'avait', 'avaient', 'aura', 'auront',
        'fait', 'faire', 'fais', 'faisons', 'faites', 'font', 'faisait', 'faisaient',
        'va', 'vas', 'allons', 'allez', 'vont', 'aller', 'allait', 'allaient', 'ira', 'iront',
        'vient', 'viens', 'venons', 'venez', 'viennent', 'venir', 'venait', 'venaient',
        'voit', 'vois', 'voyons', 'voyez', 'voient', 'voir', 'voyait', 'voyaient',
        'dit', 'dis', 'disons', 'dites', 'disent', 'dire', 'disait', 'disaient',
        'donne', 'donnes', 'donnons', 'donnez', 'donnent', 'donner', 'donnait', 'donnaient',
        'prend', 'prends', 'prenons', 'prenez', 'prennent', 'prendre', 'prenait', 'prenaient',
        'parle', 'parles', 'parlons', 'parlez', 'parlent', 'parler', 'parlait', 'parlaient',
        'aime', 'aimes', 'aimons', 'aimez', 'aiment', 'aimer', 'aimait', 'aimaient',
        'peut', 'peux', 'pouvons', 'pouvez', 'peuvent', 'pouvoir', 'pouvait', 'pouvaient',
        'veut', 'veux', 'voulons', 'voulez', 'veulent', 'vouloir', 'voulait', 'voulaient',
        'doit', 'dois', 'devons', 'devez', 'doivent', 'devoir', 'devait', 'devaient',
        'sait', 'sais', 'savons', 'savez', 'savent', 'savoir', 'savait', 'savaient',
        'mange', 'manges', 'mangeons', 'mangez', 'mangent', 'manger', 'mangeait', 'mangeaient',
        'boit', 'bois', 'buvons', 'buvez', 'boivent', 'boire', 'buvait', 'buvaient',
        'dort', 'dors', 'dormons', 'dormez', 'dorment', 'dormir', 'dormait', 'dormaient',
        'court', 'cours', 'courons', 'courez', 'courent', 'courir', 'courait', 'couraient',
        'marche', 'marches', 'marchons', 'marchez', 'marchent', 'marcher', 'marchait', 'marchaient',
        'joue', 'joues', 'jouons', 'jouez', 'jouent', 'jouer', 'jouait', 'jouaient',
        'lit', 'lis', 'lisons', 'lisez', 'lisent', 'lire', 'lisait', 'lisaient',
        'ecrit', 'ecris', 'ecrivons', 'ecrivez', 'ecrivent', 'ecrire', 'ecrivait', 'ecrivaient',
        'regarde', 'regardes', 'regardons', 'regardez', 'regardent', 'regarder', 'regardait', 'regardaient',
        'ecoute', 'ecoutes', 'ecoutons', 'ecoutez', 'ecoutent', 'ecouter', 'ecoutait', 'ecoutaient',
        'crie', 'cries', 'crions', 'criez', 'crient', 'crier', 'criait', 'criaient',
        'serre', 'serres', 'serrons', 'serrez', 'serrent', 'serrer', 'serrait', 'serraient',
        'ouvre', 'ouvres', 'ouvrons', 'ouvrez', 'ouvrent', 'ouvrir', 'ouvrait', 'ouvraient',
        'tue', 'tues', 'tuons', 'tuez', 'tuent', 'tuer', 'tuait', 'tuaient', 'tuera', 'tueront',
        'entre', 'entres', 'entrons', 'entrez', 'entrent', 'entrer', 'entrait', 'entraient'
      ],
      adjectives: [
        'grand', 'grande', 'grands', 'grandes', 'petit', 'petite', 'petits', 'petites',
        'bon', 'bonne', 'bons', 'bonnes', 'mauvais', 'mauvaise', 'mauvaises',
        'beau', 'belle', 'beaux', 'belles', 'joli', 'jolie', 'jolis', 'jolies',
        'jeune', 'jeunes', 'vieux', 'vieille', 'vieil', 'vieilles',
        'nouveau', 'nouvelle', 'nouveaux', 'nouvelles', 'nouvel',
        'ancien', 'ancienne', 'anciens', 'anciennes',
        'heureux', 'heureuse', 'heureuses', 'triste', 'tristes',
        'rouge', 'rouges', 'bleu', 'bleue', 'bleus', 'bleues',
        'vert', 'verte', 'verts', 'vertes', 'jaune', 'jaunes',
        'blanc', 'blanche', 'blancs', 'blanches', 'noir', 'noire', 'noirs', 'noires',
        'rose', 'roses', 'orange', 'oranges', 'violet', 'violette', 'violets', 'violettes',
        'gris', 'grise', 'grises', 'marron', 'marrons', 'beige', 'beiges',
        'chaud', 'chaude', 'chauds', 'chaudes', 'froid', 'froide', 'froids', 'froides',
        'rapide', 'rapides', 'lent', 'lente', 'lents', 'lentes',
        'fort', 'forte', 'forts', 'fortes', 'faible', 'faibles', 'gros'
      ],
      determiners: ['le', 'la', 'les', 'un', 'une', 'des', 'ce', 'cet', 'cette', 'ces', 'mon', 'ma', 'mes', 'ton', 'ta', 'tes', 'son', 'sa', 'ses', 'notre', 'nos', 'votre', 'vos', 'leur', 'leurs', 'du', 'de', 'au', 'aux'],
      prepositions: ['a', 'dans', 'sur', 'sous', 'avec', 'sans', 'pour', 'par', 'en', 'chez', 'vers', 'entre', 'parmi', 'pendant', 'depuis', 'jusque', 'avant', 'apres', 'contre', 'devant', 'derriere'],
      pronouns: ['je', 'j', 'tu', 'il', 'elle', 'on', 'nous', 'vous', 'ils', 'elles', 'me', 'm', 'te', 't', 'se', 's', 'le', 'la', 'les', 'lui', 'leur', 'en', 'y', 'qui', 'que', 'qu', 'quoi', 'dont', 'ou', 'lequel', 'laquelle', 'lesquels', 'lesquelles', 'auquel', 'duquel', 'celui', 'celle', 'ceux', 'celles', 'ceci', 'cela', 'ca', 'rien', 'personne', 'quelqu\'un', 'quelque', 'chacun', 'chacune', 'tout', 'tous', 'toute', 'toutes', 'moi', 'toi', 'soi'],
      adverbs: ['beaucoup', 'tres', 'bien', 'mal', 'plus', 'moins', 'trop', 'assez', 'peu', 'souvent', 'toujours', 'jamais', 'deja', 'encore', 'maintenant', 'hier', 'demain', 'aujourd\'hui', 'ici', 'la', 'ailleurs', 'partout', 'dedans', 'dehors', 'dessus', 'dessous', 'loin', 'pres', 'ensemble', 'aussi', 'alors', 'ainsi', 'seulement', 'surtout', 'ensuite', 'enfin', 'parfois', 'longtemps', 'tard', 'tot', 'vite', 'lentement', 'doucement', 'fort', 'facilement', 'difficilement', 'vraiment', 'certainement', 'probablement', 'peut-etre', 'evidemment', 'heureusement', 'malheureusement', 'comment', 'pourquoi', 'quand', 'combien'],
      conjunctions: ['et', 'ou', 'mais', 'donc', 'or', 'ni', 'car']
    },
    en: {
      nouns: ['house', 'cat', 'dog', 'child', 'school', 'book', 'table', 'chair', 'door', 'window', 'car', 'tree', 'flower', 'sun', 'moon', 'water', 'bread', 'friend', 'family', 'day', 'night', 'hand', 'foot', 'head', 'body', 'heart', 'eyes', 'mouth', 'nose', 'ear', 'horse', 'boy', 'girl', 'man', 'woman', 'father', 'mother', 'brother', 'sister', 'king', 'queen', 'prince', 'princess'],
      verbs: ['is', 'are', 'am', 'be', 'was', 'were', 'been', 'being', 'have', 'has', 'had', 'having', 'do', 'does', 'did', 'doing', 'go', 'goes', 'went', 'going', 'come', 'comes', 'came', 'coming', 'see', 'sees', 'saw', 'seeing', 'say', 'says', 'said', 'saying', 'give', 'gives', 'gave', 'giving', 'take', 'takes', 'took', 'taking', 'speak', 'speaks', 'spoke', 'speaking', 'love', 'loves', 'loved', 'loving', 'want', 'wants', 'wanted', 'wanting', 'know', 'knows', 'knew', 'knowing', 'eat', 'eats', 'ate', 'eating', 'drink', 'drinks', 'drank', 'drinking', 'sleep', 'sleeps', 'slept', 'sleeping', 'run', 'runs', 'ran', 'running', 'walk', 'walks', 'walked', 'walking', 'play', 'plays', 'played', 'playing', 'read', 'reads', 'reading', 'write', 'writes', 'wrote', 'writing', 'watch', 'watches', 'watched', 'watching', 'listen', 'listens', 'listened', 'listening'],
      adjectives: ['big', 'small', 'good', 'bad', 'beautiful', 'pretty', 'young', 'old', 'new', 'ancient', 'happy', 'sad', 'red', 'blue', 'green', 'yellow', 'white', 'black', 'hot', 'cold', 'fast', 'slow', 'strong', 'weak'],
      determiners: ['the', 'a', 'an', 'this', 'that', 'these', 'those', 'my', 'your', 'his', 'her', 'its', 'our', 'their'],
      prepositions: ['in', 'on', 'at', 'to', 'from', 'with', 'without', 'for', 'by', 'about', 'under', 'over', 'between', 'among', 'during', 'before', 'after', 'against'],
      pronouns: ['i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them', 'myself', 'yourself', 'himself', 'herself', 'itself', 'ourselves', 'yourselves', 'themselves', 'who', 'whom', 'whose', 'which', 'what', 'that', 'this', 'these', 'those', 'anyone', 'someone', 'everyone', 'nobody', 'anybody', 'somebody', 'everybody', 'nothing', 'anything', 'something', 'everything'],
      adverbs: ['very', 'well', 'badly', 'much', 'more', 'less', 'too', 'enough', 'little', 'often', 'always', 'never', 'already', 'still', 'now', 'yesterday', 'tomorrow', 'today', 'here', 'there', 'everywhere', 'inside', 'outside', 'far', 'near', 'together', 'also', 'then', 'thus', 'only', 'especially', 'next', 'finally', 'sometimes', 'long', 'late', 'early', 'quickly', 'slowly', 'easily', 'really', 'certainly', 'probably', 'maybe', 'obviously', 'fortunately', 'unfortunately', 'how', 'why', 'when'],
      conjunctions: ['and', 'or', 'but', 'so', 'nor']
    }
  };

  const dict = dictionaries[language as keyof typeof dictionaries] || dictionaries.fr;

  if (dict.determiners.includes(word)) {
    return { type: 'determiner', ambiguous: false };
  }

  if (dict.conjunctions && dict.conjunctions.includes(word)) {
    return { type: 'conjunction', ambiguous: false };
  }

  if (dict.prepositions && dict.prepositions.includes(word)) {
    return { type: 'preposition', ambiguous: false };
  }

  if (dict.pronouns && dict.pronouns.includes(word)) {
    return { type: 'pronoun', ambiguous: false };
  }

  if (dict.adverbs && dict.adverbs.includes(word)) {
    return { type: 'adverb', ambiguous: false };
  }

  const stateVerbs = ['est', 'sont', 'etait', 'etaient', 'sera', 'seront', 'suis', 'es', 'sommes', 'etes'];

  if (dict.verbs.includes(word)) {
    return { type: 'verb', ambiguous: false };
  }

  if (dict.adjectives.includes(word)) {
    if (context.prev && dict.determiners.includes(context.prev)) {
      return { type: 'adjective', ambiguous: false };
    }
    if (context.next && dict.nouns.includes(context.next)) {
      return { type: 'adjective', ambiguous: false };
    }
    if (context.prev && stateVerbs.includes(context.prev)) {
      return { type: 'adjective', ambiguous: false };
    }
    return { type: 'adjective', ambiguous: true };
  }

  if (dict.nouns.includes(word)) {
    if (context.prev && dict.determiners.includes(context.prev)) {
      return { type: 'noun', ambiguous: false };
    }
    if (context.prev && dict.adjectives.includes(context.prev)) {
      return { type: 'noun', ambiguous: false };
    }
    return { type: 'noun', ambiguous: false };
  }

  if (context.prev && dict.determiners.includes(context.prev)) {
    return { type: 'noun', ambiguous: true };
  }

  if (context.prev && dict.adjectives.includes(context.prev)) {
    return { type: 'noun', ambiguous: true };
  }

  if (word.length > 2 && (word.endsWith('er') || word.endsWith('ir') || word.endsWith('re') || word.endsWith('oir'))) {
    return { type: 'verb', ambiguous: true };
  }

  return { type: 'potential-noun', ambiguous: true };
}

async function searchPictogram(word: string, language: string): Promise<{ id: number; url: string } | null> {
  try {
    const langMap: { [key: string]: string } = {
      fr: 'fr',
      en: 'en',
    };

    const specificPictogramIds: { [key: string]: number } = {
      'rouge': 2639, 'rouges': 2639,
      'bleu': 4869, 'bleue': 4869, 'bleus': 4869, 'bleues': 4869,
      'vert': 4887, 'verte': 4887, 'verts': 4887, 'vertes': 4887,
      'jaune': 2648, 'jaunes': 2648,
      'orange': 8556, 'oranges': 8556,
      'violet': 8582, 'violette': 8582, 'violets': 8582, 'violettes': 8582,
      'rose': 2807, 'roses': 2807,
      'blanc': 2662, 'blanche': 2662, 'blancs': 2662, 'blanches': 2662,
      'noir': 2655, 'noire': 2655, 'noirs': 2655, 'noires': 2655,
      'gris': 2654, 'grise': 2654, 'grises': 2654,
      'marron': 4872, 'marrons': 4872,
      'beige': 4870, 'beiges': 4870,
      'or': 10121
    };

    const arasaacLang = langMap[language] || 'fr';

    if (specificPictogramIds[word]) {
      const pictogramId = specificPictogramIds[word];
      return {
        id: pictogramId,
        url: `https://api.arasaac.org/api/pictograms/${pictogramId}?download=false`,
      };
    }

    let searchUrl = `https://api.arasaac.org/api/pictograms/${arasaacLang}/search/${encodeURIComponent(word)}`;
    let response = await fetch(searchUrl);

    if (!response.ok) {
      return null;
    }

    let results = await response.json();

    if (results && results.length > 0) {
      const pictogramId = results[0]._id;
      return {
        id: pictogramId,
        url: `https://api.arasaac.org/api/pictograms/${pictogramId}?download=false`,
      };
    }

    return null;
  } catch (error) {
    console.error('Error searching pictogram:', error);
    return null;
  }
}