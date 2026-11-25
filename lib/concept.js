// lib/concept.js — v139 (Доп. 454): «О нас» — концепция и стандарты сети и каждого заведения. Без React.
//
// Владелец (05.11), про таблицу обучения холдинга: «По поводу концепции, можно оставить редактор, чтобы каждое заведение
// могло вписать свою концепцию, а руководитель сети общую»; про стандарты: «да. Я про дресс-код, фото и т.д.»; главное:
// «чтобы это было дополнением к имеющемуся. И чтобы все функции приложения с этим взаимодействовали».
//
// Сервер — этап 49 (supabase-stage49-concept.sql): concept_get отвечает { ok, mine, restaurant, net: { blocks, ver },
// venue: { name, blocks, ver } | null, others: [{ name, blocks }], read: { net, venue }, can: { net, venue }, venues }.
// Блок: { id, scope, kind, title, body, photos: [{ id, cap }], tracks, questions, sort, at, by }.
// Здесь: виды блоков, кто что видит, раздел «Наш ресторан» в программе каждого трека (в формате своих уроков:
// lib/custom-modules.js, поэтому его сразу видят прогресс, задания дня, экзамен, отчёт, вопрос дня, брифинг и
// Наставник), поиск, данные для Наставника и кэш на телефоне.
import { buildCustomModules, revOf } from "./custom-modules.js";
import { lessonize } from "./lesson-look.js";   // v191 (Доп. 516): текст уроков раздела — разметкой штатных уроков
import { cleanChoice } from "./utils.js";   // v195 (Доп. 520): варианты без повторов

/** Виды блоков: что писать, для кого по умолчанию (пусто — все треки), можно ли фото. Порядок — порядок раздела. */
export const CN_KINDS = [
  { kind: "idea", title: "Концепция и история", hint: "Идея, с чего начинали, чем мы отличаемся", photo: true, tracks: [] },
  { kind: "values", title: "Ценности", hint: "Во что верим и как это видно в работе", photo: false, tracks: [] },
  // v142 (Доп. 461): уроки «Приём и хранение» ведут сюда — кто в смене принимает поставки (ЕГАИС и ЭДО)
  // v143 (Доп. 463): и «Инвентарь и оборудование бара» — кто меняет баллоны CO2 и кто отвечает за ремонт (в стандарте — «Заполнить»)
  { kind: "structure", title: "Структура: кто за что отвечает", hint: "Руководители, к кому с каким вопросом: поставки (ЕГАИС и ЭДО), баллоны CO2, ремонт техники", photo: false, tracks: [] },
  { kind: "guest", title: "Наш гость", hint: "Кто к нам приходит и за чем", photo: false, tracks: [] },
  { kind: "kitchen", title: "Кухня и бар", hint: "Что готовим и наливаем, наше фирменное", photo: true, tracks: [] },
  { kind: "mood", title: "Атмосфера", hint: "Интерьер, музыка, свет, настроение", photo: true, tracks: [] },
  { kind: "pitch", title: "Рассказ гостю за 30 секунд", hint: "Как коротко рассказать гостю о нас", photo: false, tracks: [] },
  { kind: "dress", title: "Внешний вид и дресс-код", hint: "Форма, обувь, волосы, украшения, ногти", photo: true, tracks: [] },
  { kind: "setting", title: "Сервировка залов", hint: "Как накрыт стол: фото и порядок", photo: true, tracks: [] },
  { kind: "check", title: "Правильный чек: к чему стремимся", hint: "Средний чек и из чего он складывается", photo: false, tracks: ["seasonal", "core", "manager", "service_manager"] },
  { kind: "day", title: "Распорядок дня менеджера", hint: "Что и когда делает менеджер на смене", photo: false, tracks: ["manager", "service_manager"] },
  { kind: "numbers", title: "Цифры смены: на что смотрим", hint: "Выручка, средний чек, гости, списания", photo: false, tracks: ["manager", "service_manager"] },
  { kind: "own", title: "Свой блок", hint: "Всё остальное, заголовок свой", photo: true, tracks: [] },
];
export const CN_KIND_IDS = CN_KINDS.map((k) => k.kind);
export const CN_TRACKS = ["seasonal", "core", "spg", "bar", "manager", "service_manager"];
/** Соседям по сети видна только концепция заведения (как _sa_cn_public на сервере). */
export const CN_PUBLIC = ["idea", "guest", "kitchen", "mood", "pitch"];
export const CN_LIMITS = { title: 80, body: 6000, cap: 120, photos: 8, questions: 12, blocks: 40 };
/** Название раздела в программе каждого трека (по умолчанию; v191 — своё задают в редакторе, этап 57). */
export const CN_SECTION = "Наш ресторан";
export const CN_SUB = "Концепция и стандарты";
export const CN_META_LIMITS = { title: 40, sub: 60 };
export const CN_CACHE = "sa_concept_v1";
export const CN_SEEN = "sa_concept_seen";   // + uk: версии, о которых уже сказали точкой «новое»

export const kindOf = (kind) => CN_KINDS.find((k) => k.kind === kind) || CN_KINDS[CN_KINDS.length - 1];
const str = (v, n) => String(v == null ? "" : v).replace(/\r/g, "").trim().slice(0, n);

/** Вопрос теста: вопрос, 2–4 варианта, верный — один из них. Иначе null (как _sa_cn_questions). */
export function cleanQuestion(x) {
  if (!x || typeof x !== "object") return null;
  const q = str(x.q, 400);
  const o = Array.isArray(x.options) ? x.options : null;
  if (!q || !o || o.length < 2 || o.length > 4) return null;
  const options = o.map((s) => (typeof s === "string" ? str(s, 200) : ""));
  if (options.some((s) => !s)) return null;
  const correct = Number(x.correct);
  if (!Number.isInteger(correct) || correct < 0 || correct >= options.length) return null;
  // v195 (Доп. 520): повтор варианта убираем, верный остаётся верным: иначе выбор «того же» текста засчитан ошибкой
  const c = cleanChoice(options, correct);
  if (!c) return null;
  return { q, options: c.options, correct: c.correct, explanation: str(x.explanation, 500) };
}

/** Блок с сервера → чистый блок или null. */
export function cleanBlock(b) {
  if (!b || typeof b !== "object" || !CN_KIND_IDS.includes(b.kind)) return null;
  const id = Number(b.id);
  if (!Number.isInteger(id) || id <= 0) return null;
  const photos = (Array.isArray(b.photos) ? b.photos : []).filter((p) => p && Number.isInteger(Number(p.id)) && Number(p.id) > 0)
    .slice(0, CN_LIMITS.photos).map((p) => ({ id: Number(p.id), cap: str(p.cap, CN_LIMITS.cap) }));
  const tracks = [...new Set((Array.isArray(b.tracks) ? b.tracks : []).filter((t) => CN_TRACKS.includes(t)))];
  const questions = (Array.isArray(b.questions) ? b.questions : []).map(cleanQuestion).filter(Boolean).slice(0, CN_LIMITS.questions);
  return { id, scope: typeof b.scope === "string" ? b.scope : "", kind: b.kind, title: str(b.title, CN_LIMITS.title) || kindOf(b.kind).title,
    body: str(b.body, CN_LIMITS.body), photos, tracks, questions, sort: Number.isFinite(Number(b.sort)) ? Number(b.sort) : 0,
    at: typeof b.at === "string" ? b.at : "", by: typeof b.by === "string" ? b.by : "" };
}

const blocksOf = (arr) => (Array.isArray(arr) ? arr.map(cleanBlock).filter(Boolean) : []);

/** Ответ concept_get → данные для экрана и программы или null. */
export function normConcept(r) {
  if (!r || typeof r !== "object" || r.ok !== true) return null;
  const net = r.net && typeof r.net === "object" ? r.net : {};
  const ven = r.venue && typeof r.venue === "object" && typeof r.venue.name === "string" && r.venue.name ? r.venue : null;
  const read = r.read && typeof r.read === "object" ? r.read : {};
  const can = r.can && typeof r.can === "object" ? r.can : {};
  return {
    mine: typeof r.mine === "string" ? r.mine : "",
    restaurant: typeof r.restaurant === "string" ? r.restaurant : "",
    // v192 (Доп. 517): at — когда редакцию меняли последний раз (этап 58)
    net: { blocks: blocksOf(net.blocks), ver: typeof net.ver === "string" ? net.ver : "", at: iso(net.at) },
    venue: ven ? { name: ven.name, blocks: blocksOf(ven.blocks), ver: typeof ven.ver === "string" ? ven.ver : "", at: iso(ven.at) } : null,
    others: (Array.isArray(r.others) ? r.others : []).filter((o) => o && typeof o.name === "string" && o.name)
      .map((o) => ({ name: o.name, blocks: blocksOf(o.blocks).filter((b) => CN_PUBLIC.includes(b.kind)) })).filter((o) => o.blocks.length),
    read: { net: typeof read.net === "string" ? read.net : "", venue: typeof read.venue === "string" ? read.venue : "" },
    // v192 (Доп. 517): когда человек отметил «Ознакомлен(а)» и что поменялось с тех пор (этап 58; без него — пусто)
    readAt: { net: iso(r.read_at && r.read_at.net), venue: iso(r.read_at && r.read_at.venue) },
    changes: { net: changesOf(r.changes && r.changes.net), venue: ven ? changesOf(r.changes && r.changes.venue) : null },
    can: { net: can.net === true, venue: can.venue === true },
    venues: Array.isArray(r.venues) ? r.venues.filter((x) => typeof x === "string" && x) : [],
    // v191 (Доп. 516): своё название раздела (этап 57); без этапа — null, раздел «Наш ресторан», как раньше
    meta: r.meta && typeof r.meta === "object" ? { net: metaOf(r.meta.net), venue: ven ? metaOf(r.meta.venue) : { title: "", sub: "" } } : null,
  };
}
const iso = (v) => (typeof v === "string" && /^\d{4}-\d\d-\d\d/.test(v) ? v : "");
// v192: что поменялось в части после отметки: was — блоки, как их видели тогда; fresh — номера новых; gone — убранные
function changesOf(x) {
  if (!x || typeof x !== "object") return null;
  const arr = (v) => (Array.isArray(v) ? v : []);
  const was = arr(x.was).map((w) => (w && Number.isInteger(Number(w.id)) && Number(w.id) > 0 ? {
    id: Number(w.id), kind: CN_KIND_IDS.includes(w.kind) ? w.kind : "own", title: str(w.title, CN_LIMITS.title), body: str(w.body, CN_LIMITS.body),
    photos: arr(w.photos).filter((p) => p && Number(p.id) > 0).map((p) => ({ id: Number(p.id), cap: str(p.cap, CN_LIMITS.cap) })),
    tracks: arr(w.tracks).filter((t) => CN_TRACKS.includes(t)) } : null)).filter(Boolean);
  const fresh = arr(x.fresh).map(Number).filter((n) => Number.isInteger(n) && n > 0);
  const gone = arr(x.gone).map((g) => (g && Number(g.id) > 0 ? { id: Number(g.id), kind: CN_KIND_IDS.includes(g.kind) ? g.kind : "own", title: str(g.title, CN_LIMITS.title),
    tracks: arr(g.tracks).filter((t) => CN_TRACKS.includes(t)), at: iso(g.at) } : null)).filter(Boolean);
  return { at: iso(x.at), was, fresh, gone };
}
const metaOf = (m) => ({ title: str(m && m.title, CN_META_LIMITS.title), sub: str(m && m.sub, CN_META_LIMITS.sub),
  mode: m && (m.mode === "info" || m.mode === "credit") ? m.mode : "" });

/**
 * v191 (Доп. 516): название раздела в треках — { title, sub }. Владелец: «Добавил концепцию холдинга, а приложение
 * тему назвало «Наш ресторан». Мы можем добавить возможность дописывать название блока?» Своё заведение главнее сети,
 * у сети пусто — «Наш ресторан» и «Концепция и стандарты».
 */
export function conceptSection(c) {
  const m = c && c.meta;
  const pick = (k) => (m && m.venue && m.venue[k]) || (m && m.net && m.net[k]) || "";
  // v191: как проходить — владелец (21.11): «Может концепцию сделаем как ознакомительный блок?» По умолчанию — для
  // ознакомления (lib/info-topics.js: в прогресс трека, отчёт и экзамен не идёт, тест — самопроверка); «в зачёт» — как
  // обычная тема. Заведение главнее сети.
  const mode = pick("mode") || "info";
  return { title: pick("title") || CN_SECTION, sub: pick("sub") || CN_SUB, mode, info: mode !== "credit" };
}

/** Блок виден треку: «для кого» пусто — всем. */
export const blockFor = (b, track) => !!b && (!b.tracks || !b.tracks.length || !track || b.tracks.includes(track));

const order = (a, b) => {
  const ka = CN_KIND_IDS.indexOf(a.kind), kb = CN_KIND_IDS.indexOf(b.kind);
  return (ka - kb) || ((a.sort || 0) - (b.sort || 0)) || (a.id - b.id);
};

/** Что непрочитано: { net, venue, any } (есть текст и его версия не та, что отмечена). */
export function conceptUnread(c) {
  if (!c) return { net: false, venue: false, any: false };
  const net = !!(c.net.ver && c.net.blocks.length && c.read.net !== c.net.ver);
  const venue = !!(c.venue && c.venue.ver && c.venue.blocks.length && c.read.venue !== c.venue.ver);
  return { net, venue, any: net || venue };
}

/** Есть ли что показать сотруднику этого трека. */
export const conceptHas = (c, track) => !!c && (c.net.blocks.some((b) => blockFor(b, track)) || !!(c.venue && c.venue.blocks.some((b) => blockFor(b, track))));

/** Пары «сеть + заведение» по видам для трека: [{ key, kind, title, net: [блоки], venue: [блоки] }] в порядке видов. */
export function conceptPairs(c, track) {
  if (!c) return [];
  const net = c.net.blocks.filter((b) => blockFor(b, track)).sort(order);
  const ven = (c.venue ? c.venue.blocks : []).filter((b) => blockFor(b, track)).sort(order);
  const out = [];
  for (const k of CN_KIND_IDS) {
    if (k === "own") continue;
    const n = net.filter((b) => b.kind === k), v = ven.filter((b) => b.kind === k);
    if (!n.length && !v.length) continue;
    // и у сети, и у заведения — общий заголовок вида («Концепция и история»), иначе — заголовок блока
    out.push({ key: "cn-" + k, kind: k, title: n.length && v.length ? kindOf(k).title : (v[0] || n[0]).title, net: n, venue: v });
  }
  // свои блоки — каждый отдельно: сначала сети, потом заведения
  for (const b of [...net, ...ven].filter((x) => x.kind === "own")) {
    out.push({ key: "cn-o" + b.id, kind: "own", title: b.title, net: b.scope === "" ? [b] : [], venue: b.scope === "" ? [] : [b] });
  }
  return out;
}

const join = (arr) => arr.map((b) => b.body).filter(Boolean).join("\n\n");

/**
 * Записи «своих уроков» (формат cms_list_lessons: id, role, module, title, content, questions, sort) для раздела
 * «Наш ресторан» трека: урок на вид (сеть, потом «В «Заведении»»), фото — полем photos, вопросы всех блоков — в общий
 * тест раздела. Номера постоянные: поправили текст — тема в треке получает «обновлено, освежи».
 * v191 (Доп. 516): номера у каждого трека свои (cn-spg-idea, шаг урока — cms-l-cn-spg-idea). Владелец (21.11): «Он
 * должен учитывать только роль, в которой его прошли». key — прежний номер вида (cn-idea): по нему «версия» раздела,
 * а photoKey — обложка урока, одна на все треки (её ставят один раз). Пройденное раньше переезжает в свою роль на
 * сервере (этап 57).
 */
export function conceptRecords(c, track, look = false) {
  if (!c || !track) return [];
  const vname = c.venue ? c.venue.name : "";
  const name = conceptSection(c).title;   // v191: своё название раздела
  return conceptPairs(c, track).map((p, i) => {
    // v191 (Доп. 516): look — текст для экрана урока, разметкой штатных уроков (lib/lesson-look.js)
    const nb = look ? lessonize(join(p.net)) : join(p.net), vb = look ? lessonize(join(p.venue)) : join(p.venue);
    const content = nb && vb ? nb + "\n\n**В «" + vname + "»**\n" + vb : nb || vb;
    const photos = [...p.net, ...p.venue].flatMap((b) => b.photos).slice(0, 12);
    const questions = [...p.net, ...p.venue].flatMap((b) => b.questions);
    return { id: "cn-" + track + "-" + p.key.slice(3), key: p.key, photoKey: "cms-l-" + p.key, role: track, module: name, title: p.title, content: content || p.title, questions, sort: i, photos };
  });
}

/** Раздел «Наш ресторан» (или своё название) трека — модуль программы (или пустой список, если показать нечего). */
export function conceptModules(c, track, color, icon) {
  const recs = conceptRecords(c, track, true);
  if (!recs.length) return [];
  const sec = conceptSection(c);
  // v191: «версия» для пометки «обновлено» — по тексту, как его написали, и по прежним номерам видов: новая разметка на
  // экране и свои номера у трека — не повод освежать
  const rev = revOf(conceptRecords(c, track).map((r) => ({ ...r, id: r.key })));
  // свой номер модуля (cn-<трек>): раздел из редактора контента с тем же названием не сольётся с этим
  // v191: info — «для ознакомления» (lib/info-topics.js), пока раздел не перевели «в зачёт»
  return buildCustomModules(recs, track, { color, icon }).map((m) => ({ ...m, id: "cn-" + track, tag: "О нас", title: sec.title, subtitle: sec.sub, rev, concept: true,
    ...(sec.info ? { info: true } : {}) }));
}

/** Записи раздела для всех треков (отчёт, книга отзывов, названия шагов в аналитике). v191: для ознакомления — в отчёт не идёт. */
export const conceptRecordsAll = (c) => (c && !conceptSection(c).info ? CN_TRACKS.flatMap((t) => conceptRecords(c, t)) : []);

const plain = (s) => String(s || "").replace(/\*\*/g, "").replace(/^• /gm, "").replace(/\s+/g, " ").trim();

/** Для поиска: [{ id, title, where, text }] — сеть, своё заведение, соседи (их концепция). */
export function conceptSearchItems(c, track) {
  if (!c) return [];
  const out = [];
  const add = (b, where) => out.push({ id: b.id, kind: b.kind, title: b.title, where, text: plain(b.body) + " " + b.photos.map((p) => p.cap).join(" ") });
  c.net.blocks.filter((b) => blockFor(b, track)).forEach((b) => add(b, "Вся сеть"));
  if (c.venue) c.venue.blocks.filter((b) => blockFor(b, track)).forEach((b) => add(b, c.venue.name));
  c.others.forEach((o) => o.blocks.forEach((b) => add(b, o.name)));
  return out;
}

const norm = (s) => String(s || "").toLowerCase().replace(/ё/g, "е");
const STOP = new Set(["нас", "вас", "наш", "наша", "наше", "наши", "как", "что", "это", "для", "или", "чем", "при", "его", "она", "они", "мне", "нам", "вам", "где", "так", "все", "всё", "уже", "еще", "ещё"]);
const words = (q) => norm(q).split(/[^а-яa-z0-9]+/).filter((w) => w.length >= 3 && !STOP.has(w));
// вопрос про концепцию, стандарты, заведения сети
const TRIG = /концепц|истори|ценност|структур|кто за что|отвеча|дресс|форм[аеуы]|внешн|ногт|украшен|сервировк|накрыт|средн\w* чек|правильн\w* чек|распорядок|цифр|атмосфер|о нас|наш\w* ресторан|заведени|соседн|сет[ьи]\b|рассказ\w* гост/;

/**
 * Наставнику: выдержки из «О нас» по вопросу (сеть, своё заведение, соседи) или null. Не больше ~700 знаков: каждое
 * сообщение сервер режет до 2000, место нужно и меню со справочником.
 */
export function conceptAssistantContext(q, c, track, max = 700) {
  if (!c || !q) return null;
  const ws = words(q), nq = norm(q);
  const items = conceptSearchItems(c, track);
  if (!items.length) return null;
  const names = [c.venue && c.venue.name, ...c.others.map((o) => o.name)].filter(Boolean);
  const byName = names.filter((n) => nq.includes(norm(n).split(",")[0].trim()));
  const scored = items.map((it) => {
    const hay = norm(it.title + " " + it.text + " " + it.where);
    let s = ws.reduce((a, w) => a + (hay.includes(w) ? 1 : 0), 0);
    if (byName.some((n) => n === it.where)) s += 2;
    return { it, s };
  }).filter((x) => x.s > 0).sort((a, b) => b.s - a.s);
  if (!scored.length || (!TRIG.test(nq) && scored[0].s < 2 && !byName.length)) return null;
  let out = "";
  for (const { it } of scored.slice(0, 3)) {
    const line = "«" + it.title + "» (" + it.where + "): " + it.text;
    if (out.length + line.length > max) { if (!out) out = line.slice(0, max - 1) + "…"; break; }
    out += (out ? "\n" : "") + line;
  }
  return out ? "[О нас, концепция и стандарты заведений сети: " + out + "]" : null;
}

/** Программы ролей для брифинга (вопрос команде) — с разделом «Наш ресторан» у новичка и ядра. */
export function withConceptPrograms(programs, c) {
  if (!c || conceptSection(c).info) return programs;   // v191: раздел для ознакомления в вопрос команде не идёт
  const out = { ...(programs || {}) };
  for (const t of ["seasonal", "core"]) {
    const mods = conceptModules(c, t, "");
    if (mods.length) out[t] = [...mods, ...(out[t] || [])];
  }
  return out;
}

/** Блок для новичка: дресс-код его трека (сеть или заведение) — есть ли что открыть. */
export function conceptDress(c, track) {
  if (!c) return null;
  const p = conceptPairs(c, track).find((x) => x.kind === "dress");
  return p ? { key: p.key, title: p.title } : null;
}

// ── v192 (Доп. 517): «Ознакомлен(а)», «Что изменилось», обложка, рассказ гостю ─────────────────────────────
// Владелец (23.11), про семь идей для «О нас»: «Ты правильно понял. Делаем все 7».

/**
 * Отметка «Ознакомлен(а)»: { has — есть что читать, need — нужна отметка (что-то новое), at — когда отметил нынешнюю
 * редакцию (если отметил), edition — когда её меняли последний раз }. Без этапа 58 даты пустые.
 */
export function conceptAck(c) {
  if (!c) return { has: false, need: false, at: "", edition: "" };
  const net = !!(c.net.ver && c.net.blocks.length), ven = !!(c.venue && c.venue.ver && c.venue.blocks.length);
  const u = conceptUnread(c);
  const last = (arr) => arr.filter(Boolean).sort().slice(-1)[0] || "";
  const ra = c.readAt || {};
  return { has: net || ven, need: u.any, at: u.any ? "" : last([net ? ra.net : "", ven ? ra.venue : ""]),
    edition: last([net ? c.net.at : "", ven ? c.venue.at : ""]) };
}

const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
/** «20 ноября 2026» по часам телефона (дата редакции, отметки); пусто — пусто. */
export const dayWords = (iso) => { const d = new Date(iso || ""); return iso && !isNaN(d) ? d.getDate() + " " + MONTHS[d.getMonth()] + " " + d.getFullYear() : ""; };
/** «21.11.2026» — для листа ознакомления. */
export const dayDots = (iso) => { const d = new Date(iso || ""); const z = (n) => String(n).padStart(2, "0"); return iso && !isNaN(d) ? z(d.getDate()) + "." + z(d.getMonth() + 1) + "." + d.getFullYear() : ""; };

const sameView = (a, b) => a.title === b.title && a.body === b.body && JSON.stringify(a.photos || []) === JSON.stringify(b.photos || []);

/**
 * Что изменилось у человека после его отметки (этап 58): { at — с какой даты, items: [{ type: "edit" | "new" | "gone",
 * id, kind, title, where, was?, block? }] }. Только блоки, которые он видит (all — все, у руководителя); блок, который
 * стал виден, — «new», перестал — «gone»; поменяли только «для кого», а ему всё видно по-прежнему — не изменение.
 */
export function conceptChanges(c, track, all = false) {
  const out = { at: "", items: [] };
  if (!c || !c.changes) return out;
  const vis = (b) => all || blockFor(b, track);
  const part = (ch, blocks, where) => {
    if (!ch) return;
    for (const w of ch.was) {
      const b = blocks.find((x) => x.id === w.id);
      if (!b) continue;
      if (vis(b) && vis(w)) { if (!sameView(b, w)) out.items.push({ type: "edit", id: b.id, kind: b.kind, title: b.title, where, was: w, block: b }); }
      else if (vis(b)) out.items.push({ type: "new", id: b.id, kind: b.kind, title: b.title, where, block: b });
      else if (vis(w)) out.items.push({ type: "gone", id: b.id, kind: w.kind, title: w.title, where });
    }
    for (const id of ch.fresh) { const b = blocks.find((x) => x.id === id); if (b && vis(b)) out.items.push({ type: "new", id, kind: b.kind, title: b.title, where, block: b }); }
    for (const g of ch.gone) if (vis(g)) out.items.push({ type: "gone", id: g.id, kind: g.kind, title: g.title, where });
  };
  part(c.changes.net, c.net.blocks, "Вся сеть");
  if (c.venue) part(c.changes.venue, c.venue.blocks, c.venue.name);
  out.at = [c.changes.net && c.changes.net.at, c.changes.venue && c.changes.venue.at].filter(Boolean).sort()[0] || "";
  return out;
}

/** Фото на обложку «О нас»: атмосфера, концепция, кухня, сервировка, свой блок (сначала заведение) → { id, cap } или null. */
export function conceptHero(c, track) {
  if (!c) return null;
  const blocks = [...(c.venue ? c.venue.blocks : []), ...c.net.blocks].filter((b) => blockFor(b, track) && b.photos.length);
  for (const k of ["mood", "idea", "kitchen", "setting", "own"]) {
    const b = blocks.find((x) => x.kind === k);
    if (b) return { id: b.photos[0].id, cap: b.photos[0].cap, kind: k };
  }
  return null;
}

/** Оглавление «О нас»: [{ id, kind, title, where }] — блоки сети, потом заведения, как на экране. */
export function conceptToc(c, track, all = false) {
  if (!c) return [];
  const vis = (b) => all || blockFor(b, track);
  return [...c.net.blocks.filter(vis).map((b) => ({ id: b.id, kind: b.kind, title: b.title, where: "Вся сеть" })),
    ...(c.venue ? c.venue.blocks.filter(vis).map((b) => ({ id: b.id, kind: b.kind, title: b.title, where: c.venue.name })) : [])];
}

const flat = (s) => String(s || "").replace(/\*\*/g, "").replace(/^• /gm, "").replace(/[ \t]+/g, " ").replace(/\n{2,}/g, "\n").trim();

/**
 * Тренажёр «Рассказ гостю за 30 секунд»: образец (блоки «Рассказ гостю» трека, сначала заведения) и факты (концепция,
 * гость, кухня, атмосфера) → { ref, facts, title, where } или null, если образца нет.
 */
export function conceptPitch(c, track) {
  if (!c) return null;
  const vis = (arr) => (arr || []).filter((b) => blockFor(b, track));
  const all = [...vis(c.venue ? c.venue.blocks : []), ...vis(c.net.blocks)];
  const pitch = all.filter((b) => b.kind === "pitch" && (b.body || "").trim());
  if (!pitch.length) return null;
  const facts = all.filter((b) => ["idea", "guest", "kitchen", "mood"].includes(b.kind)).map((b) => b.title + ": " + flat(b.body)).join("\n");
  return { ref: pitch.map((b) => flat(b.body)).join("\n").slice(0, 1500), facts: facts.slice(0, 3000), title: pitch[0].title,
    where: c.venue ? c.venue.name : conceptSection(c).title };
}

// ── кэш на телефоне: «О нас» видно и без сети, и с первого кадра (как свои уроки) ─────────────────────────
export function conceptFromStorage() {
  try { const raw = JSON.parse(localStorage.getItem(CN_CACHE) || "null"); return raw && raw.ok === true ? normConcept(raw) : null; } catch (e) { return null; }
}
export function conceptToStorage(raw) {
  try { if (raw && raw.ok === true) localStorage.setItem(CN_CACHE, JSON.stringify(raw)); } catch (e) { /* место кончилось — не страшно */ }
}

/** Новый пустой блок вида kind для заведения scope (редактор). */
export function blankBlock(kind, scope) {
  const k = kindOf(kind);
  return { id: null, scope: scope || "", kind: k.kind, title: k.kind === "own" ? "" : k.title, body: "", photos: [], tracks: [...k.tracks], questions: [], sort: null };
}

/** Что уходит на сервер (concept_save). */
export function blockPayload(b) {
  return { id: b.id || undefined, scope: b.scope || "", kind: b.kind, title: str(b.title, CN_LIMITS.title), body: str(b.body, CN_LIMITS.body),
    photos: (b.photos || []).slice(0, CN_LIMITS.photos).map((p) => ({ id: p.id, cap: str(p.cap, CN_LIMITS.cap) })),
    tracks: (b.tracks || []).filter((t) => CN_TRACKS.includes(t)),
    questions: (b.questions || []).map(cleanQuestion).filter(Boolean).slice(0, CN_LIMITS.questions),
    sort: Number.isInteger(b.sort) ? b.sort : undefined };
}

/** Почему не сохранить (подсказка редактору) или "". */
export function blockProblem(b) {
  if (!b) return "Нет блока";
  if (!str(b.title, CN_LIMITS.title)) return "Нужен заголовок";
  if (!str(b.body, CN_LIMITS.body) && !(b.photos || []).length) return "Нужен текст или фото";
  return "";
}

/** Подпись ошибки сервера. */
export function conceptErr(e) {
  return e === "forbidden" ? "Править может руководитель этого заведения или сети."
    : e === "auth" ? "Сессия устарела. Войди заново."
    : e === "too_many" ? "Блоков уже 40, это предел. Объедини похожие."
    : e === "bad_photo" ? "Фото не подошло. Попробуй другое."
    : e === "empty" ? "Нужен текст или фото."
    : e === "no_title" ? "Нужен заголовок."
    : e === "not_found" ? "Блок уже удалили. Обнови экран."
    : "Не получилось. Попробуй ещё раз.";
}
