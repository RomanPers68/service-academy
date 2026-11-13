// v149 (Доп. 473): советы в уроках — органично и удобно. Владелец (13.11): «Давай посмотрим еще. Может где-то, что-то
// упустили. Я про функционал и уроки. Главное, что бы все органично смотрелось и было удобно».
// Аудит v148: совет вёл туда, где пусто (записей шефа нет, вин в карте нет, схемы зала нет, человека нет в графике, чата
// нет, этапа на сервере нет); кнопка вела не туда («Спасибо коллеге» — в список полученных, «Редактор меню» — в «Знаю?»,
// «Звонок в один тап» — в свёрнутое «Сегодня»); у бармена, хостес и ядра не было советов про график, напоминания,
// «Опаздываю», «Спасибо от гостей», «Мой отчёт», «Лигу недели»; не было «Наоборот», «Пищевой ценности», «Звонка в один
// тап», «Меню для печати», «Стоп-листа». Доступность — lib/tip-avail.js, подгрузка раз в день — lib/tip-sync.js.
import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { MODULES_INDEX } from "../data/modules-index";
import { TIP_FEATURES, LESSON_TIPS } from "../data/lesson-tips";
import { RESTAURANT_MENUS } from "../data/menu";
import { pickLessonTip, readTipState, featureUsed, LAYER_TIPS } from "../lib/lesson-tips";
import { AVAIL_KEY, SEAT_KEY, STAGE_KEY, readAvail, saveAvail, readSeatPlan, rememberSeatPlan, readStages, rememberStage, availCan, traceUse } from "../lib/tip-avail";
import { availOf, refreshAvail, rememberSharedMenu, AVAIL_VOICES } from "../lib/reference-context";
import { VOICE_KINDS, dishVoices } from "../lib/voice-note";
import { dishNutrition } from "../lib/nutrition";
import { syncTipData, SYNC_KEY } from "../lib/tip-sync";

const rd = (p) => readFileSync(p, "utf8");
const memStore = () => {
  const m = new Map();
  return { get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); }, clear: () => m.clear(), _m: m };
};
const LESSONS = new Map();
for (const [track, mods] of Object.entries(MODULES_INDEX)) for (const m of mods) for (const l of m.lessons || []) LESSONS.set(l.id, { ...l, track });
const featuresIn = (track) => {
  const out = new Set();
  for (const [id, list] of Object.entries(LESSON_TIPS)) if (LESSONS.get(id)?.track === track) for (const [f] of list) out.add(f);
  return out;
};
const TODAY = "2026-11-13";
const ALL = { mistakes: true, faded: true, goldable: true, warmup: true, shift: true, passed: true, menu: true, voices: true, chefVoice: true, somVoice: true,
  kbju: true, wines: true, spirits: true, noBarcard: true, seat: true, sched: true, chat: true, about: true, thanks: true, cases: true };
const ctx = (can = {}, x = {}) => ({ isLead: false, seen: {}, famUsed: new Set(), keys: [], can: { ...ALL, ...can }, ...x });
const pick = (lessonId, can, x, st = memStore()) => pickLessonTip({ lessonId, state: readTipState("_a", st), ctx: ctx(can, x), today: TODAY });
const usedAllBut = (lessonId, f) => Object.fromEntries(LESSON_TIPS[lessonId].map(([x]) => x).filter((x) => x !== f).map((x) => [x, TODAY]));
const pickOnly = (lessonId, f, can, x) => {
  const st = memStore();
  st.setItem("sa_tips__a", JSON.stringify({ used: usedAllBut(lessonId, f) }));
  return pick(lessonId, can, x, st);
};
const NEED = (f) => { const c = TIP_FEATURES[f].can; return Array.isArray(c) ? c : c ? [c] : []; };

describe("v149: совет — только туда, где есть что открыть", () => {
  it("у функций, которым нужно содержимое заведения, — свой флаг; неизвестно — совет молчит", () => {
    const want = { menu: ["menu"], faq: ["menu"], sprint: ["menu"], describe: ["menu"], voices: ["voices"], kbju: ["kbju"], sommelier: ["wines"],
      schedule: ["sched"], phonecal: ["sched"], remind: ["sched"], late: ["sched", "chat"], call: ["sched"], seat: ["seat"], chat: ["chat"],
      peerThanks: ["chat"], about: ["about"], thanks: ["thanks"], cases: ["cases"], barcardEdit: ["noBarcard"], menuprint: ["menu"] };
    for (const [f, flags] of Object.entries(want)) expect(NEED(f), f).toEqual(flags);
    // что всегда есть: словарь произношения, базовая «Колода бармена», чек-листы по умолчанию, SOS, «Первая неделя»
    for (const f of ["say", "cocktails", "families", "barlab", "checklist", "sos", "onboarding", "guestbook", "league", "glossary", "reference"]) expect(NEED(f), f).toEqual([]);
    const off = availCan({});
    for (const k of Object.keys(off)) expect(off[k], k).toBe(false);
  });
  it("каждая функция с флагом без него молчит во всех своих уроках, с ним — говорит", () => {
    for (const [lessonId, list] of Object.entries(LESSON_TIPS)) for (const [f, , x] of list) {
      const flags = [...NEED(f), ...(x && x.can ? [].concat(x.can) : [])];
      const isLead = !!TIP_FEATURES[f].staff;
      const on = pickOnly(lessonId, f, {}, { isLead });
      expect(on && on.id, lessonId + " · " + f).toBe(f);
      for (const k of flags) {
        const offTip = pickOnly(lessonId, f, { [k]: false }, { isLead });
        expect(offTip === null || offTip.id !== f, lessonId + " · " + f + " без " + k).toBe(true);
      }
    }
  });
  it("у совета свой флаг сверх функции: вкладки «Барной карты» — когда в карте есть вина и крепкое; «шеф рассказывает» — когда записал шеф", () => {
    const x = (l, f) => (LESSON_TIPS[l].find(([y]) => y === f) || [])[2] || {};
    expect(x("c6-1", "barcard")).toEqual({ tab: "wine", can: "wines" });
    expect(x("c6-4", "barcard")).toEqual({ tab: "spirit", can: "spirits" });
    expect(x("bar3-1", "barcard")).toEqual({ tab: "spirit", can: "spirits" });
    for (const l of ["s-prod-2", "s-prod-4"]) { expect(LESSON_TIPS[l].find(([f]) => f === "voices")[1]).toMatch(/шеф/); expect(x(l, "voices").can).toBe("chefVoice"); }
    expect(x("c4-3", "voices").can).toBe("somVoice");
    expect(pickOnly("c6-1", "barcard", { wines: false })).toBeNull();
    expect(pickOnly("c6-1", "barcard").tab).toBe("wine");
    expect(pickOnly("s-prod-4", "voices", { chefVoice: false })).toBeNull();
  });
  it("флаги: сводка меню, схема зала (руководителю пустая — повод нарисовать), «Своя карта бара» — пока не настроена", () => {
    const a = { menu: true, voices: true, chefVoice: true, somVoice: false, kbju: "d7", wines: true, spirits: false, barcard: false };
    const c = availCan({ avail: a, seatPlan: "1", sched: true, chat: true, about: true, thanks: true, cases: true });
    expect(c).toMatchObject({ menu: true, voices: true, chefVoice: true, somVoice: false, kbju: true, wines: true, spirits: false, noBarcard: true, seat: true, sched: true, chat: true });
    expect(availCan({ avail: { ...a, barcard: true } }).noBarcard).toBe(false);
    expect(availCan({ avail: null }).noBarcard).toBe(false);   // не знаем — не советуем
    expect(availCan({ seatPlan: "0" }).seat).toBe(false);
    expect(availCan({ seatPlan: "0", isLead: true }).seat).toBe(true);
    expect(availCan({ seatPlan: "", isLead: true }).seat).toBe(false);
  });
});

describe("v149: что есть у заведения — сводка на телефоне", () => {
  it("сводка и схема зала живут по заведению; ответ без ok не трогает, «этапа нет» — забывает", () => {
    const st = memStore();
    expect(readAvail("Два моря", st)).toBeNull();
    saveAvail("Два моря", { menu: true, wines: true }, st);
    expect(readAvail("Два моря", st)).toMatchObject({ menu: true, wines: true });
    expect(readAvail("Другое", st)).toBeNull();
    expect(JSON.parse(st.getItem(AVAIL_KEY))["Два моря"].at).toBeGreaterThan(0);
    expect(readSeatPlan("Два моря", st)).toBe("");
    rememberSeatPlan("Два моря", { ok: true, plan: { tables: [{ id: 1 }] } }, st);
    expect(readSeatPlan("Два моря", st)).toBe("1");
    rememberSeatPlan("Два моря", { ok: false, error: "net" }, st);
    expect(readSeatPlan("Два моря", st)).toBe("1");
    rememberSeatPlan("Два моря", { ok: true, plan: { tables: [] } }, st);
    expect(readSeatPlan("Два моря", st)).toBe("0");
    rememberSeatPlan("Два моря", null, st, true);
    expect(readSeatPlan("Два моря", st)).toBe("");
    expect(SEAT_KEY).toBe("sa_seat_plan");
    expect(readStages(st)).toEqual({ thanks: "", cases: "", chat: "" });
    rememberStage("thanks", false, st); rememberStage("cases", true, st); rememberStage("chat", true, st);
    expect(readStages(st)).toEqual({ thanks: "0", cases: "1", chat: "1" });
    expect(STAGE_KEY).toBe("sa_tip_stage");
    traceUse("sa_kin_seen", st); traceUse("sa_kin_seen", st);
    expect(st.getItem("sa_kin_seen")).toBe("1");
  });
  it("голоса — те же два вида, что в записях шефа и сомелье; КБЖУ — блюдо, у которого на обороте есть «Пищевая ценность»", () => {
    expect(AVAIL_VOICES).toEqual(Object.keys(VOICE_KINDS));
    const dishes = [
      { id: "a", name: "Нечто без цифр", voice: { som: { url: "https://x/som.mp3", sec: 20 } } },
      { id: "b", name: "Блюдо шефа", voice: { chef: { url: "https://x/chef.mp3", sec: 30 } }, kcal: 420, out: 250, prot: 20, fat: 18, carb: 30 },
      { id: "c", name: "В архиве", archived: true, voice: { chef: { url: "https://x/c.mp3" } } },
    ];
    const a = availOf(dishes, [{ id: "wn-1", kind: "wine", name: "Шабли" }, { id: "sp-1", kind: "spirit", name: "Ром", archived: true }]);
    expect(a).toMatchObject({ menu: true, voices: true, chefVoice: true, somVoice: true, kbju: "b", wines: true, spirits: false, barcard: false });
    for (const d of dishes.filter((x) => !x.archived)) expect(dishVoices(d).length > 0, d.id).toBe(true);
    expect(availOf([], [{ id: "__barcard__", cocktails: ["negroni"] }])).toMatchObject({ menu: false, voices: false, kbju: "", barcard: true });
    // на образцах меню (пока своего нет) КБЖУ находится по названию — колода откроется на таком блюде
    const sample = Object.values(RESTAURANT_MENUS).flat();
    const withN = availOf(sample, []).kbju;
    expect(withN).toBeTruthy();
    expect(dishNutrition(sample.find((d) => String(d.id) === withN))).toBeTruthy();
  });
  describe("кэш меню команды обновился — сводка пересчиталась", () => {
    let st;
    beforeEach(() => { st = memStore(); globalThis.localStorage = st; });
    it("rememberSharedMenu → sa_tip_avail; то же меню ещё раз — без пересчёта; refreshAvail — по кэшу и образцам", () => {
      rememberSharedMenu("Тест", [{ id: "d1", name: "Суп дня", voice: { chef: { url: "https://x/1.mp3" } } }, { id: "wn-1", kind: "wine", name: "Риоха" }]);
      const a1 = readAvail("Тест", st);
      expect(a1).toMatchObject({ menu: true, chefVoice: true, wines: true });
      const at = a1.at;
      rememberSharedMenu("Тест", [{ id: "d1", name: "Суп дня", voice: { chef: { url: "https://x/1.mp3" } } }, { id: "wn-1", kind: "wine", name: "Риоха" }]);
      expect(readAvail("Тест", st).at).toBe(at);
      rememberSharedMenu("Тест", [{ id: "d1", name: "Суп дня" }]);
      expect(readAvail("Тест", st)).toMatchObject({ voices: false, wines: false });
      expect(refreshAvail("Нигде")).toMatchObject({ menu: false });
    });
  });
});

describe("v149: тихая подгрузка раз в день (lib/tip-sync.js)", () => {
  const prof = { restaurant: "Два моря, Океан", name: "Анна", surname: "Смирнова" };
  const MISSING = { code: "PGRST202", message: "Could not find the function" };
  const isMissing = (r) => !!(r && r.code === "PGRST202");
  let st;
  beforeEach(() => { st = memStore(); globalThis.localStorage = st; });
  const fake = (answers) => { const calls = []; return { calls, rpc: async (fn, args) => { calls.push([fn, args]); const a = answers[fn]; return typeof a === "function" ? a(args) : a; } }; };
  it("меню, схема зала и этапы «Случаев» и «Спасибо от гостей» — одним заходом; свой QR не создаётся", async () => {
    const f = fake({ menu_get: [{ id: "d1", name: "Устрицы", voice: { som: { url: "https://x/s.mp3" } } }], seat_board: { ok: true, plan: { tables: [{ id: 1 }] } },
      case_list: { ok: true, team: 0 }, thanks_team: { ok: false, error: "forbidden" } });
    const now = new Date(2026, 10, 13, 10);
    expect(await syncTipData(f.rpc, "tok", prof, now, st, isMissing)).toBe(true);
    expect(f.calls.map(([fn]) => fn).sort()).toEqual(["case_list", "menu_get", "seat_board", "thanks_team"]);
    expect(f.calls.find(([fn]) => fn === "case_list")[1]).toMatchObject({ p_mode: "counts" });
    expect(f.calls.some(([fn]) => fn === "my_thanks")).toBe(false);
    expect(readAvail("Два моря, Океан", st)).toMatchObject({ menu: true, somVoice: true, chefVoice: false });
    expect(readSeatPlan("Два моря, Океан", st)).toBe("1");
    expect(readStages(st)).toMatchObject({ thanks: "1", cases: "1" });
    expect(st.getItem(SYNC_KEY)).toBe("2026-11-13|Два моря, Океан");
    expect(await syncTipData(f.rpc, "tok", prof, now, st, isMissing)).toBe(false);   // сегодня уже было
    expect(f.calls.length).toBe(4);
  });
  it("этапов нет — так и запомнили; нет связи — сводка по тому, что на телефоне, и попробуем при следующем запуске", async () => {
    const f = fake({ menu_get: MISSING, seat_board: MISSING, case_list: MISSING, thanks_team: MISSING });
    expect(await syncTipData(f.rpc, "tok", prof, new Date(2026, 10, 13, 10), st, isMissing)).toBe(true);
    expect(readStages(st)).toMatchObject({ thanks: "0", cases: "0" });
    expect(readSeatPlan("Два моря, Океан", st)).toBe("");
    expect(readAvail("Два моря, Океан", st)).toMatchObject({ menu: true, kbju: expect.any(String) });   // образцы меню, пока своего нет
    const st2 = memStore(); globalThis.localStorage = st2;
    const off = { rpc: async () => { throw new Error("offline"); } };
    expect(await syncTipData(off.rpc, "tok", prof, new Date(2026, 10, 13, 10), st2, isMissing)).toBe(true);
    expect(st2.getItem(SYNC_KEY)).toBeNull();
    expect(readAvail("Два моря, Океан", st2)).toBeTruthy();
    expect(await syncTipData(off.rpc, "", prof, new Date(), st2, isMissing)).toBe(false);
  });
  it("App: через 5 секунд после старта, отдельным модулем; после — совет перечитывается", () => {
    const a = rd("App.jsx");
    expect(a).toContain('retryImport(() => import("./lib/tip-sync")).then((m) => m.syncTipData(rpc, saToken(), profile))');
    expect(a).toMatch(/\}, 5000\);\n {4}return \(\) => \{ alive = false; clearTimeout\(t\); \};/);
    expect(a).not.toMatch(/import \{[^}]*\} from "\.\/lib\/tip-sync"/);   // не в стартовый бандл
    expect(a).not.toMatch(/from "\.\/lib\/reference-context"/);
  });
});

describe("v149: кнопка совета — прямо туда, где функция", () => {
  const app = rd("App.jsx");
  it("«Спасибо коллеге» — сразу лист «Спасибо коллеге» в «Вся команда» (было: список полученных)", () => {
    expect(TIP_FEATURES.peerThanks.open).toEqual({ chat: "thx" });
    expect(TIP_FEATURES.peerThanks.cta).toBe("Сказать спасибо ›");
    expect(app).toContain('if (o.chat === "thx") { if (openChatWithRef.current) openChatWithRef.current({ kind: "thx" }); return; }');
    for (const [l, list] of Object.entries(LESSON_TIPS)) for (const [f, t] of list) if (f === "peerThanks") expect(t, l).toMatch(/«Спасибо коллеге»/);
  });
  it("«Редактор меню» и «Стоп-лист» — в редактор (было: «Знаю?»); «Меню для печати» — лист; «Пищевая ценность» — колода на блюде с КБЖУ", () => {
    expect(TIP_FEATURES.menuEdit.open).toEqual({ menu: "edit" });
    expect(TIP_FEATURES.stop.open).toEqual({ menu: "edit" });
    expect(TIP_FEATURES.menuprint.open).toEqual({ menu: "print" });
    expect(TIP_FEATURES.kbju.open).toEqual({ menu: "kbju" });
    const mt = rd("ui/menu-trainer.jsx");
    expect(mt).toContain('else if (startMode === "cards" || startMode === "print" || (startMode === "edit" && canEdit)) { setFocusNew(false); setMode(startMode); }');
    expect(mt).toContain('if (mode === "edit") return (');
    expect(mt).toContain('if (mode === "print") return <MenuPrint');
    expect(app).toContain('if (o.menu === "kbju") { const a = readAvail((profile && profile.restaurant) || ""); setMenuStart(a && a.kbju ? a.kbju : null); setMenuMode("cards"); navigate("menuTrainer"); return; }');
  });
  it("«Звонок в один тап» — сотруднику сразу «Кто со мной» (лист «С тобой в смене»), руководителю — «Сегодня» раскрыто; «Опаздываю» — пункт «Гида»", () => {
    expect(TIP_FEATURES.call.open).toEqual({ screen: "schedule" });
    expect(TIP_FEATURES.call.cta).toBe("Кто в смене ›");
    expect(app).toContain('if (o.screen === "schedule") { setSchedToday(tip.id === "call"); navigate("schedule"); return; }');
    expect(app).toContain("chat={schedChat} startToday={schedToday}");
    const sc = rd("ui/schedule.jsx");
    expect(sc).toContain("chat = null, onCal = null, startToday = false }) {");
    expect(sc).toContain("const [todayOpen, setTodayOpen] = React.useState(!!startToday);");
    expect(sc).toContain('data-sched-today={todayOpen ? "open" : "closed"}');
    expect(sc).toContain("if (startToday && !matesShown.current) { matesShown.current = true; setTimeout(openMates, 350); }");
    expect(sc).toContain('React.useEffect(() => { if (daySheet) { try { if (!localStorage.getItem("sa_call_seen")) localStorage.setItem("sa_call_seen", "1"); } catch (e) {} } }, [daySheet]);');
    // текст — про то, что видят все: кто сегодня в смене, тап по лицу — позвонить (у сотрудника и руководителя виды разные)
    for (const [l, list] of Object.entries(LESSON_TIPS)) for (const [f, t] of list) if (f === "call" && !LESSONS.get(l).track.includes("manager")) expect(t, l).toMatch(/кто сегодня (в смене|работает)/);
    expect(TIP_FEATURES.late.open).toEqual({ screen: "guide" });
    expect(app).toContain('if (o.screen === "guide") { setGuideFocus(tip.id); navigate("guide"); return; }');
    expect(app).toContain("focus={guideFocus} onBack={() => goBack(\"me\")} onOpen={openDest} tips={guideTips} onTipsReset={resetTipsAll} />");   // v156: и «Советы в уроках»
    const g = rd("ui/guide.jsx");
    expect(g).toContain("export function GuideScreen({ T, a11y, profile, onBack, onOpen, focus = null, tips = null, onTipsReset = null }) {");   // v156: и «Советы в уроках»
    expect(g).toContain("const [open, setOpen] = React.useState(focus || null);");
    expect(g).toContain("data-guide-key={it.key}");
    expect(g).toMatch(/\{ key: "late", title: "Опаздываю"/);
  });
  it("«Наоборот»: у официанта — «Колода меню» сразу без названий, у бармена — «Колода бармена» (своя дорога совета)", () => {
    expect(TIP_FEATURES.reverse.open).toEqual({ menu: "reverse-menu" });
    for (const l of ["bar2-2", "bar2-4"]) {
      const x = LESSON_TIPS[l].find(([f]) => f === "reverse")[2];
      expect(x, l).toEqual({ open: { screen: "cocktails" }, icon: "shaker" });
      const t = pickOnly(l, "reverse");
      expect(t.open).toEqual({ screen: "cocktails" });
      expect(t.icon).toBe("shaker");
    }
    expect(pickOnly("s-prod-1", "reverse").open).toEqual({ menu: "reverse-menu" });
    expect(pickOnly("s-prod-1", "reverse", { menu: false })).toBeNull();
    expect(app).toContain('setCkReverse(tip.id === "reverse"); navigate("cocktails"); return; }');
    expect(app).toContain("<CocktailsScreen startReverse={ckReverse}");
    expect(rd("ui/cocktails.jsx")).toContain("const [reverse, setReverse] = React.useState(!!startReverse);");
  });
  it("после функции «назад» и смена экрана — всё по-старому: «Сегодня» свёрнуто, «Гид» с начала, колода с названиями", () => {
    expect(app).toContain('if (screen !== "schedule") setSchedToday(false); if (screen !== "guide") setGuideFocus(null); if (screen !== "cocktails") setCkReverse(false); }, [screen]);');
  });
});

describe("v149: чем уже пользовались — следы, о которых советы знают", () => {
  it("у каждой функции, которую нельзя увидеть по экрану, есть след на телефоне — и код, который его оставляет", () => {
    const where = {
      sa_faq_seen: "ui/menu-deck.jsx", sa_reverse_on: "ui/menu-deck.jsx", sa_kbju_seen: "ui/menu-deck.jsx", sa_kin_seen: "ui/cocktails.jsx",
      sa_60sec_done: "ui/menu-trainer.jsx", sa_stop_set: "ui/menu-trainer.jsx", sa_menu_print: "ui/menu-print.jsx", sa_say_heard: "ui/pronounce.jsx",
      sa_call_seen: "ui/schedule.jsx", sa_thx_seen: "ui/chat.jsx", sa_late_seen: "ui/chat-cards.jsx",
    };
    for (const [k, file] of Object.entries(where)) {
      const owner = Object.entries(TIP_FEATURES).find(([, F]) => (F.used.keys || []).includes(k));
      expect(owner, k).toBeTruthy();
      expect(rd(file), k + " → " + file).toMatch(new RegExp('(traceUse\\("' + k + '"\\)|"' + k + '")'));
    }
    expect(rd("ui/cocktails.jsx")).toContain('traceUse("sa_reverse_on")');
    expect(TIP_FEATURES.menuEdit.used.keys).toEqual(["sa_menu_pub_"]);
    expect(TIP_FEATURES.schedEdit.used.keys).toEqual(["sa_sched_wizard_"]);
    // нет функции без следа: экран, лист, ключ, инструмент «Пути мастера» или знак «Пути мастера»
    for (const [f, F] of Object.entries(TIP_FEATURES)) {
      const u = F.used || {};
      expect(!!((u.screens || []).length || (u.layers || []).length || (u.keys || []).length || u.family || u.seen) || f === "barcardEdit", f).toBe(true);
    }
  });
  it("лист «Опаздываю» и «Спасибо коллеге» в чате, открытые откуда угодно, — тоже след", () => {
    const a = rd("App.jsx");
    expect(a).toContain('if (intentKind === "late") ids.push("late");');
    expect(a).toContain('if (intentKind === "thx") ids.push("peerThanks");');
    expect(featureUsed("late", readTipState("_x", memStore()), { keys: ["sa_late_seen"] })).toBe(true);
    expect(featureUsed("kbju", readTipState("_x", memStore()), { keys: ["sa_kbju_seen"] })).toBe(true);
    expect(LAYER_TIPS.chat).toContain("chat");
  });
  it("App: флаги доступности — из сводки, схемы зала, графика, чата, «О нас» и этапов", () => {
    const a = rd("App.jsx");
    expect(a).toContain('import { readAvail, readSeatPlan, rememberSeatPlan, readStages, rememberStage, availCan } from "./lib/tip-avail";');
    expect(a).toContain("const about = conceptHas(concept, role) || !!(isLead && concept && concept.can && (concept.can.net || concept.can.venue));");
    expect(a).toContain('const has = availCan({ avail: readAvail(rest), seatPlan: seatOn ? readSeatPlan(rest) : "", isLead, sched: !!shiftToday, chat: chatOn && (chatLive || stages.chat === "1"), about,');
    expect(a).toContain('if (r && r.ok) rememberStage("chat", true);');
    expect(a).toContain('thanks: thanksOn && stages.thanks === "1", cases: casesOn && stages.cases === "1" });');
    expect(a).toContain("const chatLive = !!(chatOn && chatInfo);");
    expect(a).toContain("if (r && r.ok) rememberSeatPlan(profile.restaurant, r);");
    const se = rd("ui/seating.jsx");
    expect(se).toContain("rememberSeatPlan(restaurant, r); }");
    expect(se).toContain("rememberSeatPlan(restaurant, { ok: true, plan: p });");
  });
});

describe("v149: ничего не упущено — у каждого трека свои повседневные функции", () => {
  const STAFF = ["seasonal", "core", "bar", "spg"];
  const EVERYDAY = ["schedule", "phonecal", "remind", "late", "call", "chat", "thanks", "myreport", "league", "peerThanks", "warmup", "radio", "quest"];
  it("официант, ядро, бармен и хостес: график, календарь, напоминания, «Опаздываю», звонок, чат, «Спасибо», «Мой отчёт», лига", () => {
    for (const t of STAFF) { const fs = featuresIn(t); for (const f of EVERYDAY) expect(fs.has(f), t + " · " + f).toBe(true); }
  });
  it("опытным (ядро, бар, хостес) — «Зачёт на опыт»; новичку — нет", () => {
    for (const t of ["core", "bar", "spg"]) expect(featuresIn(t).has("credit"), t).toBe(true);
    expect(featuresIn("seasonal").has("credit")).toBe(false);
  });
  it("новое в каталоге — в тему урока: «Наоборот», «Пищевая ценность», «Звонок в один тап», «Меню для печати», «Стоп-лист»", () => {
    const at = (f) => Object.entries(LESSON_TIPS).filter(([, l]) => l.some(([x]) => x === f)).map(([id]) => id).sort();
    expect(at("reverse")).toEqual(["bar2-2", "bar2-4", "s-prod-1"]);
    expect(at("kbju")).toEqual(["s-al-4", "s-prod-1"]);
    expect(at("call")).toEqual(["bar6-5", "c3-3", "m7-1", "s-dg-3", "sm5-2", "spg-10-4", "spg-3-1"]);
    expect(at("menuprint")).toEqual(["m3-1", "sm1-3"]);
    expect(at("stop")).toEqual(["m7-2", "m7-3"]);
    expect(TIP_FEATURES.stop.staff).toBe(true);
    for (const l of ["s-dg-3", "c3-4", "spg-3-1", "spg-4-1", "spg-7-1", "spg-8-1", "spg-10-1", "spg-10-2"]) expect(LESSONS.get(l).type, l).toBe("lesson");
    expect(LESSON_TIPS["s-dg-3"][0][1]).toMatch(/старшего/);   // «Когда зовём подмогу»
    expect(LESSON_TIPS["spg-4-1"][0][1]).toMatch(/«Бронь»/);    // «Бронь — это обещание»
  });
  it("каталог: 60 функций, 334 совета в 196 уроках, в уроке до четырёх", () => {
    expect(Object.keys(TIP_FEATURES).length).toBe(60);
    const n = Object.values(LESSON_TIPS).reduce((s, l) => s + l.length, 0);
    expect(n).toBe(334);
    expect(Object.keys(LESSON_TIPS).length).toBe(196);
    for (const [id, l] of Object.entries(LESSON_TIPS)) expect(l.length, id).toBeLessThanOrEqual(4);
  });
});

describe("v149: метка и журнал", () => {
  it("метка «сборка v149» и Дополнение 473 со словами владельца", () => {
    const n = [...rd("ui/menu-trainer.jsx").matchAll(/· сборка v(\d+)<\/span>/g)].map((m) => Number(m[1]));
    expect(n.length).toBe(1);
    expect(n[0]).toBeGreaterThanOrEqual(149);
    const c = rd("CHANGES.md");
    expect(c).toMatch(/# Дополнение 473 — /);
    expect(c).toContain("Может где-то, что-то упустили");
    expect(c).toContain("органично смотрелось и было удобно");
  });
});
