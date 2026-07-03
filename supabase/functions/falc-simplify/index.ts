import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface FalcRequest {
  text: string;
}

const SYSTEM_PROMPT = `Tu simplifies un texte narratif court destiné à un enseignant qui va ensuite générer des pictogrammes pour un élève à besoins spécifiques (déficience intellectuelle, dyslexie sévère, allophone).

RÈGLES OBLIGATOIRES (sous-ensemble FALC adapté à un texte narratif — pas le FALC administratif complet) :
1. Phrases de maximum 12 mots.
2. Une seule idée par phrase.
3. Verbes au présent de l'indicatif (éviter conditionnel, subjonctif, futur antérieur).
4. Pas de négation double ou complexe.
5. Pas de mots entièrement en majuscules.
6. Vocabulaire courant : remplacer les mots rares ou abstraits par des équivalents simples, sans perdre le sens.

NE PAS FAIRE (ça casserait le récit) :
- Ne pas supprimer les pronoms (il/elle/le/la) — garder le style narratif normal.
- Ne pas ajouter de formules administratives ("Il faut...", "C'est quand on...", "Attention, il y a une règle...").
- Ne pas ajouter de titres, listes à puces, ou structure de document.
- Ne pas inventer ni supprimer d'information : le sens doit rester identique au texte original.

RÈGLES D'ÉCRITURE :
- Retourne UNIQUEMENT le texte simplifié, rien d'autre.
- Jamais de "Voici", "Bien sûr", préambule ou commentaire sur ta démarche.
- Conserve les sauts de ligne du texte original s'il y en a.

Fondement : Balssa (2024), « FALC et école inclusive » (RISS tel-04807443) ; principe de zone proximale de développement (Vygotski) — la simplification syntaxique cible un obstacle réel, ce n'est pas une substitution systématique du texte normal.`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { text }: FalcRequest = await req.json();

    if (!text || !text.trim()) {
      return new Response(
        JSON.stringify({ error: "Texte manquant" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Clé API manquante côté serveur" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1500,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: text }],
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      if (response.status === 529 || err.error?.type === "overloaded_error") {
        return new Response(
          JSON.stringify({ error: "API surchargée — réessayez dans quelques secondes." }),
          {
            status: 503,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      return new Response(
        JSON.stringify({ error: err.error?.message ?? "Erreur API Anthropic" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const data = await response.json();
    const simplifiedText = data.content?.[0]?.text ?? "";

    return new Response(
      JSON.stringify({ simplifiedText }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error simplifying FALC:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
