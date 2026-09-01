// ─────────────────────────────────────────────────────────────────────
// Service Academy · stt — голос → текст через OpenRouter (тот же ключ,
// что у ai-hr/ai-chat). Модель с аудио-модальностью слушает запись и
// возвращает дословную транскрипцию. Деплой: supabase functions deploy stt
// ─────────────────────────────────────────────────────────────────────
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!API_KEY) return json({ error: "no_key" }, 500);
    const { audio, format } = await req.json();
    if (!audio || typeof audio !== "string") return json({ error: "no_audio" }, 400);
    const fmt = ["m4a", "mp3", "wav", "ogg", "aac", "webm", "flac"].includes(format) ? format : "m4a";
    const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": "Bearer " + API_KEY, "Content-Type": "application/json",
        "HTTP-Referer": "https://service-academy-16te.vercel.app", "X-Title": "Service Academy STT" },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash-001",
        messages: [{ role: "user", content: [
          { type: "text", text: "Транскрибируй эту речь дословно на русском языке. Верни ТОЛЬКО текст сказанного, без кавычек, без пояснений, без форматирования. Если речи нет — верни пустую строку." },
          { type: "input_audio", input_audio: { data: audio, format: fmt } },
        ] }],
        max_tokens: 800, temperature: 0,
      }),
    });
    const data = await r.json();
    if (!r.ok) return json({ error: "provider", detail: data?.error?.message || r.status }, 502);
    const text = String(data?.choices?.[0]?.message?.content || "").trim();
    return json({ text });
  } catch (e) {
    return json({ error: "server", detail: String((e as Error)?.message || e) }, 500);
  }
});
