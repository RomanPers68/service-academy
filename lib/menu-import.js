// v204 (Доп. 530): импорт меню из PDF по частям — общее у сервера (api/menu-import.js), редактора меню и демо.
//
// Владелец (27.11, снимок «Редактора меню» с красной строкой «Сеть недоступна или функция /api/menu-import не
// развёрнута», зимнее меню — PDF 151 КБ, 2 страницы, 10 позиций): «Сам pdf весит очень мало. Поэтому не понятно почему
// он не грузит». Дело было не в сети: импорт одним запросом просил у модели сразу все блюда с описанием, составом и
// аллергенами — дольше минуты, и хостинг обрывал запрос своей страницей (не JSON), а редактор называл это «сеть
// недоступна». Теперь так:
//   1. names — модель перечисляет позиции меню (название и раздел): ответ короткий, несколько секунд;
//   2. details — подробности по MENU_BATCH позиций за запрос, по MENU_PARALLEL запроса сразу: каждый укладывается в
//      20–30 с, длинное меню не обрезается на 60 блюдах. Чего модель не дочитала — второй заход; не дочитала и
//      тогда — позиция приходит с названием и разделом и пометкой MENU_NO_DETAIL, остальное руководитель заполнит сам.
//   Ответил не наш сервер, а хостинг (не JSON) — причина своими словами и с кодом (menuImportWhy), как у винной карты.
//
// v206 (Доп. 532): у владельца импорт упёрся в «код 403» — запрос остановил сам Vercel (проверка «от ботов»), до
// функции он не дошёл. Теперь импорт идёт в функцию Supabase menu-import, туда же, куда Наставник (makeMenuPost); сервер
// приложения /api/menu-import — запасной, если функции в Supabase ещё нет (404).

import { DOC_ACCEPT, DOC_TEXT_MAX, fileKind } from "./file-kind.js";   // v209: общее с винной картой

export const MENU_PDF_MAX = 3 * 1024 * 1024;   // хостинг принимает запрос до 4,5 МБ, а PDF в запросе на треть тяжелее файла
export const MENU_PDF_BIG = "PDF больше 3 МБ: сервер такой не примет. Сожми файл, сохрани меню в Word или раздели на части.";

// v208 (Доп. 534): владелец — «может следующим мы добавим загрузку не только PDF, но и Word файл?». Кнопка «Из файла»
// принимает PDF, Word (.docx) и текст (.txt). Word читается прямо на телефоне (lib/docx-text.js, как «О нас» → «Из
// документа»), на сервер уходит текст: запрос лёгкий, модель читает быстрее, чем PDF.
// v209 (Доп. 535): что за файл и как его прочитать — общее с винной и барной картой (lib/file-kind.js)
export const MENU_FILE_ACCEPT = DOC_ACCEPT;
export const MENU_TEXT_MAX = DOC_TEXT_MAX;   // знаков текста в запросе — как MAX_TEXT у сервера
export const MENU_FILE_HINT = "PDF, Word (.docx) или текст — AI сам найдёт блюда";
/** Что за файл: "pdf" | "docx" | "txt" | "doc" (старый Word — не открыть) | "" (другое). */
export const menuFileKind = fileKind;
export const MENU_FILE_WHY = { doc: "Старый формат Word (.doc) не открыть. Сохрани меню как .docx или PDF.",
  other: "Подойдёт PDF, Word (.docx) или текст (.txt).", empty: "В файле не нашлось текста меню.",
  long: "Текст меню слишком длинный: раздели файл на части." };
export const MENU_BATCH = 4;
export const MENU_PARALLEL = 2;
export const MENU_NAMES_MAX = 200;
export const MENU_DETAILS_MAX = 6;   // позиций в одном запросе подробностей (сервер больше не примет)
export const MENU_NO_DETAIL = "AI не дочитал описание — заполни по PDF";

/** Название для сравнения: регистр, ё, кавычки и лишние пробелы не важны. */
export const normName = (s) => String(s == null ? "" : s).toLowerCase().replace(/ё/g, "е")
  .replace(/[«»"'“”„`]/g, "").replace(/\s+/g, " ").trim();

/** Ответ режима names → [{ name, cat }]: без пустых и повторов, по порядку меню, не больше MENU_NAMES_MAX. */
export function cleanNames(arr) {
  const seen = new Set(), out = [];
  for (const x of Array.isArray(arr) ? arr : []) {
    const name = String((x && typeof x === "object" ? x.name : x) || "").replace(/\s+/g, " ").trim().slice(0, 120);
    const k = normName(name);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push({ name, cat: String((x && typeof x === "object" && x.cat) || "").trim().slice(0, 40) });
    if (out.length >= MENU_NAMES_MAX) break;
  }
  return out;
}

/** Запрос подробностей: names — 1…MENU_DETAILS_MAX названий; иначе null. */
export function askNames(names) {
  if (!Array.isArray(names) || !names.length || names.length > MENU_DETAILS_MAX) return null;
  const out = names.map((n) => String(n == null ? "" : n).replace(/\s+/g, " ").trim().slice(0, 120));
  return out.every((n) => normName(n)) ? out : null;
}

/**
 * Из ответа модели — только запрошенные позиции, по порядку запроса; у каждой ask — как её спросили. Модель могла
 * вернуть и соседние блюда или чуть иначе написать название: сначала точное совпадение, потом «одно содержит другое».
 * → { dishes, missing } — missing: запрошенные, которых в ответе нет.
 */
export function pickRequested(dishes, names) {
  const list = Array.isArray(dishes) ? dishes : [];
  const used = new Set(), out = [], missing = [];
  const keyOf = (d) => normName(d && d.name);
  for (const n of names) {
    const k = normName(n);
    let i = list.findIndex((d, j) => !used.has(j) && keyOf(d) === k);
    if (i < 0) i = list.findIndex((d, j) => { const dk = keyOf(d); return !used.has(j) && dk.length >= 3 && (dk.includes(k) || k.includes(dk)); });
    if (i < 0) { missing.push(n); continue; }
    used.add(i);
    out.push({ ...list[i], ask: n });
  }
  return { dishes: out, missing };
}

/** Ответил хостинг, а не функция (не JSON): что сказать руководителю. Код в тексте — чтобы причину было видно на снимке. */
export const menuImportWhy = (status) => (status === 504 || status === 408
  ? "AI не успел прочитать меню: сервер перестал ждать (код " + status + "). Нажми «Из файла» ещё раз"
  : status === 413 ? "Файл слишком большой для сервера (код 413): сожми его или раздели меню на части"
  : status === 404 ? "Функция импорта не найдена на сервере (код 404): menu-import не развёрнута"
  : status === 403 ? "Запрос остановили по дороге к серверу (код 403). Нажми «Из файла» ещё раз"
  : status === 401 ? "Сервер не узнал тебя (код 401): войди в приложение заново и повтори импорт"
  : status === 429 ? "Слишком много импортов подряд — попробуй через час"
  : status >= 500 ? "Сервер импорта сейчас не отвечает (код " + status + "). Нажми ещё раз через минуту"
  : status === 200 ? "Сервер ответил не так, как ждали. Нажми «Из файла» ещё раз"
  : status ? "Импорт не ответил (код " + status + "). Нажми ещё раз"
  : "Нет связи с сервером приложения: проверь интернет и нажми «Из файла» ещё раз");

/** Ответ post() → текст ошибки: своя ошибка сервера — как есть, иначе по коду. r — { ok, status, j }. */
export const menuImportErr = (r) => (r && r.j && typeof r.j === "object" && r.j.error ? String(r.j.error) : menuImportWhy(r ? r.status || 0 : 0));

/**
 * v206 (Доп. 532): post(body) для runMenuImport. Сначала функция Supabase menu-import (адрес и ключ — как у Наставника);
 * её нет (404) — с этого места всё через сервер приложения /api/menu-import. Нет связи — { ok: false, status: 0 }: повтор
 * решает runMenuImport, на запасной путь не уходим (у владельца там 403). → (body) => Promise<{ ok, status, j, via }>
 */
export function makeMenuPost({ supabaseUrl = "", supabaseKey = "", token = "", fetchFn } = {}) {
  const f = fetchFn || ((u, o) => fetch(u, o));
  const send = (url, headers, b, via) => f(url, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify({ ...b, token }) })
    .then((r) => r.json().catch(() => null).then((j) => ({ ok: r.ok, status: r.status, j, via })))
    .catch(() => ({ ok: false, status: 0, j: null, via }));
  const base = String(supabaseUrl || "").replace(/\/+$/, "");
  const auth = /^eyJ/.test(supabaseKey) ? { apikey: supabaseKey, Authorization: "Bearer " + supabaseKey } : { apikey: supabaseKey };
  let useSupabase = !!base;
  return async (b) => {
    if (useSupabase) {
      const r = await send(base + "/functions/v1/menu-import", auth, b, "supabase");
      if (r.status !== 404) return r;
      useSupabase = false;   // функции ещё нет — дальше через сервер приложения
    }
    return send("/api/menu-import", {}, b, "vercel");
  };
}

const chunk = (xs, n) => { const out = []; for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n)); return out; };

/**
 * Импорт целиком. post(body) → Promise<{ ok, status, j }> (j — ответ JSON или null; нет связи — status 0); токен
 * добавляет сам post. onProgress({ done, total }) — сколько позиций уже прочитано.
 * → { dishes, short, model }: dishes — по порядку меню; у недочитанных short: true и note = MENU_NO_DETAIL; short —
 * их названия. Не прочиталось ничего — ошибка понятными словами.
 */
export async function runMenuImport({ pdfBase64, text, post, onProgress = () => {}, batch = MENU_BATCH, parallel = MENU_PARALLEL }) {
  const src = text ? { text } : { pdfBase64 };   // v208: меню из Word или текста — текстом, без PDF
  const r1 = await post({ mode: "names", ...src });
  const j1 = r1 && r1.j;
  // сервер без режимов (старая сборка): всё прочитано одним запросом
  if (r1 && r1.ok && j1 && Array.isArray(j1.dishes) && !Array.isArray(j1.names)) return { dishes: j1.dishes, short: [], model: j1.model || "" };
  if (!r1 || !r1.ok || !j1 || !Array.isArray(j1.names)) throw new Error(menuImportErr(r1));
  const names = cleanNames(j1.names);
  if (!names.length) throw new Error("В PDF не нашлось ни одного блюда — проверь файл и попробуй ещё раз");
  const got = new Map();
  let done = 0, firstErr = "", model = "";
  onProgress({ done, total: names.length });
  const runPart = async (part, again) => {
    const r = await post({ mode: "details", ...src, names: part.map((x) => x.name) });
    if (r && r.ok && r.j && Array.isArray(r.j.dishes)) {
      if (!model && r.j.model) model = String(r.j.model);
      for (const d of r.j.dishes) {
        const k = normName(d && (d.ask || d.name));
        if (k && !got.has(k)) got.set(k, d);
      }
      const miss = part.filter((x) => !got.has(normName(x.name)));
      if (miss.length && !again) await runPart(miss, true);
      return;
    }
    if (!firstErr) firstErr = menuImportErr(r);
    if (!again) await runPart(part, true);   // один повтор
  };
  const parts = chunk(names, Math.max(1, batch));
  let next = 0;
  const worker = async () => {
    while (next < parts.length) {
      const p = parts[next++];
      await runPart(p, false);
      done = Math.min(names.length, done + p.length);
      onProgress({ done, total: names.length });
    }
  };
  await Promise.all(Array.from({ length: Math.min(Math.max(1, parallel), parts.length) }, worker));
  const dishes = [], short = [];
  for (const x of names) {
    const d = got.get(normName(x.name));
    if (d) {
      const { ask, ...rest } = d;
      dishes.push({ ...rest, name: String(rest.name || "").trim() || x.name, cat: rest.cat || x.cat || "" });
    } else {
      short.push(x.name);
      dishes.push({ name: x.name, cat: x.cat || "", desc: "", ingredients: [], allergens: [], note: MENU_NO_DETAIL, pairing: "", short: true });
    }
  }
  if (short.length === names.length) throw new Error(firstErr || "AI не прочитал подробности — нажми «Из файла» ещё раз");
  return { dishes, short, model: model || j1.model || "" };
}
