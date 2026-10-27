// lib/chat-mention.js — v99 (Доп. 412): упоминания в чате. «@Имя» — бот пишет этому человеку в Telegram, даже если на его
// сообщение не отвечали; «@все» — руководитель и старший пишут всем в чате. Имена — как у сервера (этап 39,
// _sa_chat_ment_names): имя; у тёзок в этом чате — имя и буква фамилии («Анна С.»). Здесь только расчёт: подсказки по
// буквам после «@», вставка в текст, части текста для подсветки, упомянут ли я. Экран — ui/chat.jsx.

import { AI_NAME } from "./chat-smart.js";

export const LEAD_POS = ["manager", "senior", "owner", "head", "admin", "service_manager"];
export const ALL_WORDS = ["все", "всем", "all"];
export const ALL_NAME = "все";
const WORD = /[а-яёa-z0-9_]/i;
const low = (s) => String(s || "").toLowerCase().replace(/ё/g, "е");

/** Имена для «@» по участникам чата ({ id, name, pos }): [{ id, disp, name, pos }]; без пустых имён. */
export function mentionNames(members) {
  const rows = (members || []).map((m) => {
    const w = String((m && m.name) || "").replace(/\s+/g, " ").trim().split(" ");
    return { id: m && m.id != null ? String(m.id) : "", fn: w[0] || "", sn: w[1] || "", name: String((m && m.name) || "").trim(), pos: (m && m.pos) || "" };
  }).filter((x) => x.id && x.fn);
  const cnt = new Map();
  rows.forEach((x) => cnt.set(low(x.fn), (cnt.get(low(x.fn)) || 0) + 1));
  return rows.map((x) => ({ id: x.id, disp: cnt.get(low(x.fn)) > 1 && x.sn ? x.fn + " " + x.sn[0].toUpperCase() + "." : x.fn, name: x.name, pos: x.pos }));
}

/**
 * Что набирают после «@» прямо перед кареткой: { start — где «@», q — буквы после него } или null. «@» — в начале
 * строки или после пробела (почта anna@mail.ru — не упоминание); в запросе — буквы, цифры и одна «буква с точкой» для тёзок.
 */
export function mentionQuery(text, caret) {
  const t = String(text || ""), c = Math.max(0, Math.min(caret == null ? t.length : Number(caret) || 0, t.length));
  const before = t.slice(0, c);
  const m = /(^|[\s(«"])@([а-яёa-z0-9_]*(?: [а-яёa-z]\.?)?)$/i.exec(before);
  if (!m) return null;
  const q = m[2];
  if (q.length > 24) return null;
  return { start: c - q.length - 1, q };
}

/**
 * Подсказки: участники, у кого имя или фамилия начинается с набранного (кроме меня); «все» — руководителю и старшему в
 * групповом чате; Наставник — везде. До 8. → [{ kind: "person" | "all" | "ai", id, disp, name }]
 */
export function mentionSuggest(names, q, { meId = null, lead = false, group = true, ai = true } = {}) {
  const qq = low(String(q || "").trim());
  const fit = (s) => !qq || low(s).split(/\s+/).some((w) => w.startsWith(qq)) || low(s).startsWith(qq);
  const out = [];
  if (group && lead && (!qq || ALL_WORDS.some((w) => w.startsWith(qq)))) out.push({ kind: "all", id: "all", disp: ALL_NAME, name: "Все в чате" });
  if (group) {
    (names || []).filter((n) => String(n.id) !== String(meId) && (fit(n.disp) || fit(n.name)))
      .sort((a, b) => a.disp.localeCompare(b.disp, "ru"))
      .forEach((n) => out.push({ kind: "person", id: n.id, disp: n.disp, name: n.name }));
  }
  if (ai && fit(AI_NAME)) out.push({ kind: "ai", id: "ai", disp: AI_NAME, name: AI_NAME });
  return out.slice(0, 8);
}

/** Вставить «@Имя » вместо набранного: { text, caret }. */
export function mentionInsert(text, start, caret, disp) {
  const t = String(text || ""), s = Math.max(0, Math.min(Number(start) || 0, t.length)), c = Math.max(s, Math.min(Number(caret) || 0, t.length));
  const ins = "@" + disp + " ";
  const rest = t.slice(c).replace(/^\s+/, "");
  return { text: t.slice(0, s) + ins + rest, caret: s + ins.length };
}

// слова, которые подсвечиваются после «@»: имена участников, «все», Наставник
function tokens(names, extra = true) {
  const list = (names || []).map((n) => ({ s: n.disp, id: n.id }));
  if (extra) { ALL_WORDS.forEach((w) => list.push({ s: w, id: "all" })); list.push({ s: AI_NAME, id: "ai" }); }
  return list.filter((x) => x.s).sort((a, b) => b.s.length - a.s.length);
}

/**
 * Текст по частям для подсветки: [{ t: "s", s }] — обычный текст, [{ t: "at", s, id, me }] — «@Имя» (me — это я или «@все»
 * от руководителя). leadIds — кто в чате руководитель или старший (только их «@все» — упоминание).
 */
export function mentionParts(body, names, { meId = null, leadAuthor = false } = {}) {
  const t = String(body || ""), L = low(t), toks = tokens(names);
  const out = [];
  let i = 0, from = 0;
  while ((i = t.indexOf("@", i)) >= 0) {
    if (i > 0 && WORD.test(t[i - 1])) { i++; continue; }
    let hit = null;
    for (const k of toks) {
      const kk = low(k.s), end = i + 1 + kk.length;
      if (L.slice(i + 1, end) === kk && (end >= t.length || !WORD.test(t[end]))) { hit = { k, end }; break; }
    }
    if (!hit || (hit.k.id === "all" && !leadAuthor)) { i++; continue; }
    if (i > from) out.push({ t: "s", s: t.slice(from, i) });
    out.push({ t: "at", s: t.slice(i, hit.end), id: hit.k.id, me: hit.k.id === "all" || (meId != null && String(hit.k.id) === String(meId)) });
    from = i = hit.end;
  }
  if (from < t.length) out.push({ t: "s", s: t.slice(from) });
  return out;
}

/** Упомянут ли я в сообщении (подсветка пузыря): «@моё имя» или «@все» от руководителя. */
export function mentionsMe(body, names, meId, leadAuthor = false) {
  if (meId == null || String(body || "").indexOf("@") < 0) return false;
  return mentionParts(body, names, { meId, leadAuthor }).some((p) => p.t === "at" && p.me);
}

/** Руководитель ли автор (по должности участника чата). */
export const isLeadPos = (pos) => LEAD_POS.includes(String(pos || ""));
