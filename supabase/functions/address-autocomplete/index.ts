import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authorization = req.headers.get("Authorization");
  if (!authorization) return json({ error: "Please sign in again." }, 401);

  const auth = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authorization } } },
  );
  const { data: { user }, error: authError } = await auth.auth.getUser();
  if (authError || !user) return json({ error: "Please sign in again." }, 401);

  const body = await req.json().catch(() => ({}));
  const input = String(body.input ?? "").trim().slice(0, 160);
  if (input.length < 3) return json({ suggestions: [] });

  const mapsKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
  if (!mapsKey) return json({ error: "Address search is not configured." }, 503);

  const response = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST",
    headers: {
      "X-Goog-Api-Key": mapsKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ input, includedRegionCodes: ["ng"] }),
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error(`Address autocomplete failed [${response.status}]: ${detail}`);
    return json({ error: "Address suggestions are temporarily unavailable." }, response.status);
  }

  const data = await response.json();
  const suggestions = (data.suggestions ?? []).slice(0, 6).flatMap((item: Record<string, unknown>) => {
    const prediction = item.placePrediction as Record<string, unknown> | undefined;
    const structured = prediction?.structuredFormat as Record<string, unknown> | undefined;
    const main = structured?.mainText as Record<string, unknown> | undefined;
    const secondary = structured?.secondaryText as Record<string, unknown> | undefined;
    const text = prediction?.text as Record<string, unknown> | undefined;
    const formattedAddress = typeof text?.text === "string" ? text.text : "";
    if (!formattedAddress) return [];
    return [{
      id: typeof prediction?.placeId === "string" ? prediction.placeId : formattedAddress,
      formattedAddress,
      mainText: typeof main?.text === "string" ? main.text : formattedAddress,
      secondaryText: typeof secondary?.text === "string" ? secondary.text : "",
    }];
  });

  return json({ suggestions });
});