// Service Academy — stt: голос в текст через OpenRouter.
// Дополнение 124. Причина поломки: функция была прибита к google/gemini-2.0-flash-001,
// а Google отключил Gemini 2.0 Flash 1 июня 2026 — каждый запрос падал у провайдера,
// а клиент показывал общее «Не удалось распознать». Теперь модели идут списком:
// первая живая отвечает, остальные — запас. Переопределить без правки кода:
// секрет OPENROUTER_STT_MODEL в Supabase → Edge Functions → Secrets.
// Деплой: Supabase → Edge Functions → stt → заменить код → Deploy
// (или CLI: supabase functions deploy stt). Секрет OPENROUTER_API_KEY уже есть — общий с ai-hr.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

const PROMPT =
  "Транскрибируй эту речь дословно на русском языке. " +
  "Верни только текст сказанного, без кавычек, без пояснений. " +
  "Если речи нет — верни пустую строку.";

const FORMATS = ["wav", "m4a", "mp3", "ogg", "aac", "webm", "flac", "aiff"];

// Модели с аудио-входом на OpenRouter, по убыванию предпочтения (сентябрь 2026):
// 3.5 Flash Lite — дёшево ($0.30/M аудио-токенов) и без даты отключения;
// 2.5 Flash — запас, Google отключает его 16 октября 2026.
const MODELS = [
  Deno.env.get("OPENROUTER_STT_MODEL"),
  "google/gemini-3.5-flash-lite",
  "google/gemini-3.1-flash-lite-preview",
  "google/gemini-3.5-flash",
  "google/gemini-2.5-flash",
].filter((m): m is string => !!m);

// content может быть строкой или массивом частей — собираем текст в любом случае
function textOf(data: any): string {
  const c = data?.choices?.[0]?.message?.content;
  if (typeof c === "string") return c.trim();
  if (Array.isArray(c)) return c.map((p: any) => p?.text || "").join("").trim();
  return "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const apiKey = Deno.env.get("OPENROUTER_API_KEY");
    if (!apiKey) return json({ error: "no_key" }, 500);

    const body = await req.json();
    const audio = body?.audio;
    let fmt = String(body?.format || "");
    if (!audio || typeof audio !== "string") return json({ error: "no_audio" }, 400);
    if (!FORMATS.includes(fmt)) fmt = "wav";

    let lastDetail = "ни одна модель не ответила";
    for (const model of MODELS) {
      const payload = {
        model,
        max_tokens: 1500,
        temperature: 0,
        // Транскрипции размышления не нужны — не тратим токены и секунды
        reasoning: { effort: "low", exclude: true },
        messages: [{
          role: "user",
          content: [
            { type: "text", text: PROMPT },
            { type: "input_audio", input_audio: { data: audio, format: fmt } },
          ],
        }],
      };
      let r: Response, data: any;
      try {
        r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": "Bearer " + apiKey,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://service-academy-16te.vercel.app",
            "X-Title": "Service Academy STT",
          },
          body: JSON.stringify(payload),
        });
        data = await r.json();
      } catch (e) {
        lastDetail = model + ": сеть — " + String((e as any)?.message || e);
        continue;
      }
      const err = data?.error || data?.choices?.[0]?.error;
      if (r.ok && !err) {
        return json({ text: textOf(data), model: data?.model || model });
      }
      const status = r.status || err?.code || 0;
      const msg = err?.message || ("HTTP " + status);
      // Ключ не принят / кредиты кончились — другая модель не поможет
      if (status === 401) return json({ error: "provider", detail: "OpenRouter не принял ключ (401) — проверь секрет OPENROUTER_API_KEY" }, 502);
      if (status === 402) return json({ error: "provider", detail: "На OpenRouter закончились кредиты (402)" }, 502);
      console.error("stt", model, status, String(msg).slice(0, 200));
      lastDetail = model + ": " + msg;
    }
    return json({ error: "provider", detail: lastDetail }, 502);
  } catch (e) {
    return json({ error: "server", detail: String((e as any)?.message || e) }, 500);
  }
});
