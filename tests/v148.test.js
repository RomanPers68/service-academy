// v148 (Доп. 472): советы в уроках — тихая карточка в конце урока про то, что легко пропустить.
// Владелец (13.11), снимок отчёта «Не пользуется: Живой диалог, Свежесть тем, Раунд мастера, Радио в дорогу, Живой гость,
// Колоды и тренажёры, Квест смены, Навыки в зале»: «Как мы это аккуратно и в тему можем ввести в уроки, чтобы это было
// не навязчиво в виде совета. Но при этом ничего из списка не было упущено. Объясняя не душно, что это будет полезно»;
// «чтобы это было в тему урока, логично и полезно»; «Это не только к списку относится. Но и к справочнику,
// ассистенту-наставнику и т.д.». Тексты и «свои» уроки — data/lesson-tips.js, выбор — lib/lesson-tips.js,
// карточка — ui/lesson-tip.jsx, проводка — App.jsx и LessonScreen.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { MODULES_INDEX } from "../data/modules-index";
import { REFERENCE_DAILY_INDEX } from "../data/reference-index";
import { TIP_FEATURES, LESSON_TIPS } from "../data/lesson-tips";
import { pickLessonTip, markTipShown, tipLater, markTipUsed, readTipState, featureUsed, storageKeys, SCREEN_TIPS, LAYER_TIPS,
  TIP_MAX_SHOWS, TIP_LATER_DAYS, TIP_KEY, addDays } from "../lib/lesson-tips";

const rd = (p) => readFileSync(p, "utf8");
const store = () => {
  const m = new Map();
  return { get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); } };
};
const LESSONS = new Map();
for (const [track, mods] of Object.entries(MODULES_INDEX)) for (const m of mods) for (const l of m.lessons || []) LESSONS.set(l.id, { ...l, track });
const TRACKS = Object.keys(MODULES_INDEX);
const featuresIn = (track) => {
  const out = new Set();
  for (const [id, list] of Object.entries(LESSON_TIPS)) if (LESSONS.get(id)?.track === track) for (const [f] of list) out.add(f);
  return out;
};
// «Колоды и тренажёры» в отчёте — это колоды меню, бармена, барной карты и тренажёры при них
const DECKS = ["menu", "faq", "sprint", "describe", "voices", "say", "cocktails", "families", "barlab", "barcard", "sommelier"];
const NOT_USED = { "Живой диалог": ["dialogue"], "Свежесть тем": ["fresh"], "Раунд мастера": ["gold"], "Радио в дорогу": ["radio"],
  "Живой гость": ["guest"], "Колоды и тренажёры": DECKS, "Квест смены": ["quest"], "Навыки в зале": ["hall"] };
const TODAY = "2026-11-13";
const ctx0 = (x = {}) => ({ isLead: false, seen: {}, famUsed: new Set(), keys: [],
  can: { mistakes: true, faded: true, goldable: true, warmup: true, shift: true, passed: true }, ...x });
const pick = (lessonId, st, x, today = TODAY) => pickLessonTip({ lessonId, state: readTipState("_a", st), ctx: ctx0(x), today });

describe("v148: советы — в «своих» уроках, ничего из списка «Не пользуется» не упущено", () => {
  it("каждый совет стоит в существующем обычном уроке (не тест, не практика, не диалог, не сборка), в уроке до четырёх, без повторов", () => {
    expect(Object.keys(LESSON_TIPS).length).toBeGreaterThan(150);
    for (const [id, list] of Object.entries(LESSON_TIPS)) {
      const l = LESSONS.get(id);
      expect(l, id).toBeTruthy();
      expect(l.type, id).toBe("lesson");
      expect(list.length, id).toBeGreaterThan(0);
      expect(list.length, id).toBeLessThanOrEqual(4);
      expect(new Set(list.map(([f]) => f)).size, id).toBe(list.length);
      for (const [f] of list) expect(TIP_FEATURES[f], id + " · " + f).toBeTruthy();
    }
  });
  it("у инструментов «Пути мастера» в совете — их значок оттуда (ui/mastery-card.jsx)", () => {
    const mc = rd("ui/mastery-card.jsx");
    const icons = mc.slice(mc.indexOf("const ICON = {"), mc.indexOf("export function FamIcon"));
    const fams = Object.entries(TIP_FEATURES).filter(([, F]) => F.fam);
    expect(fams.map(([f]) => f).sort()).toEqual(["cocktails", "dialogue", "fresh", "gold", "guest", "hall", "mastery", "menu", "mistakes", "quest", "radio", "warmup"]);
    for (const [f, F] of fams) expect(icons, f + " → " + F.fam).toMatch(new RegExp("\\n  " + F.fam + ": \\("));
    expect(pickLessonTip({ lessonId: "s0-2", state: readTipState("_f", store()), ctx: ctx0(), today: TODAY }).fam).toBe("radio");
    expect(rd("ui/lesson-tip.jsx")).toContain("tip.fam ? (c, sz) => <FamIcon id={tip.fam} size={sz} color={c} />");
  });
  it("у каждой функции каталога есть хотя бы один «свой» урок", () => {
    const anchored = new Set(Object.values(LESSON_TIPS).flatMap((list) => list.map(([f]) => f)));
    for (const f of Object.keys(TIP_FEATURES)) expect(anchored.has(f), f).toBe(true);
  });
  it("все восемь пунктов «Не пользуется» есть в каждом из шести треков", () => {
    expect(TRACKS.length).toBe(6);
    for (const t of TRACKS) {
      const fs = featuresIn(t);
      for (const [name, ids] of Object.entries(NOT_USED)) expect(ids.some((f) => fs.has(f)), t + " · " + name).toBe(true);
    }
  });
  it("и то, что владелец назвал отдельно, — Справочник и AI-наставник — плюс поиск, «Задание дня», «Путь мастера» в каждом треке", () => {
    for (const t of TRACKS) {
      const fs = featuresIn(t);
      for (const f of ["reference", "assistant", "search", "daily", "mastery"]) expect(fs.has(f), t + " · " + f).toBe(true);
    }
  });
  it("тексты «не душные»: одна-две фразы, до 210 знаков, без эмодзи и восклицаний; функцию называет подпись карточки", () => {
    for (const [id, list] of Object.entries(LESSON_TIPS)) for (const [f, text, x] of list) {
      const at = id + " · " + f;
      expect(typeof text, at).toBe("string");
      expect(text.length, at).toBeGreaterThanOrEqual(50);
      expect(text.length, at).toBeLessThanOrEqual(210);
      expect(text, at).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(text, at).not.toContain("!");
      expect(text.split(/(?<=[.?…])\s+(?=[А-ЯЁA-Z«])/).length, at).toBeLessThanOrEqual(2);
      expect(/[.?»]$/.test(text), at).toBe(true);
      if (x) for (const k of Object.keys(x)) expect(["ask", "ref", "cta", "tab"], at).toContain(k);
    }
  });
  it("готовые вопросы Наставнику — вопросы; главы Справочника и вкладки «Барной карты» существуют", () => {
    const refs = new Set(REFERENCE_DAILY_INDEX.map((r) => r.id));
    let asks = 0, rs = 0;
    for (const [id, list] of Object.entries(LESSON_TIPS)) for (const [f, , x] of list) {
      if (!x) continue;
      if (x.ask) { asks++; expect(f, id).toBe("assistant"); expect(x.ask, id).toMatch(/\?$/); expect(x.ask.length, id).toBeLessThanOrEqual(120); }
      if (x.ref) { rs++; expect(f, id).toBe("reference"); expect(refs.has(x.ref), id + " · " + x.ref).toBe(true); }
      if (x.tab) { expect(f, id).toBe("barcard"); expect(["wine", "spirit", "cocktail"]).toContain(x.tab); }
    }
    expect(asks).toBeGreaterThan(3);
    expect(rs).toBeGreaterThan(5);
  });
});

describe("v148: кнопка совета ведёт туда, куда обещает", () => {
  const app = rd("App.jsx");
  // маршрутизатор «Гида», им же пользуется кнопка совета («Мой отчёт», «Свеча на двоих», «Спасибо от гостей»)
  const openDest = app.slice(app.indexOf("const openDest = (dest) => {"), app.indexOf("const openDestRef = useRef(openDest)"));
  const GO = ["refresh", "gold", "warmup", "radio", "guest", "mistakes", "menu", "quest", "mentor", "practice", "dialogue", "mastery"];
  it("у каждой функции ровно одна цель: вопрос Наставнику, шаг «Пути мастера», режим тренажёра меню, лист, чат или экран", () => {
    for (const [f, F] of Object.entries(TIP_FEATURES)) {
      const keys = Object.keys(F.open || {});
      expect(keys.length, f).toBe(1);
      expect(["ask", "go", "menu", "layer", "chat", "screen"], f).toContain(keys[0]);
      expect(F.name, f).toBeTruthy();
      expect(F.cta, f).toMatch(/›$/);
      if (F.open.go) expect(GO, f).toContain(F.open.go);
      if (F.open.layer) expect(["cal", "remind"], f).toContain(F.open.layer);
      if (F.open.screen && F.open.screen !== "home") {
        const sc = F.open.screen;
        expect(app.includes(`screen === "${sc}"`) || openDest.includes(`dest === "${sc}"`), f + " → " + sc).toBe(true);
      }
    }
  });
  it("тренажёр меню открывается сразу в нужном режиме: аллергены, колода, 60 секунд, голоса, произношение", () => {
    const mt = rd("ui/menu-trainer.jsx");
    for (const f of Object.values(TIP_FEATURES)) if (f.open.menu) expect(["allergens", "know-menu", "reverse-menu", "60sec", "voices", "say", "quiz"]).toContain(f.open.menu);
    expect(mt).toContain('if (startMode === "allergens") setMode("sprint")');
    expect(mt).toContain('else if (["60sec", "voices", "say", "quiz"].includes(startMode)) setMode(startMode);');
    for (const m of ["60sec", "voices", "say"]) expect(mt).toContain(`mode === "${m}"`);
  });
  it("«Спросить Сомелье» открывает подбор сразу; «Барная карта» — на нужной вкладке; «Свежесть» и «Раунд мастера» — по теме урока", () => {
    expect(TIP_FEATURES.sommelier.cta).toBe("Спросить Сомелье ›");
    expect(app).toContain('setBarSom(tip.id === "sommelier")');
    expect(app).toContain("startSom={barSom}");
    expect(app).toContain('setBarTab(tip.tab || (tip.id === "sommelier" ? "wine" : null))');
    expect(app).toContain("runMasteryGo(o.go, { mod: activeModule ? activeModule.id : null })");
    const bc = rd("ui/bar-card.jsx");
    expect(bc).toContain("startSom = false");
    expect(bc).toMatch(/if \(somAuto\.current && somOk\) \{ somAuto\.current = false; setSom\(true\); \}/);
  });
  it("след использования: экраны и листы функций знает App; свой урок, модуль и главная следом не считаются", () => {
    expect(SCREEN_TIPS.reference).toContain("reference");
    expect(SCREEN_TIPS.menuTrainer).toContain("menu");
    expect(SCREEN_TIPS.wines).toContain("barcard");
    expect(LAYER_TIPS.mentor).toContain("assistant");
    expect(LAYER_TIPS.cal).toContain("phonecal");
    for (const s of ["lesson", "module", "home", "roleSelect"]) expect(SCREEN_TIPS[s], s).toBeUndefined();
    expect(LAYER_TIPS.pair).toContain("pair");
    for (const l of Object.keys(LAYER_TIPS)) expect(["mentor", "chat", "cal", "remind", "pair"]).toContain(l);
    expect(SCREEN_TIPS.myreport).toEqual(["myreport"]);   // App: экран отчёта со своей карточкой — «Мой отчёт»
    expect(SCREEN_TIPS.report).toEqual(["reports"]);
  });
});

describe("v148: какой совет показать — не навязчиво", () => {
  it("только обычный урок со своими советами; первый подходящий по порядку важности", () => {
    const st = store();
    expect(pickLessonTip({ lessonId: "s0-1", lessonType: "quiz", state: readTipState("_a", st), ctx: ctx0(), today: TODAY })).toBeNull();
    expect(pick("s0-p", st)).toBeNull();
    expect(pick("нет-такого", st)).toBeNull();
    const t = pick("s0-1", st);
    expect(t.id).toBe(LESSON_TIPS["s0-1"][0][0]);
    expect(t.text).toBe(LESSON_TIPS["s0-1"][0][1]);
    expect(t.lesson).toBe("s0-1");
    expect(t.cta).toMatch(/›$/);
  });
  it("чем уже пользовался — не советуем: кнопка совета, «Путь мастера», инструмент с отметкой, след на телефоне", () => {
    const [f0, f1] = LESSON_TIPS["s0-2"].map(([f]) => f);
    const st = store();
    expect(pick("s0-2", st).id).toBe(f0);
    markTipUsed("_a", [f0], TODAY, st);
    expect(pick("s0-2", st).id).toBe(f1);
    expect(featureUsed("radio", readTipState("_x", store()), { seen: { radio: TODAY } })).toBe(true);
    expect(featureUsed("radio", readTipState("_x", store()), { famUsed: new Set(["radio"]) })).toBe(true);
    expect(featureUsed("radio", readTipState("_x", store()), { keys: ["sa_radio_done_Анна_"] })).toBe(true);
    expect(featureUsed("radio", readTipState("_x", store()), { keys: ["sa_other"] })).toBe(false);
    const ls = store(); ls.setItem("sa_radio_done_x", "1"); ls.setItem("sa_empty", "[]");
    expect(storageKeys(ls)).toEqual(["sa_radio_done_x"]);
  });
  it("только то, что можно сделать сейчас (квест — в день смены, «Свежесть» — когда тема побледнела); функции руководителя — руководителю", () => {
    const st = store();
    const withQuest = Object.entries(LESSON_TIPS).find(([, l]) => l[0][0] === "quest");
    expect(withQuest).toBeTruthy();
    expect(pick(withQuest[0], st).id).toBe("quest");
    const off = pick(withQuest[0], st, { can: { ...ctx0().can, shift: false } });
    expect(off === null || off.id !== "quest").toBe(true);
    const staffLesson = Object.entries(LESSON_TIPS).find(([, l]) => TIP_FEATURES[l[0][0]].staff);
    const staffF = staffLesson[1][0][0];
    const forStaff = pick(staffLesson[0], st, { isLead: true });
    expect(forStaff.id).toBe(staffF);
    const forWaiter = pick(staffLesson[0], st);
    expect(forWaiter === null || !TIP_FEATURES[forWaiter.id].staff).toBe(true);
    expect(pick("s0-1", st, { isLead: true }).name).toBe("Новички");
    expect(pick("s0-1", store()).name).toBe("Первая неделя");
  });
  it("не больше одного совета в день: увиден в одном уроке — в других сегодня тишина, в том же — тот же; завтра снова", () => {
    const st = store();
    const a = pick("s0-2", st);
    markTipShown("_a", "s0-2", a.id, TODAY, st);
    expect(pick("s1-2", st)).toBeNull();
    expect(pick("s0-2", st).id).toBe(a.id);
    markTipShown("_a", "s0-2", a.id, TODAY, st);
    expect(readTipState("_a", st).shown[a.id]).toBe(1);   // в тот же день и урок — показ считается один раз
    expect(pick("s1-2", st, {}, addDays(TODAY, 1))).not.toBeNull();
  });
  it("«Не сейчас» прячет функцию на 14 дней (и сегодня в этом уроке совета больше нет); три показа без нажатия — и хватит", () => {
    const st = store();
    const a = pick("s0-2", st);
    markTipShown("_a", "s0-2", a.id, TODAY, st);
    tipLater("_a", a.id, TODAY, st);
    expect(readTipState("_a", st).later[a.id]).toBe(addDays(TODAY, TIP_LATER_DAYS));
    expect(pick("s0-2", st)).toBeNull();
    const d1 = addDays(TODAY, 1);
    const b = pick("s0-2", st, {}, d1);
    expect(b === null || b.id !== a.id).toBe(true);
    expect(pick("s0-2", st, {}, addDays(TODAY, TIP_LATER_DAYS + 1)).id).toBe(a.id);
    const st2 = store();
    let day = TODAY;
    for (let i = 0; i < TIP_MAX_SHOWS; i++) { expect(pick("s0-2", st2, {}, day).id).toBe(a.id); markTipShown("_a", "s0-2", a.id, day, st2); day = addDays(day, 1); }
    const after = pick("s0-2", st2, {}, day);
    expect(after === null || after.id !== a.id).toBe(true);
    expect(TIP_MAX_SHOWS).toBe(3);
    expect(TIP_LATER_DAYS).toBe(14);
  });
  it("кнопка совета нажата — совета про функцию больше нет и в этом уроке сегодня", () => {
    const st = store();
    const a = pick("s0-2", st);
    markTipShown("_a", "s0-2", a.id, TODAY, st);
    markTipUsed("_a", [a.id], TODAY, st);
    expect(pick("s0-2", st)).toBeNull();
    expect(readTipState("_a", st).used[a.id]).toBe(TODAY);
    expect(TIP_KEY).toBe("sa_tips_");
  });
  it("доп. к совету доходят до кнопки: готовый вопрос Наставнику, глава Справочника, вкладка «Барной карты», своя надпись", () => {
    const st = store();
    const ask = Object.entries(LESSON_TIPS).find(([, l]) => l[0][0] === "assistant" && l[0][2] && l[0][2].ask);
    expect(pick(ask[0], st).ask).toBe(ask[1][0][2].ask);
    const ref = Object.entries(LESSON_TIPS).find(([, l]) => l[0][0] === "reference" && l[0][2] && l[0][2].ref);
    expect(pick(ref[0], store()).ref).toBe(ref[1][0][2].ref);
    expect(pick("c6-1", store()).tab).toBe("wine");
    expect(pick("c6-4", store()).tab).toBe("spirit");
    const g = pick("spg-8-3", store(), { keys: ["sa_pair_ms_x"], famUsed: new Set(["hall"]) });
    expect(g.id).toBe("reference");
    expect(g.ref).toBe("app-start");
    expect(g.cta).toBe("Открыть гид ›");
  });
});

describe("v148: карточка и проводка", () => {
  it("карточка тихая: значок в линзе, «Совет · функция», кнопка-линза и «Не сейчас»; показ считается, когда её видно", () => {
    const c = rd("ui/lesson-tip.jsx");
    expect(c).toContain("data-lesson-tip={tip.id}");
    expect(c).toContain("Совет · {tip.name}");
    expect(c).toContain('data-tip-go="" data-lens-btn="soft" data-lens-ink=""');   // как «Урок пройден ✓» рядом
    expect(c).toContain(">Не сейчас</button>");
    expect(c).toContain("IntersectionObserver");
    expect(c).toContain("intersectionRatio >= 0.5");
    expect(c).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(c).toContain('const tie = (t) => msTie(t).replace(/ —/g, "\\u00A0—");');   // тире не начинает строку
  });
  it("урок: совет над «Закрепить у стола» / «Урок пройден» — в ленте и на последней карточке, только у обычного урока", () => {
    const s = rd("ui/screens-learning.jsx");
    expect(s).toContain('import { LessonTip } from "./lesson-tip";');
    expect(s).toContain("tip = null, onTipGo, onTipLater, onTipShown, a11y = false }) {");
    expect(s).toContain('const tipCard = tip && lesson.type === "lesson"');
    expect(s).toContain("{cardIdx === cards.length - 1 && tipCard}");
    expect(s).toContain("{tipCard ? <div style={{ marginTop: 22 }}>{tipCard}</div> : null}");
  });
  it("App: выбор совета, «увиден», «не сейчас», переход и след с экранов", () => {
    const a = rd("App.jsx");
    expect(a).toContain('from "./lib/lesson-tips"');
    expect(a).toContain('if (!profile || screen !== "lesson" || !activeLesson) return null;');
    expect(a).toContain("tip={lessonTip} onTipGo={goTip} onTipLater={laterTip} onTipShown={shownTip}");
    expect(a).toContain('const ids = [...(SCREEN_TIPS[screen === "report" && reportSelf ? "myreport" : screen] || [])];');
    expect(a).toContain("if (pairOpen) ids.push(...(LAYER_TIPS.pair || []));");
    expect(a).toContain("onOpen={openDest} />");   // «Гид» и совет — одна дорога
    expect(a).toContain("if (o.screen) openDestRef.current(o.screen);");
    expect(a).toMatch(/if \(o\.ask\) \{ askMentor\(tip\.ask \|\|/);
    expect(a).toMatch(/if \(o\.screen === "reference"\) \{ setRefStart\(tip\.ref \|\| null\); navigate\("reference"\); return; \}/);
  });
  it("метка «сборка v148» и журнал: Дополнение 472 со словами владельца", () => {
    const n = [...rd("ui/menu-trainer.jsx").matchAll(/· сборка v(\d+)<\/span>/g)].map((m) => Number(m[1]));
    expect(n.length).toBe(1);
    expect(n[0]).toBeGreaterThanOrEqual(148);
    const c = rd("CHANGES.md");
    expect(c).toMatch(/# Дополнение 472 — /);
    expect(c).toContain("не навязчиво в виде совета");
    expect(c).toContain("к справочнику, ассистенту-наставнику");
  });
});
