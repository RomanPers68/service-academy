// v139 (Доп. 454): «О нас» — концепция и стандарты сети и каждого заведения. Владелец (05.11): «можно оставить редактор,
// чтобы каждое заведение могло вписать свою концепцию, а руководитель сети общую»; «да. Я про дресс-код, фото и т.д.»;
// «чтобы это было дополнением к имеющемуся. И чтобы все функции приложения с этим взаимодействовали».
// lib/concept.js, ui/concept.jsx, ui/concept-photo.jsx, этап 49 (supabase-stage49-concept.sql), сервер демо, связи в App.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  CN_KINDS, CN_KIND_IDS, CN_TRACKS, CN_PUBLIC, CN_SECTION, kindOf, cleanQuestion, cleanBlock, normConcept, blockFor, conceptUnread, conceptHas,
  conceptPairs, conceptRecords, conceptModules, conceptRecordsAll, conceptSearchItems, conceptAssistantContext, withConceptPrograms, conceptDress,
  blankBlock, blockPayload, blockProblem, conceptErr,
} from "../lib/concept.js";
import { sectionSteps } from "../lib/custom-modules.js";
import { STAGES } from "../lib/server-check.js";
import { sanitize, PROMPT, CONCEPT_KINDS } from "../api/lesson-assist.js";
import { makeServer } from "../tools/claude/demo-app/fake-server.js";
import { planOf } from "../lib/newbie.js";

const rd = (f) => readFileSync(f, "utf8");
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
const dashes = (s) => (code(s).match(/[А-Яа-яЁё»)"]\s—\s[А-Яа-яЁё«]/g) || []).length;

const B = (id, scope, kind, x = {}) => ({ id, scope, kind, title: x.title || kindOf(kind).title, body: x.body === undefined ? "Текст " + id : x.body, photos: x.photos || [],
  tracks: x.tracks || [], questions: x.questions || [], sort: x.sort || id, at: "2026-11-05T10:00:00Z", by: "Мария" });
const Q1 = { q: "Где бейдж?", options: ["Слева", "Справа"], correct: 0, explanation: "Слева" };
const RAW = () => ({ ok: true, mine: "Океан", restaurant: "Океан",
  net: { ver: "n1", blocks: [B(1, "", "idea", { body: "Сеть выросла из одного зала." }), B(2, "", "dress", { body: "Чёрный верх", photos: [{ id: 7, cap: "Форма" }], questions: [Q1] }),
    B(3, "", "own", { title: "Музыка", body: "Джаз до 21:00" })] },
  venue: { name: "Океан", ver: "v1", blocks: [B(11, "Океан", "idea", { title: "Концепция «Океана»", body: "Рыба и аквариум." }), B(12, "Океан", "pitch", { body: "«Добрый вечер!»" }),
    B(13, "Океан", "day", { body: "10:30 открытие", tracks: ["manager"] }), B(14, "Океан", "check", { body: "Средний чек 2 800", tracks: ["seasonal", "core", "manager", "service_manager"],
      questions: [{ q: "Что в чеке?", options: ["Напиток и горячее", "Только горячее"], correct: 0, explanation: "" }] })] },
  others: [{ name: "Порт", blocks: [B(21, "Порт", "idea", { body: "Бар у причала, крафтовое пиво." }), B(22, "Порт", "dress", { body: "Тельняшка" })] }],
  read: { net: "n1", venue: "v0" }, can: { net: false, venue: true }, venues: null });

describe("v139: виды блоков и чистка", () => {
  it("13 видов: концепция, ценности, структура, гость, кухня и бар, атмосфера, рассказ гостю, дресс-код, сервировка, чек, распорядок, цифры, свой", () => {
    expect(CN_KIND_IDS).toEqual(["idea", "values", "structure", "guest", "kitchen", "mood", "pitch", "dress", "setting", "check", "day", "numbers", "own"]);
    expect(CN_KINDS.map((k) => k.title)).toContain("Внешний вид и дресс-код");
    // «для кого» по умолчанию — как в таблице обучения холдинга: чек — зал и руководители, распорядок и цифры — менеджеры
    expect(kindOf("check").tracks).toEqual(["seasonal", "core", "manager", "service_manager"]);
    expect(kindOf("day").tracks).toEqual(["manager", "service_manager"]);
    expect(kindOf("numbers").tracks).toEqual(["manager", "service_manager"]);
    expect(kindOf("dress").tracks).toEqual([]);
    expect(CN_KINDS.filter((k) => k.photo).map((k) => k.kind)).toEqual(["idea", "kitchen", "mood", "dress", "setting", "own"]);
    expect(CN_PUBLIC).toEqual(["idea", "guest", "kitchen", "mood", "pitch"]);
    expect(CN_TRACKS).toEqual(["seasonal", "core", "spg", "bar", "manager", "service_manager"]);
    expect(kindOf("нет").kind).toBe("own");
  });
  it("вопрос: 2–4 варианта, верный — один из них, всё непустое (как _sa_cn_questions)", () => {
    expect(cleanQuestion(Q1)).toEqual(Q1);
    for (const bad of [null, {}, { q: "", options: ["a", "b"], correct: 0 }, { q: "x", options: ["a"], correct: 0 }, { q: "x", options: ["a", "b", "c", "d", "e"], correct: 0 },
      { q: "x", options: ["a", ""], correct: 0 }, { q: "x", options: ["a", "b"], correct: 2 }, { q: "x", options: ["a", 5], correct: 0 }, { q: "x", options: ["a", "b"], correct: "x" }]) expect(cleanQuestion(bad)).toBe(null);
    expect(cleanQuestion({ q: "x", options: ["a", "b"], correct: "1" }).correct).toBe(1);   // номер строкой — как у сервера ('^[0-3]$')
    expect(cleanQuestion({ q: "  Где?  ", options: [" a ", "b"], correct: 1 })).toEqual({ q: "Где?", options: ["a", "b"], correct: 1, explanation: "" });
  });
  it("блок: неизвестный вид и номер — прочь; треки — только известные; фото до восьми; пустой заголовок — по виду", () => {
    expect(cleanBlock({ id: 1, kind: "spam" })).toBe(null);
    expect(cleanBlock({ id: 0, kind: "idea" })).toBe(null);
    const b = cleanBlock({ id: "5", scope: "Океан", kind: "dress", title: "", body: "x", tracks: ["core", "x", "core"], photos: Array.from({ length: 10 }, (_, i) => ({ id: i + 1 })).concat([{ id: "z" }]) });
    expect(b.title).toBe("Внешний вид и дресс-код");
    expect(b.tracks).toEqual(["core"]);
    expect(b.photos.length).toBe(8);
    expect(b.photos[0]).toEqual({ id: 1, cap: "" });
  });
  it("ответ сервера → данные; не ok — null; соседям — только концепция", () => {
    expect(normConcept(null)).toBe(null);
    expect(normConcept({ ok: false })).toBe(null);
    const c = normConcept(RAW());
    expect(c.net.blocks.length).toBe(3);
    expect(c.venue.name).toBe("Океан");
    expect(c.others).toEqual([{ name: "Порт", blocks: [expect.objectContaining({ kind: "idea" })] }]);
    expect(c.can).toEqual({ net: false, venue: true });
    expect(normConcept({ ok: true, net: {}, venue: { name: "" } }).venue).toBe(null);
  });
});

describe("v139: кто что видит и что непрочитано", () => {
  const c = normConcept(RAW());
  it("«для кого» пусто — всем; распорядок — менеджеру", () => {
    expect(blockFor(c.venue.blocks[2], "seasonal")).toBe(false);
    expect(blockFor(c.venue.blocks[2], "manager")).toBe(true);
    expect(blockFor(c.net.blocks[0], "bar")).toBe(true);
    expect(conceptHas(c, "bar")).toBe(true);
    expect(conceptHas(null, "bar")).toBe(false);
  });
  it("непрочитано: версия заведения не та, что отмечена; сеть — прочитана", () => {
    expect(conceptUnread(c)).toEqual({ net: false, venue: true, any: true });
    expect(conceptUnread({ ...c, read: { net: "n1", venue: "v1" } })).toEqual({ net: false, venue: false, any: false });
    expect(conceptUnread(null).any).toBe(false);
    expect(conceptUnread({ ...c, net: { blocks: [], ver: "" }, venue: null }).any).toBe(false);
  });
});

describe("v139: раздел «Наш ресторан» в программе каждого трека", () => {
  const c = normConcept(RAW());
  it("пары сеть + заведение по видам; общий заголовок, если блоки у обоих; свои блоки — отдельно", () => {
    const p = conceptPairs(c, "seasonal");
    expect(p.map((x) => x.key)).toEqual(["cn-idea", "cn-pitch", "cn-dress", "cn-check", "cn-o3"]);
    expect(p[0].title).toBe("Концепция и история");   // и у сети, и у «Океана»
    expect(p[1].title).toBe("Рассказ гостю за 30 секунд");
    expect(p[4].title).toBe("Музыка");
    expect(conceptPairs(c, "manager").map((x) => x.key)).toContain("cn-day");
    expect(conceptPairs(c, "spg").map((x) => x.key)).not.toContain("cn-check");
  });
  it("записи — как свои уроки: текст сети, потом «В «Океан»», фото полем, вопросы всех блоков", () => {
    const r = conceptRecords(c, "seasonal");
    expect(r[0]).toMatchObject({ id: "cn-idea", role: "seasonal", module: CN_SECTION, title: "Концепция и история", sort: 0 });
    expect(r[0].content).toBe("Сеть выросла из одного зала.\n\n**В «Океан»**\nРыба и аквариум.");
    expect(r.find((x) => x.id === "cn-dress").photos).toEqual([{ id: 7, cap: "Форма" }]);
    expect(r.find((x) => x.id === "cn-dress").questions).toEqual([Q1]);
    expect(conceptRecords(c, "")).toEqual([]);
    expect(conceptRecords(null, "seasonal")).toEqual([]);
    expect(conceptRecordsAll(c).length).toBe(CN_TRACKS.reduce((a, t) => a + conceptRecords(c, t).length, 0));
  });
  it("модуль: номер cn-<трек>, «О нас», уроки cms-l-cn-…, один тест на раздел, фото у шага урока", () => {
    const [m] = conceptModules(c, "seasonal", "#7C9E87");
    expect(m).toMatchObject({ id: "cn-seasonal", tag: "О нас", title: "Наш ресторан", subtitle: "Концепция и стандарты", concept: true, custom: true });
    expect(m.lessons.map((l) => l.id)).toEqual(["cms-l-cn-idea", "cms-l-cn-pitch", "cms-l-cn-dress", "cms-l-cn-check", "cms-l-cn-o3", "cms-q-cn-dress"]);
    expect(m.lessons.find((l) => l.type === "quiz").questions.length).toBe(2);
    expect(m.lessons.find((l) => l.id === "cms-l-cn-dress").photos).toEqual([{ id: 7, cap: "Форма" }]);
    expect(m.lessons.find((l) => l.id === "cms-l-cn-idea").photos).toBe(undefined);
    expect(m.rev).toMatch(/^r/);
    expect(conceptModules(normConcept({ ok: true, net: { blocks: [] } }), "seasonal")).toEqual([]);
  });
  it("свои уроки без фото — как раньше (lib/custom-modules.js)", () => {
    const st = sectionSteps("Раздел", [{ id: 5, title: "Урок", content: "x", questions: [] }], "seasonal", "");
    expect(st).toEqual([{ id: "cms-l-5", title: "Урок", type: "lesson", content: "x" }]);
  });
  it("брифинг: вопрос команде и из «О нас» (новичок и ядро первыми)", () => {
    const pr = withConceptPrograms({ seasonal: [{ id: "s0" }], bar: [{ id: "b0" }] }, c);
    expect(pr.seasonal.map((m) => m.id)).toEqual(["cn-seasonal", "s0"]);
    expect(pr.core.map((m) => m.id)).toEqual(["cn-core"]);
    expect(pr.bar.map((m) => m.id)).toEqual(["b0"]);
    expect(withConceptPrograms({ a: 1 }, null)).toEqual({ a: 1 });
  });
  it("новичок: «Внешний вид по стандарту» открывает раздел «Наш ресторан», если в нём дресс-код", () => {
    expect(conceptDress(c, "seasonal")).toEqual({ key: "cn-dress", title: "Внешний вид и дресс-код" });
    const nb = { checked: {}, confirm: {}, focus: [] };
    const mods = conceptModules(c, "seasonal", "");
    const d1c = planOf(nb, { track: "seasonal", modules: mods }).sections.flatMap((s) => s.steps).find((s) => s.id === "d1c");
    expect(d1c).toMatchObject({ module: "cn-seasonal", sub: "Дресс-код и фото: «О нас», раздел «Наш ресторан»" });
    const plain = planOf(nb, { track: "seasonal", modules: [] }).sections.flatMap((s) => s.steps).find((s) => s.id === "d1c");
    expect(plain.module).toBe(undefined);
  });
});

describe("v139: поиск и Наставник", () => {
  const c = normConcept(RAW());
  it("поиск: сеть, своё заведение и соседи (их концепция)", () => {
    const it = conceptSearchItems(c, "seasonal");
    expect(it.map((x) => x.where)).toEqual(["Вся сеть", "Вся сеть", "Вся сеть", "Океан", "Океан", "Океан", "Порт"]);
    expect(it.find((x) => x.id === 2).text).toContain("Форма");   // подпись фото тоже ищется
  });
  it("Наставник: выдержки по вопросу про концепцию, соседа, форму; не по теме — ничего", () => {
    const a = conceptAssistantContext("Какая концепция у Порта?", c, "seasonal");
    expect(a).toMatch(/^\[О нас, концепция и стандарты заведений сети: /);
    expect(a).toContain("(Порт)");
    expect(conceptAssistantContext("Какой у нас дресс-код?", c, "seasonal")).toContain("Чёрный верх");
    expect(conceptAssistantContext("Сколько градусов в эспрессо?", c, "seasonal")).toBe(null);
    expect(conceptAssistantContext("концепция", null, "seasonal")).toBe(null);
    expect(conceptAssistantContext("концепция сети", c, "seasonal", 120).length).toBeLessThanOrEqual(170);
  });
  it("в контекст Наставника — по треку сотрудника, раньше справочника; кнопка [[go:about|О нас]]", () => {
    const rc = rd("lib/reference-context.js");
    expect(rc).toContain("const cnCtx = conceptAssistantContext(last.content, conceptFromStorage(), learner && learner.track);");
    expect(rc).toContain("[[go:about|О нас]]");
    expect(rc).toContain("const body = [cnCtx, ...(drinkFirst");
    expect(rd("App.jsx")).toContain('roleTitle: (ROLES.find(r => r.id === role) || {}).title, track: role || "",');
    expect(rd("ui/assistant.jsx")).toContain('about: "О нас",');
    expect(rd("App.jsx")).toContain('if (k === "about") { setAboutEdit(false); jump("about"); return; }');
  });
});

describe("v139: редактор — что уходит на сервер", () => {
  it("новый блок: заголовок вида, «для кого» вида; свой — без заголовка", () => {
    expect(blankBlock("check", "Океан")).toEqual({ id: null, scope: "Океан", kind: "check", title: "Правильный чек: к чему стремимся", body: "", photos: [],
      tracks: ["seasonal", "core", "manager", "service_manager"], questions: [], sort: null });
    expect(blankBlock("own", "").title).toBe("");
  });
  it("concept_save получает чистый блок; что мешает сохранить — словами", () => {
    const p = blockPayload({ id: 5, scope: "", kind: "idea", title: " Т ", body: " Т ", photos: [{ id: 1, cap: " c " }], tracks: ["x", "bar"], questions: [Q1, { q: "" }], sort: 3 });
    expect(p).toEqual({ id: 5, scope: "", kind: "idea", title: "Т", body: "Т", photos: [{ id: 1, cap: "c" }], tracks: ["bar"], questions: [Q1], sort: 3 });
    expect(blockPayload({ kind: "idea", title: "x", body: "x" }).id).toBe(undefined);
    expect(blockProblem({ title: "", body: "x" })).toBe("Нужен заголовок");
    expect(blockProblem({ title: "x", body: " ", photos: [] })).toBe("Нужен текст или фото");
    expect(blockProblem({ title: "x", body: "", photos: [{ id: 1 }] })).toBe("");
    expect(conceptErr("forbidden")).toBe("Править может руководитель этого заведения или сети.");
    expect(conceptErr("что-то")).toBe("Не получилось. Попробуй ещё раз.");
  });
  it("помощник: режим concept (текст или PDF → блоки), чистка ответа модели", () => {
    expect(Object.keys(CONCEPT_KINDS)).toEqual(CN_KIND_IDS);
    expect(PROMPT.concept("Порт", "текст")).toContain("Разложи материал о ресторане (Порт)");
    expect(PROMPT.concept("", "")).toContain("МАТЕРИАЛ — во вложенном PDF.");
    expect(sanitize("concept", { blocks: [{ kind: "idea", body: "x" }, { kind: "idea", body: "y" }, { kind: "own", title: "Музыка", body: "z" }, { kind: "spam", body: "q" }, { kind: "own", body: "" }] }))
      .toEqual({ blocks: [{ kind: "idea", title: "Концепция и история", body: "x" }, { kind: "own", title: "Музыка", body: "z" }] });
    expect(sanitize("concept", { blocks: [] })).toBe(null);
    const api = rd("api/lesson-assist.js");
    expect(api).toContain('"review", "concept"].includes(mode)');
    expect(api).toContain('const withPdf = mode === "lesson" || mode === "concept";');
  });
});

describe("v139: этап 49 и экран «Сервер»", () => {
  const sql = rd("supabase/supabase-stage49-concept.sql");
  it("девять функций, все с проверкой входа — volatile, права на anon", () => {
    const fns = ["concept_get", "concept_save", "concept_delete", "concept_order", "concept_photo_put", "concept_photo", "concept_read", "concept_reads", "concept_notify"];
    for (const f of fns) {
      const m = sql.match(new RegExp("create or replace function " + f + "\\([^)]*\\)\\s*returns jsonb language plpgsql (\\w+)"));
      expect([f, m && m[1]]).toEqual([f, "volatile"]);
    }
    expect(sql).toContain("to anon, authenticated;");
    expect(sql).toContain("select 'о нас: ' ||");
    expect(sql).toContain("raise exception 'Сначала этап 21 (supabase-stage21-private-data.sql): нужна проверка входа';");
  });
  it("права: сеть — владелец и руководящий состав; заведение — его руководители", () => {
    expect(sql).toContain("coalesce((c->>'network')::boolean, false)\n    or (coalesce(p_scope, '') <> '' and coalesce((c->>'lead')::boolean, false) and p_scope = c->>'restaurant'))");
    expect(sql).toContain("perform sa_tg_send(chat, txt, 'О нас', 'about');");
  });
  it("«Сервер» знает этап 49", () => {
    expect(STAGES.find((s) => s.n === "49")).toEqual({ n: "49", file: "supabase-stage49-concept.sql", what: "О нас: концепция и стандарты", fn: "concept_get" });
  });
});

describe("v139: сервер демо — как этап 49", () => {
  const P = (id, name, restaurant, position, x = {}) => ({ id, name, surname: "", restaurant, position, is_admin: false, ...x });
  const people = [P("r", "Роман", "Океан", "owner", { is_admin: true }), P("m", "Мария", "Океан", "manager"), P("a", "Анна", "Океан", "waiter"), P("i", "Ирина", "Порт", "manager")];
  const pings = [];
  const srv = makeServer({ today: "2026-11-05", rest: "Океан", people, tok: { tr: "r", tm: "m", ta: "a", ti: "i" }, sstaff: [], cfg: { shifts: [] }, plan: {}, menu: [], tgLinked: ["a"],
    concept: { net: [{ kind: "idea", title: "Сеть", body: "x" }], venues: { "Порт": [{ kind: "dress", title: "Форма", body: "y" }] } }, ping: (to, text, acts, chat, msg, o) => pings.push({ to, text, o }) });
  it("права и чтение", () => {
    expect(srv.rpc("concept_save", { p_token: "ta", p_block: { scope: "Океан", kind: "idea", title: "x", body: "x" } }).error).toBe("forbidden");
    expect(srv.rpc("concept_save", { p_token: "tm", p_block: { scope: "", kind: "idea", title: "x", body: "x" } }).error).toBe("forbidden");
    expect(srv.rpc("concept_save", { p_token: "tm", p_block: { scope: "Океан", kind: "pitch", title: "Рассказ", body: "«Добрый вечер»", tracks: ["x", "core"] } }).block.tracks).toEqual(["core"]);
    const g = srv.rpc("concept_get", { p_token: "ta" });
    expect([g.net.blocks.length, g.venue.blocks.length, g.others.length, g.can.venue]).toEqual([1, 1, 0, false]);   // у «Порта» только форма — соседям не видна
    expect(srv.rpc("concept_read", { p_token: "ta", p_scope: "Порт" }).error).toBe("forbidden");
    expect(srv.rpc("concept_read", { p_token: "ta", p_scope: "Океан" }).ver).toBe(g.venue.ver);
    // «Кто прочитал»: себя в списке нет, владельца тоже; Анна прочитала обе части
    expect(srv.rpc("concept_reads", { p_token: "tm" }).rows.map((x) => x.id + ":" + (x.net && x.venue))).toEqual(["a:false"]);
    srv.rpc("concept_read", { p_token: "ta", p_scope: "" });
    expect(srv.rpc("concept_reads", { p_token: "tm" }).rows.map((x) => x.id + ":" + (x.net && x.venue))).toEqual(["a:true"]);
  });
  it("«Сообщить команде» — бот с кнопкой «О нас», раз в день", () => {
    const r = srv.rpc("concept_notify", { p_token: "tm", p_scope: "Океан" });
    expect(r).toMatchObject({ ok: true, sent: 1, people: 2 });
    expect(pings[pings.length - 1]).toMatchObject({ to: "a", o: { kind: "about", kb: [[{ text: "О нас", go: "about" }]] } });
    expect(pings[pings.length - 1].text).toBe("Обновили «О нас»: концепция и стандарты «Океан».\nОткрой и отметь «Прочитал(а)».");
    expect(srv.rpc("concept_notify", { p_token: "tm", p_scope: "Океан" }).sent).toBe(0);
  });
  it("нет этапа 49 — «функции нет»", () => {
    const s2 = makeServer({ today: "2026-11-05", rest: "Океан", people, tok: { ta: "a" }, sstaff: [], cfg: { shifts: [] }, plan: {}, menu: [], noStage49: true });
    expect(s2.rpc("concept_get", { p_token: "ta" }).code).toBe("PGRST202");
  });
});

describe("v139: связи в приложении", () => {
  const app = rd("App.jsx");
  it("программа: «Наш ресторан» первым; свои разделы — с ним; отчёт и «Далее» его знают", () => {
    expect(app).toContain("const programModules = useMemo(() => [...conceptMods, ...modules, ...customOwn], [conceptMods, modules, customOwn]);");
    expect(app).toContain("const customModules = useMemo(() => [...conceptMods, ...customOwn], [conceptMods, customOwn]);");
    expect(app).toContain("const homeMods = useMemo(() => [...conceptMods, ...modules], [conceptMods, modules]);");
    expect(app).toContain("customLessons={reportCms}");
    expect(app).toContain("const seq = programModules.flatMap(m => m.lessons.filter(l => l.type !== \"result\").map(l => ({ mod: m, lesson: l })));");
    expect(app).toContain("[...conceptModules(concept, r.id, TRACK_COLOR[r.id] || GOLD, customIcon),");
  });
  it("Наставнику — только свои уроки из редактора: раздел «Наш ресторан» уходит текстом «О нас», а не списком", () => {
    expect(app).toContain("customLessons: (customOwn || []).flatMap(m => m.lessons.filter(l => l.type === \"lesson\").map(l => ({ id: l.id, title: l.title, section: m.title }))),");
    expect(app).not.toContain("customLessons: (customModules || []).flatMap(");
  });
  it("загрузка с сервера и копия на телефоне; ссылка about; пункты «О нас» и «Концепция и стандарты»; экран", () => {
    expect(app).toContain('rpc("concept_get", { p_token: saToken() }).then((r) => { if (r && r.ok === true) onConceptRaw(r); }).catch(() => {});');
    expect(app).toContain("const [concept, setConcept] = useState(() => conceptFromStorage());");
    expect(app).toContain('typeof v === "string" && (v === "about" || ["pair", "league",');
    expect(app).toContain('else if (g === "about") { setAboutEdit(false); navigate("about"); }');
    expect(app).toContain('aboutOn && { key:"about", group:"Команда", icon:"about", label:"О нас"');
    expect(app).toContain('badge: conceptNew ? "новое" : null');
    expect(app).toContain('staff && { key:"cn", group:"Управление", icon:"about", label:"Концепция и стандарты"');
    expect(app).toContain('<AboutScreen T={T} a11y={a11y} profile={profile} role={role} concept={concept} onRaw={onConceptRaw} startEdit={aboutEdit} onBack={() => goBack("teamHub")} />');
    expect(rd("ui/home-hubs.jsx")).toContain("  about: (c) => <svg");
  });
  it("поиск, брифинг, урок с фото", () => {
    expect(rd("ui/search.jsx")).toContain('{results.about.length > 0 && <div style={secT}>Соседи по сети</div>}');
    expect(app).toContain('concept={concept} onAbout={() => { setAboutEdit(false); navigate("about"); }}');
    expect(rd("ui/briefing.jsx")).toContain("programs: withConceptPrograms(programAll(), conceptFromStorage())");
    expect(rd("ui/screens-learning.jsx")).toContain("<ConceptPhotos photos={lesson.photos} a11y={!!T.a11y} />");
  });
});

describe("v139: «Линза» и все заведения сети (владелец: «Добавленное все имеет эффект линзы?», «в финальном будут все?»)", () => {
  const src = rd("ui/concept.jsx");
  it("каждая кнопка экрана «О нас» и редактора — с меткой линзы (кроме строки соседа и зелёного кружка верного ответа)", () => {
    // атрибуты кнопки до onClick; без метки линзы — только строка соседа (className="sa-hit", внутри карточки-линзы)
    const attrs = src.split("<button").slice(1).map((t) => t.slice(0, t.indexOf("onClick")));
    const bare = attrs.filter((t) => !/data-lens|data-cn-right/.test(t));
    expect(attrs.length).toBeGreaterThan(30);
    expect(bare).toEqual([' type="button" className="sa-hit" ']);
    expect(src).toContain('data-cn-tabs="" data-lens-seg=""');
    expect(src).toContain('data-lens-btn={scope === "net" ? "tab" : undefined}');
    expect(src).toContain('data-cn-kind={k.kind} data-lens-opt=""');
    expect(src).toContain('data-lens-btn={on ? "tab" : "soft"}');
    expect(src).toContain('data-cn-q={i} data-lens-edge=""');
    expect((src.match(/outline: "none"/g) || []).length).toBe(2);
  });
  it("выбор заведения: своё, все заведения из приложения, что знает сервер", () => {
    expect(src).toContain('import { RESTAURANTS } from "../data/roles";');
    expect(src).toContain("const venueList = [...new Set([mine, ...RESTAURANTS, ...(data.venues || [])].filter(Boolean))];");
    expect(src).toContain("{can.net ? (");
  });
});

describe("v139: тексты и записи", () => {
  it("без тире-ритма и эмодзи в новых файлах", () => {
    for (const f of ["lib/concept.js", "ui/concept.jsx", "ui/concept-photo.jsx"]) {
      expect(dashes(rd(f)), f).toBe(0);
      expect(/\p{Extended_Pictographic}/u.test(code(rd(f))), f).toBe(false);
    }
  });
  it("CHANGES, README базы и проверок", () => {
    expect(rd("CHANGES.md")).toContain("# Дополнение 454");
    expect(rd("supabase/README.md")).toContain("supabase-stage49-concept.sql");
    expect(rd("tools/claude/README.md")).toContain("`e2e-v139.mjs`");
    expect(rd("tools/claude/README.md")).toContain("test49.sh");
  });
});
