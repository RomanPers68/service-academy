// v96 (Доп. 409): клавиатура на iPhone — строка ввода едет ровно вместе с клавиатурой; Наставник прикладывает только то
// блюдо, о котором спросили.
// Клавиатура. Запись владельца (v95, 60 кадров в секунду): строка ввода дрожала относительно клавиатуры на 8–15 px: отступ,
// который код менял каждый кадр, в Telegram на iPhone доходит до экрана неровно, через раз. И трогалась позже клавиатуры.
// Теперь ход ведёт браузер (Web Animations: transform у всего, что с data-kbm), раскладка (--kb, --kbs) меняется один раз,
// ход — по кривой самой клавиатуры (KB_OPEN, KB_CLOSE) с момента нажатия. Вид по кадрам — tools/claude/e2e-v96.mjs.
// Карточки. Спросили «что входит в салат два моря» — пришёл и «Морской ёж» (запись владельца): слова сравнивались по
// началу («моря» → «мор…» → «морской»), а «ёж» из двух букв не проверялся. Теперь основа слова целиком (lib/ai-cards.js).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const rd = (f) => readFileSync(f, "utf8");

describe("v96: ход клавиатуры iPhone (ui/keyboard.js)", () => {
  it("кривые сняты с записи: с нуля до единицы, только растут; появляется резко (треть пути за 25 мс), уходит чуть плавнее", async () => {
    const K = await import("../ui/keyboard.js");
    for (const pts of [K.KB_OPEN, K.KB_CLOSE]) {
      expect([pts[0][0], pts[0][1], pts[pts.length - 1][1]]).toEqual([0, 0, 1]);
      for (let i = 1; i < pts.length; i++) expect([i, pts[i][0] > pts[i - 1][0], pts[i][1] >= pts[i - 1][1]]).toEqual([i, true, true]);
    }
    expect(K.KB_OPEN[K.KB_OPEN.length - 1][0]).toBe(290);
    expect(K.KB_CLOSE[K.KB_CLOSE.length - 1][0]).toBe(258);
    expect(K.kbCurve(K.KB_OPEN, 25)).toBeCloseTo(0.38, 9);
    expect(K.kbCurve(K.KB_CLOSE, 25)).toBeCloseTo(0.216, 9);
    expect(K.kbCurve(K.KB_OPEN, 12.5)).toBeCloseTo(0.12 + (0.27 - 0.12) * (4.5 / 9), 6);   // между точками — по прямой
    expect([K.kbCurve(K.KB_OPEN, -10), K.kbCurve(K.KB_OPEN, 5000), K.kbCurve([], 10)]).toEqual([0, 1, 1]);
  });
  it("путь: не опоздали — ровно по клавиатуре; опоздали — сходимся с ней за KB_CATCH; последний шаг — ровно цель", async () => {
    const { kbPath, kbAt, kbCurve, KB_OPEN, KB_CATCH } = await import("../ui/keyboard.js");
    expect(KB_CATCH).toBe(20);   // v98: было 50 мс — догоняем за кадр с небольшим (клавиатура и сама в первом кадре проходит треть)
    // фокус в 1000 мс, едем с того же мига от 818 к 516
    const p = kbPath(KB_OPEN, { y0: 818, y1: 516, k0: 1000, s: 1000, ys: 818 });
    expect(p[0]).toEqual({ t: 0, y: 818 });
    expect(p[p.length - 1].y).toBe(516);
    expect(p[p.length - 1].t).toBe(290);
    for (const u of [16, 48, 112, 208]) expect(kbAt(p, u)).toBeCloseTo(818 - 302 * kbCurve(KB_OPEN, u), 0);
    // Telegram сообщил через 40 мс: стоим в 818, клавиатура уже прошла почти половину — догоняем
    const q = kbPath(KB_OPEN, { y0: 818, y1: 516, k0: 1000, s: 1040, ys: 818 });
    expect(q[0].y).toBe(818);
    expect(Math.abs(kbAt(q, 32) - (818 - 302 * kbCurve(KB_OPEN, 40 + 32)))).toBeLessThan(1.5);   // догнали (точки пути — через 16 мс)
    for (let i = 1; i < q.length; i++) expect(q[i].y <= q[i - 1].y + 1e-9).toBe(true);   // только вверх
    // клавиатура давно доехала: короткий доезд, не меньше 90 мс
    const r = kbPath(KB_OPEN, { y0: 818, y1: 516, k0: 0, s: 5000, ys: 700 });
    expect(r[r.length - 1]).toEqual({ t: 90, y: 516 });
  });
  it("куда ехать: вверх — трансформом, раскладка в конце; вниз — раскладка сразу; трансформом вниз от раскладки не сдвигаем", async () => {
    const { kbMove } = await import("../ui/keyboard.js");
    expect(kbMove(818, 516, 0)).toBe("up");
    expect(kbMove(516, 818, -302)).toBe("down");
    expect(kbMove(818, 818.4, 0)).toBe("settle");
    expect(kbMove(864, 516, 12)).toBe("settle");   // уже ниже раскладки — сразу на место
  });
  it("высоты клавиатуры «с прошлого раза» нет (v98: ход ждёт сообщения Telegram, sa_kb_k не нужен)", async () => {
    const K = await import("../ui/keyboard.js");
    expect([K.kbRemember, K.kbRemembered]).toEqual([undefined, undefined]);
    expect(rd("ui/keyboard.js")).not.toContain("sa_kb_k");
  });
  it("хук: ход — Web Animations у всего, что с data-kbm, с одного момента; раскладка — setLayout; фокус — начало хода", () => {
    const src = rd("ui/keyboard.js");
    for (const s of [
      'all("[data-kbm]").forEach((m) => { try { anims.push(m.animate(frames, { duration: total, easing: "linear", fill: "forwards" })); } catch (e) { /* */ } });',
      "anims.forEach((a) => { try { a.startTime = t0; } catch (e) { /* */ } });",
      "if (!anims.length) { setLayout(Lg, St); yIdle = goal; return; }   // ехать некому — сразу на место",
      "if (up) setLayout(rn.Lg, rn.St);",   // v98: up = rn.dir === "up"
      "if (!animOk() || calm()) { snap(); return; }",
      // v98: начало хода — kbOpenAt (сообщение Telegram) и kbCloseAt (ушёл фокус), а не сам фокус
      "const k0 = same ? run.k0 : kbOpenAt(te, kOpen), y0 = same ? run.y0 : yS;",
      "const k0 = same ? run.k0 : kbCloseAt(te, kClose), y0 = same ? run.y0 : yS;",
      "const onOut = (e) => { if (!textInput(e && e.relatedTarget)) kClose = now(); later(); };",
    ]) expect([s, src.includes(s)]).toEqual([s, true]);
  });
  it("прокрутка ленты держит зазор до низа; окно выросло раньше нас — берём прокрутку до того; usePinBottom не прижимает поверх", () => {
    const src = rd("ui/keyboard.js");
    for (const s of [
      "const c = s.clientHeight, t = w.t + (w.c - c);",
      "const before = (resized) => all(\"[data-kbm-scroll]\").map((s) => { let w = null; try { w = (resized && kept.get(s)) || snapOf(s); } catch (e) { w = null; } return [s, w]; });",
      "const was = before(resized);   // прокрутка лент до перемены раскладки (окно уже сменило высоту — до того)",
      'if (root) root.addEventListener("scroll", onScroll, { capture: true, passive: true });',
      "s.__kbH = c !== w.c ? c : undefined;",
      "if (el.__kbH === nh) { el.__kbH = undefined; return; }",
    ]) expect([s, src.includes(s)]).toEqual([s, true]);
    expect(src).not.toContain("if (resized && s.scrollHeight - s.scrollTop - s.clientHeight < 2) return;");
  });
  it("рамка слоя — по раскладке: сдвиг въезда (.sa-screen, translateY 12 px) не в счёт", () => {
    const src = rd("ui/keyboard.js");
    expect(src).toContain("if (Math.abs(m.a - 1) < 1e-3 && Math.abs(m.d - 1) < 1e-3 && Math.abs(m.b) < 1e-3 && Math.abs(m.c) < 1e-3) dy = m.f || 0;");
    expect(src).toContain("return dy ? { top: r.top - dy, bottom: r.bottom - dy, height: r.height, width: r.width } : r;");
    expect(rd("ui/css.js")).toContain("from { opacity: 0; transform: translateY(12px); }");
  });
});

describe("v96: что едет с клавиатурой (разметка)", () => {
  it("чат: лента (и её прокрутка), кнопка «вниз», строка ввода, 7 затемнений листов, низ «Нового чата»", () => {
    const chat = rd("ui/chat.jsx"), cards = rd("ui/chat-cards.jsx");
    expect(chat).toContain('<div ref={chatRef} className="ch-chat sa-dlgscroll" role="log" aria-live="polite" aria-relevant="additions" onScroll={onScroll} data-chat-feed="" data-kbm="" data-kbm-scroll="">');
    expect(chat).toContain('<button type="button" className="ch-down" data-kbm=""');
    expect(chat).toContain('<div className="ch-bar" data-kbm="" data-kbm-at="">');   // v98: data-kbm-at
    expect((chat.match(/className="ch-veil" data-kbm=""/g) || []).length).toBe(7);   // v97: + «Поделиться в чат» и карточка коллеги
    expect((cards.match(/className="ch-veil" data-kbm=""/g) || []).length).toBe(2);
    expect((chat.match(/<div className="ch-foot" data-kbm="" data-kbm-at="">/g) || []).length).toBe(2);   // v98: data-kbm-at
    expect(chat).toContain(".ch-chatwrap{position:relative;flex:1 1 auto;min-height:0;overflow:hidden}");
    expect(chat).toContain('<div className="ch-chatwrap sa-dlgpath">');
  });
  it("«Уменьшить движение» в чате: переходы 0 с (с 0,01 мс смена выреза снизу запаздывала на кадр)", () => {
    const chat = rd("ui/chat.jsx");
    expect(chat).toContain("@media (prefers-reduced-motion: reduce){.sa-dlg.ch *,.ch-banner{animation-duration:.01ms!important;transition-duration:0s!important}}");
    expect(chat).not.toContain("transition-duration:.01ms");
  });
  it("Наставник: лента в рамке (overflow: hidden) едет трансформом, строка ввода тоже; вырез снизу — env()", () => {
    const as = rd("ui/assistant.jsx");
    expect(as).toContain('<div style={{ flex: 1, minHeight: 0, position: "relative", overflow: "hidden" }}>');
    expect(as).toContain('<div ref={listRef} className="sa-dlgscroll" data-kbm="" data-kbm-scroll=""');
    expect(as).toContain('<div className="sa-ai-bar" data-kbm=""');
  });
});

describe("v96: Наставник — карточка того блюда, о котором спросили (lib/ai-cards.js)", () => {
  it("основа слова целиком: «салата» = «салат», «моря» ≠ «морской», «ежа» = «ёж», «рибая» = «рибай»", async () => {
    const A = await import("../lib/ai-cards.js");
    const same = (a, b) => A.sameWord(a, b);
    expect([same("салат", "салата"), same("салат", "салате"), same("моря", "морем"), same("еж", "ежа"), same("морской", "морского"), same("рибай", "рибая"), same("икра", "икрой"), same("мидии", "мидиями")])
      .toEqual([true, true, true, true, true, true, true, true]);
    expect([same("моря", "морской"), same("моря", "мороженое"), same("морс", "моря"), same("сало", "салат"), same("два", "двух"), same("рыба", "рибай")])
      .toEqual([false, false, false, false, false, false]);
    expect(A.aiStems("рибая")).toEqual(["рибая", "риб", "риба"]);
    // беглая гласная: «креветок» — те же креветки, «огурца» — тот же огурец
    expect([same("креветки", "креветок"), same("огурец", "огурца"), same("перец", "перца"), same("чеснок", "чеснока")]).toEqual([true, true, true, true]);
    expect(A.namedIn("Креветки темпура", A.aiWords("сколько креветок в темпуре"))).toBe(true);
  });
  it("в названии считаются все слова, кроме предлогов, союзов и чисел: «ёж» тоже", async () => {
    const A = await import("../lib/ai-cards.js");
    const q = A.aiWords("@Наставник напомнишь что входит в салат два моря, океан?");
    expect(["Салат два моря", "Морской ёж", "Мороженое", "Морс клюквенный"].map((n) => A.namedIn(n, q))).toEqual([true, false, false, false]);
    expect(A.namedIn("Морской ёж", A.aiWords("что входит в морского ежа?"))).toBe(true);
    expect(A.namedIn("Тартар из тунца", A.aiWords("тартар тунца"))).toBe(true);
    expect(A.namedIn("Пицца 4 сыра", A.aiWords("состав пиццы четыре сыра"))).toBe(true);
    expect(A.namedIn("Том ям", A.aiWords("что в том яме"))).toBe(true);
    expect(A.namedIn("Том ям", A.aiWords("том второй"))).toBe(false);
  });
  it("запись владельца: «что входит в салат два моря» — одна карточка, сам салат", async () => {
    const { pickCards } = await import("../lib/ai-cards.js");
    const SEAS = { id: "s1", name: "Салат два моря", ingredients: ["Кальмар", "Краб Стригун", "Кнелли с икрой: сливочный крем, вакаме и икра трески"] };
    const URCHIN = { id: "u1", name: "Морской ёж", ingredients: ["Морской ёж (икра)", "Желток перепелиный"] };
    const ICE = { id: "i1", name: "Мороженое", ingredients: ["Сливки"] };
    const CRAB = { id: "c1", name: "Краб стригун", ingredients: ["Краб стригун"] };
    const r = pickCards({ text: "Роман, вот состав салата «Два моря»:\n1. Кальмар\n2. Краб Стригун\n3. Кнелли с икрой: икра трески", question: "@Наставник напомнишь что входит в салат два моря, океан?", dishes: [URCHIN, ICE, CRAB, SEAS] });
    expect(r.picks.map((p) => p.item.name)).toEqual(["Салат два моря"]);
    const u = pickCards({ text: "Морской ёж подаём с желтком.", question: "что входит в морского ежа?", dishes: [SEAS, URCHIN, ICE] });
    expect(u.picks.map((p) => p.item.name)).toEqual(["Морской ёж"]);
  });
});

describe("v96: документы", () => {
  it("README: e2e-v96; CHANGES: Дополнение 409; «сборка v96»", () => {
    expect(rd("tools/claude/README.md")).toContain("`e2e-v96.mjs` — v96 (Доп. 409)");
    expect(rd("CHANGES.md")).toContain("# Дополнение 409 — Клавиатура на iPhone: строка ввода едет вровень с клавиатурой; Наставник прикладывает только то блюдо, о котором спросили (v96)");
    expect(rd("ui/menu-trainer.jsx")).toMatch(/· сборка v(9[6-9]|\d{3,})<\/span>/);
  });
});
