// Service Academy — radio-tts: «живые голоса» для «Радио в дорогу» (v31).
//
// POST { token, probe: true }               → { ok, configured }       — есть ли ключ (без озвучки)
// POST { token, text, who: host|guest|staff } → { ok, url, cached }     — ссылка на mp3 фразы
//
// Голос — OpenAI TTS (секрет OPENAI_API_KEY; модель OPENAI_TTS_MODEL, по умолчанию gpt-4o-mini-tts).
// Ключа нет — { ok:false, error:"not_configured" }: приложение молча читает голосом телефона, как раньше.
// Кэш: каждая фраза озвучивается один раз — mp3 кладём в публичную корзину radio-voice (создаёт
// этап 25) под именем по sha256(модель|голос|манера|текст). Повтор того же выпуска — без запроса к OpenAI.
// Лимит: 400 новых фраз и 40 000 знаков в сутки на сотрудника (из кэша — без счёта), админ — без
// лимита. Счёт — атомарно на сервере (этап 25: sa_tts_take); нет этапа 25 — живых голосов нет.
// Голоса меняются секретом RADIO_TTS_VOICES, например: host:nova,guest:onyx,staff:coral
// Деплой: Supabase → Edge Functions → Deploy a new function → Via Editor → имя radio-tts
// (или CLI: supabase functions deploy radio-tts).

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// Доп. 191: старые ключи — JWT (apikey + Bearer), новые sb_secret_… — только apikey
const isJwt = (k: string) => /^eyJ/.test(k || "");
const keyHeaders = (k: string): Record<string, string> => isJwt(k) ? { apikey: k, Authorization: "Bearer " + k } : { apikey: k };

const BUCKET = "radio-voice";
const MAX_TEXT = 900;
const VOICE_DEFAULT: Record<string, string> = { host: "nova", guest: "onyx", staff: "coral" };
// манера — подсказка модели (gpt-4o-mini-tts понимает instructions; tts-1 их не знает — не шлём)
const MANNER: Record<string, string> = {
  host: "Тёплый спокойный ведущий утреннего радио. Говори по-русски, живо, без спешки.",
  guest: "Гость ресторана за столиком. Естественная разговорная речь по-русски, с лёгкой эмоцией.",
  staff: "Вежливый уверенный официант. Доброжелательно и чётко, по-русски.",
};
const MANNER_V = "m1";   // поменяли манеру — меняем версию, чтобы не брать старый кэш

function voices(): Record<string, string> {
  const out = { ...VOICE_DEFAULT };
  const raw = Deno.env.get("RADIO_TTS_VOICES") || "";
  raw.split(",").forEach((pair) => {
    const [k, v] = pair.split(":").map((s) => s.trim());
    if (k && v && k in out && /^[a-z]{2,20}$/.test(v)) out[k] = v;
  });
  return out;
}

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "method" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anon = Deno.env.get("SUPABASE_ANON_KEY");
    if (!url || !service) return json({ ok: false, error: "no_env" }, 500);

    const body = await req.json().catch(() => null);
    const token = String(body?.token || "");
    if (!token) return json({ ok: false, error: "bad_request" }, 400);

    // Кто это: только живая сессия сотрудника
    const who = await fetch(`${url}/rest/v1/rpc/whoami`, {
      method: "POST",
      headers: { ...keyHeaders(anon || service), "Content-Type": "application/json" },
      body: JSON.stringify({ p_token: token }),
    }).then((r) => r.json()).catch(() => null);
    const emp = who && who.ok ? who.employee || {} : null;
    if (!emp) return json({ ok: false, error: "auth" }, 401);

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (body?.probe) {
      // живые голоса есть, когда задан ключ и есть корзина этапа 25
      let bucket = false;
      if (apiKey) {
        const b = await fetch(`${url}/storage/v1/bucket/${BUCKET}`, { headers: keyHeaders(service) }).catch(() => null);
        bucket = !!(b && b.ok);
      }
      return json({ ok: true, configured: !!apiKey && bucket });
    }
    if (!apiKey) return json({ ok: false, error: "not_configured" });

    const whoKey = ["host", "guest", "staff"].includes(String(body?.who)) ? String(body.who) : "host";
    const text = String(body?.text || "").replace(/\s+/g, " ").trim().slice(0, MAX_TEXT);
    if (!text) return json({ ok: false, error: "bad_request" }, 400);

    const model = Deno.env.get("OPENAI_TTS_MODEL") || "gpt-4o-mini-tts";
    const voice = voices()[whoKey];
    const withManner = !/^tts-1/.test(model);
    const hash = await sha256([model, voice, withManner ? MANNER_V + ":" + whoKey : "-", text].join("|"));
    const path = `v1/${voice}/${hash.slice(0, 2)}/${hash}.mp3`;
    const pub = `${url}/storage/v1/object/public/${BUCKET}/${path}`;

    // уже озвучено — отдаём ссылку сразу, без счёта
    const head = await fetch(pub, { method: "HEAD" }).catch(() => null);
    if (head && head.ok) return json({ ok: true, url: pub, cached: true });

    // суточный лимит новых фраз — атомарно на сервере; нет этапа 25 или ответа — не озвучиваем
    const take = await fetch(`${url}/rest/v1/rpc/sa_tts_take`, {
      method: "POST",
      headers: { ...keyHeaders(service), "Content-Type": "application/json" },
      body: JSON.stringify({ p_token: token, p_chars: text.length }),
    }).then(async (r) => ({ status: r.status, j: await r.json().catch(() => null) })).catch(() => null);
    if (!take) return json({ ok: false, error: "server" }, 502);
    if (take.status === 404 || (take.j && (take.j.code === "PGRST202" || take.j.code === "42883"))) return json({ ok: false, error: "not_configured", detail: "нужен этап 25 (sa_tts_take)" });
    if (!take.j || take.j.ok !== true) return json({ ok: false, error: (take.j && take.j.error) || "server", limit: take.j && take.j.limit });

    const payload: Record<string, unknown> = { model, voice, input: text, response_format: "mp3" };
    if (withManner) payload.instructions = MANNER[whoKey];
    const tts = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { Authorization: "Bearer " + apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!tts.ok) {
      const t = await tts.text().catch(() => "");
      console.error("radio-tts openai", tts.status, t.slice(0, 200));
      if (tts.status === 401) return json({ ok: false, error: "provider", detail: "OpenAI не принял ключ (401) — проверь секрет OPENAI_API_KEY" }, 502);
      if (tts.status === 429) return json({ ok: false, error: "rate_limit" }, 502);
      return json({ ok: false, error: "provider", status: tts.status }, 502);
    }
    const bytes = new Uint8Array(await tts.arrayBuffer());
    if (!bytes.length) return json({ ok: false, error: "provider", detail: "пустой ответ" }, 502);

    const up = await fetch(`${url}/storage/v1/object/${BUCKET}/${path}`, {
      method: "POST",
      headers: { ...keyHeaders(service), "Content-Type": "audio/mpeg", "x-upsert": "true", "cache-control": "public, max-age=31536000" },
      body: bytes,
    });
    if (!up.ok) {
      const t = await up.text().catch(() => "");
      console.error("radio-tts storage", up.status, t.slice(0, 300));
      // корзины нет (этап 25 не запущен) — отдаём звук прямо в ответе, без кэша
      const b64 = btoa(Array.from(bytes, (c) => String.fromCharCode(c)).join(""));
      return json({ ok: true, url: "data:audio/mpeg;base64," + b64, cached: false, nocache: true });
    }
    return json({ ok: true, url: pub, cached: false });
  } catch (e) {
    console.error("radio-tts", e);
    return json({ ok: false, error: "server", detail: String((e as any)?.message || e) }, 500);
  }
});
