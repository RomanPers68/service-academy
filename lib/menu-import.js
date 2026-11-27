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

export const MENU_PDF_MAX = 3 * 1024 * 1024;   // хостинг принимает запрос до 4,5 МБ, а PDF в запросе на треть тяжелее файла
export const MENU_PDF_BIG = "PDF больше 3 МБ: сервер такой не примет. Сожми файл или раздели меню на части.";
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
  ? "AI не успел прочитать меню: сервер перестал ждать (код " + status + "). Нажми «Из PDF» ещё раз"
  : status === 413 ? "PDF слишком большой для сервера (код 413): сожми файл или раздели меню на части"
  : status === 404 ? "Функция импорта не найдена на сервере (код 404): /api/menu-import не развёрнута"
  : status === 429 ? "Слишком много импортов подряд — попробуй через час"
  : status >= 500 ? "Сервер импорта сейчас не отвечает (код " + status + "). Нажми ещё раз через минуту"
  : status === 200 ? "Сервер ответил не так, как ждали. Нажми «Из PDF» ещё раз"
  : status ? "Импорт не ответил (код " + status + "). Нажми ещё раз"
  : "Нет связи с сервером приложения: проверь интернет и нажми «Из PDF» ещё раз");

/** Ответ post() → текст ошибки: своя ошибка сервера — как есть, иначе по коду. r — { ok, status, j }. */
export const menuImportErr = (r) => (r && r.j && typeof r.j === "object" && r.j.error ? String(r.j.error) : menuImportWhy(r ? r.status || 0 : 0));

const chunk = (xs, n) => { const out = []; for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n)); return out; };

/**
 * Импорт целиком. post(body) → Promise<{ ok, status, j }> (j — ответ JSON или null; нет связи — status 0); токен
 * добавляет сам post. onProgress({ done, total }) — сколько позиций уже прочитано.
 * → { dishes, short, model }: dishes — по порядку меню; у недочитанных short: true и note = MENU_NO_DETAIL; short —
 * их названия. Не прочиталось ничего — ошибка понятными словами.
 */
export async function runMenuImport({ pdfBase64, post, onProgress = () => {}, batch = MENU_BATCH, parallel = MENU_PARALLEL }) {
  const r1 = await post({ mode: "names", pdfBase64 });
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
    const r = await post({ mode: "details", pdfBase64, names: part.map((x) => x.name) });
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
  if (short.length === names.length) throw new Error(firstErr || "AI не прочитал подробности — нажми «Из PDF» ещё раз");
  return { dishes, short, model: model || j1.model || "" };
}
