import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SearchRequest {
  word: string;
  language: string;
}

interface Pictogram {
  id: number;
  url: string;
  keywords: string[];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { word, language }: SearchRequest = await req.json();

    const langMap: { [key: string]: string } = {
      fr: 'fr',
      en: 'en',
    };

    const colorWords: { [key: string]: string } = {
      'rouge': 'red', 'rouges': 'red',
      'bleu': 'blue', 'bleue': 'blue', 'bleus': 'blue', 'bleues': 'blue',
      'vert': 'green', 'verte': 'green', 'verts': 'green', 'vertes': 'green',
      'jaune': 'yellow', 'jaunes': 'yellow',
      'orange': 'orange', 'oranges': 'orange',
      'violet': 'purple', 'violette': 'purple', 'violets': 'purple', 'violettes': 'purple',
      'rose': 'pink', 'roses': 'pink',
      'blanc': 'white', 'blanche': 'white', 'blancs': 'white', 'blanches': 'white',
      'noir': 'black', 'noire': 'black', 'noirs': 'black', 'noires': 'black',
      'gris': 'gray', 'grise': 'gray', 'grises': 'gray',
      'marron': 'brown', 'marrons': 'brown',
      'beige': 'beige', 'beiges': 'beige',
      'or': 'gold'
    };

    const arasaacLang = langMap[language] || 'fr';
    let results: any[] = [];

    const specificWordIds: { [key: string]: number } = {
      'main': 5122,
      'mains': 5122,
      'cerf': 3668,
      'lapin': 5566,
      'lapins': 5566,
      'crier': 18065,
      'chasseur': 11537,
      'serrer': 11980,
      'fenêtre': 36638,
      'maison': 5064,
      'regarder': 18231,
      'venir': 3479,
      'entrer': 8800,
      'ouvrir': 18090,
      'tuer': 16023,
      'principaux': 18235,
      'principales': 18235
    };

    if (specificWordIds[word]) {
      const pictogramId = specificWordIds[word];
      const specificUrl = `https://api.arasaac.org/api/pictograms/${arasaacLang}/${pictogramId}`;
      const specificResponse = await fetch(specificUrl);

      if (specificResponse.ok) {
        const result = await specificResponse.json();
        results = [result];
      }
    }

    if (results.length === 0 && colorWords[word]) {
      const englishColor = colorWords[word];
      const colorSearchUrl = `https://api.arasaac.org/api/pictograms/en/search/${encodeURIComponent(englishColor)}`;
      const colorResponse = await fetch(colorSearchUrl);

      if (colorResponse.ok) {
        results = await colorResponse.json();
      }
    }

    if (results.length === 0) {
      let searchUrl = `https://api.arasaac.org/api/pictograms/${arasaacLang}/search/${encodeURIComponent(word)}`;
      let response = await fetch(searchUrl);

      if (!response.ok) {
        return new Response(
          JSON.stringify({ pictograms: [] }),
          {
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        );
      }

      results = await response.json();
    }

    const pictograms: Pictogram[] = results.slice(0, 9).map((result: any) => ({
      id: result._id,
      url: `https://api.arasaac.org/api/pictograms/${result._id}?download=false`,
      keywords: result.keywords || [],
    }));

    return new Response(
      JSON.stringify({ pictograms }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error searching pictograms:', error);
    return new Response(
      JSON.stringify({ error: error.message, pictograms: [] }),
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