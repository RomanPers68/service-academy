// v64 (Доп. 377): ряд треков и Наставник в нижнем меню — по записи экрана владельца.
//
// «Давай поправим анимацию»; «когда нажимаешь на роль, кружок заменяется на выбранный — это будет путать»;
// «кнопку, которая открывается, нужно переработать, сделать красивее»; «AI как-то не вписывается в новый
// дизайн… может в навбар?» → «Да, прекрасно. Но давай открытые кнопки сделаем компактнее».
// Вид в браузере — tools/claude/e2e-v61.mjs (ROW, TAP, MOTION, AI).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { followPanel, trackEyebrow, lockedHint } from "../ui/tracks-row.jsx";
import { HINTS } from "../data/hints.js";

const rd = (f) => readFileSync(f, "utf8");

// ── стенд для followPanel: панель с заданными высотами по кадрам, лента, кадры по запросу ──
const mkEl = (hs) => { let i = 0; return { isConnected: true, getBoundingClientRect: () => ({ height: hs[Math.min(i++, hs.length - 1)] }) }; };
const mkSc = (top) => { const log = []; let v = top; return { log, get scrollTop() { return v; }, set scrollTop(x) { v = x; log.push(x); } }; };
const mkRaf = () => { const q = []; return { q, raf: (f) => { q.push(f); return q.length; }, caf: () => { q.length = 0; }, run(n = 99) { while (q.length && n-- > 0) q.shift()(); } }; };

describe("v64: страница едет вместе с панелью (followPanel)", () => {
  it("раскрытие: прокрутка растёт вместе с высотой панели и встаёт ровно в конец", () => {
    const el = mkEl([0, 25, 50, 75, 100]), sc = mkSc(10), f = mkRaf();
    followPanel(el, sc, 0, 100, 10, 26, f.raf, f.caf);
    f.run();
    expect(sc.log).toEqual([10, 14, 18, 22, 26]);
  });
  it("сворачивание: лента опускается вместе с панелью, последний кадр — ровно туда, где страница кончится", () => {
    const el = mkEl([94, 60, 30, 0]), sc = mkSc(25), f = mkRaf();
    followPanel(el, sc, 94, 0, 25, 10, f.raf, f.caf);
    f.run();
    expect(sc.log[sc.log.length - 1]).toBe(10);
    expect(sc.log.every((x, i) => i === 0 || x <= sc.log[i - 1])).toBe(true);   // только вниз, без рывков назад
  });
  it("человек сам тронул ленту — отпускаем, не тянем обратно", () => {
    const el = mkEl([0, 25, 50, 75, 100]), sc = mkSc(10), f = mkRaf();
    followPanel(el, sc, 0, 100, 10, 26, f.raf, f.caf);
    f.run(1);
    sc.scrollTop = 200; sc.log.length = 0;
    f.run();
    expect(sc.log).toEqual([]);
    expect(sc.scrollTop).toBe(200);
  });
  it("двигать нечего (меньше пикселя) — ничего не планирует; stop() останавливает", () => {
    const f = mkRaf();
    const stop0 = followPanel(mkEl([0, 100]), mkSc(10), 0, 100, 10, 10.5, f.raf, f.caf);
    expect(f.q.length).toBe(0); stop0();
    const el = mkEl([0, 25, 50, 75, 100]), sc = mkSc(10);
    const stop = followPanel(el, sc, 0, 100, 10, 26, f.raf, f.caf);
    f.run(1); stop(); f.run();
    expect(sc.log).toEqual([10]);
  });
  it("панель убрали со страницы посреди движения — дотягивает до конца и останавливается", () => {
    const el = { isConnected: false, getBoundingClientRect: () => ({ height: 3 }) }, sc = mkSc(25), f = mkRaf();
    followPanel(el, sc, 94, 0, 25, 10, f.raf, f.caf);
    f.run();
    expect(sc.log).toEqual([10]);
  });
});

describe("v64: ряд треков — кружки на местах, панель под ними", () => {
  const row = rd("ui/tracks-row.jsx");
  it("ряд не перестраивается: шесть кружков всегда в одном порядке; выбранный — кольцо цвета трека и чуть крупнее", () => {
    expect(row).toContain("{items.map(node)}");
    expect(row).not.toContain("order: -1");
    expect(row).toContain('data-track-sel={sel ? "" : undefined}');
    expect(row).toContain("aria-pressed={sel}");
    expect(row).toContain('transform: sel ? "scale(1.07)" : "none"');
    expect(row).toContain("inset 0 0 0 1.5px ${selRing}, 0 0 0 3px ${selRing}33, 0 0 18px ${selRing}66");
  });
  it("панель — под рядом, язычок указывает на выбранный кружок и переезжает за ним", () => {
    expect(row).toContain("const centerOf = (i) => i * slot + D / 2;");
    expect(row).toContain('data-track-notch=""');
    expect(row).toContain("left: notchX - 7");
    expect(row).toContain("transition: `left .35s ${EASE}`");
    expect(row).toContain("radial-gradient(120% 90% at ${notchPct}% 0%");
  });
  it("компактная панель: три строки — название · кто это (+ «твой»), описание в одну строку, ступень · нить · «Открыть ›»", () => {
    expect(row).toContain("{x.r.label}</span>");
    expect(row).toContain("· {x.r.sublabel}</span>");
    expect(row).toContain('data-track-mine=""');
    expect(row).toContain(">твой</span>");
    expect(row).toMatch(/fontSize: 12\.5, lineHeight: 1\.4, color: text, opacity: x\.open \? 0\.88 : 0\.65, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"/);
    expect(row).toContain("{trackEyebrow(x.r.id)}");
    expect(row).toContain('{pct ? `${pct}%` : "не начат"}');
    expect(row).toContain('data-track-go=""');
    expect(row).toContain('whiteSpace: "nowrap" }}>Открыть ›</span>');
    expect(row).toContain('padding: "10px 12px 10px"');
    expect(row).toContain("borderRadius: 16");
    // закрытый трек — замок и что его откроет; перехода нет
    expect(row).toContain("{lockIcon(T.modSub.color, 13)}</span>{lockedHint(x.r.id)}");
  });
  it("строка «где трек на пути»: ступени зала, приём гостей, бар", () => {
    expect(trackEyebrow("seasonal")).toBe("Ступень 1/4");
    expect(trackEyebrow("core")).toBe("Ступень 2/4");
    expect(trackEyebrow("service_manager")).toBe("Ступень 4/4");
    expect(trackEyebrow("spg")).toBe("Приём гостей");
    expect(trackEyebrow("bar")).toBe("Бар");
    expect(lockedHint("core")).toBe("Пройди «Новичок», чтобы открыть");
  });
  it("движение: по высоте (текст не растягивается), смена — мягкая смена содержимого, сворачивание — высота и отступ к нулю", () => {
    expect(row).toContain('[{ height: "0px", marginTop: "0px" }, { height: to + "px", marginTop: MT + "px" }]');
    expect(row).toContain('[{ height: h + "px", marginTop: MT + "px", opacity: 1 }, { height: "0px", marginTop: "0px", opacity: 0 }]');
    expect(row).toContain('className="sa-panel-out"');
    expect(row).toContain('className="sa-panel-in"');
    expect(row).toContain("stop = followPanel(el, sc, from, to, sc.scrollTop, sc.scrollTop + delta)");
    expect(row).toContain("stop = followPanel(el, sc, h, 0, s0, after)");
    expect(row).toContain("if (id === openId) { close(); return; }");   // повторный тап по выбранному — свернуть
    const css = rd("ui/css.js");
    expect(css).toContain(".sa-panel-in { animation: saPanelIn .24s cubic-bezier(.2,.8,.2,1) .03s both; }");
    expect(css).toContain(".sa-panel-out { animation: saPanelOut .12s ease-out both; }");
    expect(css).toContain("@media (prefers-reduced-motion: reduce) { .sa-panel-in, .sa-panel-out { animation: none; } }");
    expect(css).not.toMatch(/saPanel(In|Out) \{[^}]*blur/);   // без размытия: на слабых телефонах мигало бы
  });
});

describe("v64: Наставник — круг посередине нижнего меню", () => {
  const tb = rd("ui/tabbar.jsx"), app = rd("App.jsx");
  it("панель вкладок: ячейка AI между «Сменой» и «Командой»; тап и перетаскивание линзы на неё открывают Наставника", () => {
    expect(tb).toContain('export function LiquidTabBar({ tabs, activeId, onTab, a11y, onAi = null, aiMode = "center" })');
    expect(tb).toContain("const AI_AT = Math.floor(n0 / 2);");
    expect(tb).toContain("if (ti === -1) { ai(); return; }");
    expect(tb).toContain('<div key="ai" data-tab-ai="" role="button" tabIndex={0} aria-label="AI-наставник"');
    expect(tb).toContain("export function AiDisc({ a11y, size = 46, glass = false, pulse = false })");
  });
  it("пульс «ещё не открывали» переехал вместе с кнопкой — тот же ключ sa_ai_fab, что у прежней кнопки и меню слева", () => {
    expect(tb).toContain('const [aiNew, setAiNew] = useState(() => { try { return localStorage.getItem("sa_ai_fab") !== "1"; } catch (e) { return false; } });');
    expect(tb).toContain("<AiDisc a11y={a11y} size={46} pulse={aiNew} />");
    expect(tb).toContain('{pulse ? <span className="sa-pulse" data-ai-pulse=""');
  });
  it("App: в портрете — меню с AI посередине, плавающей кнопки нет; на компьютере — меню слева, как было", () => {
    expect(app).toContain('onAi={() => navigate("assistant")} aiMode="center" />;');
    expect(app).toContain("const fabOn = false;");
    expect(app).toContain("function AiFab({ a11y, onClick, screen }) {");   // сама кнопка в коде осталась
    expect(app).toContain("? <NavRail a11y={a11y} activeId={activeId} tabs={tabs} compact={vp.short} onTab={(id) => navigate(id)} onAi={() => navigate(\"assistant\")} />");
    expect(app).not.toContain("sa_ai_place");
  });
  it("тексты вслед за кнопкой: карточка приветствия, тур главной; на компьютере — «слева» и «внизу меню»", () => {
    expect(app).toContain("Круглая кнопка «AI» посередине нижнего меню (на компьютере в меню слева) открывает Наставника.");   // v74
    expect(HINTS.home_staff[2]).toBe("Внизу четыре вкладки: «Учусь» с программой, «Смена» с рабочим днём, «Команда» и «Я». Круг «AI» посередине открывает Наставника.");   // v74
    expect(HINTS.home_admin[2]).toContain("Внизу четыре вкладки и Наставник «AI» посередине.");
    expect(rd("ui/screens-roleselect.jsx")).toContain('.replace(/^Внизу/, "Слева").replace("посередине", "внизу меню")');
  });
  it("ряду больше не нужно уступать кнопке: ни «ушка», ни отступа под неё", () => {
    expect(rd("ui/tracks-row.jsx")).not.toContain("sa-fab");
    expect(rd("ui/screens-roleselect.jsx")).not.toContain("data-ai-spot");
  });
});

describe("v64: метка сборки и описание", () => {
  it("«сборка v64», «Дополнение 377»", () => {
    expect(rd("ui/menu-trainer.jsx")).toMatch(/· сборка v\d{2}<\/span>/);   // v65 — следующая метка
    expect(rd("CHANGES.md")).toContain("# Дополнение 377");
  });
});
