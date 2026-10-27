// lib/chat-search.js — v99 (Доп. 412): поиск по переписке. Сервер (этап 39, chat_search) ищет по тексту сообщений во
// всех моих чатах или в одном (регистр и «ё» не важны), здесь — кусок текста вокруг найденного для строки результата.

export const SEARCH_MIN = 2;
export const SEARCH_MAX = 80;
const low = (s) => String(s || "").toLowerCase().replace(/ё/g, "е");

/** Запрос: пробелы схлопнуты; короче 2 знаков — "" (не искать). */
export const searchQuery = (s) => { const q = String(s || "").replace(/\s+/g, " ").trim().slice(0, SEARCH_MAX); return q.length >= SEARCH_MIN ? q : ""; };

/**
 * Кусок текста вокруг найденного: { pre, hit, post } — до max знаков в одну строку, с многоточием по краям. Не нашлось
 * (карточка, у которой совпало в подписи) — начало текста целиком в pre.
 */
export function searchSnippet(body, q, max = 96) {
  const t = String(body || "").replace(/\s+/g, " ").trim(), qq = low(String(q || "").replace(/\s+/g, " ").trim());
  const i = qq ? low(t).indexOf(qq) : -1;
  if (i < 0) return { pre: t.length > max ? t.slice(0, max - 1).trimEnd() + "…" : t, hit: "", post: "" };
  const room = Math.max(0, max - qq.length), lead = Math.min(i, Math.max(12, Math.floor(room / 3)));
  const s = i - lead, e = Math.min(t.length, i + qq.length + (room - lead));
  return { pre: (s > 0 ? "…" : "") + t.slice(s, i), hit: t.slice(i, i + qq.length), post: t.slice(i + qq.length, e) + (e < t.length ? "…" : "") };
}
