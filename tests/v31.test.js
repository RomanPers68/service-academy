// v31 (Доп. 323–330): «берём все» — доработки нововведений v30. Слои, быстрая отметка дня,
// квест и свеча на двоих, лига, погреб тем, итоги месяца (сравнение, подписи, картинка),
// живой гость (шёпот, свои гости, поток), радио (живые голоса), ai-chat на новых ключах.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { layersReducer, layerData, topLayer, TOP_KINDS } from "../lib/layers";
import { dayRecord } from "../lib/learning-sync";
import { bumpActivity, readActivity, ACTIVITY_KEEP_DAYS } from "../lib/activity";
import { wineLevel } from "../lib/freshness";
import { monthRecap, spanStats, recapParts, compareLine, recapShareText, PART_WORDS } from "../lib/month-recap";
import { drawRecap, RECAP_W, RECAP_H } from "../lib/recap-image";
import { pickGuest, PERSONAS, normPersona, previousRun, streamText } from "../lib/live-guest";
import { questSegments, pairMilestone, pairNudgeText, PAIR_MILESTONES } from "../ui/together";
import { gapWords, moveOf, cupStreak } from "../ui/league";

function mem(init = {}) {
  const o = { ...init };
  return { o, get length() { return Object.keys(o).length; }, key: (i) => Object.keys(o)[i], getItem: (k) => (k in o ? o[k] : null), setItem: (k, v) => { o[k] = String(v); }, removeItem: (k) => { delete o[k]; } };
}
const D = (s, h = 12) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d, h); };

describe("слои поверх экрана (диспетчер)", () => {
  it("обычный слой заменяет прежний, Наставник — поверх", () => {
    let s = layersReducer([], { type: "open", kind: "warmup", data: 1 });
    s = layersReducer(s, { type: "open", kind: "radio", data: [1, 2] });
    expect(s.map((l) => l.kind)).toEqual(["radio"]);
    s = layersReducer(s, { type: "open", kind: "mentor", data: { q: "?" } });
    expect(s.map((l) => l.kind)).toEqual(["radio", "mentor"]);
    expect(topLayer(s)).toBe("mentor");
    expect(layerData(s, "radio")).toEqual([1, 2]);
    expect(layerData(s, "guest")).toBe(null);
    s = layersReducer(s, { type: "close", kind: "mentor" });
    expect(topLayer(s)).toBe("radio");
    expect(layersReducer(s, { type: "closeAll" })).toEqual([]);
    expect(TOP_KINDS.has("mentor")).toBe(true);
  });
  it("ревью v31: поздний ответ слою не закрывает Наставника поверх", () => {
    let s = layersReducer([], { type: "open", kind: "special", data: { key: 1 } });
    s = layersReducer(s, { type: "open", kind: "mentor", data: { q: "?" } });
    s = layersReducer(s, { type: "open", kind: "special", data: { key: 1, record: true } });
    expect(s.map((l) => l.kind)).toEqual(["special", "mentor"]);
    expect(layerData(s, "special")).toEqual({ key: 1, record: true });
  });
  it("закрыть несуществующий — то же состояние; мусор не ломает", () => {
    const s = [{ kind: "week", data: true }];
    expect(layersReducer(s, { type: "close", kind: "pair" })).toBe(s);
    expect(layersReducer(null, { type: "nope" })).toEqual([]);
    expect(layersReducer(s, null)).toBe(s);
    expect(layerData(layersReducer([], { type: "open", kind: "recap" }), "recap")).toBe(true);
  });
});

describe("быстрая отметка дня (этап 25: sa_day_push)", () => {
  it("сегодняшняя запись журнала, только числа > 0, не больше 1000", () => {
    const ls = mem();
    bumpActivity("_a", "lesson", 2, D("2026-10-14"), ls);
    bumpActivity("_a", "warmup", 1, D("2026-10-14"), ls);
    bumpActivity("_a", "lesson", 1, D("2026-10-13"), ls);
    expect(dayRecord("_a", ls, D("2026-10-14"))).toEqual({ day: "2026-10-14", rec: { st: 3, l: 2, w: 1 } });
    expect(dayRecord("_a", ls, D("2026-10-15"))).toBe(null);
    const big = mem({ sa_activity_b: JSON.stringify({ "2026-10-14": { l: 99999, q: -3, x: "2" } }) });
    expect(dayRecord("_b", big, D("2026-10-14")).rec).toEqual({ l: 1000, x: 2 });
  });
  it("журнал хранит 75 дней — прошлый месяц для сравнения целиком", () => {
    expect(ACTIVITY_KEEP_DAYS).toBe(75);
    const ls = mem();
    bumpActivity("_a", "lesson", 1, D("2026-08-01"), ls);
    bumpActivity("_a", "lesson", 1, D("2026-10-02"), ls);   // 62 дня спустя — 1 августа ещё в журнале
    expect(Object.keys(readActivity("_a", ls))).toEqual(["2026-08-01", "2026-10-02"]);
    bumpActivity("_a", "lesson", 1, D("2026-10-20"), ls);   // 80 дней — уже нет
    expect(Object.keys(readActivity("_a", ls))).toEqual(["2026-10-02", "2026-10-20"]);
  });
});

describe("квест смены и свеча на двоих (v31)", () => {
  it("вклад каждого — доля полосы, не больше 100%", () => {
    const seg = questSegments([{ name: "Анна", me: true, w: 2 }, { name: "Пётр", surname: "Л", w: 3 }, { name: "Илья", w: 0 }], "w", 4);
    expect(seg.map((x) => x.w)).toEqual([50, 50]);
    expect(seg[0].who).toBe("ты");
    expect(seg[1].who).toBe("Пётр Л.");
    expect(questSegments([], "w", 0)).toEqual([]);
  });
  it("вехи 7 / 30 / 100", () => {
    expect(PAIR_MILESTONES).toEqual([7, 30, 100]);
    expect(pairMilestone(5)).toEqual({ got: [], next: 7, left: 2, last: 0 });
    expect(pairMilestone(31)).toEqual({ got: [7, 30], next: 100, left: 69, last: 30 });
    expect(pairMilestone(140).next).toBe(null);
  });
  it("строка свечи: напарница уже размялась — твоя очередь; выходной не рвёт", () => {
    const p = (pt, me) => ({ partner: { name: "Аня" }, partner_today: pt, me_today: me });
    expect(pairNudgeText(p({ state: 2, warm: true }, { state: 0 }))).toBe("Аня уже размялась, твоя очередь");   // v74: без тире
    expect(pairNudgeText(p({ state: 2 }, { state: 1 }))).toMatch(/выходной по графику, а Аня свою часть сделала/);
    expect(pairNudgeText(p({ state: 2 }, { state: 2 }))).toBe("Сегодня горите вдвоём");   // v73: без ✦
    expect(pairNudgeText(null)).toBe("");
  });
});

describe("лига и рейтинг (v31)", () => {
  it("«до места выше — это …», стрелки, серия кубка", () => {
    expect(gapWords(35)).toBe("2 живых гостя или 4 урока");
    expect(gapWords(20)).toBe("1 живой гость или 2 урока");
    expect(gapWords(0)).toBe("");
    expect(moveOf(2, 5)).toEqual({ up: true, n: 3 });
    expect(moveOf(4, 1)).toEqual({ up: false, n: 3 });
    expect(moveOf(3, 3)).toEqual({ same: true });
    expect(moveOf(3, null)).toBe(null);
    expect(cupStreak([{ restaurant: "Океан", week_start: "2026-10-05" }, { restaurant: "Океан", week_start: "2026-09-28" }, { restaurant: "Порт", week_start: "2026-09-21" }])).toEqual({ restaurant: "Океан", weeks: 2 });
    // ревью v31: пропущенная неделя прерывает «подряд»
    expect(cupStreak([{ restaurant: "Океан", week_start: "2026-10-05" }, { restaurant: "Океан", week_start: "2026-09-21" }])).toEqual({ restaurant: "Океан", weeks: 1 });
    expect(cupStreak([])).toBe(null);
  });
});

describe("погреб тем: уровень вина", () => {
  it("свежая — полный бокал, выдохшаяся — на донышке, обновлённая — не полный", () => {
    expect(wineLevel(null)).toBe(null);
    expect(wineLevel({ level: "fresh", k: 1 })).toBe(1);
    expect(wineLevel({ level: "faded", k: 0.4 })).toBe(0.12);
    expect(wineLevel({ level: "fresh", k: 1, updated: true })).toBe(0.75);
    const mid = wineLevel({ level: "fading", k: 0.7 });
    expect(mid > 0.25 && mid < 0.75).toBe(true);
  });
});

describe("итоги месяца v31", () => {
  const act = { "2026-09-02": { st: 3, l: 3 }, "2026-09-10": { st: 2, q: 2 }, "2026-09-20": { st: 5, l: 5 },
    "2026-10-01": { st: 4, l: 4 }, "2026-10-05": { st: 3, w: 3 }, "2026-10-11": { st: 1, g: 1 } };
  it("подписи согласуются с числом", () => {
    const parts = recapParts({ l: 9, q: 1, w: 3, g: 2, f: 5, st: 20 });
    expect(parts.map((p) => p.n + " " + p.word)).toEqual(["9 уроков", "1 тест", "3 разминки", "2 живых гостя", "5 ошибок исправлено"]);
    expect(Object.keys(PART_WORDS)).toContain("o");
  });
  it("идущий месяц — «к этому же числу»", () => {
    const r = monthRecap({ act, month: "2026-10", now: new Date(2026, 9, 12) });
    expect(r.prev).toMatchObject({ key: "2026-09", upto: 12, partial: true, st: 5, active: 2, ins: "сентябрём" });
    expect(r.totals.st).toBe(8);
    const c = compareLine(r);
    expect(c.tone).toBe("up");
    expect(c.title).toBe("Шагов больше, чем в сентябре");
    expect(recapShareText(r, "Анна")).toContain("к сентябрю: +3 шага");
  });
  it("прошедший месяц — целиком; вровень и меньше — честно", () => {
    const r = monthRecap({ act, month: "2026-10", now: new Date(2026, 10, 2) });
    expect(r.prev).toMatchObject({ upto: 30, partial: false, st: 10 });
    expect(compareLine(r)).toMatchObject({ tone: "down", title: "В сентябре шагов было больше" });
    // ревью v31: 0 шагов против 0 — «вровень», а не «было больше»
    const zero = monthRecap({ act: { "2026-09-03": { f: 2 }, "2026-10-04": { f: 1 } }, month: "2026-10", now: new Date(2026, 10, 2) });
    expect(compareLine(zero)).toMatchObject({ tone: "eq", d: 0 });
    const eq = monthRecap({ act: { "2026-09-03": { st: 10 }, "2026-10-04": { st: 10 } }, month: "2026-10", now: new Date(2026, 10, 2) });
    expect(compareLine(eq)).toMatchObject({ tone: "eq", title: "Вровень с сентябрём" });
    expect(recapShareText(eq, "")).not.toMatch(/к сентябрю/);
  });
  it("журнал уже не помнит прошлый месяц — сравнения нет", () => {
    expect(monthRecap({ act, month: "2026-10", now: new Date(2027, 0, 2) }).prev).toBe(null);
    expect(monthRecap({ act: { "2026-10-01": { st: 1 } }, month: "2026-10", now: new Date(2026, 9, 12) }).prev).toBe(null);
    expect(spanStats(act, { days: ["2026-09-03"] }, "2026-09", 30)).toEqual({ active: 4, st: 10, points: 110 });
  });
  it("картинка рисуется без ошибок: имя, месяц, подпись", () => {
    const calls = [];
    const grad = { addColorStop() {} };
    const ctx = new Proxy({ font: "10px x", fillStyle: "", strokeStyle: "", lineWidth: 1, textAlign: "left", textBaseline: "alphabetic", letterSpacing: "0px" }, {
      get(t, k) {
        if (k in t) return t[k];
        if (k === "measureText") return (s) => ({ width: String(s).length * 12 });
        if (k === "createRadialGradient" || k === "createLinearGradient") return () => grad;
        if (k === "fillText") return (s) => calls.push(String(s));
        return () => {};
      },
      set(t, k, v) { t[k] = v; return true; },
    });
    const r = monthRecap({ act, month: "2026-10", now: new Date(2026, 9, 12) });
    drawRecap(ctx, r, { name: "Анна", surname: "Смирнова", restaurant: "Океан" });
    const all = calls.join("|");
    expect(all).toContain("Анна Смирнова · Океан");
    expect(all).toMatch(/Итоги · октябрь 2026/);   // v73: подпись курсивом, обычными буквами
    expect(all).toContain("SERVICE ACADEMY");
    expect(all).toContain("8 шагов");
    expect([RECAP_W, RECAP_H]).toEqual([1080, 1350]);
  });
});

describe("живой гость v31", () => {
  it("у каждого встроенного гостя — шёпот наставника и сколько человек за столом", () => {
    Object.values(PERSONAS).flat().forEach((p) => {
      expect([p.id, typeof p.whisper, p.whisper.length > 20]).toEqual([p.id, "string", true]);
      expect(p.seats >= 1 && p.seats <= 8).toBe(true);
    });
    const g = pickGuest({ role: "seasonal", position: "waiter", seed: 7 });
    expect(g.whisper.length).toBeGreaterThan(20);
    expect(g.custom).toBe(false);
  });
  it("свои гости заведения: нормализация, только своё место, «сыграть ещё раз»", () => {
    const rows = [
      { id: "c-abc123abc123", place: "hall", name: "Пётр", age: 200, mood: 9, open: "Добрый день!", tags: ["вегетарианец", "", "торопится", "x", "y"], whisper: "Спроси про мясо" },
      { id: "c-bar000000001", place: "bar", name: "Олег", open: "Привет" },
      { id: "c-broken", place: "hall", name: "", open: "Нет имени" },
    ];
    const n = normPersona(rows[0]);
    expect([n.age, n.mood, n.tags, n.custom, n.seats]).toEqual([90, 5, ["вегетарианец", "торопится", "x"], true, 2]);
    expect(normPersona(rows[2])).toBe(null);
    const g = pickGuest({ role: "seasonal", position: "waiter", seed: 1, extra: rows, prefer: "c-abc123abc123" });
    expect([g.id, g.name, g.custom, g.whisper]).toEqual(["c-abc123abc123", "Пётр", true, "Спроси про мясо"]);
    // бармену — не гость зала
    const b = pickGuest({ role: "bar", position: "bartender", seed: 1, extra: rows, prefer: "c-abc123abc123" });
    expect(b.id).not.toBe("c-abc123abc123");
    // среди многих выборов свой гость встречается
    const ids = new Set(); for (let i = 0; i < 40; i++) ids.add(pickGuest({ role: "seasonal", position: "waiter", seed: i, extra: rows }).id);
    expect(ids.has("c-abc123abc123")).toBe(true);
  });
  it("было/стало: с этим же гостем, иначе прошлый живой разговор", () => {
    const runs = [{ p: "rush", s: 3, ai: true }, { p: "kid", s: 2, ai: false }, { p: "late", s: 4, ai: true }];
    expect(previousRun(runs, "rush")).toMatchObject({ s: 3, same: true });
    expect(previousRun(runs, "vip")).toMatchObject({ p: "late", same: false });
    expect(previousRun([], "x")).toBe(null);
  });
  it("текст потоком — без меток настроения и их начала", () => {
    expect(streamText("Здравствуйте! [[mo")).toBe("Здравствуйте!");
    expect(streamText("Минуту [")).toBe("Минуту");
    expect(streamText("Хорошо. [[mood:4]]\n[[end]]")).toBe("Хорошо.");
  });
});

describe("сервер: ai-chat и radio-tts (v31)", () => {
  const chat = readFileSync("supabase/functions/ai-chat/index.ts", "utf8");
  const tts = readFileSync("supabase/functions/radio-tts/index.ts", "utf8");
  it("ai-chat: сервисный ключ — через keyHeaders (новые sb_secret_ ключи не в Bearer)", () => {
    expect(chat).toContain("const keyHeaders");
    expect(chat).not.toMatch(/Bearer \$\{SERVICE_KEY\}/);
  });
  it("ai-chat: свой гость — с сервера (guest_persona_get), поток — только для реплик гостя", () => {
    expect(chat).toContain("rpc/guest_persona_get");
    // ревью v31: по имени — только без номера (свой гость «Елена» не подменяется встроенной)
    expect(chat).toMatch(/: !id \? Object\.values\(GUEST_PERSONAS\)\.find/);
    expect(chat).toMatch(/wantStream = !!\(isGuest && !finish && stream\)/);
    expect(chat).toContain("text/event-stream");
  });
  it("radio-tts: без ключа — not_configured, кэш по sha256, лимит в сутки", () => {
    expect(tts).toContain("not_configured");
    expect(tts).toContain("SHA-256");
    expect(tts).toContain("rpc/sa_tts_take");   // счёт атомарно на сервере (ревью v31)
    expect(tts).toContain("radio-voice");
  });
});
