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

    // Note : une table de correspondances mot -> ID ARASAAC codée en dur existait ici
    // (raccourci pour éviter une recherche plein texte). Retirée le 2026-07-19 : la
    // majorité des ID renvoyaient une 404, et ceux qui répondaient pointaient vers des
    // pictogrammes sans rapport avec le mot (ex. "maison" -> anneaux olympiques). La
    // recherche plein texte ci-dessous donne des résultats corrects pour ces mêmes mots.

    if (colorWords[word]) {
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