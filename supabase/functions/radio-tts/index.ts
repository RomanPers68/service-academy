// Service Academy — radio-tts: «живые голоса» для «Радио в дорогу» (v31) и разговора голосом (v34).
//
// POST { token, probe: true }                 → { ok, configured, talk, provider, transient? } — есть ли голоса
//                                                (без озвучки; transient — хранилище не ответило, спросить позже)
// POST { token, text, who }                   → { ok, url, cached }   — фраза радио: ссылка на mp3 (кэш в Storage)
// POST { token, text, who, talk: true }       → { ok, audio }         — v34: реплика разговора голосом —
//                                                mp3 прямо в ответе (data:audio/mpeg;base64,…), без кэша
//
// Кто озвучивает (v34):
//   • OpenRouter — секрет OPENROUTER_API_KEY (тот же, что у ai-chat и stt; добавлять ничего не нужно).
//     Модель — секрет OPENROUTER_TTS_MODEL, по умолчанию openai/gpt-4o-mini-tts-2025-12-15
//     (v36: короткий id без даты OpenRouter не принимает — убран; задан свой секрет — он первым,
//     эта модель — запасной).
// v36: ошибка — с причиной (detail): что ответил OpenRouter / OpenAI или счётчик голосов. Приложение
//     показывает её в скобках в строке «Живой голос не ответил (…)», а полный текст — в Logs функции.
//   • OpenAI напрямую — если задан секрет OPENAI_API_KEY (модель OPENAI_TTS_MODEL, по умолчанию
//     gpt-4o-mini-tts). Есть оба ключа — OpenAI; выбрать явно: секрет TTS_PROVIDER = openrouter | openai.
// Ключей нет — { ok:false, error:"not_configured" }: приложение молча читает голосом телефона, как раньше.
//
// Кэш радио: каждая фраза озвучивается один раз — mp3 кладём в публичную корзину radio-voice (создаёт
// этап 25) под именем по sha256(модель|голос|манера|текст). Повтор того же выпуска — без запроса.
// Реплики разговора не кэшируются (каждый раз новые).
// Лимит: 400 новых фраз и 40 000 знаков в сутки на сотрудника — радио и разговор вместе (из кэша —
// без счёта), админ — без лимита. Счёт — атомарно на сервере (этап 25: sa_tts_take); нет этапа 25 —
// живых голосов нет.
// Голоса (who): host — ведущий радио, guest / guest_f — гость / гостья, staff — официант, mentor —
// Наставник. Поменять — секрет RADIO_TTS_VOICES, например: host:nova,guest:onyx,guest_f:shimmer,mentor:sage
// Деплой: Supabase → Edge Functions → radio-tts → вставить код → Deploy
// (новая функция: Deploy a new function → Via Editor → имя radio-tts; или CLI: supabase functions deploy radio-tts).

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
const WHO = ["host", "guest", "staff", "guest_f", "mentor"];
const VOICE_DEFAULT: Record<string, string> = { host: "nova", guest: "onyx", staff: "coral", guest_f: "shimmer", mentor: "sage" };
// манера — подсказка модели (gpt-4o-mini-tts понимает instructions; tts-1 их не знает — не шлём)
const MANNER: Record<string, string> = {
  host: "Тёплый спокойный ведущий утреннего радио. Говори по-русски, живо, без спешки.",
  guest: "Гость ресторана за столиком. Естественная разговорная речь по-русски, с лёгкой эмоцией.",
  guest_f: "Гостья ресторана за столиком. Естественная разговорная речь по-русски, с лёгкой эмоцией.",
  staff: "Вежливый уверенный официант. Доброжелательно и чётко, по-русски.",
  mentor: "Опытный наставник ресторана. Спокойно, доброжелательно и по делу, по-русски, без спешки.",
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

function b64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

type Engine = { provider: "openai" | "openrouter"; key: string; models: string[] };

// v34: кто озвучивает — OpenAI напрямую или OpenRouter (тем же ключом, что ai-chat и stt)
function engine(): Engine | null {
  const openai = Deno.env.get("OPENAI_API_KEY") || "";
  const or = Deno.env.get("OPENROUTER_API_KEY") || "";
  const want = (Deno.env.get("TTS_PROVIDER") || "").toLowerCase();
  if (openai && want !== "openrouter") return { provider: "openai", key: openai, models: [Deno.env.get("OPENAI_TTS_MODEL") || "gpt-4o-mini-tts"] };
  if (or) {
    // v36: только полный id модели с датой — по документации OpenRouter короткий «openai/gpt-4o-mini-tts»
    // неверный; раньше он стоял запасным и своей ошибкой «модель не найдена» прятал настоящую причину
    const models = [Deno.env.get("OPENROUTER_TTS_MODEL"), "openai/gpt-4o-mini-tts-2025-12-15"]
      .filter((m, i, a): m is string => !!m && a.indexOf(m) === i);
    return { provider: "openrouter", key: or, models };
  }
  if (openai) return { provider: "openai", key: openai, models: [Deno.env.get("OPENAI_TTS_MODEL") || "gpt-4o-mini-tts"] };
  return null;
}
const withManner = (model: string) => !/(^|\/)tts-1/.test(model);
// v34 (ревью): звук ли это — по типу ответа или по началу файла (ID3 / кадр MP3); текст ошибки с
// «чужим» типом (text/plain) звуком не считаем
const looksMp3 = (b: Uint8Array) => b.length > 64 && ((b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0));

type Synth = { ok: true; bytes: Uint8Array; model: string } | { ok: false; status: number; error: string; detail?: string };

// v36: из ответа с ошибкой — само сообщение (OpenRouter и OpenAI кладут его в error.message)
const errText = (t: string) => {
  try { const j = JSON.parse(t); const m = j?.error?.message || j?.message || j?.error; if (m) return String(typeof m === "string" ? m : JSON.stringify(m)); } catch (_e) { /* не JSON */ }
  return t;
};

async function synth(eng: Engine, voice: string, whoKey: string, text: string): Promise<Synth> {
  // v36: причина — от ПЕРВОЙ модели (основной); запасная модель её не перезаписывает
  let first: Synth | null = null;
  const fail = (f: Synth) => { if (!first) first = f; };
  const who = eng.provider === "openai" ? "OpenAI" : "OpenRouter";
  for (const model of eng.models) {
    const payload: Record<string, unknown> = { model, voice, input: text, response_format: "mp3" };
    if (withManner(model)) payload.instructions = MANNER[whoKey];
    const url = eng.provider === "openai" ? "https://api.openai.com/v1/audio/speech" : "https://openrouter.ai/api/v1/audio/speech";
    const headers: Record<string, string> = { Authorization: "Bearer " + eng.key, "Content-Type": "application/json" };
    if (eng.provider === "openrouter") { headers["HTTP-Referer"] = "https://service-academy-16te.vercel.app"; headers["X-Title"] = "Service Academy TTS"; }
    let r: Response;
    try { r = await fetch(url, { method: "POST", headers, body: JSON.stringify(payload) }); }
    catch (e) { fail({ ok: false, status: 502, error: "provider", detail: `${who}: сеть — ` + String((e as any)?.message || e).slice(0, 80) }); continue; }
    const ct = (r.headers.get("content-type") || "").toLowerCase();
    if (r.ok && !/json|text\//.test(ct)) {
      const bytes = new Uint8Array(await r.arrayBuffer());
      if (bytes.length > 64 && (/audio|octet-stream|mpeg/.test(ct) || looksMp3(bytes))) return { ok: true, bytes, model };
      fail({ ok: false, status: 502, error: "provider", detail: model + (bytes.length > 64 ? ": ответ не похож на звук (" + (ct || "без типа") + ")" : ": пустой ответ") });
      continue;
    }
    const t = await r.text().catch(() => "");
    console.error("radio-tts", eng.provider, model, r.status, t.slice(0, 300));
    const sec = eng.provider === "openai" ? "OPENAI_API_KEY" : "OPENROUTER_API_KEY";
    // ключ не принят / кредиты кончились — другая модель не поможет
    if (r.status === 401) return { ok: false, status: 502, error: "provider", detail: `${who} не принял ключ (401) — проверь секрет ${sec}` };
    if (r.status === 402) return { ok: false, status: 502, error: "provider", detail: `${who}: закончились кредиты (402)` };
    if (r.status === 429) return { ok: false, status: 502, error: "rate_limit" };
    fail({ ok: false, status: 502, error: "provider", detail: `${who} ${r.status}: ` + errText(t).replace(/\s+/g, " ").slice(0, 140) });
  }
  return first || { ok: false, status: 502, error: "provider", detail: "нет модели озвучки" };
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
    if (!emp) return json({ ok: false, error: "auth", detail: "вход не подтвердился — перезайди в приложение" }, 401);

    const eng = engine();
    if (body?.probe) {
      // радио: нужен ключ и корзина этапа 25; разговор голосом — только ключ
      let bucket = false, transient = false;
      if (eng) {
        const b = await fetch(`${url}/storage/v1/bucket/${BUCKET}`, { headers: keyHeaders(service) }).catch(() => null);
        bucket = !!(b && b.ok);
        // v36 (ревью): «корзины нет» — только ясный ответ хранилища (400/404); сбой связи или сервера —
        // transient: приложение не запомнит «живых голосов нет» до перезапуска, спросит снова
        transient = !bucket && !(b && (b.status === 404 || b.status === 400));
        if (transient) console.error("radio-tts probe: storage", b ? b.status : "network");
      }
      return json({ ok: true, configured: !!eng && bucket, talk: !!eng, provider: eng ? eng.provider : null, ...(transient ? { transient: true } : {}) });
    }
    if (!eng) return json({ ok: false, error: "not_configured" });

    const talk = !!body?.talk;
    const whoKey = WHO.includes(String(body?.who)) ? String(body.who) : (talk ? "mentor" : "host");
    const text = String(body?.text || "").replace(/\s+/g, " ").trim().slice(0, MAX_TEXT);
    if (!text) return json({ ok: false, error: "bad_request" }, 400);

    const voice = voices()[whoKey];
    let pub = "", path = "";
    if (!talk) {
      const model = eng.models[0];
      const hash = await sha256([model, voice, withManner(model) ? MANNER_V + ":" + whoKey : "-", text].join("|"));
      path = `v1/${voice}/${hash.slice(0, 2)}/${hash}.mp3`;
      pub = `${url}/storage/v1/object/public/${BUCKET}/${path}`;
      // уже озвучено — отдаём ссылку сразу, без счёта
      const head = await fetch(pub, { method: "HEAD" }).catch(() => null);
      if (head && head.ok) return json({ ok: true, url: pub, cached: true });
    }

    // суточный лимит — атомарно на сервере; нет этапа 25 или ответа — не озвучиваем
    const take = await fetch(`${url}/rest/v1/rpc/sa_tts_take`, {
      method: "POST",
      headers: { ...keyHeaders(service), "Content-Type": "application/json" },
      body: JSON.stringify({ p_token: token, p_chars: text.length }),
    }).then(async (r) => ({ status: r.status, j: await r.json().catch(() => null) })).catch(() => null);
    if (!take) return json({ ok: false, error: "server", detail: "счётчик голосов не ответил" }, 502);
    if (take.status === 404 || (take.j && (take.j.code === "PGRST202" || take.j.code === "42883"))) return json({ ok: false, error: "not_configured", detail: "нужен этап 25 (sa_tts_take)" });
    if (!take.j || take.j.ok !== true) {
      // v36: причина — в ответе (по ней видно, что чинить); лимит и вход — своими кодами, как раньше
      const code = (take.j && take.j.error) || "server";
      if (code === "server") console.error("radio-tts sa_tts_take", take.status, JSON.stringify(take.j).slice(0, 300));
      return json({ ok: false, error: code, limit: take.j && take.j.limit, detail: code === "server" ? "счётчик голосов: " + String((take.j && (take.j.message || take.j.code)) || "HTTP " + take.status).slice(0, 100) : undefined });
    }

    const s = await synth(eng, voice, whoKey, text);
    if (s.ok === false) return json({ ok: false, error: s.error, detail: s.detail }, s.status);

    // v34: реплика разговора — звук прямо в ответе
    if (talk) return json({ ok: true, audio: "data:audio/mpeg;base64," + b64(s.bytes), provider: eng.provider });

    const up = await fetch(`${url}/storage/v1/object/${BUCKET}/${path}`, {
      method: "POST",
      headers: { ...keyHeaders(service), "Content-Type": "audio/mpeg", "x-upsert": "true", "cache-control": "public, max-age=31536000" },
      body: s.bytes as unknown as BodyInit,
    });
    if (!up.ok) {
      const t = await up.text().catch(() => "");
      console.error("radio-tts storage", up.status, t.slice(0, 300));
      // корзины нет (этап 25 не запущен) — отдаём звук прямо в ответе, без кэша
      return json({ ok: true, url: "data:audio/mpeg;base64," + b64(s.bytes), cached: false, nocache: true });
    }
    return json({ ok: true, url: pub, cached: false });
  } catch (e) {
    console.error("radio-tts", e);
    return json({ ok: false, error: "server", detail: String((e as any)?.message || e) }, 500);
  }
});
