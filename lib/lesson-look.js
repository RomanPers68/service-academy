// lib/lesson-look.js — v191 (Доп. 516): текст «О нас» — как в уроках приложения. Без React: этим пользуются и экран,
// и функция помощника (api/lesson-assist.js).
//
// Владелец (21.11): «давай сделаем так, что бы он красиво составлял текст, по типу того, что у нас уже собранно в
// уроках. А то выглядит инородно».
//
// Как выглядят штатные уроки (data/modules-*.js, 246 уроков): первая строка — главная мысль (экран покажет её крупно),
// дальше части с подзаголовком **в звёздочках**, короткие абзацы через пустую строку, списки «• », чек-лист «☑ »,
// принципы «🔹 », шаги 1️⃣ 2️⃣, «✅ » как надо, «🚫 » так нельзя, «📌 » главный вывод, фраза гостю в «ёлочках»;
// 80–450 слов, обычно около 200. Экран урока делит текст на карточки по пустым строкам (lib/lesson-cards.js), поэтому
// стена текста без пустых строк — одна огромная карточка.
//
// lessonize(text) приводит к этому виду любой текст: вставленный документ, ответ помощника, набранное руками.
// Только безопасные правки разметки, слова и смысл не трогает: # и __ → **заголовок**, «- », «* », «·» → «• »,
// нумерованный список 2–9 пунктов → 1️⃣ 2️⃣, строка КАПСОМ → **Заголовок**, «Важно: …» → «📌 Важно: …», таблица →
// строки «• а — б», переносы строк из PDF внутри абзаца склеены, абзацы и части разделены пустой строкой, слишком
// длинный абзац разбит по предложению. Повторный проход ничего не меняет (lessonize(lessonize(x)) === lessonize(x)).
// lookInfo(text) — что получилось: слова, карточки, есть ли крупная первая мысль, сколько частей.

import { lessonCards } from "./lesson-cards.js";

export const KEYCAPS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣"];
// значки в начале строки, которые экран урока рисует своим видом (ui/screens-learning.jsx)
const MARKS = /^(✅|❌|🚫|☑️?|📌|🔹|🌟|🟢|🟡|🟠|🔴|🔵|[1-9]️?⃣)/u;
const EMOJI_ONLY = /^[\p{Extended_Pictographic}\s️‍]+$/u;
const PARA_MAX = 420;   // абзац длиннее — делим по предложению

const isHead = (t) => t.length > 4 && t.startsWith("**") && t.endsWith("**") && !t.slice(2, -2).includes("**");
const isItem = (t) => t.startsWith("• ") || MARKS.test(t) || /^\d{1,2}[.)]\s/.test(t);
// семейство пункта: подряд идут без пустой строки только пункты одного семейства («✅» и «🚫» — одно: как надо и как нельзя)
const family = (t) => (t.startsWith("• ") ? "dot" : /^(✅|❌|🚫)/u.test(t) ? "do" : /^☑/u.test(t) ? "check" : t.startsWith("📌") ? "pin"
  : /^([1-9]\uFE0F?\u20E3|\d{1,2}[.)]\s)/u.test(t) ? "num" : /^(🟢|🟡|🟠|🔴|🔵)/u.test(t) ? "level" : "mark");
const isDivider = (t) => EMOJI_ONLY.test(t) && t.length <= 12;
const kindOf = (t) => (!t ? "blank" : isHead(t) ? "head" : isItem(t) ? "item" : t.startsWith("«") ? "quote" : isDivider(t) || t.startsWith("[mm:") ? "div" : "para");

// заголовок: без #, звёздочек и подчёркиваний внутри, двоеточие — внутри звёздочек, как в уроках («**Что такое брифинг:**»)
const head = (s) => {
  const t = String(s).replace(/\*\*|__/g, "").replace(/\s+/g, " ").trim().replace(/[.;,]$/, "");
  return t ? "**" + t + "**" : "";
};

// внутри строки: __жирное__ → **жирное**, *курсив* и _курсив_ — просто текст, [текст](ссылка) → текст, « - » → « — »
function inline(t) {
  let s = t.replace(/__([^_\n]+?)__/g, "**$1**")
    .replace(/(^|[^*])\*(?!\s)([^*\n]+?)(?<!\s)\*(?!\*)/g, "$1$2")
    .replace(/(^|[\s(«"])_(?!\s)([^_\n]+?)(?<!\s)_(?=$|[\s).,!?:;»"])/g, "$1$2")
    .replace(/\[([^\]\n]+)\]\((?:https?:\/\/|mailto:)[^)\s]+\)/g, "$1")
    .replace(/(\S) - (?=\S)/g, "$1 — ")
    .replace(/\.\.\.(?!\.)/g, "…");
  // "фраза" → «фраза» (парные прямые и «лапки»), но не дюймы и не кавычки внутри слова
  s = s.replace(/(^|[\s(—:])"([^"\n]{1,120}?)"(?=$|[\s).,!?:;—])/g, "$1«$2»").replace(/“([^”\n]{1,120})”/g, "«$1»").replace(/„([^“\n]{1,120})“/g, "«$1»");
  return s;
}

// предложение КАПСОМ → «Как в предложении»; слова, которые в обычных строках текста пишутся с большой буквы или капсом
// (Marin Resto Group, ЕГАИС, Камчатка), берут то же написание
const WORD = /[A-Za-zА-Яа-яЁё0-9]+/g;
function casingOf(lines) {
  const map = new Map();
  for (const l of lines) {
    if (!/[a-zа-яё]/.test(l)) continue;
    let m;
    WORD.lastIndex = 0;
    while ((m = WORD.exec(l))) {
      const w = m[0], before = l.slice(0, m.index).replace(/[\s«"(*•—–-]+$/, "");
      if (!before || /[.!?:…]$/.test(before)) continue;   // начало строки или предложения — там с большой буквы всегда
      const k = w.toLowerCase();
      if (!map.has(k)) map.set(k, w);
    }
  }
  return map;
}
function sentenceCase(t, casing) {
  // латиница капсом — скорее название (MARIN RESTO GROUP → Marin Resto Group); короткое — сокращение, остаётся капсом
  const low = t.replace(WORD, (w) => {
    const k = w.toLowerCase();
    if (casing.has(k)) return casing.get(k);
    if (/^[A-Z]+$/.test(w)) return w.length <= 3 ? w : w[0] + k.slice(1);
    if (/^[А-ЯЁ]{2,}$/.test(w) && !/[АЕЁИОУЫЭЮЯ]/.test(w)) return w;   // без гласных — сокращение (МРГ, СПб)
    return k;
  });
  return low.replace(/^([^a-zа-яё]*)([a-zа-яё])/i, (m, a, b) => a + b.toUpperCase());
}
const isCaps = (t) => t.length >= 3 && t.length <= 64 && /[А-ЯЁA-Z]{2}/.test(t) && !/[a-zа-яё]/.test(t) && !/[.!?]$/.test(t) && !/^\d+$/.test(t);

// длинный абзац — на два по границе предложения ближе к середине (повторно, пока не станет короче предела)
function splitLong(t) {
  if (t.length <= PARA_MAX) return [t];
  const cuts = [];
  const re = /[.!?…»)](?=\s+[«"(А-ЯЁA-Z0-9])/gu;
  let m;
  while ((m = re.exec(t))) cuts.push(m.index + 1);
  if (!cuts.length) return [t];
  const mid = t.length / 2;
  const at = cuts.reduce((a, b) => (Math.abs(b - mid) < Math.abs(a - mid) ? b : a));
  if (at < 80 || t.length - at < 80) return [t];
  return [...splitLong(t.slice(0, at).trim()), ...splitLong(t.slice(at).trim())];
}

/** Текст → разметка уроков. Пустое и не-строки → "". */
export function lessonize(text) {
  if (typeof text !== "string" || !text.trim()) return "";
  const raw = text.replace(/\r\n?/g, "\n").replace(/\t/g, " ").replace(/[​⁠﻿]/g, "").replace(/ /g, " ").split("\n").map((l) => l.replace(/\s+$/, ""));
  const casing = casingOf(raw);

  // 1) построчно: заголовки, списки, цитаты, таблицы
  let out = [];
  for (let i = 0; i < raw.length; i++) {
    let t = raw[i].trim();
    if (!t) { out.push(""); continue; }
    if (/^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?$/.test(t)) continue;   // разделитель таблицы
    if (/^\|.*\|$/.test(t)) {                                              // строка таблицы → пункт списка
      const cells = t.slice(1, -1).split("|").map((x) => inline(x.trim())).filter(Boolean);
      const sep = /^\|?\s*:?-{2,}/.test((raw[i + 1] || "").trim());
      // шапка таблицы (под ней разделитель) — подзаголовком, если над ней его нет
      if (sep) { const pv = out.filter(Boolean).slice(-1)[0] || ""; if (cells.length && !isHead(pv)) out.push(head(cells.map((c, k) => (k ? c.charAt(0).toLowerCase() + c.slice(1) : c)).join(" — "))); continue; }
      if (cells.length) out.push("• " + cells.join(" — "));
      continue;
    }
    let m;
    if ((m = t.match(/^#{1,6}\s+(.+?)\s*#*$/))) { out.push(head(m[1])); continue; }
    if ((m = t.match(/^__([^_].*?)__:?$/)) || (m = t.match(/^\*\*([^*].*?)\*\*\s*:$/))) { out.push(head(m[1] + (t.endsWith(":") && !m[1].endsWith(":") ? ":" : ""))); continue; }
    if (isHead(t)) { out.push(head(t.slice(2, -2))); continue; }
    if ((m = t.match(/^[-*+·▪●◦‣⁃]\s+(.+)$/))) { out.push("• " + inline(m[1].trim())); continue; }
    if ((m = t.match(/^•\s*(.+)$/))) { out.push("• " + inline(m[1].trim())); continue; }
    if ((m = t.match(/^>\s*(.+)$/))) { const q = m[1].trim(); out.push(q.startsWith("«") ? inline(q) : "«" + inline(q).replace(/^["“„«]|["”“»]$/g, "") + "»"); continue; }
    if ((m = t.match(/^["“„](.+)["”“]$/)) && !m[1].includes('"')) { out.push("«" + inline(m[1].trim()) + "»"); continue; }
    if (isCaps(t)) { out.push(head(sentenceCase(t.replace(/:$/, ""), casing) + (t.endsWith(":") ? ":" : ""))); continue; }
    if ((m = t.match(/^(Важно|Главное|Запомни|Помни|Итог|Вывод|Совет)(\s*[:!—–-]\s*)(.+)$/u)) && !t.startsWith("📌")) {
      out.push("📌 " + inline(m[1] + (/^\s*[—–-]\s*$/.test(m[2]) ? " — " : m[2].trim() + " ") + m[3].trim()));
      continue;
    }
    out.push(inline(t));
  }

  // 1б) «— пункт» / «– пункт» две строки и больше подряд — список (одна такая строка — скорее реплика, её не трогаем)
  for (let i = 0; i < out.length; i++) {
    let j = i;
    while (j < out.length && /^[—–]\s+\S/.test(out[j] || "")) j++;
    if (j - i >= 2) for (let k = i; k < j; k++) out[k] = "• " + out[k].replace(/^[—–]\s+/, "");
    if (j > i) i = j - 1;
  }

  // 2) нумерованные списки из 2–9 пунктов → 1️⃣ 2️⃣ (подряд, пустые строки между пунктами не мешают)
  const num = (t) => t.match(/^(\d{1,2})[.)]\s+(.+)$/);
  for (let i = 0; i < out.length; i++) {
    if (!num(out[i])) continue;
    const run = [];
    let j = i;
    while (j < out.length && (num(out[j]) || (!out[j] && j + 1 < out.length && num(out[j + 1])))) { if (out[j]) run.push(j); j++; }
    const nums = run.map((k) => Number(num(out[k])[1]));
    if (run.length >= 2 && run.length <= 9 && nums.every((n, k) => n === nums[0] + k) && nums[0] === 1) {
      run.forEach((k, idx) => { out[k] = KEYCAPS[idx] + " " + num(out[k])[2].trim(); });
      for (let k = run[0]; k <= run[run.length - 1]; k++) if (!out[k]) out[k] = null;   // пустые строки внутри списка — долой
    }
    i = j - 1;
  }
  out = out.filter((l) => l !== null);

  // 3) «Что делаем:» или «Наши принципы» (коротко, без точки) перед списком → подзаголовок
  for (let i = 0; i < out.length; i++) {
    const t = out[i];
    if (kindOf(t) !== "para" || !/^[А-ЯЁA-Z«"][^.!?;]{1,58}$/.test(t) || /[,—–]$/.test(t) || t.includes("**")) continue;
    let j = i + 1; while (j < out.length && !out[j]) j++;
    if (j < out.length && kindOf(out[j]) === "item") out[i] = head(t);
  }

  // 4) переносы строк из PDF: абзац без точки в конце, а следующий начинается со строчной — одна строка
  const glued = [];
  for (const t of out) {
    const prev = glued.length ? glued[glued.length - 1] : "";
    if (t && prev && kindOf(prev) === "para" && kindOf(t) === "para" && !/[.!?:;…»)]$/.test(prev) && /^[a-zа-яё(]/.test(t)) glued[glued.length - 1] = prev + " " + t;
    else glued.push(t);
  }

  // 5) раскладка: части и абзацы — через пустую строку; после заголовка, внутри списка и после «…:» — без неё
  const lines = [];
  for (const t0 of glued) {
    if (!t0) continue;
    const parts = kindOf(t0) === "para" ? splitLong(t0) : [t0];
    for (const t of parts) {
      const prev = lines.length ? lines[lines.length - 1] : null;
      if (prev !== null) {
        const a = kindOf(prev), b = kindOf(t);
        const tight = a === "head" || (a === "item" && b === "item" && family(prev) === family(t) && family(t) !== "pin")
          || (a === "para" && prev.endsWith(":") && (b === "item" || b === "quote")) || (a === "quote" && b === "quote");
        if (!tight) lines.push("");
      }
      lines.push(t);
    }
  }
  return lines.join("\n").trim();
}

/** Что в тексте: слова, карточки (как их покажет экран урока), крупная первая мысль, части, пункты, выводы 📌. */
export function lookInfo(text) {
  const t = typeof text === "string" ? text : "";
  const ls = t.split("\n").map((x) => x.trim()).filter(Boolean);
  const first = ls[0] || "";
  return {
    words: t.trim() ? t.trim().split(/\s+/).length : 0,
    cards: t.trim() ? lessonCards(t).length : 0,
    lead: !!first && kindOf(first) === "para" && !/^\p{Extended_Pictographic}/u.test(first) && first.length >= 30,
    heads: ls.filter(isHead).length,
    items: ls.filter(isItem).length,
    pins: ls.filter((x) => x.startsWith("📌")).length,
  };
}

// ── вид строки для экрана (ui/lesson-look.jsx): значки урока живут здесь, а не в разметке экрана ──────────────────
const LEVELS = { "🔵": "blue", "🟢": "green", "🟡": "yellow", "🟠": "orange", "🔴": "red" };
/** Строка урока со значком → { k: check | ban | good | bad | pin | step | level | star | diamond, n?, level? } или null. */
export function lineKind(t) {
  if (!t) return null;
  if (/^☑/u.test(t)) return { k: "check" };
  if (t.startsWith("🚫")) return { k: "ban" };
  if (t.startsWith("✅")) return { k: "good" };
  if (t.startsWith("❌")) return { k: "bad" };
  if (t.startsWith("📌")) return { k: "pin" };
  const kc = t.match(/^([1-9])\uFE0F?\u20E3/u);
  if (kc) return { k: "step", n: kc[1] };
  const lv = LEVELS[[...t][0]];
  if (lv) return { k: "level", level: lv };
  if (t.startsWith("🌟")) return { k: "star" };
  if (t.startsWith("🔹")) return { k: "diamond" };
  return null;
}

// ── кнопки разметки в правке блока «О нас» (ui/concept.jsx) ─────────────────────────────────────────────────────
const MARK_OF = { list: "• ", check: "☑ ", good: "✅ ", ban: "🚫 ", pin: "📌 " };
const MARK_RE = /^(•|☑️?|✅|❌|🚫|📌|🔹|[1-9]\uFE0F?\u20E3)\s*/u;
/**
 * Разметка выделенных строк текста v (выделение s..e): bold — **жирное**, head — подзаголовок, list — «• », steps — 1️⃣ 2️⃣,
 * check — «☑ », good — «✅ », ban — «🚫 », pin — «📌 », quote — «ёлочки». Повторное нажатие снимает. → { v, s, e }.
 */
export function markLines(v, s, e, kind) {
  if (kind === "bold") { const sel = v.slice(s, e) || "текст"; return { v: v.slice(0, s) + "**" + sel + "**" + v.slice(e), s: s + 2, e: s + 2 + sel.length }; }
  const ls = s === 0 ? 0 : v.lastIndexOf("\n", s - 1) + 1;
  let le = v.indexOf("\n", e); if (le < 0) le = v.length;
  const lines = v.slice(ls, le).split("\n");
  const bare = (x) => x.replace(MARK_RE, "").replace(/^\*\*(.*)\*\*$/, "$1").replace(/^«(.*)»$/, "$1");
  let nl;
  if (kind === "head") nl = lines.map((x) => (/^\*\*.+\*\*$/.test(x) ? x.slice(2, -2) : "**" + (bare(x) || "Заголовок") + "**"));
  else if (kind === "quote") nl = lines.every((x) => /^«.*»$/.test(x)) ? lines.map((x) => x.slice(1, -1)) : lines.map((x) => "«" + (bare(x) || "Фраза гостю") + "»");
  else if (kind === "steps") {
    let n = 0;
    nl = lines.every((x) => /^[1-9]\uFE0F?\u20E3/u.test(x)) ? lines.map((x) => x.replace(MARK_RE, "")) : lines.map((x) => (x.trim() ? KEYCAPS[Math.min(n++, 8)] + " " + bare(x) : x));
  } else {
    const mk = MARK_OF[kind] || MARK_OF.list;
    nl = lines.every((x) => x.startsWith(mk.trim())) ? lines.map((x) => x.replace(MARK_RE, "")) : lines.map((x) => (x.trim() ? mk + bare(x) : x));
  }
  const out = nl.join("\n");
  return { v: v.slice(0, ls) + out + v.slice(le), s: ls, e: ls + out.length };
}
