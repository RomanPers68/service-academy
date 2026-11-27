// lib/ref-edit.js — v167 (Доп. 492): редактор справочника — то, что нужно только ему: номера своего, запись на сервер,
// дерево разделов и глав для правки, строки правок, порядок, кнопки оформления текста. Грузится вместе с экраном
// редактора (ui/ref-editor.jsx); память, загрузка и слияние, которые нужны всем, — в lib/ref-book.js (он в стартовой сборке).
import { rpc, saToken, rpcMissing } from "./supabase";
import { RB_FIXED, RB_LIMITS, isOwnSec, isOwnCh, normRefItems, refBookNow, commitRefBook, refLayout, refSecTitle, refSecSub } from "./ref-book";

const rnd = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
/** Номер своего раздела («rs-…») или своей главы («rc-…») */
export const newRefId = (kind) => (kind === "sec" ? "rs-" : "rc-") + rnd();
/** Номер своего фото в тексте главы: хранится как фото урока (этап 51), на всю сеть */
export const newRefPhotoId = () => "rp:" + rnd();

/** Правка, приложенная к списку строк: убрать del (свой раздел — вместе с его главами), заменить или добавить items */
export function applyRefEdit(items, put, del) {
  const gone = new Set(Array.isArray(del) ? del : []);
  const fresh = normRefItems(put);
  const ids = new Set(fresh.map((x) => x.id));
  const rest = (Array.isArray(items) ? items : []).filter((r) => !gone.has(r.id) && !(r.kind === "ch" && isOwnSec(r.parent) && gone.has(r.parent)) && !ids.has(r.id));
  return [...rest, ...fresh];
}

/**
 * Записать правки: put — строки целиком (пустое поле у штатного — «как в приложении»), del — номера строк убрать
 * (своё — удалить, штатное — вернуть как было). Только владелец; сервер проверит.
 * Ответ: { ok: true, ver } или { ok: false, error } (missing, auth, forbidden, bad_item, too_many, net).
 */
export async function saveRefBook(put = [], del = []) {
  const tok = saToken();
  if (!tok) return { ok: false, error: "auth" };
  let r;
  try { r = await rpc("ref_book_save", { p_token: tok, p_items: put, p_del: del }); } catch (e) { return { ok: false, error: "net" }; }
  if (rpcMissing(r)) return { ok: false, error: "missing" };
  if (!r || r.ok !== true) return { ok: false, error: (r && r.error) || "net" };
  const b = commitRefBook(r.ver, applyRefEdit(refBookNow().items, put, del));
  return { ok: true, ver: b.ver };
}

/** Что сказать владельцу, если не записалось */
export function refBookErr(code) {
  switch (code) {
    case "missing": return "На сервере нет этапа 53. Supabase → SQL Editor → файл supabase-stage53-ref-book.sql → Run, и редактор заработает.";
    case "forbidden": return "Править справочник может только владелец.";
    case "auth": return "Вход устарел. Закрой приложение и открой снова.";
    case "too_many": return "В справочнике слишком много своих правок. Убери лишнее и попробуй ещё раз.";
    case "bad_item": return "Сервер не принял правку: слишком длинное название или текст.";
    default: return "Не записалось: нет связи. Попробуй ещё раз.";
  }
}

// ── редактор: дерево разделов и глав со всем, что нужно для правки ───────────────────────────────────────────────────
/**
 * Справочник для редактора: все разделы, кроме тех, что не правятся («Гид по приложению»), со скрытыми и пустыми.
 * Раздел: { id, title, subtitle, baseTitle, baseSub, own, hidden, edited (своё название или подзаголовок), it (строка
 * правки или null), nat (место без правки; у своего null), lessons }.
 * Глава: { id, title, content, baseTitle, baseContent, own, hidden, edited (своё название или текст), moved (штатная
 * в чужом разделе), home (родной раздел), sec (раздел сейчас), it, nat, type }.
 */
export function refEditTree(base, items) {
  const courses = (Array.isArray(base) ? base : []).filter((c) => c && c.id);
  const { secs } = refLayout(courses, Array.isArray(items) ? items : []);
  return secs.filter((s) => !RB_FIXED.includes(s.id)).map((s) => ({
    id: s.id, title: refSecTitle(s), subtitle: refSecSub(s), baseTitle: s.base ? s.base.title : "", baseSub: s.base ? s.base.subtitle || "" : "",
    own: s.own, hidden: !!(s.it && s.it.hidden), edited: !s.own && !!(s.it && (s.it.title || s.it.sub)), it: s.it || null, nat: s.own ? null : (s.at + 1) * 10,
    lessons: s.ch.map((x) => ({
      id: x.id, title: x.own ? x.it.title || "Без названия" : (x.it && x.it.title) || x.l.title,
      content: x.own ? x.it.body || "" : x.it && x.it.body !== null ? x.it.body : x.l.content || "",
      baseTitle: x.l ? x.l.title : "", baseContent: x.l ? x.l.content || "" : "", own: x.own, hidden: !!(x.it && x.it.hidden),
      edited: !x.own && !!(x.it && (x.it.title || x.it.body !== null)), moved: !x.own && x.home !== s.id, home: x.home, sec: s.id,
      it: x.it || null, nat: x.own ? null : (x.at + 1) * 10, type: x.l ? x.l.type || "lesson" : "lesson",
    })),
  }));
}

/**
 * v171 (Доп. 496): пометка главы «из документа, ещё не показана». Владелец (16.11): «Давай что бы была видна везде».
 * Раньше номера таких глав помнил телефон (v170), и строка «Из документа» была только на нём. Теперь пометка лежит в
 * строке самой главы на сервере — в поле sub (у глав оно больше ничем не занято; у разделов это подзаголовок), поэтому
 * видна с любого устройства и этапа SQL не требует. Ставит её ассистент (addHiddenChapter), снимает показ: «Показать все»
 * или кнопка в главе. Правка текста и перестановка пометку сохраняют.
 */
export const REF_FRESH = "doc";
/** Глава из дерева редактора ждёт показа: своя, скрыта, с пометкой «из документа» */
export const refFresh = (l) => !!(l && l.own && l.hidden && l.it && l.it.sub === REF_FRESH);

/** Тот же ли это текст (перевод строки Windows и пустое по краям не считаются правкой) */
export const sameText = (a, b) => String(a == null ? "" : a).replace(/\r/g, "").trim() === String(b == null ? "" : b).replace(/\r/g, "").trim();

const rowOf = (node, kind) => ({ id: node.id, kind, parent: node.it ? node.it.parent : kind === "ch" && node.own ? node.sec : "",
  title: node.it ? node.it.title : null, sub: node.it ? node.it.sub : null, body: node.it ? node.it.body : null, hidden: !!(node.it && node.it.hidden), sort: node.it ? node.it.sort : null });
/** Строка правки узла дерева (раздела или главы) как она есть сейчас: её меняют и пишут целиком */
export const refRow = (node, kind) => rowOf(node, kind);
/** Пуста ли строка штатного: ничего не меняет — такую не хранят, а убирают */
export const refRowEmpty = (row) => !isOwnSec(row.id) && !isOwnCh(row.id) && !row.title && !row.sub && row.body === null && !row.hidden && row.sort === null && !row.parent;

/**
 * Порядок: какие строки записать, чтобы узлы (разделы или главы одного раздела) встали как в ids. Место — (номер + 1) × 10;
 * строка пишется только тому, чьё место меняется (штатное на своём месте остаётся без строки).
 */
export function reorderPut(nodes, ids, kind) {
  const by = new Map((Array.isArray(nodes) ? nodes : []).map((n) => [n.id, n]));
  const put = [];
  (Array.isArray(ids) ? ids : []).forEach((id, i) => {
    const n = by.get(id);
    if (!n) return;
    const want = (i + 1) * 10, have = n.it && n.it.sort !== null ? n.it.sort : n.nat;
    if (have !== want) put.push({ ...rowOf(n, kind), sort: want });
  });
  return put;
}

/**
 * Строка главы после правки в редакторе. node — глава из дерева (у новой: { id, own: true, sec }), d — { title, body, parent }.
 * У штатной название и текст пишутся, только если отличаются от штатных (иначе — «как в приложении»), родной раздел — пусто.
 */
export function chapterRow(node, d) {
  const title = String(d.title || "").trim().slice(0, RB_LIMITS.title), body = String(d.body == null ? "" : d.body).replace(/\r/g, "").slice(0, RB_LIMITS.body);
  const parent = d.parent || node.sec || node.home || "";
  const keep = { hidden: !!(node.it && node.it.hidden), sort: node.it ? node.it.sort : null };
  // v171: пометка «из документа» переживает правку текста и перенос в другой раздел, пока глава скрыта
  if (node.own) return { id: node.id, kind: "ch", parent, title: title || null, sub: refFresh({ ...node, hidden: keep.hidden }) ? REF_FRESH : null, body, ...keep };
  return { id: node.id, kind: "ch", parent: parent === node.home ? "" : parent, title: title && title !== node.baseTitle ? title : null, sub: null,
    body: sameText(body, node.baseContent) ? null : body, ...keep };
}

// ── кнопки оформления в редакторе: работают со строками, в которых стоит выделение ──────────────────────────────────
// Разметка главы — та же, что у штатных глав (ui/ReferenceSection.jsx, Content): **заголовок** строкой, «• » — пункт,
// «1. » — пункт с номером, булавка, галочка и крестик в начале строки — «важно», «верно», «неверно», **слово** — жирным.
export const REF_MARKS = { note: "\u{1F4CC}", good: "\u2705", bad: "\u274C" };
const LINE_MARK = /^(?:\u2022\s*|\d+\.\s+|(?:\u{1F4CC}|\u2611\uFE0F?|\u{1F6AB}|\u2705|\u274C)\s*)/u;
/**
 * Оформить: kind — bold (жирным выделенное), head (строки заголовком), list, num, note, good, bad (метка в начале строк).
 * Повторное нажатие снимает оформление. v — текст, s и e — выделение. → { text, s, e } (новое выделение).
 */
export function refFmt(v, s, e, kind) {
  const t = String(v == null ? "" : v);
  const a = Math.max(0, Math.min(t.length, Math.min(s, e) || 0)), b = Math.max(a, Math.min(t.length, Math.max(s, e) || 0));
  if (kind === "bold") {
    const sel = t.slice(a, b) || "текст";
    return { text: t.slice(0, a) + "**" + sel + "**" + t.slice(b), s: a + 2, e: a + 2 + sel.length };
  }
  const ls = a === 0 ? 0 : t.lastIndexOf("\n", a - 1) + 1;
  const eb = b > a && t[b - 1] === "\n" ? b - 1 : b;   // выделили до начала следующей строки — её не трогаем
  let le = t.indexOf("\n", eb); if (le < 0) le = t.length;
  const block = t.slice(ls, le).split("\n");
  const bare = (x) => x.trim().replace(/^\*\*(.+)\*\*$/, "$1").replace(LINE_MARK, "");
  const full = block.filter((x) => x.trim());
  let nb;
  if (kind === "head") {
    const all = full.length > 0 && full.every((x) => /^\*\*.+\*\*$/.test(x.trim()));
    nb = block.map((x) => (!x.trim() && block.length > 1 ? x : all ? x.trim().slice(2, -2) : "**" + (bare(x).replace(/\*\*/g, "") || "Заголовок") + "**"));
  } else if (kind === "num") {
    const all = full.length > 0 && full.every((x) => /^\d+\.\s+/.test(x.trim()));
    let n = 0;
    nb = block.map((x) => (!x.trim() && block.length > 1 ? x : all ? x.trim().replace(/^\d+\.\s+/, "") : ++n + ". " + bare(x)));
  } else {
    const mark = (kind === "list" ? "•" : REF_MARKS[kind] || "•") + " ";
    const all = full.length > 0 && full.every((x) => x.trim().startsWith(mark));
    nb = block.map((x) => (!x.trim() && block.length > 1 ? x : all ? x.trim().slice(mark.length) : mark + bare(x)));
  }
  const out = nb.join("\n"), text = t.slice(0, ls) + out + t.slice(le);
  return a === b ? { text, s: ls + out.length, e: ls + out.length } : { text, s: ls, e: ls + out.length };
}
/** Вставить строку (фото или схему) отдельной строкой там, где курсор. → { text, pos } (курсор после вставленного) */
export function refInsertLine(v, pos, line) {
  const t = String(v == null ? "" : v), p = Math.max(0, Math.min(t.length, pos == null ? t.length : pos));
  const before = t.slice(0, p), after = t.slice(p);
  const pre = before && !before.endsWith("\n") ? "\n" : "", post = after.startsWith("\n") ? "" : "\n";
  const text = before + pre + line + post + after;
  return { text, pos: before.length + pre.length + line.length + 1 };
}
/** Строка своего фото для текста главы: [photo:номер] или [photo:номер|подпись] */
export const refPhotoLine = (id, cap) => { const c = String(cap || "").replace(/[\r\n]+/g, " ").trim(); return "[photo:" + id + (c ? "|" + c : "") + "]"; };
