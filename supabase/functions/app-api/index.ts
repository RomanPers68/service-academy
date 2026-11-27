// @ts-nocheck
// supabase/functions/app-api/index.ts — СОБРАНО: node tools/claude/edge-build.mjs (руками не править).
// Источник — supabase/functions/app-api/entry.js и всё, что он подключает:
//   api/_auth.js
//   api/_web.js
//   api/lesson-assist.js
//   api/web-answer.js
//   api/wine-import.js
//   lib/concept-pitch.js
//   lib/dish-desc.js
//   lib/lesson-cards.js
//   lib/lesson-look.js
//   lib/ref-ai.js
//   supabase/functions/app-api/entry.js
//   supabase/functions/app-api/shim.js
// sources-sha256: 3fc1c67fd1846ed08ee04e63ad5873cea91292a10a2db3a388f6c0905e60e0af
// supabase/functions/app-api/shim.js
import { Buffer as Buffer2 } from "node:buffer";
var g = globalThis;
if (!g.process) g.process = { env: {} };
if (!g.process.env) g.process.env = {};
try {
  const all = g.Deno && g.Deno.env && typeof g.Deno.env.toObject === "function" ? g.Deno.env.toObject() : {};
  for (const [k, v] of Object.entries(all)) if (g.process.env[k] === void 0) g.process.env[k] = v;
} catch (e) {
}
if (!g.Buffer) g.Buffer = Buffer2;

// api/_auth.js
var SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://gvxhgdynjuaisswplroh.supabase.co";
var SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2eGhnZHluanVhaXNzd3Bscm9oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4NjA1ODgsImV4cCI6MjA5NjQzNjU4OH0._4aLd4eb7cSfcqS9EvSwChJR-SixW2tsgn4ksCM5S3g";
async function verifySession(token) {
  if (!token || typeof token !== "string" || token.length > 200) return null;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/whoami`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: "Bearer " + SUPABASE_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ p_token: token })
    });
    if (!r.ok) return null;
    const d = await r.json();
    return d && d.ok ? d.employee || {} : null;
  } catch (e) {
    return null;
  }
}
var _buckets = /* @__PURE__ */ new Map();
function rateLimit(key2, limit, windowMs) {
  const now = Date.now();
  if (_buckets.size > 500) {
    for (const [k, b2] of _buckets) if (now - b2.start > windowMs) _buckets.delete(k);
  }
  const b = _buckets.get(key2);
  if (!b || now - b.start > windowMs) {
    _buckets.set(key2, { start: now, n: 1 });
    return true;
  }
  if (b.n >= limit) return false;
  b.n += 1;
  return true;
}

// api/_web.js
var WEB_MAX_SEARCHES = 3;
var WEB_MAX_CHARS = 2e3;
var webEngine = () => process.env.OPENROUTER_WEB_ENGINE || "exa";
var webTool = (maxResults = 5, maxChars = WEB_MAX_CHARS, maxUses = WEB_MAX_SEARCHES) => ({
  type: "openrouter:web_search",
  parameters: { engine: webEngine(), max_results: maxResults, max_characters: maxChars, max_uses: maxUses }
});
var orAsks = (model, base, maxResults = 5, maxSearches = WEB_MAX_SEARCHES) => [
  { via: "tool", body: { ...base, model, tools: [webTool(maxResults, WEB_MAX_CHARS, maxSearches)], max_tool_calls: maxSearches } },
  { via: "tool-plain", body: { ...base, model, tools: [{ type: "openrouter:web_search" }] } },
  { via: "plugin", body: { ...base, model, plugins: [{ id: "web", max_results: maxResults }] } }
];
var logWeb = (m) => {
  try {
    console.error("[web-search] " + m);
  } catch (e) {
  }
};
var s = (v, n) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, n);
var okUrl = (u) => /^https?:\/\/[^\s"'<>]+$/i.test(String(u || "")) && String(u).length <= 400;
function sourcesOf(list2, max = 6) {
  const out = [], seen = /* @__PURE__ */ new Set();
  for (const x of Array.isArray(list2) ? list2 : []) {
    const url = typeof x === "string" ? x.trim() : x && typeof x === "object" ? String(x.url || x.u || "").trim() : "";
    if (!okUrl(url)) continue;
    const key2 = url.replace(/[#?].*$/, "").replace(/\/+$/, "").toLowerCase();
    if (seen.has(key2)) continue;
    seen.add(key2);
    out.push({ url, title: s(x && typeof x === "object" ? x.title || x.t : "", 100) });
    if (out.length >= max) break;
  }
  return out;
}
function orCitations(data) {
  const msg = data && data.choices && data.choices[0] && data.choices[0].message;
  const ann = msg && Array.isArray(msg.annotations) ? msg.annotations : [];
  return sourcesOf(ann.filter((a) => a && (a.type === "url_citation" || a.url_citation)).map((a) => a.url_citation || a));
}
function anCitations(data) {
  const blocks = Array.isArray(data && data.content) ? data.content : [];
  const cited = [], found = [];
  for (const b of blocks) {
    if (b && b.type === "text" && Array.isArray(b.citations)) {
      for (const c of b.citations) if (c && c.url) cited.push({ url: c.url, title: c.title });
    }
    if (b && b.type === "web_search_tool_result" && Array.isArray(b.content)) {
      for (const r of b.content) if (r && r.url) found.push({ url: r.url, title: r.title });
    }
  }
  return sourcesOf(cited.length ? cited : found);
}
var orText = (data) => {
  const c = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  return typeof c === "string" ? c : Array.isArray(c) ? c.map((p) => p && p.text || "").join("") : "";
};
var orSearches = (data) => {
  const d = data && data.usage && data.usage.server_tool_use_details;
  return Number(d && d.web_search_requests) || 0;
};
async function webCall({ orKey, anKey, models = [], system = "", user = "", history = [], maxTokens = 1500, lim: lim2 = { each: 45e3, total: 5e4 }, maxResults = 5, maxSearches = WEB_MAX_SEARCHES }) {
  const msgs = [...system ? [{ role: "system", content: system }] : [], ...history.filter((m) => m && (m.role === "user" || m.role === "assistant") && m.content).map((m) => ({ role: m.role, content: s(m.content, 2e3) })), { role: "user", content: user }];
  const t0 = Date.now();
  if (orKey) {
    const headers = { Authorization: "Bearer " + orKey, "Content-Type": "application/json", "X-Title": "Service Academy web search" };
    if (process.env.VERCEL_URL) headers["HTTP-Referer"] = "https://" + process.env.VERCEL_URL;
    let lastErr = "ни одна модель не ответила", late = 0, tried = 0;
    const list2 = models.filter(Boolean), base = { max_tokens: maxTokens, temperature: 0.2, messages: msgs };
    for (let i = 0; i < list2.length; i++) {
      const asks = orAsks(list2[i], base, maxResults, maxSearches);
      for (let v = 0; v < asks.length; v++) {
        const left = lim2.total - (Date.now() - t0);
        if (left < 3e3) {
          i = list2.length;
          break;
        }
        const wait = i === list2.length - 1 ? left : Math.min(lim2.each, left);
        const ac = new AbortController(), timer = setTimeout(() => ac.abort(), wait);
        let r, data;
        tried++;
        try {
          r = await fetch("https://openrouter.ai/api/v1/chat/completions", { method: "POST", headers, signal: ac.signal, body: JSON.stringify(asks[v].body) });
          data = await r.json();
        } catch (e) {
          if (ac.signal.aborted) {
            late++;
            lastErr = list2[i] + ": не ответила за " + Math.round(wait / 1e3) + " с";
            logWeb(lastErr);
            break;
          }
          lastErr = list2[i] + ": " + (r ? "HTTP " + r.status + ", ответ не JSON" : "сеть — " + (e && e.message ? e.message : "unknown"));
          logWeb(lastErr);
          break;
        } finally {
          clearTimeout(timer);
        }
        const err = data && data.error || data && data.choices && data.choices[0] && data.choices[0].error;
        if (r.ok && !err) {
          const text = orText(data), fin = data && data.choices && data.choices[0] && data.choices[0].finish_reason;
          if (text.trim()) return { ok: true, text, sources: orCitations(data), model: data && data.model || list2[i], searches: orSearches(data), cut: fin === "length", via: asks[v].via };
          lastErr = list2[i] + ": пустой ответ" + (fin ? " (" + fin + ")" : "");
          logWeb(lastErr);
          break;
        }
        const status = r.status || err && err.code || 0;
        if (status === 401) return { ok: false, status: 502, error: "OpenRouter не принял ключ (401). Проверь OPENROUTER_API_KEY в Vercel → Settings → Environment Variables и сделай Redeploy." };
        if (status === 402) return { ok: false, status: 502, error: "На OpenRouter закончились кредиты (402): пополни баланс на openrouter.ai → Credits." };
        lastErr = list2[i] + " (" + asks[v].via + "): " + s(err && err.message || "HTTP " + status, 300) + (err && err.metadata && err.metadata.raw ? " — " + s(err.metadata.raw, 200) : "");
        logWeb(lastErr);
        if (!(status === 400 || status === 422)) break;
      }
    }
    if (late && late === tried) return { ok: false, status: 504, error: "AI не успел найти ответ: нажми ещё раз. Если повторится, подожди минуту" };
    return { ok: false, status: 502, error: "Ошибка OpenRouter: " + lastErr };
  }
  if (anKey) {
    const ac = new AbortController(), timer = setTimeout(() => ac.abort(), lim2.total);
    let r, data;
    try {
      r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        signal: ac.signal,
        headers: { "x-api-key": anKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: maxTokens,
          ...system ? { system } : {},
          messages: msgs.filter((m) => m.role !== "system"),
          tools: [{ type: "web_search_20250305", name: "web_search", max_uses: maxSearches }]
        })
      });
      data = await r.json();
    } catch (e) {
      if (ac.signal.aborted) return { ok: false, status: 504, error: "AI не успел найти ответ: нажми ещё раз. Если повторится, подожди минуту" };
      return { ok: false, status: 502, error: "Сеть до Anthropic: " + (e && e.message ? e.message : "unknown") };
    } finally {
      clearTimeout(timer);
    }
    if (!r.ok) return { ok: false, status: 502, error: data && data.error && data.error.message || "Ошибка Claude API" };
    const text = (data.content || []).filter((c) => c && c.type === "text").map((c) => c.text || "").join("");
    const searches = Number(data.usage && data.usage.server_tool_use && data.usage.server_tool_use.web_search_requests) || 0;
    return { ok: true, text, sources: anCitations(data), model: data.model || "claude-sonnet-4-6", searches, cut: data.stop_reason === "max_tokens" };
  }
  return { ok: false, status: 500, error: "OPENROUTER_API_KEY не задан: Vercel → Settings → Environment Variables → Add (после добавления нужен Redeploy)." };
}

// lib/dish-desc.js
var DESC_N = 5;
var DESC_ANGLES = [
  ["taste", "Вкус и текстура", "про вкус и текстуру: что гость почувствует"],
  ["origin", "Откуда блюдо", "откуда блюдо и как его готовят по традиции"],
  ["play", "Коротко и игриво", "одна короткая игривая фраза"],
  ["doubt", "Если гость сомневается", "для гостя, который сомневается: почему стоит взять"],
  ["star", "Главный ингредиент", "что особенного в главном ингредиенте"],
  ["craft", "Как готовим", "как готовим и подаём — только то, что следует из состава и пометок"],
  ["mood", "Под настроение", "к какому случаю, времени дня или сезону"],
  ["simple", "Простыми словами", "простыми словами для гостя, который блюдо не знает"],
  ["gourmet", "Для гурмана", "для гурмана: детали и оттенки вкуса"],
  ["fact", "Интересный факт", "интересный факт или маленькая история о блюде"]
];
var DESC_LABEL = Object.fromEntries(DESC_ANGLES.map(([k, l]) => [k, l]));
function descAngles(round = 0) {
  const n = DESC_ANGLES.length, r = Math.max(0, Math.floor(Number(round) || 0)), k = r * DESC_N % n;
  return [...DESC_ANGLES.slice(k), ...DESC_ANGLES.slice(0, k)].slice(0, DESC_N);
}
var s2 = (v, n) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, n);
var ingOf = (v) => (Array.isArray(v) ? v : String(v || "").split(",")).map((x) => s2(x, 60)).filter(Boolean).slice(0, 30);
var DESC_RULES = `1. Упоминай только ингредиенты из состава блюда и то, что в пометках ресторана. Ничего не добавляй: у гостя могут быть
   аллергии, а повар готовит по своей технологической карте.
2. Факты о происхождении, истории и технике — только те, в которых уверен. Не уверен — пиши о вкусе.
3. Без цен, скидок, граммовок и обещаний, которых нет в данных («домашняя», «фермерская», «мраморная» — только если это есть
   в составе или пометках).
4. По-русски, тёплым живым языком официанта, без пафоса и штампов («изысканный», «непревзойдённый», «гастрономическое
   путешествие»), без перечисления ингредиентов подряд. Каждое описание — 1–2 предложения.
5. Все варианты разные: по углу, по словам и по началу фразы. Уже показанные варианты не повторяй.`;
var DESC_SYSTEM = `Ты — автор меню и шеф-наставник ресторана: пишешь «вкусные описания» блюд, которые официант говорит гостю. У тебя
есть поиск в интернете: найди, откуда блюдо, как его готовят по традиции, чем особенны его ингредиенты, какими словами
описывают похожие блюда. Это для фактов и идей — текст пиши сам, фразы с сайтов не копируй; факты о блюде бери только те,
что подтверждают найденные страницы. Правила:
${DESC_RULES}`;
function descPrompt({ restaurant = "", dish = {}, seen = [], round = 0, web = false } = {}) {
  const d = dish || {}, ing = ingOf(d.ingredients), angles = descAngles(round);
  const prev = (Array.isArray(seen) ? seen : []).map((x) => s2(x, 300)).filter(Boolean).slice(-15);
  const head2 = web ? "" : "Напиши «вкусные описания» блюда для гостя: их говорит официант. Правила:\n" + DESC_RULES + "\n\n";
  return head2 + (restaurant ? "Ресторан: «" + s2(restaurant, 80) + "».\n" : "") + "Блюдо: «" + s2(d.name, 120) + "»" + (s2(d.cat, 60) ? " (раздел: " + s2(d.cat, 60) + ")" : "") + ".\nСостав: " + (ing.join(", ") || "не указан") + "." + (s2(d.note, 300) ? "\nПометки ресторана: " + s2(d.note, 300) + "." : "") + "\n\nНапиши " + angles.length + " вариантов, по одному на каждый угол:\n" + angles.map(([k, , hint], i) => i + 1 + ". " + (web ? k + " — " : "") + hint).join("\n") + (prev.length ? "\n\nУже показаны — не повторяй ни мысль, ни начало фразы:\n" + prev.map((x) => "— " + x).join("\n") : "") + (web ? '\n\nОтвет — только JSON-массив без пояснений: [{"angle": "' + angles[0][0] + '", "text": "…"}, …]; angle — ключ угла из списка выше.' : "\n\nФормат ответа строго: " + angles.length + " абзацев по порядку углов, каждый начинается с «1.», «2.» и так далее. Без кавычек, заголовков и пояснений.");
}
var key = (t) => String(t || "").toLowerCase().replace(/ё/g, "е").replace(/[^а-яa-z0-9]+/g, " ").trim();
var tidy = (t) => {
  const x = s2(String(t || "").replace(/\[\[[^\]]*\]\]/g, ""), 400).replace(/^[*•\s—-]+/, "").trim();
  return /^["“«]/.test(x) && /["”»]$/.test(x) && (x.match(/["“”«»]/g) || []).length === 2 ? x.slice(1, -1).trim() : x;
};
function descParse(text, round = 0, seen = []) {
  const keys = descAngles(round).map((a2) => a2[0]);
  const raw = String(text || "").replace(/```(json)?/gi, "").trim();
  let arr2 = null;
  const a = raw.indexOf("["), b = raw.lastIndexOf("]");
  if (a >= 0 && b > a) {
    try {
      arr2 = JSON.parse(raw.slice(a, b + 1));
    } catch (e) {
      arr2 = null;
    }
  }
  const plain = raw.replace(/\[\[[^\]]*\]\]/g, "");
  const numbered = [...plain.matchAll(/(?:^|\n)\s*([1-9])[.)]\s*([\s\S]*?)(?=\n\s*[1-9][.)]\s|$)/g)].map((m) => ({ angle: keys[Number(m[1]) - 1] || "", text: tidy(m[2]) }));
  const fromJson = Array.isArray(arr2) ? arr2.map((x, i) => x && typeof x === "object" ? { angle: keys.includes(x.angle) ? x.angle : keys[i] || "", text: tidy(x.text) } : { angle: keys[i] || "", text: tidy(x) }) : [];
  const list2 = fromJson.some((v) => v.text.length > 20) ? fromJson : numbered.length ? numbered : [{ angle: keys[0], text: tidy(plain) }];
  const old = new Set((Array.isArray(seen) ? seen : []).map(key).filter(Boolean)), out = [];
  for (const v of list2) {
    const k = key(v.text);
    if (v.text.length <= 20 || !k || old.has(k)) continue;
    old.add(k);
    out.push({ angle: v.angle, label: DESC_LABEL[v.angle] || "", text: v.text });
    if (out.length >= DESC_N) break;
  }
  return out;
}

// api/web-answer.js
import zlib from "node:zlib";
function unpack(b) {
  if (!b || typeof b !== "object") return {};
  try {
    if (typeof b.z === "string") return { ...JSON.parse(zlib.inflateRawSync(Buffer.from(b.z, "base64"), { maxOutputLength: 3e5 }).toString("utf8")), token: b.token };
    if (typeof b.p === "string") return { ...JSON.parse(Buffer.from(b.p, "base64").toString("utf8")), token: b.token };
  } catch (e) {
    return { token: b.token, bad: true };
  }
  return b;
}
var WEB_MODELS = () => [process.env.OPENROUTER_WEB_MODEL, "google/gemini-2.5-flash", "anthropic/claude-sonnet-4.6"].filter(Boolean);
var SYSTEM = `Ты — «Наставник» академии сервиса ресторанной группы: помогаешь официантам, барменам, хостес и менеджерам прямо
в смене. У тебя есть поиск в интернете. Правила:
1. Сначала — «Данные приложения», если они есть: карта ресторана, стандарты. Они верны, держись их.
2. Сюда приходят вопросы, где нужен интернет: попросили поискать или спрашивают о том, чего нет в данных приложения (марка,
   бутылка, производитель, продукт, рыба, сыр, специя, блюдо). Поищи в интернете хотя бы раз, даже если ответ кажется
   знакомым: сайт производителя, импортёра, винные, барные и кулинарные справочники. Без поиска — только если «Данные
   приложения» отвечают полностью. Вопрос короткий («а подробнее?», «найди в сети») — тема в прошлых репликах.
3. Пиши только то, что подтверждают данные приложения или найденные страницы. Не нашёл — так и скажи, без догадок.
4. Цены, наличие, скидки и правила ресторана называй только из данных приложения. Аллергены — только по карточкам блюд,
   иначе: «уточни у шефа».
5. По-русски, коротко и практично, как старший коллега в зале: 2–5 предложений. Без заголовков, таблиц и списка ссылок —
   ссылки приложение покажет само.`;
var s3 = (v, n) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, n);
function webPrompt({ question, context, check, chat }) {
  return (context ? "Данные приложения:\n" + String(context).slice(0, 4e3) + "\n\n" : "") + "Вопрос сотрудника: " + s3(question, 1200) + (check ? "\n\nПроверь в интернете ответ, который ты дал раньше, и поправь, если в нём ошибка: «" + s3(check, 1500) + "»." : "") + (chat ? "\n\n[Вопрос задан в общем чате смены, ответ увидит вся команда: коротко, 2–4 предложения, без списков.]" : "");
}
var lim = () => ({ each: Number(process.env.WEB_ANSWER_EACH_MS) || 4e4, total: Number(process.env.WEB_ANSWER_TOTAL_MS) || 5e4 });
async function desc(b, res, orKey, anKey) {
  const dish = b.dish && typeof b.dish === "object" ? b.dish : {};
  if (!s3(dish.name, 120)) return res.status(400).json({ ok: false, error: "server", message: "Нет названия блюда" });
  const emp = await verifySession(b.token);
  if (!emp) return res.status(401).json({ ok: false, error: "auth", message: "Сессия не найдена: войди в приложение заново" });
  if (!rateLimit("webdesc:" + b.token, 60, 36e5)) return res.status(429).json({ ok: false, error: "rate_limit", message: "Слишком много запросов подряд: попробуй через час" });
  const round = Math.max(0, Math.floor(Number(b.round) || 0)), seen = (Array.isArray(b.seen) ? b.seen : []).map((x) => s3(x, 300)).filter(Boolean).slice(-15);
  try {
    const out = await webCall({
      orKey,
      anKey,
      models: WEB_MODELS(),
      system: DESC_SYSTEM,
      user: descPrompt({ restaurant: s3(b.restaurant, 80), dish, seen, round, web: true }),
      maxTokens: 2500,
      lim: lim(),
      maxSearches: 2
    });
    if (!out.ok) return res.status(200).json({ ok: false, error: out.status === 504 ? "timeout" : "server", message: out.error });
    const variants = descParse(out.text, round, seen);
    if (!variants.length) return res.status(200).json({ ok: false, error: "server", message: "AI ответил не по формату" });
    return res.status(200).json({ ok: true, variants, sources: out.sources || [], searched: out.searches || 0, model: out.model });
  } catch (e) {
    return res.status(200).json({ ok: false, error: "server", message: "Сбой: " + (e && e.message ? e.message : "unknown") });
  }
}
async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "server", message: "Только POST" });
  const orKey = process.env.OPENROUTER_API_KEY, anKey = process.env.ANTHROPIC_API_KEY;
  if (!orKey && !anKey) return res.status(200).json({ ok: false, error: "not_configured", message: "OPENROUTER_API_KEY не задан в Vercel" });
  const b = unpack(req.body || {});
  if (b.bad) return res.status(400).json({ ok: false, error: "server", message: "Запрос не прочитан: обнови приложение" });
  if (b.mode === "desc") return desc(b, res, orKey, anKey);
  const question = s3(b.question, 1200);
  if (!question) return res.status(400).json({ ok: false, error: "server", message: "Пустой вопрос" });
  const emp = await verifySession(b.token);
  if (!emp) return res.status(401).json({ ok: false, error: "auth", message: "Сессия не найдена: войди в приложение заново" });
  if (!rateLimit("web:" + b.token, 20, 36e5)) return res.status(429).json({ ok: false, error: "rate_limit", message: "Слишком много поисков подряд: попробуй через час" });
  const history = (Array.isArray(b.history) ? b.history : []).slice(-6).map((m) => ({ role: m && m.role === "assistant" ? "assistant" : "user", content: s3(m && m.content, 1500) })).filter((m) => m.content);
  try {
    const out = await webCall({
      orKey,
      anKey,
      models: WEB_MODELS(),
      system: SYSTEM,
      user: webPrompt({ question, context: b.context, check: b.check, chat: b.chat === true }),
      history,
      maxTokens: 1800,
      lim: lim()
    });
    if (!out.ok) return res.status(200).json({ ok: false, error: out.status === 504 ? "timeout" : "server", message: out.error });
    const reply = String(out.text || "").trim();
    if (!reply) return res.status(200).json({ ok: false, error: "server", message: "AI ответил пусто" });
    return res.status(200).json({ ok: true, reply, sources: out.sources || [], searched: out.searches || 0, model: out.model });
  } catch (e) {
    return res.status(200).json({ ok: false, error: "server", message: "Сбой: " + (e && e.message ? e.message : "unknown") });
  }
}

// api/wine-import.js
var COLORS = ["sparkling", "white", "rose", "orange", "red", "dessert", "fortified"];
var GLASSES = ["универсальный", "бордо", "бургундия", "флюте", "тюльпан", "десертный"];
var SHAPE = `{
  "name": "название вина, как в карте",
  "producer": "производитель (хозяйство, дом)",
  "country": "страна по-русски",
  "region": "регион или апелласьон",
  "grapes": ["сорт винограда по-русски"],
  "color": "одно из: ${COLORS.join(" | ")}",
  "sweet": "сухое | полусухое | полусладкое | сладкое; у игристых: брют натюр | экстра брют | брют | экстра сухое | сухое | полусухое | сладкое",
  "vintage": "год урожая или пустая строка",
  "abv": "крепость, число, или пустая строка",
  "byGlass": true или false — есть ли подача бокалом,
  "priceGlass": "цена бокала числом или пустая строка",
  "priceBottle": "цена бутылки числом или пустая строка",
  "volume": "объём бутылки или бокала, как в карте",
  "temp": "температура подачи, например 8–10 °C",
  "glass": "одно из: ${GLASSES.join(" | ")}",
  "notes": ["3–5 коротких нот вкуса и аромата"],
  "short": "одна фраза для гостя, живо и без штампов, до 120 знаков",
  "story": "2–3 предложения о вине для официанта: стиль, чем интересно, как рассказать гостю"
}`;
var DOC_MAX = 12e4;
var DOC_HEAD = "Карта — текст из файла (Word или текст вместо фото и PDF; всё, что сказано про лист, относится к этому тексту):\n\n";
var SHEET_SHAPE = `{
  "name": "название вина, как в карте",
  "producer": "производитель",
  "country": "страна по-русски",
  "region": "регион или апелласьон",
  "grapes": ["сорт, если указан"],
  "color": "одно из: ${COLORS.join(" | ")}",
  "sweet": "сладость, если указана",
  "vintage": "год или пустая строка",
  "volume": "объём, как в карте",
  "byGlass": true или false,
  "priceGlass": "цена бокала числом или пустая строка",
  "priceBottle": "цена бутылки числом или пустая строка"
}`;
var RULES = `Пиши по-русски. Если не уверен в факте (производитель, регион, сорт, год) — оставь поле пустым, ничего не выдумывай.
Цены и год бери только с листа или из названия. Верни ТОЛЬКО валидный JSON без markdown и пояснений.`;
var PROMPTS = {
  fill: (name, facts = "") => `Ты — сомелье ресторанной академии. Помоги официанту с вином «${name}» из винной карты ресторана.${facts}
Верни один JSON-объект:
${SHAPE}
${RULES}`,
  names: (names) => `Ты — сомелье ресторанной академии. Ниже названия вин из винной карты ресторана, по одному в строке.
Для каждого верни объект — получится JSON-массив в том же порядке, поле "name" — как в строке:
${SHAPE}
${RULES}

Вина:
${names.join("\n")}`,
  label: `Ты — сомелье ресторанной академии. На фото — бутылка вина из погреба ресторана, снята телефоном.
Прочитай этикетку и верни один JSON-объект. С этикетки бери название, производителя, страну, регион или апелласьон, год,
сорт (если указан), крепость и объём; в "name" — как назвать вино в карте: название и производитель, без года.
Остальное (цвет, сладость, ноты, температура, бокал, фраза гостю, о вине) — из своих знаний, только если уверен.
Цены не заполняй, "byGlass" — false. Если на фото нет бутылки вина или этикетку не прочитать, верни {"name": ""}:
${SHAPE}
${RULES}`,
  sheet: (after) => `Ты — сомелье ресторанной академии. На листе — винная карта ресторана (фото страницы или PDF).
Перепиши все вина по порядку, как в карте, JSON-массивом объектов. Бери только то, что написано в карте; цвет — по разделу
карты или по названию. Ноты, описания и подачу не пиши: их добавят отдельно. Пиши компактно, без пробелов и переносов
между полями.
${SHEET_SHAPE}
${after ? "Начало карты уже прочитано: начни с вина, которое идёт сразу после «" + after + "», и продолжай до конца карты.\n" : ""}${RULES}`
};
var SP_CATS = ["whisky", "cognac", "rum", "gin", "agave", "vodka", "liqueur", "bitter", "other"];
var SP_GLASSES = ["тюльпан", "гленкерн", "снифтер", "рокс", "шот", "хайбол"];
var SP_SERVE = ["чистым", "со льдом", "с каплей воды", "охлаждённым", "в коктейле"];
var SP_SHAPE = `{
  "name": "название, как в карте (марка и выдержка, если она в названии)",
  "producer": "производитель: дом, дистиллерия или бренд",
  "cat": "одно из: ${SP_CATS.join(" | ")} (other: кальвадос, граппа, писко, абсент, саке)",
  "style": "стиль: односолодовый, купажированный, бурбон, VSOP, XO, London Dry, бланко, репосадо, тёмный ром и т. п.",
  "country": "страна по-русски",
  "region": "регион, если известен",
  "age": "выдержка, как принято писать: 12 лет, VSOP, XO; или пустая строка",
  "abv": "крепость, число",
  "portion": "порция в мл числом, если указана в карте (обычно 25, 40 или 50), или пустая строка",
  "pricePortion": "цена порции числом или пустая строка",
  "priceBottle": "цена бутылки числом или пустая строка",
  "volume": "объём бутылки, как в карте",
  "serve": ["как подают: ${SP_SERVE.join(" | ")}"],
  "glass": "одно из: ${SP_GLASSES.join(" | ")}",
  "temp": "температура подачи словами, например: комнатная, охлаждённым",
  "notes": ["3–5 коротких нот вкуса и аромата"],
  "short": "одна фраза для гостя, живо и без штампов, до 120 знаков",
  "story": "2–3 предложения для официанта: что это, чем интересно, как рассказать гостю"
}`;
var SP_SHEET_SHAPE = `{
  "name": "название, как в карте",
  "producer": "производитель, если указан",
  "cat": "одно из: ${SP_CATS.join(" | ")}",
  "style": "стиль, если указан",
  "country": "страна, если указана",
  "age": "выдержка, если указана",
  "portion": "порция в мл числом, если указана",
  "pricePortion": "цена порции числом или пустая строка",
  "priceBottle": "цена бутылки числом или пустая строка",
  "volume": "объём бутылки, как в карте"
}`;
var SP_RULES = `Пиши по-русски, названия марок оставляй как в карте. Если не уверен в факте (производитель, страна, выдержка) — оставь поле
пустым, ничего не выдумывай. Цены, порцию и выдержку бери только с листа, из названия или с этикетки. Верни ТОЛЬКО валидный JSON без
markdown и пояснений.`;
var SP_PROMPTS = {
  fill: (name, facts = "") => `Ты — бармен ресторанной академии. Помоги официанту с крепким напитком «${name}» из барной карты ресторана.${facts}
Верни один JSON-объект:
${SP_SHAPE}
${SP_RULES}`,
  names: (names) => `Ты — бармен ресторанной академии. Ниже крепкие напитки из барной карты ресторана, по одному в строке.
Для каждого верни объект — получится JSON-массив в том же порядке, поле "name" — как в строке:
${SP_SHAPE}
${SP_RULES}

Напитки:
${names.join("\n")}`,
  label: `Ты — бармен ресторанной академии. На фото — бутылка крепкого напитка из бара ресторана, снята телефоном.
Прочитай этикетку и верни один JSON-объект. С этикетки бери название, производителя, страну, регион, выдержку, крепость и объём;
в "name" — как назвать напиток в карте: марка и выдержка. Остальное (вид, стиль, подача, бокал, ноты, фраза гостю) — из своих
знаний, только если уверен. Цены и порцию не заполняй. Если на фото нет бутылки или этикетку не прочитать, верни {"name": ""}:
${SP_SHAPE}
${SP_RULES}`,
  sheet: (after) => `Ты — бармен ресторанной академии. На листе — барная карта ресторана (фото страницы или PDF).
Перепиши по порядку все крепкие напитки (виски, коньяк и бренди, ром, джин, текила и мескаль, водка, ликёры, биттеры,
кальвадос, граппа и прочее) JSON-массивом объектов. Вина, пиво, коктейли и безалкогольное не бери. Бери только то, что написано
в карте; вид — по разделу карты или по названию. Ноты, описания и подачу не пиши: их добавят отдельно. Пиши компактно, без
пробелов и переносов между полями.
${SP_SHEET_SHAPE}
${after ? "Начало карты уже прочитано: начни с напитка, который идёт сразу после «" + after + "», и продолжай до конца карты.\n" : ""}${SP_RULES}`
};
var FILL_KEYS = ["producer", "country", "region", "grapes", "color", "sweet", "vintage", "abv", "volume", "temp", "glass", "notes", "short", "story"];
var SP_FILL_KEYS = ["producer", "cat", "style", "country", "region", "age", "abv", "volume", "serve", "glass", "temp", "notes", "short", "story"];
function knownFacts(known, keys) {
  const k = known && typeof known === "object" && !Array.isArray(known) ? known : {}, out = {};
  for (const f of keys) {
    const v = k[f], t = Array.isArray(v) ? v.map((x) => str(x, 40)).filter(Boolean).slice(0, 6).join(", ") : str(v, 120);
    if (t) out[f] = t;
  }
  return out;
}
function factsText(known, keys) {
  if (!Object.keys(known).length) return "";
  const rest = keys.filter((f) => !known[f]);
  return "\nУже вписано в карточку (это верно, держись этого и не меняй): " + JSON.stringify(known) + "." + (rest.length ? "\nЗаполни только недостающее: " + rest.join(", ") + ". Вписанные поля в ответе оставь пустыми." : "");
}
var SLOW = "AI не успел ответить: нажми ещё раз. Если повторится, подожди минуту";
var quickLim = () => ({ each: Number(process.env.WINE_AI_EACH_MS) || 3e4, total: Number(process.env.WINE_AI_TOTAL_MS) || 5e4 });
var gapLim = () => ({ each: Number(process.env.WINE_AI_GAPS_EACH_MS) || 45e3, total: Number(process.env.WINE_AI_GAPS_TOTAL_MS) || 5e4 });
var GAP_SKIP = ["vintage", "volume", "byGlass", "priceGlass", "priceBottle", "portion", "pricePortion"];
var GAP_MAX = 6;
var GAP_WEB_MAX = 2;
var GAP_WEB_SEARCHES = 2;
var gapWebLim = () => ({ each: Number(process.env.WINE_AI_WEB_EACH_MS) || 48e3, total: Number(process.env.WINE_AI_WEB_TOTAL_MS) || 54e3 });
function gapItems(raw, sp, max = GAP_MAX) {
  const keys = sp ? SP_FILL_KEYS : FILL_KEYS, ask2 = keys.filter((f) => !GAP_SKIP.includes(f));
  return (Array.isArray(raw) ? raw : []).slice(0, max).map((x) => ({
    name: str(x && x.name, 120),
    known: knownFacts(x && x.known, keys),
    missing: (Array.isArray(x && x.missing) ? x.missing : []).filter((f, i, a) => ask2.includes(f) && a.indexOf(f) === i)
  }));
}
function gapsPrompt(items, sp, web = false) {
  const rows = items.map((x, i) => x.name && x.missing.length ? i + ". «" + x.name + "»" + (Object.keys(x.known).length ? " — вписано: " + JSON.stringify(x.known) : "") + "; не хватает: " + x.missing.join(", ") : "").filter(Boolean);
  return `Ты — ${sp ? "бармен" : "сомелье"} ресторанной академии. Ниже ${sp ? "крепкие напитки из барной карты ресторана" : "вина из винной карты ресторана"}: номер,
название, что уже вписано в карточку и каких полей не хватает. Вписанное — верно: по нему пойми, о какой позиции речь, держись его и не
повторяй. Для каждой позиции верни объект: "i" — номер, "name" — название, как в строке, и только недостающие поля из её списка,
по образцу:
${sp ? SP_SHAPE : SHAPE}
${sp ? SP_RULES : RULES}
Год урожая, объём, цены${sp ? " и порцию" : " и подачу бокалом"} не пиши. Позицию не узнаёшь — верни для неё только "i" и "name".${web ? `
Своих знаний о них не хватило: найди каждую в интернете — сайт производителя, импортёра или дистрибьютора, винные и барные
справочники. Пиши только то, что подтверждает найденная страница; не нашёл — оставь поле пустым, ничего не додумывай. В поле
"src" — до 3 адресов страниц, откуда взял (массив строк).` : ""}
Ответ — JSON-массив в том же порядке.

${sp ? "Напитки" : "Вина"}:
${rows.join("\n")}`;
}
var hasV = (v) => Array.isArray(v) ? v.length > 0 : v !== "" && v != null && v !== false;
var nameKey = (x) => String(x || "").toLowerCase().replace(/[^a-zа-яё0-9]+/gi, " ").trim();
function gapsPick(got, items, sp, opts = {}) {
  const byName = /* @__PURE__ */ new Map();
  items.forEach((x, i) => {
    const k = nameKey(x.name);
    if (k && !byName.has(k)) byName.set(k, i);
  });
  const ok = (i) => Number.isInteger(i) && i >= 0 && i < items.length && !!items[i].name && items[i].missing.length > 0;
  const seen = /* @__PURE__ */ new Set(), out = [];
  (Array.isArray(got) ? got : []).forEach((g2, j) => {
    if (!g2 || typeof g2 !== "object") return;
    const hasI = !(g2.i === "" || g2.i == null);
    let i = hasI ? Number(g2.i) : NaN;
    if (!ok(i) || seen.has(i)) {
      const k = nameKey(g2.name);
      i = k && byName.has(k) ? byName.get(k) : hasI ? NaN : j;
    }
    if (!ok(i) || seen.has(i)) return;
    seen.add(i);
    const c = (sp ? cleanSpirit : clean)({ ...g2, name: items[i].name }), w = { i, name: items[i].name };
    for (const f of items[i].missing) if (hasV(c[f])) w[f] = c[f];
    if (opts.web) {
      const src = sourcesOf([...Array.isArray(g2.src) ? g2.src : [], ...items.length === 1 ? opts.cites || [] : []], 3);
      if (src.length) w.src = src;
    }
    out.push(w);
  });
  return out.sort((a, b) => a.i - b.i);
}
var OPENROUTER_MODELS = [process.env.OPENROUTER_WINE_MODEL, process.env.OPENROUTER_MENU_MODEL, "anthropic/claude-sonnet-4.6", "google/gemini-2.5-flash"].filter(Boolean);
function parse(text) {
  const clean2 = String(text || "").replace(/```json|```/g, "").trim();
  const tryJ = (x) => {
    try {
      return JSON.parse(x);
    } catch (e) {
      return void 0;
    }
  };
  let v = tryJ(clean2);
  if (v === void 0) {
    const a = clean2.indexOf("["), b = clean2.lastIndexOf("]");
    if (a >= 0 && b > a) v = tryJ(clean2.slice(a, b + 1));
  }
  if (v === void 0) {
    const a = clean2.indexOf("{"), b = clean2.lastIndexOf("}");
    if (a >= 0 && b > a) v = tryJ(clean2.slice(a, b + 1));
  }
  if (v && !Array.isArray(v) && Array.isArray(v.wines)) v = v.wines;
  if (v && !Array.isArray(v) && typeof v === "object") v = [v];
  return Array.isArray(v) ? v : null;
}
function parseLoose(text) {
  const t = String(text || ""), out = [];
  let i = t.indexOf("[");
  if (i < 0) return out;
  let depth = 0, start = -1, inStr = false, esc = false;
  for (i = i + 1; i < t.length; i++) {
    const ch = t[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') {
      inStr = true;
      continue;
    }
    if (ch === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0 && start >= 0) {
        try {
          const o = JSON.parse(t.slice(start, i + 1));
          if (o && typeof o === "object") out.push(o);
        } catch (e) {
        }
        start = -1;
      }
      if (depth < 0) depth = 0;
    } else if (ch === "]" && depth === 0) break;
  }
  return out;
}
var str = (v, n) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, n);
var arr = (v, n, each) => (Array.isArray(v) ? v : String(v || "").split(/[,;]/)).map((x) => str(x, each)).filter(Boolean).slice(0, n);
var money = (v) => {
  const x = Number(String(v == null ? "" : v).replace(",", ".").replace(/[^\d.]/g, ""));
  return isFinite(x) && x > 0 && x < 1e7 ? Math.round(x) : "";
};
function clean(w) {
  return {
    name: str(w.name, 120),
    producer: str(w.producer, 80),
    country: str(w.country, 40),
    region: str(w.region, 80),
    grapes: arr(w.grapes, 6, 40),
    color: COLORS.includes(w.color) ? w.color : "",
    sweet: str(w.sweet, 24),
    vintage: str(w.vintage, 12),
    abv: money(w.abv) && money(w.abv) < 80 ? Number(String(w.abv).replace(",", ".").replace(/[^\d.]/g, "")) : "",
    byGlass: w.byGlass === true,
    priceGlass: money(w.priceGlass),
    priceBottle: money(w.priceBottle),
    volume: str(w.volume, 12),
    temp: str(w.temp, 24),
    glass: GLASSES.includes(w.glass) ? w.glass : "",
    notes: arr(w.notes, 6, 32),
    short: str(w.short, 200),
    story: str(w.story, 900)
  };
}
function cleanSpirit(w) {
  const abv = money(w.abv) && money(w.abv) < 100 ? Number(String(w.abv).replace(",", ".").replace(/[^\d.]/g, "")) : "";
  const portion = money(w.portion) && money(w.portion) <= 500 ? money(w.portion) : "";
  return {
    name: str(w.name, 120),
    producer: str(w.producer, 80),
    cat: SP_CATS.includes(w.cat) ? w.cat : str(w.cat, 24),
    style: str(w.style, 40),
    country: str(w.country, 40),
    region: str(w.region, 80),
    age: str(w.age, 24),
    abv,
    portion,
    pricePortion: money(w.pricePortion),
    priceBottle: money(w.priceBottle),
    volume: str(w.volume, 12),
    serve: arr(w.serve, 4, 24).filter((x) => SP_SERVE.includes(x)),
    glass: SP_GLASSES.includes(w.glass) ? w.glass : "",
    temp: str(w.temp, 32),
    notes: arr(w.notes, 6, 32),
    short: str(w.short, 200),
    story: str(w.story, 900)
  };
}
var orText2 = (data) => {
  const c = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  return typeof c === "string" ? c : Array.isArray(c) ? c.map((p) => p && p.text || "").join("") : "";
};
async function viaOpenRouter(key2, parts, maxTokens = 8e3, lim2 = null) {
  const headers = { Authorization: "Bearer " + key2, "Content-Type": "application/json", "X-Title": "Service Academy wine import" };
  if (process.env.VERCEL_URL) headers["HTTP-Referer"] = "https://" + process.env.VERCEL_URL;
  const content = parts.map((p) => p.text != null ? { type: "text", text: p.text } : p.pdf ? { type: "file", file: { filename: "wine.pdf", file_data: "data:application/pdf;base64," + p.pdf } } : { type: "image_url", image_url: { url: "data:" + p.mime + ";base64," + p.image } });
  let lastErr = "ни одна модель не ответила", tried = 0, late = 0;
  const t0 = Date.now();
  for (let i = 0; i < OPENROUTER_MODELS.length; i++) {
    const model = OPENROUTER_MODELS[i];
    let r, data, wait = 0;
    if (lim2) {
      const left = lim2.total - (Date.now() - t0);
      if (left < Math.min(3e3, lim2.total / 10)) break;
      wait = i === OPENROUTER_MODELS.length - 1 ? left : Math.min(lim2.each, left);
    }
    const ac = wait ? new AbortController() : null, timer = ac ? setTimeout(() => ac.abort(), wait) : null;
    tried++;
    try {
      r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers,
        signal: ac ? ac.signal : void 0,
        body: JSON.stringify({ model, max_tokens: maxTokens, temperature: 0.2, messages: [{ role: "user", content }] })
      });
      data = await r.json();
    } catch (e) {
      if (ac && ac.signal.aborted) {
        late++;
        lastErr = model + ": не ответила за " + Math.round(wait / 1e3) + " с";
        continue;
      }
      lastErr = model + ": сеть — " + (e && e.message ? e.message : "unknown");
      continue;
    } finally {
      if (timer) clearTimeout(timer);
    }
    const err = data && data.error || data && data.choices && data.choices[0] && data.choices[0].error;
    if (r.ok && !err) {
      const text = orText2(data);
      const fin = data && data.choices && data.choices[0] && data.choices[0].finish_reason;
      if (text.trim()) return { ok: true, text, model: data && data.model || model, cut: fin === "length" };
      lastErr = model + ": пустой ответ";
      continue;
    }
    const status = r.status || err && err.code || 0;
    if (status === 401) return { ok: false, status: 502, error: "OpenRouter не принял ключ (401). Проверь OPENROUTER_API_KEY в Vercel → Settings → Environment Variables и сделай Redeploy." };
    if (status === 402) return { ok: false, status: 502, error: "На OpenRouter закончились кредиты (402): пополни баланс на openrouter.ai → Credits." };
    lastErr = model + ": " + (err && err.message || "HTTP " + status);
  }
  if (late && late === tried) return { ok: false, status: 504, error: SLOW };
  return { ok: false, status: 502, error: "Ошибка OpenRouter: " + lastErr };
}
async function viaAnthropic(key2, parts, maxTokens = 8e3, lim2 = null) {
  const content = parts.map((p) => p.text != null ? { type: "text", text: p.text } : p.pdf ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: p.pdf } } : { type: "image", source: { type: "base64", media_type: p.mime, data: p.image } });
  let r, data;
  const ac = lim2 ? new AbortController() : null, timer = ac ? setTimeout(() => ac.abort(), lim2.total) : null;
  try {
    r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: ac ? ac.signal : void 0,
      headers: { "x-api-key": key2, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: maxTokens, messages: [{ role: "user", content }] })
    });
    data = await r.json();
  } catch (e) {
    if (ac && ac.signal.aborted) return { ok: false, status: 504, error: SLOW };
    return { ok: false, status: 502, error: "Сеть до Anthropic: " + (e && e.message ? e.message : "unknown") };
  } finally {
    if (timer) clearTimeout(timer);
  }
  if (!r.ok) return { ok: false, status: 502, error: data && data.error && data.error.message || "Ошибка Claude API" };
  return { ok: true, text: (data.content || []).map((c) => c.text || "").join(""), model: data.model || "claude-sonnet-4-6", cut: data.stop_reason === "max_tokens" };
}
async function handler2(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Только POST" });
  if (req.body && req.body.via === "web-answer") return handler(req, res);
  const orKey = process.env.OPENROUTER_API_KEY, anKey = process.env.ANTHROPIC_API_KEY;
  if (!orKey && !anKey) return res.status(500).json({ error: "OPENROUTER_API_KEY не задан: Vercel → Settings → Environment Variables → Add (после добавления нужен Redeploy)." });
  const b = req.body || {};
  const emp = await verifySession(b.token);
  if (!emp) return res.status(401).json({ error: "Сессия не найдена: войди в приложение заново и повтори" });
  if (!rateLimit("wine:" + b.token, 200, 36e5)) return res.status(429).json({ error: "Слишком много запросов подряд: попробуй через час" });
  if (b.mode === "taste") {
    const spT = b.kind === "spirit";
    const items = (Array.isArray(b.items) ? b.items : []).slice(0, 25).map((x) => ({
      name: str(x && x.name, 120),
      producer: str(x && x.producer, 80),
      country: str(x && x.country, 40),
      region: str(x && x.region, 80),
      grapes: (Array.isArray(x && x.grapes) ? x.grapes : []).map((g2) => str(g2, 40)).filter(Boolean).slice(0, 6),
      color: str(x && x.color, 20),
      sweet: str(x && x.sweet, 24),
      cat: str(x && x.cat, 20),
      style: str(x && x.style, 40),
      age: str(x && x.age, 24),
      abv: str(x && x.abv, 8)
    })).filter((x) => x.name);
    if (!items.length) return res.status(400).json({ error: "Нет позиций" });
    const keys = spT ? ["body", "sweet", "smoke", "oak", "spice"] : ["body", "acid", "tannin", "sweet", "oak"];
    const axes = spT ? "body (тело), sweet (сладость), smoke (дым и торф), oak (дуб), spice (пряность)" : "body (тело), acid (кислотность), tannin (танины), sweet (сладость), oak (дуб)";
    const text = "Ты сомелье. Для каждой позиции " + (spT ? "крепкого" : "вина") + " оцени вкус по шкалам от 1 до 5: " + axes + '. Опирайся на то, что знаешь о самом вине, производителе, сорте и регионе; не знаешь — оцени по стилю. Ответ — только JSON-массив без пояснений: [{"i": номер, ' + keys.map((k) => '"' + k + '": 1-5').join(", ") + "}]. Позиции:\n" + items.map((x, i) => i + ". " + JSON.stringify(x)).join("\n");
    try {
      const out = orKey ? await viaOpenRouter(orKey, [{ text }], 3e3) : await viaAnthropic(anKey, [{ text }], 3e3);
      if (!out.ok) return res.status(out.status || 502).json({ error: out.error });
      const got = parse(out.text) || parseLoose(out.text) || [];
      const lv = (v) => {
        const n = Math.round(Number(v));
        return n >= 1 && n <= 5 ? n : 0;
      };
      const tastes = (Array.isArray(got) ? got : []).filter((t) => t && Number.isInteger(Number(t.i)) && Number(t.i) >= 0 && Number(t.i) < items.length).map((t) => Object.assign({ i: Number(t.i) }, ...keys.map((k) => ({ [k]: lv(t[k]) })))).filter((t) => keys.some((k) => t[k]));
      return res.status(200).json({ tastes, model: out.model });
    } catch (e) {
      return res.status(500).json({ error: "Сбой: " + (e && e.message ? e.message : "unknown") });
    }
  }
  let parts;
  const sp = b.kind === "spirit", P = sp ? SP_PROMPTS : PROMPTS;
  if (b.mode === "gaps") {
    const web = b.web === true;
    const items = gapItems(b.items, sp, web ? GAP_WEB_MAX : GAP_MAX);
    if (!items.some((x) => x.name && x.missing.length)) return res.status(400).json({ error: "Нечего дописывать" });
    try {
      const text = gapsPrompt(items, sp, web);
      const out = web ? await webCall({ orKey, anKey, models: OPENROUTER_MODELS, user: text, maxTokens: 4e3, lim: gapWebLim(), maxResults: 5, maxSearches: GAP_WEB_SEARCHES }) : orKey ? await viaOpenRouter(orKey, [{ text }], 6e3, gapLim()) : await viaAnthropic(anKey, [{ text }], 6e3, gapLim());
      if (!out.ok) return res.status(out.status || 502).json({ error: out.error });
      let got = out.cut ? null : parse(out.text);
      if (!got) {
        const loose = parseLoose(out.text);
        if (loose.length || /^\s*(```(json)?)?\s*\[\s*\]/.test(String(out.text || ""))) got = loose;
        else return res.status(422).json({ error: "Модель ответила не списком: «" + String(out.text || "").replace(/\s+/g, " ").trim().slice(0, 140) + "…». Нажми ещё раз" });
      }
      return res.status(200).json({ wines: gapsPick(got, items, sp, { web, cites: out.sources }), model: out.model, ...web ? { searches: out.searches || 0 } : {} });
    } catch (e) {
      return res.status(500).json({ error: "Сбой: " + (e && e.message ? e.message : "unknown") });
    }
  }
  if (b.mode === "fill") {
    const name = str(b.name, 120);
    if (!name) return res.status(400).json({ error: "Нет названия" });
    const keys = sp ? SP_FILL_KEYS : FILL_KEYS;
    parts = [{ text: P.fill(name, factsText(knownFacts(b.known, keys), keys)) }];
  } else if (b.mode === "names") {
    const names = (Array.isArray(b.names) ? b.names : []).map((x) => str(x, 120)).filter(Boolean).slice(0, 15);
    if (!names.length) return res.status(400).json({ error: "Нет названий" });
    parts = [{ text: P.names(names) }];
  } else if (b.mode === "photo") {
    const image = String(b.imageBase64 || "").replace(/^data:[^;]*;base64,/, "");
    const mime = /^image\/(jpeg|png|webp)$/.test(b.mime) ? b.mime : "image/jpeg";
    if (!image) return res.status(400).json({ error: "Снимок не получен" });
    parts = [{ text: P.sheet(str(b.after, 120)) }, { image, mime }];
  } else if (b.mode === "label") {
    const image = String(b.imageBase64 || "").replace(/^data:[^;]*;base64,/, "");
    const mime = /^image\/(jpeg|png|webp)$/.test(b.mime) ? b.mime : "image/jpeg";
    if (!image) return res.status(400).json({ error: "Снимок не получен" });
    parts = [{ text: P.label }, { image, mime }];
  } else if (b.mode === "pdf") {
    const pdf = String(b.pdfBase64 || "").replace(/^data:[^;]*;base64,/, "");
    if (!pdf) return res.status(400).json({ error: "Файл не получен" });
    parts = [{ text: P.sheet(str(b.after, 120)) }, { pdf }];
  } else if (b.mode === "doc") {
    const text = typeof b.text === "string" ? b.text.trim() : "";
    if (!text) return res.status(400).json({ error: "Файл не получен" });
    if (text.length > DOC_MAX) return res.status(413).json({ error: "Текст карты слишком длинный: раздели файл на части" });
    parts = [{ text: P.sheet(str(b.after, 120)) }, { text: DOC_HEAD + text }];
  } else return res.status(400).json({ error: "Неизвестный режим" });
  try {
    const sheet = b.mode === "photo" || b.mode === "pdf" || b.mode === "doc";
    const max = sheet ? 16e3 : 8e3;
    const lim2 = b.mode === "fill" || b.mode === "label" ? quickLim() : null;
    const out = orKey ? await viaOpenRouter(orKey, parts, max, lim2) : await viaAnthropic(anKey, parts, max, lim2);
    if (!out.ok) return res.status(out.status || 502).json({ error: out.error });
    let got = out.cut ? null : parse(out.text), cut4 = !!out.cut;
    if (!got) {
      const loose = parseLoose(out.text);
      if (loose.length) {
        got = loose;
        cut4 = cut4 || !/\]\s*(```)?\s*$/.test(String(out.text).trim());
      }
    }
    if (!got) return res.status(422).json({ error: "Модель ответила не списком: «" + String(out.text || "").replace(/\s+/g, " ").trim().slice(0, 140) + "…». Попробуй ещё раз или «Фото страницы» по одной" });
    let wines = got.filter((w) => w && typeof w === "object").map(sp ? cleanSpirit : clean).filter((w) => w.name).slice(0, 120);
    if (b.mode === "label") wines = wines.slice(0, 1).map((w) => sp ? { ...w, portion: "", pricePortion: "", priceBottle: "" } : { ...w, byGlass: false, priceGlass: "", priceBottle: "" });
    if (!wines.length && b.mode === "fill" && Object.keys(knownFacts(b.known, sp ? SP_FILL_KEYS : FILL_KEYS)).length) return res.status(200).json({ wines: [], nothing: true, model: out.model });
    if (!wines.length) return res.status(422).json({ error: b.mode === "fill" ? sp ? "Модель не узнала этот напиток: заполни руками" : "Модель не узнала это вино: заполни руками" : b.mode === "label" ? "Этикетку не прочитать: сними бутылку ближе, при свете, этикеткой к камере" : sp ? "На листе не нашлось ни одного крепкого напитка: проверь снимок и попробуй ещё раз" : "На листе не нашлось ни одного вина: проверь снимок и попробуй ещё раз" });
    return res.status(200).json({ wines, model: out.model, cut: sheet && cut4 });
  } catch (e) {
    return res.status(500).json({ error: "Сбой: " + (e && e.message ? e.message : "unknown") });
  }
}

// lib/concept-pitch.js
var PITCH_LIMITS = { said: 1500, ref: 1500, facts: 3e3, item: 200, items: 4, tip: 300, better: 900 };
var cut = (v, n) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, n);
var list = (v) => (Array.isArray(v) ? v : typeof v === "string" && v.trim() ? [v] : []).map((x) => cut(x, PITCH_LIMITS.item)).filter(Boolean).slice(0, PITCH_LIMITS.items);
function pitchClean(o) {
  if (!o || typeof o !== "object") return null;
  const good = list(o.good), missed = list(o.missed), tip = cut(o.tip, PITCH_LIMITS.tip), better = cut(o.better, PITCH_LIMITS.better);
  if (!good.length && !missed.length && !tip) return null;
  const sc = Math.round(Number(o.score));
  return { good, missed, tip, better, score: sc >= 1 && sc <= 5 ? sc : 0 };
}
function pitchPrompt({ where = "", ref = "", facts = "", said = "", secs = 0 } = {}) {
  return [
    `Ты наставник сотрудников ресторана${where ? " «" + cut(where, 80) + "»" : ""}. Сотрудник тренирует «Рассказ гостю за 30 секунд»: гость впервые у нас и спрашивает, что это за место, а сотрудник рассказывает своими словами${secs > 0 ? " (уложился в " + Math.round(secs) + " с)" : ""}.`,
    "Сравни его рассказ с образцом и фактами о ресторане. Говори на «ты», по-доброму и по делу, без канцелярита и громких слов.",
    "good — что получилось: 1–3 коротких пункта, что именно он сказал хорошо;",
    "missed — что важное из образца и фактов не прозвучало или прозвучало неверно: 0–4 коротких пункта, неверные факты первыми;",
    "tip — один совет на следующий раз, одно-два предложения;",
    "better — как мог бы звучать его рассказ: его же мысли плюс упущенное, 3–5 предложений от «мы», на 25–30 секунд речи;",
    "score — от 1 до 5: насколько рассказ готов для гостя.",
    "Не выдумывай фактов, цен, блюд и имён, которых нет в образце и фактах.",
    'Ответ — строго JSON без пояснений и без ```: {"good": ["…"], "missed": ["…"], "tip": "…", "better": "…", "score": 4}',
    "\nОБРАЗЕЦ:\n" + cut(ref, PITCH_LIMITS.ref),
    facts ? "\nФАКТЫ О РЕСТОРАНЕ:\n" + String(facts).slice(0, PITCH_LIMITS.facts) : "",
    "\nРАССКАЗ СОТРУДНИКА:\n" + cut(said, PITCH_LIMITS.said)
  ].filter(Boolean).join("\n");
}

// lib/lesson-look.js
var KEYCAPS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣"];
var MARKS = /^(✅|❌|🚫|☑️?|📌|🔹|🌟|🟢|🟡|🟠|🔴|🔵|[1-9]️?⃣)/u;
var EMOJI_ONLY = /^[\p{Extended_Pictographic}\s️‍]+$/u;
var PARA_MAX = 420;
var isHead = (t) => t.length > 4 && t.startsWith("**") && t.endsWith("**") && !t.slice(2, -2).includes("**");
var isItem = (t) => t.startsWith("• ") || MARKS.test(t) || /^\d{1,2}[.)]\s/.test(t);
var family = (t) => t.startsWith("• ") ? "dot" : /^(✅|❌|🚫)/u.test(t) ? "do" : /^☑/u.test(t) ? "check" : t.startsWith("📌") ? "pin" : /^([1-9]\uFE0F?\u20E3|\d{1,2}[.)]\s)/u.test(t) ? "num" : /^(🟢|🟡|🟠|🔴|🔵)/u.test(t) ? "level" : "mark";
var isDivider = (t) => EMOJI_ONLY.test(t) && t.length <= 12;
var kindOf = (t) => !t ? "blank" : isHead(t) ? "head" : isItem(t) ? "item" : t.startsWith("«") ? "quote" : isDivider(t) || t.startsWith("[mm:") ? "div" : "para";
var head = (s4) => {
  const t = String(s4).replace(/\*\*|__/g, "").replace(/\s+/g, " ").trim().replace(/[.;,]$/, "");
  return t ? "**" + t + "**" : "";
};
function inline(t) {
  let s4 = t.replace(/__([^_\n]+?)__/g, "**$1**").replace(/(^|[^*])\*(?!\s)([^*\n]+?)(?<!\s)\*(?!\*)/g, "$1$2").replace(/(^|[\s(«"])_(?!\s)([^_\n]+?)(?<!\s)_(?=$|[\s).,!?:;»"])/g, "$1$2").replace(/\[([^\]\n]+)\]\((?:https?:\/\/|mailto:)[^)\s]+\)/g, "$1").replace(/(\S) - (?=\S)/g, "$1 — ").replace(/\.\.\.(?!\.)/g, "…");
  s4 = s4.replace(/(^|[\s(—:])"([^"\n]{1,120}?)"(?=$|[\s).,!?:;—])/g, "$1«$2»").replace(/“([^”\n]{1,120})”/g, "«$1»").replace(/„([^“\n]{1,120})“/g, "«$1»");
  return s4;
}
var WORD = /[A-Za-zА-Яа-яЁё0-9]+/g;
function casingOf(lines) {
  const map = /* @__PURE__ */ new Map();
  for (const l of lines) {
    if (!/[a-zа-яё]/.test(l)) continue;
    let m;
    WORD.lastIndex = 0;
    while (m = WORD.exec(l)) {
      const w = m[0], before = l.slice(0, m.index).replace(/[\s«"(*•—–-]+$/, "");
      if (!before || /[.!?:…]$/.test(before)) continue;
      const k = w.toLowerCase();
      if (!map.has(k)) map.set(k, w);
    }
  }
  return map;
}
function sentenceCase(t, casing) {
  const low = t.replace(WORD, (w) => {
    const k = w.toLowerCase();
    if (casing.has(k)) return casing.get(k);
    if (/^[A-Z]+$/.test(w)) return w.length <= 3 ? w : w[0] + k.slice(1);
    if (/^[А-ЯЁ]{2,}$/.test(w) && !/[АЕЁИОУЫЭЮЯ]/.test(w)) return w;
    return k;
  });
  return low.replace(/^([^a-zа-яё]*)([a-zа-яё])/i, (m, a, b) => a + b.toUpperCase());
}
var isCaps = (t) => t.length >= 3 && t.length <= 64 && /[А-ЯЁA-Z]{2}/.test(t) && !/[a-zа-яё]/.test(t) && !/[.!?]$/.test(t) && !/^\d+$/.test(t);
function splitLong(t) {
  if (t.length <= PARA_MAX) return [t];
  const cuts = [];
  const re = /[.!?…»)](?=\s+[«"(А-ЯЁA-Z0-9])/gu;
  let m;
  while (m = re.exec(t)) cuts.push(m.index + 1);
  if (!cuts.length) return [t];
  const mid = t.length / 2;
  const at = cuts.reduce((a, b) => Math.abs(b - mid) < Math.abs(a - mid) ? b : a);
  if (at < 80 || t.length - at < 80) return [t];
  return [...splitLong(t.slice(0, at).trim()), ...splitLong(t.slice(at).trim())];
}
function lessonize(text) {
  if (typeof text !== "string" || !text.trim()) return "";
  const raw = text.replace(/\r\n?/g, "\n").replace(/\t/g, " ").replace(/[​⁠﻿]/g, "").replace(/ /g, " ").split("\n").map((l) => l.replace(/\s+$/, ""));
  const casing = casingOf(raw);
  let out = [];
  for (let i = 0; i < raw.length; i++) {
    let t = raw[i].trim();
    if (!t) {
      out.push("");
      continue;
    }
    if (/^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?$/.test(t)) continue;
    if (/^\|.*\|$/.test(t)) {
      const cells = t.slice(1, -1).split("|").map((x) => inline(x.trim())).filter(Boolean);
      const sep = /^\|?\s*:?-{2,}/.test((raw[i + 1] || "").trim());
      if (sep) {
        const pv = out.filter(Boolean).slice(-1)[0] || "";
        if (cells.length && !isHead(pv)) out.push(head(cells.map((c, k) => k ? c.charAt(0).toLowerCase() + c.slice(1) : c).join(" — ")));
        continue;
      }
      if (cells.length) out.push("• " + cells.join(" — "));
      continue;
    }
    let m;
    if (m = t.match(/^#{1,6}\s+(.+?)\s*#*$/)) {
      out.push(head(m[1]));
      continue;
    }
    if ((m = t.match(/^__([^_].*?)__:?$/)) || (m = t.match(/^\*\*([^*].*?)\*\*\s*:$/))) {
      out.push(head(m[1] + (t.endsWith(":") && !m[1].endsWith(":") ? ":" : "")));
      continue;
    }
    if (isHead(t)) {
      out.push(head(t.slice(2, -2)));
      continue;
    }
    if (m = t.match(/^[-*+·▪●◦‣⁃]\s+(.+)$/)) {
      out.push("• " + inline(m[1].trim()));
      continue;
    }
    if (m = t.match(/^•\s*(.+)$/)) {
      out.push("• " + inline(m[1].trim()));
      continue;
    }
    if (m = t.match(/^>\s*(.+)$/)) {
      const q = m[1].trim();
      out.push(q.startsWith("«") ? inline(q) : "«" + inline(q).replace(/^["“„«]|["”“»]$/g, "") + "»");
      continue;
    }
    if ((m = t.match(/^["“„](.+)["”“]$/)) && !m[1].includes('"')) {
      out.push("«" + inline(m[1].trim()) + "»");
      continue;
    }
    if (isCaps(t)) {
      out.push(head(sentenceCase(t.replace(/:$/, ""), casing) + (t.endsWith(":") ? ":" : "")));
      continue;
    }
    if ((m = t.match(/^(Важно|Главное|Запомни|Помни|Итог|Вывод|Совет)(\s*[:!—–-]\s*)(.+)$/u)) && !t.startsWith("📌")) {
      out.push("📌 " + inline(m[1] + (/^\s*[—–-]\s*$/.test(m[2]) ? " — " : m[2].trim() + " ") + m[3].trim()));
      continue;
    }
    out.push(inline(t));
  }
  for (let i = 0; i < out.length; i++) {
    let j = i;
    while (j < out.length && /^[—–]\s+\S/.test(out[j] || "")) j++;
    if (j - i >= 2) for (let k = i; k < j; k++) out[k] = "• " + out[k].replace(/^[—–]\s+/, "");
    if (j > i) i = j - 1;
  }
  const num = (t) => t.match(/^(\d{1,2})[.)]\s+(.+)$/);
  for (let i = 0; i < out.length; i++) {
    if (!num(out[i])) continue;
    const run = [];
    let j = i;
    while (j < out.length && (num(out[j]) || !out[j] && j + 1 < out.length && num(out[j + 1]))) {
      if (out[j]) run.push(j);
      j++;
    }
    const nums = run.map((k) => Number(num(out[k])[1]));
    if (run.length >= 2 && run.length <= 9 && nums.every((n, k) => n === nums[0] + k) && nums[0] === 1) {
      run.forEach((k, idx) => {
        out[k] = KEYCAPS[idx] + " " + num(out[k])[2].trim();
      });
      for (let k = run[0]; k <= run[run.length - 1]; k++) if (!out[k]) out[k] = null;
    }
    i = j - 1;
  }
  out = out.filter((l) => l !== null);
  for (let i = 0; i < out.length; i++) {
    const t = out[i];
    if (kindOf(t) !== "para" || !/^[А-ЯЁA-Z«"][^.!?;]{1,58}$/.test(t) || /[,—–]$/.test(t) || t.includes("**")) continue;
    let j = i + 1;
    while (j < out.length && !out[j]) j++;
    if (j < out.length && kindOf(out[j]) === "item") out[i] = head(t);
  }
  const glued = [];
  for (const t of out) {
    const prev = glued.length ? glued[glued.length - 1] : "";
    if (t && prev && kindOf(prev) === "para" && kindOf(t) === "para" && !/[.!?:;…»)]$/.test(prev) && /^[a-zа-яё(]/.test(t)) glued[glued.length - 1] = prev + " " + t;
    else glued.push(t);
  }
  const lines = [];
  for (const t0 of glued) {
    if (!t0) continue;
    const parts = kindOf(t0) === "para" ? splitLong(t0) : [t0];
    for (const t of parts) {
      const prev = lines.length ? lines[lines.length - 1] : null;
      if (prev !== null) {
        const a = kindOf(prev), b = kindOf(t);
        const tight = a === "head" || a === "item" && b === "item" && family(prev) === family(t) && family(t) !== "pin" || a === "para" && prev.endsWith(":") && (b === "item" || b === "quote") || a === "quote" && b === "quote";
        if (!tight) lines.push("");
      }
      lines.push(t);
    }
  }
  return lines.join("\n").trim();
}

// lib/ref-ai.js
var REF_AI_MODES = ["ref_chapter", "ref_improve", "ref_shorten", "ref_plan", "ref_part", "ref_check", "ref_amend"];
var REF_AI_LIMITS = {
  topic: 160,
  material: 3e4,
  text: 6e3,
  out: 2e4,
  min: 40,
  doc: 6e4,
  docMin: 200,
  parts: 8,
  about: 300,
  notes: 6,
  quote: 200,
  note: 400,
  fixes: 3e3
};
var REF_STYLE = /* @__PURE__ */ [
  "Стиль глав справочника приложения Service Academy (ресторан):",
  "— справочный тон: спокойно, точно и по делу, на «ты»; без воды и канцелярита; короткие абзацы;",
  "— подзаголовок — отдельной строкой целиком в **двойных звёздочках**;",
  "— список — каждая строка начинается с «• »; шаги по порядку — строки «1. », «2. », «3. »;",
  "— важное правило — отдельной строкой, начинается с «📌 »;",
  "— как правильно и как неправильно — строки, начинающиеся с «✅ » и «❌ »;",
  "— ключевое слово внутри строки можно выделить **двойными звёздочками**;",
  "— никаких других разметок (#, _, таблиц, HTML);",
  "— строки вида [img:…] и [photo:…] — это картинки: переноси их без изменений, каждую отдельной строкой, рядом с тем же текстом; новых не придумывай.",
  "Каждая фраза договорена до конца."
].join("\n");
var JSON_CONTENT = 'Ответ — строго JSON без пояснений и без ```: {"content": "…"} (переносы строк в content — \\n).';
var JSON_CHAPTER = 'Ответ — строго JSON без пояснений и без ```: {"title": "…", "content": "…"} (переносы строк в content — \\n).';
var REF_WEB_SYSTEM = "Ты помогаешь владельцу ресторанной группы вести справочник для сотрудников зала и бара. У тебя есть поиск в интернете: ищи на сайтах производителей, в профессиональных справочниках, у школ сервиса и сомелье, в текстах законов и норм. Пиши только то, что подтверждают найденные страницы или общепринятые правила ресторанного сервиса; не нашёл подтверждения, так и скажи, без догадок. Пиши по-русски. Ссылок, сносок и адресов сайтов в ответ не ставь: ссылки приложение покажет само.";
var WEB_TOPIC = "Найди и проверь в интернете факты по теме: температуры, сроки, пропорции, термины, нормы, классические правила. Хватит одного-трёх поисков. Не придумывай правил конкретного заведения, цен, имён и названий блюд; где в разных ресторанах принято по-разному, так и скажи.";
var WEB_NOTES = " Заметки владельца ниже учти обязательно: это правила его ресторана, они важнее найденного в интернете.";
var DOC = (material, hasPdf) => material ? "\nДОКУМЕНТ:\n" + material + (hasPdf ? "\n\nПродолжение документа — во вложенном PDF." : "") : "\nДОКУМЕНТ — во вложенном PDF.";
var REF_PROMPT = {
  // web (v169) — «Глава по теме» с поиском: факты ищутся в интернете, заметки владельца важнее найденного
  chapter: (topic, material, hasPdf, web = false) => [
    `Напиши одну главу справочника для сотрудников ресторана${topic ? ` на тему «${topic}»` : ""}.`,
    web ? WEB_TOPIC + (material ? WEB_NOTES : "") : material || hasPdf ? "Опирайся только на материал: правила, цифры, названия и порядок действий — как в нём. Ничего не придумывай и ничего важного не выбрасывай." : "Материала нет: пиши по общепринятым правилам ресторанного сервиса. Не придумывай правил конкретного заведения, цен, имён и названий блюд; где в разных ресторанах принято по-разному, так и скажи.",
    "Объём — 150–450 слов: в справочнике важны детали, но без воды. Название главы — коротко, 2–7 слов, без кавычек и точки.",
    REF_STYLE,
    JSON_CHAPTER,
    material ? (web ? "\nЗАМЕТКИ ВЛАДЕЛЬЦА:\n" : "\nМАТЕРИАЛ:\n") + material : hasPdf ? "\nМАТЕРИАЛ — во вложенном PDF." : ""
  ].filter(Boolean).join("\n"),
  // v169: большой документ → список глав; потом каждая глава пишется отдельным обращением (part)
  plan: (material, hasPdf) => [
    "Разложи документ на главы справочника для сотрудников ресторана: одна тема, одна глава.",
    "Глава — законченная тема, которую удобно прочитать за раз (в справочнике это 150–450 слов). Мелкие пункты об одном объединяй, большую тему дели на две-три главы.",
    `Обычно выходит от 2 до ${REF_AI_LIMITS.parts} глав; документ об одном — одна глава. Больше ${REF_AI_LIMITS.parts} не предлагай: бери самое нужное в работе.`,
    "Порядок глав — как в документе. Название — коротко, 2–7 слов, без кавычек, номера и точки.",
    "about — одна-две фразы: что именно из документа войдёт в главу (какие правила, шаги, цифры), так, чтобы главы не пересекались.",
    "Бери только то, что есть в документе. Вступление, реквизиты, подписи, оглавление и лист согласования — не главы.",
    'Ответ — строго JSON без пояснений и без ```: {"chapters": [{"title": "…", "about": "…"}]}',
    DOC(material, hasPdf)
  ].join("\n"),
  part: (title, about, others, material, hasPdf) => [
    `Напиши одну главу справочника для сотрудников ресторана: «${title}». Она пишется по документу ниже.`,
    about ? "Что входит в главу: " + about : "",
    others && others.length ? "Документ разложен на несколько глав. Остальные главы: " + others.map((t) => "«" + t + "»").join(", ") + ". Их содержание сюда не бери: только то, что относится к этой главе." : "",
    "Опирайся только на документ: правила, цифры, названия и порядок действий — как в нём. Ничего не придумывай и ничего важного по теме главы не выбрасывай.",
    "Объём — 150–450 слов: в справочнике важны детали, но без воды. Название оставь как дано.",
    REF_STYLE,
    JSON_CHAPTER,
    DOC(material, hasPdf)
  ].filter(Boolean).join("\n"),
  // v169: проверка фактов в интернете. Правила самого ресторана ассистент не оценивает: это решение владельца
  check: (text) => [
    "Проверь по интернету факты в тексте главы справочника для сотрудников ресторана.",
    "Что проверять: то, что можно сверить с источниками. Температуры и сроки, граммовки и пропорции классических рецептов, термины и названия, происхождение продуктов и напитков, нормы закона, этикета и безопасности.",
    "Что не проверять: порядок работы самого ресторана (кто что делает, когда и как у них принято), цены, внутренние стандарты, тон. Это решение владельца, с ним не спорь.",
    "Найди подтверждение спорным местам: хватит одного-трёх поисков. Замечание пиши только там, где текст расходится с надёжными источниками или сами источники расходятся. Расхождений нет — замечаний нет.",
    `Не больше ${REF_AI_LIMITS.notes} замечаний, самые важные первыми.`,
    'Ответ — строго JSON без пояснений и без ```: {"summary": "…", "notes": [{"quote": "…", "note": "…"}]}',
    "summary — одна-две фразы: что проверено и общий вывод. quote — слова из текста, о которых замечание: дословно и коротко, до 12 слов. note — что не так и как верно по источникам, одна-две фразы.",
    "\nТЕКСТ ГЛАВЫ:\n" + text
  ].join("\n"),
  amend: (text, fixes) => [
    "Поправь текст главы справочника по замечаниям проверки фактов.",
    "Меняй только то, чего касаются замечания. Остальной текст, его порядок, оформление и объём оставь как есть и ничего не добавляй от себя.",
    REF_STYLE,
    JSON_CONTENT,
    "\nЗАМЕЧАНИЯ:\n" + fixes,
    "\nТЕКСТ ГЛАВЫ:\n" + text
  ].join("\n"),
  improve: (text) => [
    "Улучши текст главы справочника: яснее, без ошибок и повторов; подзаголовки, списки и пометки — там, где они помогают читать.",
    "Смысл, факты, цифры и правила не меняй и ничего не добавляй от себя. Объём — примерно тот же.",
    REF_STYLE,
    JSON_CONTENT,
    "\nТЕКСТ ГЛАВЫ:\n" + text
  ].join("\n"),
  shorten: (text) => [
    "Сократи текст главы справочника примерно на треть: убери повторы, воду и очевидное.",
    "Все правила, цифры, шаги и предупреждения сохрани. Ничего не добавляй от себя.",
    REF_STYLE,
    JSON_CONTENT,
    "\nТЕКСТ ГЛАВЫ:\n" + text
  ].join("\n")
};
var refPrompt = (mode, topic, text, hasPdf, x = {}) => mode === "ref_chapter" ? REF_PROMPT.chapter(topic, text, hasPdf, !!(x && x.web)) : mode === "ref_plan" ? REF_PROMPT.plan(text, hasPdf) : mode === "ref_part" ? REF_PROMPT.part(topic, x && x.about || "", x && x.others || [], text, hasPdf) : mode === "ref_check" ? REF_PROMPT.check(text) : mode === "ref_amend" ? REF_PROMPT.amend(text, x && x.fixes || "") : mode === "ref_shorten" ? REF_PROMPT.shorten(text) : REF_PROMPT.improve(text);
function refAiCheck(mode, { topic = "", text = "", hasPdf = false, len = null, fixes = "" } = {}) {
  const n = len == null ? String(text || "").length : len;
  if (mode === "ref_chapter") {
    if (n > REF_AI_LIMITS.material) return "Текст слишком большой. Дай его частями, одна тема за раз.";
    if (!String(text || "").trim() && !hasPdf && String(topic || "").trim().length < 3) return "Напиши тему, вставь текст или прикрепи PDF.";
    return null;
  }
  if (mode === "ref_plan" || mode === "ref_part") {
    const has = String(text || "").trim().length;
    if (n > REF_AI_LIMITS.doc) return "Документ слишком большой. Дай его частями.";
    if (!has && !hasPdf) return "Вставь текст документа или прикрепи PDF.";
    if (mode === "ref_plan" && !hasPdf && has < REF_AI_LIMITS.docMin) return "Текста мало для нескольких глав. Одну главу ассистент соберёт в редакторе главы.";
    if (mode === "ref_part" && String(topic || "").trim().length < 3) return "У главы нет названия.";
    return null;
  }
  if (String(text || "").trim().length < REF_AI_LIMITS.min) return "Сначала нужен текст главы, хотя бы пара предложений.";
  if (n > REF_AI_LIMITS.text) return mode === "ref_check" ? "Текст длинный для одной проверки. Выдели часть, и ассистент проверит её." : "Текст длинный для одного раза. Выдели часть, и ассистент поправит её.";
  if (mode === "ref_amend" && !String(fixes || "").trim()) return "Отметь хотя бы одно замечание.";
  return null;
}
var REF_MARK_LINE = /^[ \t]*\[(?:img|photo):[^\n]*\][ \t]*$/;
var refMarkLines = (text) => String(text == null ? "" : text).split("\n").filter((l) => REF_MARK_LINE.test(l)).map((l) => l.trim());
function keepRefMarks(src, out) {
  const marks = refMarkLines(src), room = /* @__PURE__ */ new Map(), have = /* @__PURE__ */ new Map();
  for (const m of marks) room.set(m, (room.get(m) || 0) + 1);
  const lines = [];
  for (const l of String(out == null ? "" : out).replace(/\r/g, "").split("\n")) {
    if (!REF_MARK_LINE.test(l)) {
      lines.push(l);
      continue;
    }
    const k = l.trim(), n = have.get(k) || 0;
    if (n < (room.get(k) || 0)) {
      have.set(k, n + 1);
      lines.push(k);
    }
  }
  const back = [];
  for (const m of marks) {
    const n = have.get(m) || 0;
    if (n > 0) have.set(m, n - 1);
    else back.push(m);
  }
  let text = lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  if (back.length) text = (text ? text + "\n\n" : "") + back.join("\n");
  return { text, lost: back.length };
}
var cut2 = (s4, n) => String(s4 == null ? "" : s4).replace(/\r/g, "").slice(0, n);
var one = (s4, n) => String(s4 == null ? "" : s4).replace(/\s+/g, " ").trim().slice(0, n);
var bareTitle = (t) => cut2(t, REF_AI_LIMITS.topic).replace(/\s+/g, " ").trim().replace(/^[«"]+|[»".]+$/g, "").trim();
var REF_NEW_MODES = ["ref_chapter", "ref_part"];
function refNoLinks(text) {
  return String(text == null ? "" : text).split("\n").map((l) => REF_MARK_LINE.test(l) ? l : l.replace(/\[([^\]\n]+)\]\(https?:\/\/[^)\s]+\)/g, "$1").replace(/[ \t]*\((?:https?:\/\/[^)\s]+|\[\d{1,2}\])\)/g, "").replace(/[ \t]*(?:\[\d{1,2}\]|【[^】\n]*】)/g, "").replace(/[ \t]*https?:\/\/[^\s)»"]+/g, "").replace(/[ \t]+([.,;:!?])/g, "$1")).join("\n");
}
function refAiClean(mode, o, src = "", web = false) {
  if (!o || typeof o !== "object" || !REF_AI_MODES.includes(mode) || mode === "ref_plan" || mode === "ref_check" || typeof o.content !== "string") return null;
  const raw = cut2(web ? refNoLinks(o.content) : o.content, REF_AI_LIMITS.out).trim();
  if (!raw) return null;
  const fresh = REF_NEW_MODES.includes(mode);
  const kept = keepRefMarks(fresh ? "" : src, raw);
  if (!kept.text) return null;
  const out = { content: kept.text, lost: kept.lost };
  if (fresh) out.title = bareTitle(o.title);
  return out;
}
var tkey = (t) => String(t == null ? "" : t).toLowerCase().replace(/ё/g, "е").replace(/[^a-zа-я0-9]+/g, " ").trim();
function refPlanClean(o) {
  const list2 = o && typeof o === "object" ? Array.isArray(o) ? o : Array.isArray(o.chapters) ? o.chapters : null : null;
  if (!list2) return null;
  const seen = /* @__PURE__ */ new Set(), chapters = [];
  for (const c of list2) {
    const title = bareTitle(typeof c === "string" ? c : c && c.title).replace(/^(?:глава\s*\d+[.):]?\s+|\d+[.)]\s+)/i, "").trim();
    const k = tkey(title);
    if (title.length < 3 || !k || seen.has(k)) continue;
    seen.add(k);
    chapters.push({ title, about: one(c && typeof c === "object" ? c.about : "", REF_AI_LIMITS.about) });
    if (chapters.length >= REF_AI_LIMITS.parts) break;
  }
  return chapters.length ? { chapters } : null;
}
function refCheckClean(o) {
  if (!o || typeof o !== "object" || Array.isArray(o)) return null;
  const notes = [];
  for (const x of Array.isArray(o.notes) ? o.notes : []) {
    if (!x || typeof x !== "object") continue;
    const note = one(refNoLinks(x.note), REF_AI_LIMITS.note), quote = one(x.quote, REF_AI_LIMITS.quote).replace(/^[«"]+|[»"]+$/g, "").trim();
    if (!note) continue;
    notes.push({ quote, note });
    if (notes.length >= REF_AI_LIMITS.notes) break;
  }
  const summary = one(refNoLinks(o.summary), 300);
  return notes.length || summary ? { summary, notes } : null;
}

// api/lesson-assist.js
var MODELS = [process.env.OPENROUTER_LESSON_MODEL, "google/gemini-2.5-flash", "anthropic/claude-sonnet-4.6"].filter((m, i, a) => m && a.indexOf(m) === i);
var WEB_MODELS2 = () => [process.env.OPENROUTER_WEB_MODEL, "google/gemini-2.5-flash", "anthropic/claude-sonnet-4.6"].filter((m, i, a) => m && a.indexOf(m) === i);
var webLim = () => ({ each: Number(process.env.WEB_ANSWER_EACH_MS) || 4e4, total: Number(process.env.WEB_ANSWER_TOTAL_MS) || 5e4 });
var ROLE_RU = {
  seasonal: "новички-официанты в первые недели",
  core: "официанты",
  spg: "хостес (служба приёма гостей)",
  bar: "бармены",
  manager: "менеджеры зала",
  service_manager: "сервис-менеджеры"
};
var WHOLE = "Каждая фраза договорена до конца: не обрывай мысль на предлоге, союзе, «во время», «вместо» или «было где / чем» — «чтобы малышу было где устроиться», а не «чтобы малышу было где».";
var STYLE = [
  "Стиль уроков приложения Service Academy:",
  // v210: без названия заведения
  "— на «ты», живо и по делу, без канцелярита и воды; короткие абзацы;",
  "— подзаголовок — отдельной строкой целиком в **двойных звёздочках**;",
  "— список — каждая строка начинается с «• »;",
  "— точная фраза гостю — отдельной строкой в «ёлочках»;",
  "— хорошо/плохо — строки, начинающиеся с «✅ » и «❌ »;",
  "— никаких других разметок (#, _, таблиц, HTML).",
  "Не выдумывай фактов, цен, блюд, имён и правил, которых нет в исходном материале.",
  WHOLE
].join("\n");
var CN_MODES = ["concept", "concept_plan", "concept_block", "concept_style"];
var CONCEPT_KINDS = {
  idea: "Концепция и история",
  values: "Ценности",
  structure: "Структура: кто за что отвечает",
  guest: "Наш гость",
  kitchen: "Кухня и бар",
  mood: "Атмосфера",
  pitch: "Рассказ гостю за 30 секунд",
  dress: "Внешний вид и дресс-код",
  setting: "Сервировка залов",
  check: "Правильный чек: к чему стремимся",
  day: "Распорядок дня менеджера",
  numbers: "Цифры смены: на что смотрим",
  own: "Свой блок"
};
var LOOK = [
  "Вид — как у уроков приложения (экран урока рисует эти строки по-своему):",
  "— первая строка — главная мысль одним-двумя предложениями (30–170 знаков), без подзаголовка перед ней: экран покажет её крупно;",
  "— дальше 2–4 части: подзаголовок отдельной строкой в **двойных звёздочках** (можно с двоеточием внутри: **Что важно:**), под ним 1–3 коротких абзаца по 1–3 предложения или список;",
  "— части и абзацы разделяй пустой строкой (в JSON — \\n\\n): по пустым строкам урок делится на карточки;",
  "— список — строки с «• »; что проверить или сделать — «☑ »; принципы и ценности — «🔹 »; шаги по порядку — 1️⃣ 2️⃣ 3️⃣ (до девяти);",
  "— как правильно — строки с «✅ », так нельзя — «🚫 »;",
  "— главный вывод — строка с «📌 » в конце (одна, самое большее две на блок);",
  "— точная фраза гостю — отдельной строкой в «ёлочках»;",
  "— **жирным** — только ключевые слова внутри строки, не целые предложения;",
  "— других значков, #, _, таблиц и HTML нет."
].join("\n");
var VOICE = [
  "Пишешь сотрудникам ресторанов на «ты», живо и по делу, без канцелярита, воды и громких слов.",
  "Не выдумывай фактов, цен, блюд, имён, цифр и правил, которых нет в материале.",
  WHOLE
].join("\n");
var CONCEPT_LOOK = {
  idea: "кто мы, с чего начинали и чем отличаемся; в конце — «📌 » суть одной фразой",
  values: "каждая ценность — строкой «🔹 Ценность — как это видно в работе»",
  structure: "кто за что отвечает — строки «• Должность (имя, если есть в материале) — за что отвечает, с каким вопросом идти»",
  guest: "кто к нам приходит и за чем; кому что посоветовать",
  kitchen: "что готовим и наливаем, наше фирменное — списком; цены — только если они есть в материале",
  mood: "интерьер, музыка, свет, настроение — как гость это чувствует",
  pitch: "сначала одна строка — когда это говорить; дальше готовая речь гостю 3–5 предложений от «мы», каждая фраза — строкой в «ёлочках»",
  dress: "по пунктам — форма, обувь, волосы, украшения, ногти: «✅ » как надо и «🚫 » так нельзя",
  setting: "как накрыт стол — по порядку 1️⃣ 2️⃣ 3️⃣",
  check: "из чего складывается чек и к какому стремимся — списком, цифры как в материале",
  day: "распорядок по времени — 1️⃣ 2️⃣ 3️⃣, время в начале строки",
  numbers: "на какие цифры смотрим — строки «• Показатель — норма или цель»",
  own: "по смыслу материала"
};
var QUIZ_RULES = [
  "Вопрос — ситуация из работы или проверка важного правила из блока. 4 варианта, ровно один верный; неверные — правдоподобные ошибки новичка, не абсурд.",
  "Все варианты — примерно одной длины и одинаково уверенные: верный не выделяется ни длиной, ни подробностью. Пояснение — одной фразой: почему верный ответ верный."
].join("\n");
var PROMPT = {
  // v202 (Доп. 527): вопросы живой проверки — руководитель спрашивает вслух, отмечает пункты, которые человек назвал сам
  live: (role, text, title, others) => [
    `Ты помогаешь руководителю ресторана проверить, читал ли сотрудник уроки модуля «${title || "модуль"}» (курс: ${role || "сервис"}).`,
    "Составь 4 вопроса для живой проверки: руководитель задаёт их вслух, сотрудник отвечает своими словами.",
    "К каждому вопросу — от 2 до 5 пунктов «что должно прозвучать»: коротко, по 3–12 слов, только то, что есть в тексте уроков, без общих слов.",
    "Вопросы — о главном и о том, что пригодится в зале завтра. Один вопрос можно сделать ситуацией: начни его словами «Ситуация:» и опиши, что происходит, а в пунктах — что сделать.",
    "Не повторяй вопросы, которые уже есть." + (others && others.length ? " Уже есть:\n" + others.map((x) => "• " + x).join("\n") : ""),
    "Пиши по-русски, просто и конкретно, без длинных тире и без канцелярита.",
    'Ответ — строго JSON без пояснений и без ```: {"questions": [{"q": "…", "a": ["…", "…"]}]}',
    "\nТЕКСТ УРОКОВ:\n" + text
  ].join("\n"),
  // v191: план раздела по документу — какие блоки получаются и выдержка для каждого
  concept_plan: (where, material) => [
    `Прочитай материал о ${where || "сети ресторанов"} и составь план раздела «О нас» в приложении для сотрудников ресторанов: какие блоки-уроки из него получаются.`,
    "Виды блоков (kind — название):",
    Object.entries(CONCEPT_KINDS).map(([k, t]) => `• ${k} — ${t}`).join("\n"),
    "Бери только то, о чём в материале есть содержание. Один вид — один блок; own — важное, что не подошло к другим видам (не больше пяти).",
    "Для каждого блока: kind; title — заголовок урока 2–6 слов, живой и конкретный, можно с названием компании («Кто мы: …», «Наш гость: кому что советовать»); about — что войдёт, одним предложением;",
    "src — выдержка из материала для этого блока: все факты, цифры, имена, правила и формулировки, которые в него войдут, близко к тексту материала, до 900 знаков.",
    "Порядок блоков — как в списке видов.",
    // v192 (Доп. 517): картинки из Word — метки «[фото N]» на их месте в тексте
    "Строки «[фото N]» в материале — картинки документа на своём месте. photos — номера картинок, которые относятся к блоку (по месту в тексте и смыслу: зал — к атмосфере, форма — к внешнему виду, стол — к сервировке); одна картинка — одному блоку; нет картинок — пустой список. В src метки оставляй.",
    'Ответ — строго JSON без пояснений и без ```: {"blocks": [{"kind": "idea", "title": "…", "about": "…", "src": "…", "photos": [1]}]}',
    material ? "\nМАТЕРИАЛ:\n" + material : "\nМАТЕРИАЛ — во вложенном PDF."
  ].join("\n"),
  // v191: один блок по материалу — в виде уроков и с вопросами теста
  concept_block: (where, kind, title, about, others, qn, material, src = "") => [
    `Напиши блок-урок «${title || CONCEPT_KINDS[kind] || "О нас"}» для раздела «О нас» приложения сотрудников (${where || "сеть ресторанов"}). Вид блока — ${CONCEPT_KINDS[kind] || "свой блок"}: ${CONCEPT_LOOK[kind] || CONCEPT_LOOK.own}.`,
    about ? "Что в нём: " + about : "",
    src ? "Выдержка из материала для этого блока (остальной материал — ниже, бери из него только то, что относится к блоку):\n" + src : "",
    others && others.length ? "Другие блоки раздела — их содержание не повторяй: " + others.map((x) => "«" + x + "»").join(", ") + "." : "",
    "Объём — 120–320 слов, строго по материалу ниже. Строки «[фото N]» — картинки документа: в текст блока их не переноси.",
    LOOK,
    VOICE,
    qn > 0 ? `Ещё ${qn} вопрос${qn === 1 ? "" : "а"} для теста по этому блоку.
` + QUIZ_RULES : "",
    qn > 0 ? 'Ответ — строго JSON без пояснений и без ```: {"title": "…", "body": "…", "questions": [{"q": "…", "options": ["…","…","…","…"], "correct": 0, "explanation": "…"}]}' : 'Ответ — строго JSON без пояснений и без ```: {"title": "…", "body": "…"}',
    material ? "\nМАТЕРИАЛ:\n" + material : "\nМАТЕРИАЛ — во вложенном PDF."
  ].filter(Boolean).join("\n"),
  // v191: оформить готовый текст блока как урок — смысл и факты те же
  concept_style: (kind, title, text) => [
    `Оформи текст блока «${title || CONCEPT_KINDS[kind] || "О нас"}» раздела «О нас» как урок приложения (вид блока — ${CONCEPT_KINDS[kind] || "свой блок"}: ${CONCEPT_LOOK[kind] || CONCEPT_LOOK.own}).`,
    "Смысл, факты, цифры, имена и правила — те же: ничего не добавляй от себя и ничего важного не теряй; повторы и воду убери.",
    LOOK,
    VOICE,
    'Ответ — строго JSON без пояснений и без ```: {"body": "…"}',
    "\nТЕКСТ БЛОКА:\n" + text
  ].join("\n"),
  concept: (where, material) => [
    `Разложи материал о ресторане (${where || "сеть ресторанов"}) по блокам раздела «О нас» приложения для сотрудников.`,
    "Виды блоков (kind — название):",
    Object.entries(CONCEPT_KINDS).map(([k, t]) => `• ${k} — ${t}`).join("\n"),
    "pitch — готовая речь гостю: 3–5 предложений от «мы», без цен. own — всё важное, что не подошло к другим видам; заголовок — свой, 2–5 слов.",
    "Бери только то, что есть в материале: о чём материал молчит, того блока не пиши. Один вид — один блок (own — сколько нужно, но не больше пяти).",
    "Объём текста блока — до 300 слов. Цифры, имена, правила — как в материале, ничего не придумывай.",
    LOOK,
    // v191: вид как у уроков
    VOICE,
    'Ответ — строго JSON без пояснений и без ```: {"blocks": [{"kind": "idea", "title": "…", "body": "…"}]} (переносы строк в body — \\n).',
    material ? "\nМАТЕРИАЛ:\n" + material : "\nМАТЕРИАЛ — во вложенном PDF."
  ].join("\n"),
  lesson: (role, material) => [
    `Сделай один урок для сотрудников ресторана — ${ROLE_RU[role] || "сотрудники зала"} — из материала ниже.`,
    "Объём текста урока — 150–450 слов. Название — коротко, 2–6 слов.",
    STYLE,
    'Ответ — строго JSON без пояснений и без ```: {"title": "…", "content": "…"} (переносы строк в content — \\n).',
    material ? "\nМАТЕРИАЛ:\n" + material : "\nМАТЕРИАЛ — во вложенном PDF."
  ].join("\n"),
  improve: (role, text) => [
    "Улучши текст урока: яснее, короче, без ошибок и повторов, в стиле ниже.",
    "Смысл, факты, цифры и правила не меняй и ничего не добавляй от себя.",
    STYLE,
    'Ответ — строго JSON без пояснений и без ```: {"content": "…"}',
    "\nТЕКСТ УРОКА:\n" + text
  ].join("\n"),
  questions: (role, text, title) => [
    `Составь 4 вопроса для теста по уроку «${title || "без названия"}» для: ${ROLE_RU[role] || "сотрудники зала"}.`,
    "Каждый вопрос — ситуация из работы или проверка важного правила из урока. 4 варианта ответа,",
    "ровно один верный; неверные — правдоподобные ошибки новичка, не абсурд. Опирайся только на текст урока.",
    "Все варианты — примерно одной длины и одинаково уверенные: верный не должен выделяться ни длиной, ни подробностью (иначе его угадывают, не читая).",
    "Пояснение — одной фразой: почему верный ответ верный.",
    WHOLE,
    'Ответ — строго JSON без пояснений и без ```: {"questions": [{"q": "…", "options": ["…","…","…","…"], "correct": 0, "explanation": "…"}]}',
    "\nТЕКСТ УРОКА:\n" + text
  ].join("\n"),
  review: (role, text, title) => [
    `Напиши отзыв гостя для «Книги отзывов» ресторана по разделу обучения «${title || "раздел"}» (${ROLE_RU[role] || "сотрудники зала"}).`,
    "2–4 предложения от лица гостя: тепло, живо и конкретно — что сотрудник сделал так, что захотелось вернуться; опирайся на уроки раздела ниже. Без имён сотрудников, без цен и блюд, которых нет в тексте.",
    "guest — кто гость, 2–4 слова («Пара на годовщине», «Семья с детьми»); table — «стол N».",
    'Ответ — строго JSON без пояснений и без ```: {"review": {"guest": "…", "table": "стол 5", "text": "…"}}',
    "\nУРОКИ РАЗДЕЛА:\n" + text
  ].join("\n"),
  build: (role, recipe) => [
    "Составь «Сборку» — пошаговый тренажёр приготовления напитка для барменов по рецепту ниже.",
    "5–7 шагов по порядку приготовления: бокал, основа, лёд, алкоголь, долив или метод, гарниш — только то, что есть в рецепте.",
    "Шаг: label — 1–2 слова («Бокал», «Лёд»…); q — вопрос бармену; ровно 4 варианта: один верный (ok: true) — строго по рецепту, с объёмами в мл; три неверных — правдоподобные ошибки (на глаз, не тот бокал, не тот лёд, не тот метод); fb — объяснение к каждому варианту одной фразой; cost — цена ошибки на этом шаге, коротко («напиток выдохнется до второго глотка»).",
    "glass — форма бокала для картинки, одна из: high (хайбол, коллинз), rocks (олд фэшн), coupe (купе, мартини), wine (винный), pint (пинта). tint — цвет готового напитка в HEX (#RRGGBB).",
    "win — фраза при чистой сборке, lose — при ошибках, по одной. Опирайся строго на рецепт — дозы, бокал, лёд, метод, гарниш как в нём, ничего не выдумывай.",
    'Ответ — строго JSON без пояснений и без ```: {"build": {"title": "…", "glass": "rocks", "tint": "#B8352A", "win": "…", "lose": "…", "steps": [{"label": "Бокал", "q": "…", "cost": "…", "options": [{"t": "…", "ok": true, "fb": "…"}, {"t": "…", "fb": "…"}]}]}}',
    "\nРЕЦЕПТ:\n" + recipe
  ].join("\n"),
  dialogue: (role, text, title, idea) => [
    `Составь «Живой диалог» — тренажёр разговора с гостем по уроку «${title || "без названия"}» для: ${ROLE_RU[role] || "сотрудники зала"}.`,
    idea ? "Ситуация разговора: " + idea : "Ситуацию выбери сам — самую жизненную для этого урока.",
    "Гость: имя, аватар (один эмодзи человека), контекст — кто он, зачем пришёл, в каком настроении (1–2 предложения), начальное настроение mood от 1 до 5 (3 — нейтрально).",
    "Шаги по порядку, 8–12 штук: action — что происходит (коротко, от третьего лица); guest — реплика гостя (живая, разговорная); choice — вопрос сотруднику и ровно 3 варианта ответа.",
    "В choice: один вариант верный (correct: true, moodDelta: 1), два неверных — правдоподобные ошибки (correct: false, moodDelta: 0 или -1); feedback — почему так, одной фразой. Сделай 3–4 choice.",
    "Все три варианта — одной длины (разница не больше пятой части), одинаково вежливые и уверенные: верный НЕ выделяется ни длиной, ни тоном. Неверный — ловушка: звучит профессионально, но в нём одна ошибка по уроку (пообещал, не проверив; решил за гостя; верное действие не вовремя; перестарался; переложил на другого). feedback неверного — что в нём подкупает и в чём ошибка («Звучит заботливо, но…»).",
    "Опирайся на текст урока. Реплики сотрудника — на «вы» к гостю.",
    "tip — итог разговора: главная мысль урока одной фразой, покажется в конце.",
    'Ответ — строго JSON без пояснений и без ```: {"dialogue": {"tip": "…", "guest": {"name": "…", "avatar": "👔", "context": "…", "mood": 3}, "steps": [{"type": "action", "text": "…"}, {"type": "guest", "text": "…"}, {"type": "choice", "prompt": "…", "options": [{"text": "…", "correct": true, "feedback": "…", "moodDelta": 1}]}]}}',
    "\nТЕКСТ УРОКА:\n" + text
  ].join("\n"),
  // v40: все шесть видов практики — как в приложении и по правилам docs/ОТВЕТЫ-С-ПОДВОХОМ.md (v37–v39)
  situations: (role, text, title) => [
    `Составь 6 ситуаций для «Практики ситуаций» по уроку «${title || "без названия"}» для: ${ROLE_RU[role] || "сотрудники зала"} — по одной каждого вида (genre), в таком порядке: action, find, empathy, truefalse, complete, timer. Если для вида в уроке нет материала — вместо него сделай ещё одну action.`,
    "Виды и их поля:",
    "— action («Что делаешь?»): scene — короткая сцена из смены, 1–3 предложения, от второго лица («Ты…», «Гость…»); question — «Что делаешь?»; options — 4 действия.",
    "— find («Найди ошибку»): в scene сотрудник ошибается; question спрашивает, что не так («Что не так?»), а не «что делаешь?»; options — 4 варианта того, в чём ошибка.",
    "— empathy («Глазами гостя»): guestThought — мысли гостя от первого лица, 1–2 предложения, и они совпадают со сценой (то, что гость видит и чувствует в ней); scene — что происходит; question — про чувства гостя и про то, что их создаёт или что сделать («Что чувствует гость и что сделать?»); options — 4 варианта.",
    "— truefalse («Правда или миф»): statement — одно утверждение, которое по тексту урока однозначно верно или однозначно неверно, без «иногда» и «зависит»; isTrue — true, если верно, false — если миф. Полей scene и options у этого вида нет.",
    "— complete («Собери правило»): start — начало правила из урока; options — 4 продолжения. start и любой вариант вместе читаются как одно грамотное предложение: start не заканчивается вопросом и не обрывается двоеточием после «а», «в», «он»; варианты продолжают фразу со строчной буквы. Поля scene у этого вида нет.",
    "— timer («Быстрое решение»): как action, но решать надо за 12 секунд — сцена и варианты короче.",
    "Мысли гостя (guestThought) — только в empathy; мысли сотрудника пиши прямо в сцену.",
    "Во всех видах с вариантами ровно один верный (correct — его номер, с нуля). Неверные — правдоподобные ошибки новичка именно по теме урока: верное действие не вовремя, полуправда, соседняя цифра из урока, переложил на другого, перестарался, решил за гостя. Не абсурд и не шутка; эксперт не должен суметь защитить неверный по тексту урока: каждый неверный — ловушка, а не пустышка.",
    "Все варианты одной ситуации — одной длины (самый длинный длиннее самого короткого не больше чем на четверть), одной формы и одинаково уверенные: верный не должен выделяться ни длиной, ни подробностью, ни тоном. Верный стоит на разных местах.",
    "win — реакция при верном ответе, одна фраза, можно начать с 🎯; fail — подсказка при ошибке, одна фраза, можно начать с 💡, и она подходит к любому неверному варианту; emoji — один эмодзи к ситуации.",
    "Опирайся только на текст урока, ничего не выдумывай: всё, на чём держится верный ответ, должно быть в уроке. Кавычки — «ёлочки», тире — длинное.",
    WHOLE,
    'Ответ — строго JSON без пояснений и без ```: {"situations": [{"genre": "action", "emoji": "🔥", "scene": "…", "question": "Что делаешь?", "options": ["…","…","…","…"], "correct": 1, "win": "…", "fail": "…"}, {"genre": "find", "emoji": "🔍", "scene": "…", "question": "Что не так?", "options": ["…","…","…","…"], "correct": 3, "win": "…", "fail": "…"}, {"genre": "empathy", "emoji": "🎭", "guestThought": "…", "scene": "…", "question": "Что чувствует гость и что сделать?", "options": ["…","…","…","…"], "correct": 0, "win": "…", "fail": "…"}, {"genre": "truefalse", "emoji": "🃏", "statement": "…", "isTrue": false, "win": "…", "fail": "…"}, {"genre": "complete", "emoji": "🔗", "start": "…", "options": ["…","…","…","…"], "correct": 2, "win": "…", "fail": "…"}, {"genre": "timer", "emoji": "⚡", "scene": "…", "question": "Что делаешь?", "options": ["…","…","…","…"], "correct": 1, "win": "…", "fail": "…"}]}',
    "\nТЕКСТ УРОКА:\n" + text
  ].join("\n")
};
function parseObject(text) {
  const clean2 = String(text || "").replace(/```json|```/g, "").trim();
  try {
    const o = JSON.parse(clean2);
    if (o && typeof o === "object") return o;
  } catch (e) {
  }
  const a = clean2.indexOf("{"), b = clean2.lastIndexOf("}");
  if (a >= 0 && b > a) {
    try {
      return JSON.parse(clean2.slice(a, b + 1));
    } catch (e) {
    }
  }
  return null;
}
var cut3 = (s4, n) => String(s4 == null ? "" : s4).replace(/\r/g, "").slice(0, n);
var SIT_GENRES = ["action", "find", "empathy", "truefalse", "complete", "timer"];
var SIT_Q = { action: "Что делаешь?", find: "Что не так?", empathy: "Что чувствует гость и что сделать?", timer: "Что делаешь?" };
var TF_OPTIONS = ["✅ Верно", "❌ Неверно"];
var CUT_COLON = /(^|[\s,])(а|в|он|на|о|в течение)\s*:\s*$/iu;
var emojiOf = (v) => {
  let out = "";
  for (const ch of String(v == null ? "" : v).trim()) {
    if ((out + ch).length > 4) break;
    out += ch;
  }
  return out.replace(/\u200d+$/, "");
};
var unquote = (s4) => /^«[^«»]*»$/.test(s4) ? s4.slice(1, -1).trim() : s4;
var truthOf = (x) => typeof x.isTrue === "boolean" ? x.isTrue : x.isTrue === "true" ? true : x.isTrue === "false" ? false : String(x.correct) === "0" ? true : String(x.correct) === "1" ? false : null;
function sanitizeSituation(x) {
  if (!x || typeof x !== "object") return null;
  const genre = SIT_GENRES.includes(x.genre) ? x.genre : "action";
  const head2 = { genre, emoji: emojiOf(x.emoji) }, tail = { win: cut3(x.win, 240).trim(), fail: cut3(x.fail, 240).trim() };
  if (genre === "truefalse") {
    const statement = unquote(cut3(x.statement, 300).trim()), isTrue = truthOf(x);
    if (!statement || isTrue === null) return null;
    return { ...head2, statement, isTrue, correct: isTrue ? 0 : 1, question: "Это верно?", options: [...TF_OPTIONS], ...tail };
  }
  const raw = Array.isArray(x.options) ? x.options : [];
  const rc = Number.isInteger(x.correct) ? x.correct : parseInt(x.correct, 10);
  const keep = raw.map((v, i) => ({ v: cut3(v, 200).trim(), i })).filter((y) => y.v).slice(0, 4);
  if (keep.length < 2) return null;
  const options = keep.map((y) => y.v), correct = Math.max(0, keep.findIndex((y) => y.i === rc));
  if (genre === "complete") {
    const start = cut3(x.start, 300).trim().replace(CUT_COLON, "$1$2");
    if (!start || /\?\s*$/.test(start)) return null;
    return { ...head2, start, options, correct, question: "Выбери правильное продолжение:", ...tail };
  }
  const scene = cut3(x.scene, 400).trim();
  if (!scene) return null;
  const guestThought = genre === "empathy" ? unquote(cut3(x.guestThought, 300).trim()) : "";
  if (genre === "empathy" && !guestThought) return null;
  let question = cut3(x.question, 160).trim() || SIT_Q[genre];
  if (genre === "find" && /что делаешь/i.test(question)) question = "Что не так?";
  return { ...head2, ...genre === "empathy" ? { guestThought } : {}, scene, question, options, correct, ...tail };
}
function cnQuestions(arr2) {
  return (Array.isArray(arr2) ? arr2 : []).map((q) => {
    if (!q || typeof q !== "object") return null;
    const rc = Number.isInteger(q.correct) ? q.correct : parseInt(q.correct, 10);
    const keep = (Array.isArray(q.options) ? q.options : []).map((x, i) => ({ v: cut3(x, 200).trim(), i })).filter((x) => x.v).slice(0, 4);
    const correct = keep.findIndex((x) => x.i === rc);
    const text = cut3(q.q, 400).trim();
    if (!text || keep.length < 2 || correct < 0) return null;
    return { q: text, options: keep.map((x) => x.v), correct, explanation: cut3(q.explanation, 500).trim() };
  }).filter(Boolean).slice(0, 4);
}
function sanitize(mode, o) {
  if (mode === "live") {
    const list2 = (Array.isArray(o && o.questions) ? o.questions : []).map((x) => {
      const q = cut3(x && x.q, 300).replace(/\s+/g, " ").trim();
      const a = (Array.isArray(x && x.a) ? x.a : []).filter((p) => typeof p === "string").map((p) => cut3(p, 200).replace(/\s+/g, " ").trim()).filter(Boolean).slice(0, 5);
      return q.length >= 8 && a.length >= 2 ? { q, a } : null;
    }).filter(Boolean).slice(0, 4);
    return list2.length ? { questions: list2 } : null;
  }
  if (!o) return null;
  if (mode === "concept") {
    const seen = /* @__PURE__ */ new Set();
    const blocks = (Array.isArray(o.blocks) ? o.blocks : []).filter((b) => b && typeof b === "object" && CONCEPT_KINDS[b.kind]).map((b) => ({
      kind: b.kind,
      title: cut3(b.title, 80).trim() || CONCEPT_KINDS[b.kind],
      body: lessonize(cut3(b.body, 6e3))
    })).filter((b) => b.body && (b.kind === "own" || !seen.has(b.kind) && seen.add(b.kind))).slice(0, 17);
    return blocks.length ? { blocks } : null;
  }
  if (mode === "concept_plan") {
    const seen = /* @__PURE__ */ new Set();
    let own = 0;
    const blocks = (Array.isArray(o.blocks) ? o.blocks : []).filter((b) => b && typeof b === "object" && CONCEPT_KINDS[b.kind]).map((b) => ({
      kind: b.kind,
      title: cut3(b.title, 80).trim() || CONCEPT_KINDS[b.kind],
      about: cut3(b.about, 300).trim(),
      src: cut3(b.src, 1500).trim(),
      photos: [...new Set((Array.isArray(b.photos) ? b.photos : []).map(Number).filter((n) => Number.isInteger(n) && n > 0 && n <= 60))].slice(0, 8)
    })).filter((b) => b.kind === "own" ? ++own <= 5 : !seen.has(b.kind) && seen.add(b.kind)).slice(0, 17);
    return blocks.length ? { blocks } : null;
  }
  if (mode === "concept_block") {
    const body = lessonize(cut3(o.body, 6e3).replace(/^[ \t]*\[фото \d+\][ \t]*$/gm, "").replace(/ ?\[фото \d+\]/g, ""));
    if (!body) return null;
    return { title: cut3(o.title, 80).trim(), body, questions: cnQuestions(o.questions) };
  }
  if (mode === "concept_style") {
    const body = lessonize(cut3(o.body != null ? o.body : o.content, 6e3));
    return body ? { body } : null;
  }
  if (mode === "lesson") {
    const content = cut3(o.content, 12e3).trim();
    return content ? { title: cut3(o.title, 120).trim(), content } : null;
  }
  if (mode === "improve") {
    const content = cut3(o.content, 12e3).trim();
    return content ? { content } : null;
  }
  if (mode === "review") {
    const v = o && o.review || o || {};
    const text = cut3(v.text, 600).trim();
    return text ? { review: { guest: cut3(v.guest, 40).trim() || "Гость", table: cut3(v.table, 20).trim(), text } } : null;
  }
  if (mode === "build") {
    const b = o && o.build || o || {};
    const steps = (Array.isArray(b.steps) ? b.steps : []).slice(0, 8).map((st) => {
      const options = (Array.isArray(st && st.options) ? st.options : []).slice(0, 4).map((op) => ({ t: cut3(op && op.t, 160).trim(), ok: !!(op && op.ok), fb: cut3(op && op.fb, 200).trim() })).filter((op) => op.t);
      if (options.length < 2) return null;
      let seen = false;
      options.forEach((op) => {
        if (op.ok) {
          if (seen) op.ok = false;
          seen = true;
        }
      });
      if (!seen) options[0].ok = true;
      const q = cut3(st && st.q, 160).trim();
      if (!q) return null;
      return { label: cut3(st && st.label, 24).trim() || "Шаг", q, cost: cut3(st && st.cost, 120).trim(), options: options.map((op) => op.ok ? op : { t: op.t, fb: op.fb }) };
    }).filter(Boolean);
    if (steps.length < 2) return null;
    const glass = ["high", "rocks", "coupe", "wine", "pint"].includes(b.glass) ? b.glass : "rocks";
    const tint = /^#[0-9a-f]{6}$/i.test(String(b.tint || "")) ? b.tint : "#C8A96E";
    return { build: { title: cut3(b.title, 60).trim() || "Сборка", glass, tint, win: cut3(b.win, 200).trim(), lose: cut3(b.lose, 200).trim(), steps } };
  }
  if (mode === "dialogue") {
    const d = o && o.dialogue || o || {};
    const g2 = d.guest || {};
    const steps = (Array.isArray(d.steps) ? d.steps : []).slice(0, 16).map((st) => {
      const type = st && ["action", "guest", "choice"].includes(st.type) ? st.type : null;
      if (!type) return null;
      if (type !== "choice") {
        const text = cut3(st.text, 300).trim();
        return text ? { type, text } : null;
      }
      const options = (Array.isArray(st.options) ? st.options : []).slice(0, 3).map((op) => ({
        text: cut3(op && op.text, 200).trim(),
        correct: !!(op && op.correct),
        feedback: cut3(op && op.feedback, 240).trim(),
        moodDelta: Math.max(-1, Math.min(1, parseInt(op && op.moodDelta, 10) || 0))
      })).filter((op) => op.text);
      if (options.length < 2) return null;
      let seen = false;
      options.forEach((op) => {
        if (op.correct) {
          if (seen) op.correct = false;
          seen = true;
        }
      });
      if (!seen) options[0].correct = true;
      return { type, prompt: cut3(st.prompt, 200).trim() || "Что ответишь?", options };
    }).filter(Boolean);
    if (!steps.some((st) => st.type === "choice")) return null;
    return { dialogue: { tip: cut3(d.tip, 200).trim(), guest: {
      name: cut3(g2.name, 40).trim() || "Гость",
      avatar: cut3(g2.avatar, 4).trim() || "🙂",
      context: cut3(g2.context, 300).trim(),
      mood: Math.max(1, Math.min(5, parseInt(g2.mood, 10) || 3))
    }, steps } };
  }
  if (mode === "situations") {
    const ss = (Array.isArray(o.situations) ? o.situations : []).slice(0, 8).map(sanitizeSituation).filter(Boolean);
    return ss.length ? { situations: ss } : null;
  }
  const qs = (Array.isArray(o.questions) ? o.questions : []).slice(0, 8).map((q) => {
    const options = (Array.isArray(q && q.options) ? q.options : []).map((x) => cut3(x, 200).trim()).filter(Boolean).slice(0, 4);
    let correct = Number.isInteger(q && q.correct) ? q.correct : parseInt(q && q.correct, 10);
    if (!(correct >= 0 && correct < options.length)) correct = 0;
    return { q: cut3(q && q.q, 300).trim(), options, correct, explanation: cut3(q && q.explanation, 300).trim() };
  }).filter((q) => q.q && q.options.length >= 2);
  return qs.length ? { questions: qs } : null;
}
function openRouterText(data) {
  const msg = data && data.choices && data.choices[0] && data.choices[0].message;
  const c = msg && msg.content;
  if (typeof c === "string") return c;
  if (Array.isArray(c)) return c.map((p) => p && p.text || "").join("");
  return "";
}
async function ask(key2, prompt, pdfBase64, maxTokens = 4e3) {
  const headers = { Authorization: "Bearer " + key2, "Content-Type": "application/json", "X-Title": "Service Academy lesson assist" };
  if (process.env.VERCEL_URL) headers["HTTP-Referer"] = "https://" + process.env.VERCEL_URL;
  const content = [{ type: "text", text: prompt }];
  if (pdfBase64) content.push({ type: "file", file: { filename: "material.pdf", file_data: "data:application/pdf;base64," + pdfBase64 } });
  let lastErr = "ни одна модель не ответила";
  for (const model of MODELS) {
    let r, data;
    try {
      r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers,
        body: JSON.stringify({ model, max_tokens: maxTokens, temperature: 0.3, messages: [{ role: "user", content }] })
      });
      data = await r.json();
    } catch (e) {
      lastErr = model + ": сеть — " + (e && e.message ? e.message : "unknown");
      continue;
    }
    const err = data && data.error || data && data.choices && data.choices[0] && data.choices[0].error;
    if (r.ok && !err) {
      const text = openRouterText(data);
      if (text.trim()) return { ok: true, text, model: data && data.model || model, cut: !!(data && data.choices && data.choices[0] && data.choices[0].finish_reason === "length") };
      lastErr = model + ": пустой ответ";
      continue;
    }
    const status = r.status || err && err.code || 0;
    if (status === 401) return { ok: false, status: 502, error: "OpenRouter не принял ключ (401). Проверь OPENROUTER_API_KEY в Vercel и сделай Redeploy." };
    if (status === 402) return { ok: false, status: 502, error: "На OpenRouter закончились кредиты (402) — пополни баланс: openrouter.ai → Credits." };
    lastErr = model + ": " + (err && err.message || "HTTP " + status);
  }
  return { ok: false, status: 502, error: "Ассистент не ответил — " + lastErr };
}
async function liveAssist(res, key2, { token, role, title, text, others }) {
  const emp = await verifySession(token);
  if (!emp) return res.status(401).json({ ok: false, error: "Сессия не найдена — войди в приложение заново" });
  if (!(emp.is_admin || ["manager", "senior"].includes(emp.position))) return res.status(403).json({ ok: false, error: "Редактор контента — только для руководителей" });
  if (!rateLimit("lesson:" + token, 40, 36e5)) return res.status(429).json({ ok: false, error: "Слишком много запросов подряд — попробуй через час" });
  const material = cut3(text, 3e4).trim();
  if (material.length < 40) return res.status(400).json({ ok: false, error: "Сначала нужен текст урока — хотя бы пара предложений" });
  const oth = (Array.isArray(others) ? others : []).filter((x) => typeof x === "string").map((x) => cut3(x, 200).replace(/\s+/g, " ").trim()).filter(Boolean).slice(0, 16);
  try {
    const out = await ask(key2, PROMPT.live(cut3(role, 40), material, cut3(title, 120), oth), "", 3e3);
    if (!out.ok) return res.status(out.status || 502).json({ ok: false, error: out.error });
    const result = sanitize("live", parseObject(out.text));
    if (!result) return res.status(422).json({ ok: false, error: "Ассистент ответил не по формату — попробуй ещё раз" });
    return res.status(200).json({ ok: true, ...result, model: out.model });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Сбой ассистента: " + (e && e.message ? e.message : "unknown") });
  }
}
async function handler3(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Только POST" });
  const key2 = process.env.OPENROUTER_API_KEY;
  if (!key2) return res.status(500).json({ ok: false, error: "OPENROUTER_API_KEY не задан: Vercel → Settings → Environment Variables (тот же ключ, что у импорта меню), затем Redeploy." });
  const { token, mode, role, title, text, pdfBase64, idea, about, others, fixes, web, kind, qn, where, src, facts, secs } = req.body || {};
  const isRef = REF_AI_MODES.includes(mode);
  const isCn = CN_MODES.includes(mode);
  const isPitch = mode === "concept_pitch";
  if (mode === "live") return liveAssist(res, key2, req.body || {});
  if (!isRef && !isPitch && !["lesson", "improve", "questions", "situations", "dialogue", "build", "review", ...CN_MODES].includes(mode)) return res.status(400).json({ ok: false, error: "Неизвестный режим" });
  const emp = await verifySession(token);
  if (!emp) return res.status(401).json({ ok: false, error: "Сессия не найдена — войди в приложение заново" });
  const boss = !!(emp.is_admin || ["manager", "senior"].includes(emp.position));
  if (isPitch) {
    if (!rateLimit("pitch:" + token, 30, 36e5)) return res.status(429).json({ ok: false, error: "Много попыток подряд. Отдохни и попробуй через час." });
    const said = cut3(text, PITCH_LIMITS.said).trim(), ref = cut3(src, PITCH_LIMITS.ref).trim();
    if (!ref) return res.status(400).json({ ok: false, error: "В «О нас» нет образца рассказа гостю" });
    if (said.length < 15) return res.status(400).json({ ok: false, error: "Расскажи хотя бы пару предложений" });
    try {
      const out = await ask(key2, pitchPrompt({ where: cut3(title, 80), ref, facts: cut3(facts, PITCH_LIMITS.facts), said, secs: Number(secs) || 0 }), "", 1500);
      if (!out.ok) return res.status(out.status || 502).json({ ok: false, error: out.error });
      const result = pitchClean(parseObject(out.text));
      if (!result) return res.status(422).json({ ok: false, error: "Помощник ответил не по формату. Попробуй ещё раз." });
      return res.status(200).json({ ok: true, ...result, model: out.model });
    } catch (e) {
      return res.status(500).json({ ok: false, error: "Сбой помощника: " + (e && e.message ? e.message : "unknown") });
    }
  }
  if (!boss) return res.status(403).json({ ok: false, error: "Редактор контента — только для руководителей" });
  if (isRef && !emp.is_admin) return res.status(403).json({ ok: false, error: "Редактор справочника доступен только владельцу" });
  if (!(isRef ? rateLimit("ref:" + token, 80, 36e5) : isCn ? rateLimit("cn:" + token, 150, 36e5) : rateLimit("lesson:" + token, 40, 36e5))) return res.status(429).json({ ok: false, error: "Слишком много запросов подряд — попробуй через час" });
  const material = cut3(text, 3e4).trim();
  const b64 = typeof pdfBase64 === "string" && pdfBase64 ? pdfBase64.replace(/^data:[^;]*;base64,/, "") : "";
  if (b64.length > 43e5) return res.status(413).json({ ok: false, error: "PDF слишком большой: до 3 МБ" });
  if (isRef) {
    const big = mode === "ref_plan" || mode === "ref_part";
    const topic = cut3(title, REF_AI_LIMITS.topic).trim(), src2 = cut3(text, big ? REF_AI_LIMITS.doc : REF_AI_LIMITS.material).trim(), pdf = mode === "ref_chapter" || big ? b64 : "";
    const extra = {
      about: cut3(about, REF_AI_LIMITS.about).trim(),
      fixes: cut3(fixes, REF_AI_LIMITS.fixes).trim(),
      others: (Array.isArray(others) ? others : []).filter((x) => typeof x === "string").map((x) => cut3(x, REF_AI_LIMITS.topic).trim()).filter(Boolean).slice(0, REF_AI_LIMITS.parts)
    };
    const miss = refAiCheck(mode, { topic, text: src2, hasPdf: !!pdf, len: String(text == null ? "" : text).length, fixes: extra.fixes });
    if (miss) return res.status(400).json({ ok: false, error: miss });
    const useWeb = mode === "ref_check" || mode === "ref_chapter" && web === true && !pdf;
    const bad = (status, error) => res.status(status).json({ ok: false, error, ...useWeb ? { web: true } : {} });
    try {
      let out;
      if (useWeb) out = await webCall({ orKey: key2, models: WEB_MODELS2(), system: REF_WEB_SYSTEM, user: refPrompt(mode, topic, src2, false, { web: true }), maxTokens: 3500, lim: webLim() });
      else out = await ask(key2, refPrompt(mode, topic, src2, !!pdf, extra), pdf);
      if (!out.ok) return bad(out.status || 502, out.error);
      if (out.cut) return bad(422, "Ответ не уместился. Выдели часть текста или дай материал частями.");
      const o = parseObject(out.text);
      const result = mode === "ref_plan" ? refPlanClean(o) : mode === "ref_check" ? refCheckClean(o) : refAiClean(mode, o, src2, useWeb);
      if (!result) return bad(422, "Ассистент ответил не по формату. Попробуй ещё раз.");
      return res.status(200).json({ ok: true, ...result, ...useWeb ? { sources: out.sources || [], searched: out.searches || 0 } : {}, model: out.model });
    } catch (e) {
      return bad(500, "Сбой ассистента: " + (e && e.message ? e.message : "unknown"));
    }
  }
  const withPdf = mode === "lesson" || mode === "concept" || mode === "concept_plan" || mode === "concept_block";
  if (withPdf && !material && !b64) return res.status(400).json({ ok: false, error: "Вставь текст или прикрепи PDF" });
  if (!withPdf && material.length < 40) return res.status(400).json({ ok: false, error: "Сначала нужен текст урока — хотя бы пара предложений" });
  if ((mode === "concept_block" || mode === "concept_style") && !CONCEPT_KINDS[kind]) return res.status(400).json({ ok: false, error: "Неизвестный вид блока" });
  const nq = Math.max(0, Math.min(4, Number.isInteger(qn) ? qn : parseInt(qn, 10) || 0));
  const oth = (Array.isArray(others) ? others : []).filter((x) => typeof x === "string").map((x) => cut3(x, 80).trim()).filter(Boolean).slice(0, 16);
  const prompt = mode === "concept_plan" ? PROMPT.concept_plan(cut3(title, 80).trim(), material) : mode === "concept_block" ? PROMPT.concept_block(cut3(where, 80).trim(), kind, cut3(title, 80).trim(), cut3(about, 300).trim(), oth, nq, material, cut3(src, 1500).trim()) : mode === "concept_style" ? PROMPT.concept_style(kind, cut3(title, 80).trim(), material) : mode === "concept" ? PROMPT.concept(cut3(title, 80).trim(), material) : mode === "lesson" ? PROMPT.lesson(role, material) : mode === "improve" ? PROMPT.improve(role, material) : mode === "situations" ? PROMPT.situations(role, material, cut3(title, 120)) : mode === "dialogue" ? PROMPT.dialogue(role, material, cut3(title, 120), cut3(idea, 400).trim()) : mode === "build" ? PROMPT.build(role, material) : mode === "review" ? PROMPT.review(role, material, cut3(title, 120)) : PROMPT.questions(role, material, cut3(title, 120));
  try {
    const out = await ask(key2, prompt, withPdf ? b64 : "", mode === "concept_plan" ? 8e3 : 4e3);
    if (out.ok && out.cut && isCn) return res.status(422).json({ ok: false, error: "Документ слишком большой для одного раза. Вставь его частями." });
    if (!out.ok) return res.status(out.status || 502).json({ ok: false, error: out.error });
    const result = sanitize(mode, parseObject(out.text));
    if (!result) return res.status(422).json({ ok: false, error: "Ассистент ответил не по формату — попробуй ещё раз" });
    return res.status(200).json({ ok: true, ...result, model: out.model });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Сбой ассистента: " + (e && e.message ? e.message : "unknown") });
  }
}

// supabase/functions/app-api/entry.js
var APP_API_V = 1;
var ROUTES = { "wine-import": handler2, "lesson-assist": handler3, "web-answer": handler };
var CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};
var json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json" } });
var routeOf = (url) => {
  try {
    return new URL(url).pathname.split("/").filter(Boolean).pop() || "";
  } catch (e) {
    return "";
  }
};
function makeRes() {
  const out = { status: 200, headers: {}, body: "" };
  const res = {
    statusCode: 200,
    status(c) {
      res.statusCode = Number(c) || 200;
      return res;
    },
    setHeader(k, v) {
      out.headers[k] = String(v);
      return res;
    },
    json(o) {
      out.body = JSON.stringify(o);
      out.headers["Content-Type"] = "application/json";
      return res;
    },
    send(x) {
      out.body = typeof x === "string" ? x : JSON.stringify(x);
      return res;
    },
    end(x) {
      if (x != null) out.body = String(x);
      return res;
    },
    on() {
      return res;
    }
  };
  return { res, out };
}
async function handle(req) {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const name = routeOf(req.url);
  const fn = Object.prototype.hasOwnProperty.call(ROUTES, name) ? ROUTES[name] : null;
  if (!fn) return json({ error: "Нет такой функции: " + name.slice(0, 40) }, 404);
  let body = {};
  if (req.method === "POST") {
    try {
      body = await req.json() || {};
    } catch (e) {
      body = {};
    }
  }
  const { res, out } = makeRes();
  const started = Date.now();
  try {
    let query = {};
    try {
      query = Object.fromEntries(new URL(req.url).searchParams);
    } catch (e) {
    }
    await fn({ method: req.method, body, query, headers: Object.fromEntries(req.headers) }, res);
  } catch (e) {
    const m = e && e.message ? String(e.message) : "unknown";
    console.error("app-api", name, "crash", m.slice(0, 200));
    return json({ error: "Сбой функции " + name + ": " + m.slice(0, 200) }, 500);
  }
  console.log("app-api", name, res.statusCode, Date.now() - started + "ms");
  return new Response(out.body, { status: res.statusCode, headers: { ...CORS, ...out.headers } });
}
Deno.serve(handle);
export {
  APP_API_V,
  ROUTES,
  handle,
  makeRes,
  routeOf
};
