// lib/reference-context.js
// Ассистент ориентируется в Справочнике без изменения серверной функции:
// перед отправкой вопроса ищем релевантные главы прямо на клиенте и
// подмешиваем выдержки в текст вопроса. Сервер видит просто более
// подробное сообщение — совместимо с текущей Edge Function ai-chat.
//
// Экономия токенов: контекст добавляется только при внятном совпадении,
// максимум 2 главы, суммарно ~1300 символов, и только в отправляемую
// копию последнего сообщения (в историю чата не пишется).

import { REFERENCE_COURSE, REFERENCE_WINE_COURSE, REFERENCE_COFFEE_COURSE, REFERENCE_BAR_COURSE } from "../data/reference";

const COURSES = [REFERENCE_COURSE, REFERENCE_WINE_COURSE, REFERENCE_COFFEE_COURSE, REFERENCE_BAR_COURSE];

const norm = (s) => (s || "").toLowerCase().replace(/ё/g, "е");
const STOP = new Set(["как", "что", "это", "для", "или", "чем", "при", "его", "она", "они", "оно", "мне", "нам", "вам", "надо", "нужно", "можно", "если", "чтобы", "какой", "какая", "какие", "почему", "зачем", "где", "когда", "есть", "быть", "такое", "расскажи", "скажи", "подскажи", "объясни"]);

function words(q) {
  return norm(q).split(/[^а-яa-z0-9]+/).filter(w => w.length >= 3 && !STOP.has(w));
}

/** Выдержка: первый абзац главы со словом запроса + 📌-вывод главы. */
function excerpt(content, ws) {
  const paras = (content || "").split(/\n\n+/);
  let hit = null;
  for (const p of paras) {
    const np = norm(p);
    if (ws.some(w => np.includes(w))) { hit = p.trim(); break; }
  }
  const pin = paras.find(p => p.trim().startsWith("📌"));
  let out = (hit || paras[0] || "").slice(0, 420);
  if (pin && pin.trim() !== hit) out += "\n" + pin.trim().slice(0, 220);
  return out;
}

/**
 * Возвращает текстовый блок контекста или null, если справочник не в тему.
 */
export function refAssistantContext(question) {
  const ws = words(question);
  if (!ws.length) return null;
  const scored = [];
  for (const course of COURSES) {
    for (const l of course.lessons || []) {
      if (l.type !== "lesson") continue;
      const t = norm(l.title), c = norm(l.content || "");
      let score = 0;
      for (const w of ws) {
        if (t.includes(w)) score += 3;
        else {
          let i = 0, n = 0;
          while ((i = c.indexOf(w, i)) !== -1 && n < 3) { n++; i += w.length; }
          score += n;
        }
      }
      if (score >= 2) scored.push({ course, l, score });
    }
  }
  if (!scored.length) return null;
  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, 2);
  const parts = top.map(({ course, l }) =>
    `— «${l.title}» (курс «${course.title}»):\n${excerpt(l.content, ws)}`);
  return parts.join("\n\n").slice(0, 1300);
}

/**
 * Обогащает копию последнего user-сообщения контекстом справочника.
 * История в UI остаётся чистой — обогащение живёт только в payload.
 */
export function withRefContext(messages) {
  if (!messages.length) return messages;
  const last = messages[messages.length - 1];
  if (last.role !== "user") return messages;
  const ctx = refAssistantContext(last.content);
  if (!ctx) return messages;
  const enriched = last.content +
    "\n\n[Выдержки из Справочника приложения — используй их при ответе и скажи, что подробнее есть в Справочнике. " +
    "Кнопку перехода ставь маркером [[go:reference|Открыть Справочник]] — именно go:reference, не go:glossary (глоссарий — другой раздел):\n" + ctx + "]";
  return [...messages.slice(0, -1), { role: "user", content: enriched }];
}
