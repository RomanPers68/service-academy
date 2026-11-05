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
import { buildCustomModules } from "./custom-modules.js";

/** Виды блоков: что писать, для кого по умолчанию (пусто — все треки), можно ли фото. Порядок — порядок раздела. */
export const CN_KINDS = [
  { kind: "idea", title: "Концепция и история", hint: "Идея, с чего начинали, чем мы отличаемся", photo: true, tracks: [] },
  { kind: "values", title: "Ценности", hint: "Во что верим и как это видно в работе", photo: false, tracks: [] },
  { kind: "structure", title: "Структура: кто за что отвечает", hint: "Руководители и к кому с каким вопросом", photo: false, tracks: [] },
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
/** Название раздела в программе каждого трека. */
export const CN_SECTION = "Наш ресторан";
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
  return { q, options, correct, explanation: str(x.explanation, 500) };
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
    net: { blocks: blocksOf(net.blocks), ver: typeof net.ver === "string" ? net.ver : "" },
    venue: ven ? { name: ven.name, blocks: blocksOf(ven.blocks), ver: typeof ven.ver === "string" ? ven.ver : "" } : null,
    others: (Array.isArray(r.others) ? r.others : []).filter((o) => o && typeof o.name === "string" && o.name)
      .map((o) => ({ name: o.name, blocks: blocksOf(o.blocks).filter((b) => CN_PUBLIC.includes(b.kind)) })).filter((o) => o.blocks.length),
    read: { net: typeof read.net === "string" ? read.net : "", venue: typeof read.venue === "string" ? read.venue : "" },
    can: { net: can.net === true, venue: can.venue === true },
    venues: Array.isArray(r.venues) ? r.venues.filter((x) => typeof x === "string" && x) : [],
  };
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
 * тест раздела. Номера постоянные (cn-idea, cn-o12): поправили текст — тема в треке получает «обновлено, освежи».
 */
export function conceptRecords(c, track) {
  if (!c || !track) return [];
  const vname = c.venue ? c.venue.name : "";
  return conceptPairs(c, track).map((p, i) => {
    const nb = join(p.net), vb = join(p.venue);
    const content = nb && vb ? nb + "\n\n**В «" + vname + "»**\n" + vb : nb || vb;
    const photos = [...p.net, ...p.venue].flatMap((b) => b.photos).slice(0, 12);
    const questions = [...p.net, ...p.venue].flatMap((b) => b.questions);
    return { id: p.key, role: track, module: CN_SECTION, title: p.title, content: content || p.title, questions, sort: i, photos };
  });
}

/** Раздел «Наш ресторан» трека — модуль программы (или пустой список, если показать нечего). */
export function conceptModules(c, track, color, icon) {
  const recs = conceptRecords(c, track);
  if (!recs.length) return [];
  // свой номер модуля (cn-<трек>): раздел из редактора контента с тем же названием не сольётся с этим
  return buildCustomModules(recs, track, { color, icon }).map((m) => ({ ...m, id: "cn-" + track, tag: "О нас", subtitle: "Концепция и стандарты", concept: true }));
}

/** Записи раздела для всех треков (отчёт, книга отзывов, названия шагов в аналитике). */
export const conceptRecordsAll = (c) => (c ? CN_TRACKS.flatMap((t) => conceptRecords(c, t)) : []);

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
  if (!c) return programs;
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
