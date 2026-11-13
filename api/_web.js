// api/_web.js — v152 (Доп. 476): поиск в интернете для AI приложения. Файлы с «_» Vercel маршрутами не делает — это помощник
// для /api/wine-import («Поискать в интернете» в барной карте) и /api/web-answer (ассистент ищет то, чего не знает).
//
// Владелец (13.11): «Мы можем дать моему ассистенту выход в интернет, что бы он мог просмотреть или найти инфу которую он
// к примеру не знает? И сколько это будет стоить?» — «Да, давай сделаем😉».
//
// Как: OpenRouter, серверный инструмент openrouter:web_search — модель сама решает, искать ли и что, OpenRouter ищет и отдаёт
// ей страницы, ответ приходит со ссылками (annotations, url_citation). Поисков на запрос — не больше maxSearches (3).
// Без ключа OpenRouter, но с ANTHROPIC_API_KEY — инструмент web_search Claude API (ссылки — citations в тексте ответа).
// Цена на 11.2026: Exa — $0,007 за поиск (OPENROUTER_WEB_ENGINE: exa | parallel | perplexity | native | auto), Claude API —
// $10 за 1000 поисков; плюс токены прочитанных страниц (Exa отдаёт выдержки, не страницы целиком). Списывается с того же
// баланса, что и остальной AI. Выдержки Exa — до WEB_MAX_CHARS знаков на страницу (без предела Exa отдаёт 2–4 тыс.): модель
// перечитывает их после каждого поиска, а токены — главная часть цены. Прикидка: позиция барной карты (Claude Sonnet, до 2
// поисков) — 3–6 ₽, вопрос ассистенту с поиском (Gemini Flash, до 3 поисков) — около 1–2 ₽.
//
// v154 (Доп. 478): владелец прислал снимок «Не получилось поискать в интернете. Попробуй ещё раз» под «Проверить в интернете».
// Причину приложение не показывало. Теперь: OpenRouter не принял запрос (400, 422) — та же модель проще (инструмент без
// настроек, потом старый плагин web), только потом следующая; поиски ограничивает max_uses инструмента (у Chat Completions
// max_tool_calls не в счёт); ответа хватает и «думающим» моделям (max_tokens больше); причина — в тексте ошибки и в журнале
// Vercel ([web-search]).

export const WEB_MAX_SEARCHES = 3;
export const WEB_MAX_CHARS = 2000;
export const webEngine = () => process.env.OPENROUTER_WEB_ENGINE || "exa";
/** Запись в tools запроса OpenRouter: результатов на поиск, знаков выдержки на страницу (Exa, Parallel, Perplexity) и
 *  v154: поисков на запрос (max_uses — у Chat Completions поиски ограничивает он, max_tool_calls там не в счёт). */
export const webTool = (maxResults = 5, maxChars = WEB_MAX_CHARS, maxUses = WEB_MAX_SEARCHES) => ({ type: "openrouter:web_search",
  parameters: { engine: webEngine(), max_results: maxResults, max_characters: maxChars, max_uses: maxUses } });
/** v154: запросы к одной модели по очереди — инструмент с настройками; без настроек; старый плагин web. via — что сработало. */
export const orAsks = (model, base, maxResults = 5, maxSearches = WEB_MAX_SEARCHES) => [
  { via: "tool", body: { ...base, model, tools: [webTool(maxResults, WEB_MAX_CHARS, maxSearches)], max_tool_calls: maxSearches } },
  { via: "tool-plain", body: { ...base, model, tools: [{ type: "openrouter:web_search" }] } },
  { via: "plugin", body: { ...base, model, plugins: [{ id: "web", max_results: maxResults }] } },
];
// v154: в журнал Vercel (Deployments → Functions → Logs) — почему поиск не вышел
const logWeb = (m) => { try { console.error("[web-search] " + m); } catch (e) { /* */ } };

const s = (v, n) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, n);
const okUrl = (u) => /^https?:\/\/[^\s"'<>]+$/i.test(String(u || "")) && String(u).length <= 400;
/** Ссылки без повторов: [{ url, title }] — только http(s), не больше max. Принимает строки и объекты { url, title }. */
export function sourcesOf(list, max = 6) {
  const out = [], seen = new Set();
  for (const x of Array.isArray(list) ? list : []) {
    const url = typeof x === "string" ? x.trim() : x && typeof x === "object" ? String(x.url || x.u || "").trim() : "";
    if (!okUrl(url)) continue;
    const key = url.replace(/[#?].*$/, "").replace(/\/+$/, "").toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ url, title: s(x && typeof x === "object" ? x.title || x.t : "", 100) });
    if (out.length >= max) break;
  }
  return out;
}
/** Ссылки из ответа OpenRouter: choices[0].message.annotations — [{ type: "url_citation", url_citation: { url, title } }]. */
export function orCitations(data) {
  const msg = data && data.choices && data.choices[0] && data.choices[0].message;
  const ann = msg && Array.isArray(msg.annotations) ? msg.annotations : [];
  return sourcesOf(ann.filter((a) => a && (a.type === "url_citation" || a.url_citation)).map((a) => a.url_citation || a));
}
/** Ссылки из ответа Claude API: citations в текстовых блоках, иначе — найденные страницы (web_search_tool_result). */
export function anCitations(data) {
  const blocks = Array.isArray(data && data.content) ? data.content : [];
  const cited = [], found = [];
  for (const b of blocks) {
    if (b && b.type === "text" && Array.isArray(b.citations)) for (const c of b.citations) if (c && c.url) cited.push({ url: c.url, title: c.title });
    if (b && b.type === "web_search_tool_result" && Array.isArray(b.content)) for (const r of b.content) if (r && r.url) found.push({ url: r.url, title: r.title });
  }
  return sourcesOf(cited.length ? cited : found);
}
const orText = (data) => { const c = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  return typeof c === "string" ? c : Array.isArray(c) ? c.map((p) => (p && p.text) || "").join("") : ""; };
const orSearches = (data) => { const d = data && data.usage && data.usage.server_tool_use_details; return Number(d && d.web_search_requests) || 0; };

/**
 * Вопрос модели с поиском в интернете. models — по очереди (первая ответила — дальше не идём); lim — { each, total } мс.
 * → { ok: true, text, sources, model, searches, cut } или { ok: false, status, error }.
 */
export async function webCall({ orKey, anKey, models = [], system = "", user = "", history = [], maxTokens = 1500, lim = { each: 45000, total: 50000 }, maxResults = 5, maxSearches = WEB_MAX_SEARCHES }) {
  const msgs = [...(system ? [{ role: "system", content: system }] : []), ...history.filter((m) => m && (m.role === "user" || m.role === "assistant") && m.content)
    .map((m) => ({ role: m.role, content: s(m.content, 2000) })), { role: "user", content: user }];
  const t0 = Date.now();
  if (orKey) {
    const headers = { Authorization: "Bearer " + orKey, "Content-Type": "application/json", "X-Title": "Service Academy web search" };
    if (process.env.VERCEL_URL) headers["HTTP-Referer"] = "https://" + process.env.VERCEL_URL;
    let lastErr = "ни одна модель не ответила", late = 0, tried = 0;
    const list = models.filter(Boolean), base = { max_tokens: maxTokens, temperature: 0.2, messages: msgs };
    for (let i = 0; i < list.length; i++) {
      // v154: OpenRouter не принял запрос (400, 422) — тот же вопрос той же модели проще: инструмент без настроек, потом
      // старый плагин web. Другая ошибка (нет модели, 5xx, молчит, пусто) — сразу следующая модель.
      const asks = orAsks(list[i], base, maxResults, maxSearches);
      for (let v = 0; v < asks.length; v++) {
        const left = lim.total - (Date.now() - t0);
        if (left < 3000) { i = list.length; break; }
        const wait = i === list.length - 1 ? left : Math.min(lim.each, left);
        const ac = new AbortController(), timer = setTimeout(() => ac.abort(), wait);
        let r, data;
        tried++;
        try {
          r = await fetch("https://openrouter.ai/api/v1/chat/completions", { method: "POST", headers, signal: ac.signal, body: JSON.stringify(asks[v].body) });
          data = await r.json();
        } catch (e) {
          if (ac.signal.aborted) { late++; lastErr = list[i] + ": не ответила за " + Math.round(wait / 1000) + " с"; logWeb(lastErr); break; }
          lastErr = list[i] + ": " + (r ? "HTTP " + r.status + ", ответ не JSON" : "сеть — " + (e && e.message ? e.message : "unknown")); logWeb(lastErr); break;
        } finally { clearTimeout(timer); }
        const err = (data && data.error) || (data && data.choices && data.choices[0] && data.choices[0].error);
        if (r.ok && !err) {
          const text = orText(data), fin = data && data.choices && data.choices[0] && data.choices[0].finish_reason;
          if (text.trim()) return { ok: true, text, sources: orCitations(data), model: (data && data.model) || list[i], searches: orSearches(data), cut: fin === "length", via: asks[v].via };
          lastErr = list[i] + ": пустой ответ" + (fin ? " (" + fin + ")" : ""); logWeb(lastErr); break;
        }
        const status = r.status || (err && err.code) || 0;
        if (status === 401) return { ok: false, status: 502, error: "OpenRouter не принял ключ (401). Проверь OPENROUTER_API_KEY в Vercel → Settings → Environment Variables и сделай Redeploy." };
        if (status === 402) return { ok: false, status: 502, error: "На OpenRouter закончились кредиты (402): пополни баланс на openrouter.ai → Credits." };
        lastErr = list[i] + " (" + asks[v].via + "): " + s((err && err.message) || "HTTP " + status, 300) + (err && err.metadata && err.metadata.raw ? " — " + s(err.metadata.raw, 200) : "");
        logWeb(lastErr);
        if (!(status === 400 || status === 422)) break;
      }
    }
    if (late && late === tried) return { ok: false, status: 504, error: "AI не успел найти ответ: нажми ещё раз. Если повторится, подожди минуту" };
    return { ok: false, status: 502, error: "Ошибка OpenRouter: " + lastErr };
  }
  if (anKey) {
    const ac = new AbortController(), timer = setTimeout(() => ac.abort(), lim.total);
    let r, data;
    try {
      r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", signal: ac.signal,
        headers: { "x-api-key": anKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: maxTokens, ...(system ? { system } : {}), messages: msgs.filter((m) => m.role !== "system"),
          tools: [{ type: "web_search_20250305", name: "web_search", max_uses: maxSearches }] }) });
      data = await r.json();
    } catch (e) {
      if (ac.signal.aborted) return { ok: false, status: 504, error: "AI не успел найти ответ: нажми ещё раз. Если повторится, подожди минуту" };
      return { ok: false, status: 502, error: "Сеть до Anthropic: " + (e && e.message ? e.message : "unknown") };
    } finally { clearTimeout(timer); }
    if (!r.ok) return { ok: false, status: 502, error: (data && data.error && data.error.message) || "Ошибка Claude API" };
    const text = (data.content || []).filter((c) => c && c.type === "text").map((c) => c.text || "").join("");
    const searches = Number(data.usage && data.usage.server_tool_use && data.usage.server_tool_use.web_search_requests) || 0;
    return { ok: true, text, sources: anCitations(data), model: data.model || "claude-sonnet-4-6", searches, cut: data.stop_reason === "max_tokens" };
  }
  return { ok: false, status: 500, error: "OPENROUTER_API_KEY не задан: Vercel → Settings → Environment Variables → Add (после добавления нужен Redeploy)." };
}
