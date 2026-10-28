// v101 (Доп. 414): главная «Линза». Владелец (29.10) про новую главную: «не понравился. Если это будет приближенно к тому,
// что есть, но более красиво, с каким-то общим элементом, который будет роднить весь экран, и будет радовать глаз, то
// возможно». Из «Линзы», «Строчки» и «Меню», а потом «Хрусталя» и «Оправы» выбрал «Линзу» (lib/home-look.js,
// ui/home-look.jsx). Раскладка прежняя; e2e — tools/claude/e2e-v101.mjs.
// Там же главная целиком на экране (lib/home-fit.js). Владелец: «стоит ли сжать немного элементы и закрепить экран?
// В основном на больших экранах… чтобы было видно девиз академии… чтобы учитывались открытые уроки, тогда уже может
// работать скрол».
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { LOOKS, LOOK_NAMES, LOOK_KEY, LOOK_DEFAULT, homeLook, setHomeLook, nextLook, lookClass } from "../lib/home-look.js";
import { FIT_ITEMS, FIT_ABOVE, FIT_GAP, FIT_TAIL, FIT_NONE, fitValues, fitOver, fitNext, fitTailFor, fitTail, fitBudget } from "../lib/home-fit.js";

const rd = (f) => readFileSync(f, "utf8");
const mem = (init = {}) => { const m = { ...init }; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, m }; };

describe("v101: выбор вида главной", () => {
  it("«Линза» — вид по умолчанию; «как сейчас» — запасной; неизвестное (и показанные «Хрусталь», «Оправа», «Меню») — «Линза»", () => {
    expect(LOOKS).toEqual(["now", "lens"]);
    expect(LOOK_NAMES).toEqual({ now: "как сейчас", lens: "Линза" });
    expect(LOOK_DEFAULT).toBe("lens");
    expect(homeLook(mem())).toBe("lens");
    expect(homeLook(mem({ [LOOK_KEY]: "now" }))).toBe("now");
    for (const v of ["crystal", "bezel", "menu", "stitch", "neon"]) expect(homeLook(mem({ [LOOK_KEY]: v }))).toBe("lens");
    const s = mem();
    expect(setHomeLook("now", s)).toBe("now"); expect(s.m[LOOK_KEY]).toBe("now");
    expect(setHomeLook("x", s)).toBe("lens");
  });
  it("класс на корне: «Линза» — sa-look sa-look-lens; «как сейчас» — без класса (вид прежний до пикселя)", () => {
    expect([nextLook("now"), nextLook("lens"), nextLook("?")]).toEqual(["lens", "now", "now"]);
    expect(lookClass("lens")).toBe(" sa-look sa-look-lens");
    expect(lookClass("now")).toBe("");
    expect(lookClass("crystal")).toBe("");
  });
});

describe("v101: швы", () => {
  const RS = rd("ui/screens-roleselect.jsx"), APP = rd("App.jsx"), CSS = rd("ui/home-look.jsx"), BOOT = rd("tools/claude/demo-app/boot.js");
  it("App: вид из localStorage, переключение без перезагрузки; RoleSelect: классы на корне, метки круглого", () => {
    expect(APP).toContain("const [look, setLook] = useState(() => homeLook());");
    expect(APP).toContain("window.addEventListener(LOOK_EVENT, on)");
    expect(APP).toContain("look={look} nowCard={nowCard}");
    expect(RS).toContain('className={"sa-screen" + (wideCols ? " sa-home2" : "") + lk} data-home-look={look}');
    for (const a of ["data-tools-capsule", "data-tool-disc", "data-sos-disc"]) expect(RS).toContain(a + '=""');
    expect(RS).not.toMatch(/MenuFrame|data-home-divider|data-sos-sep/);
    expect(rd("ui/tracks-row.jsx")).toContain('data-orb-glass=""');
  });
  it("«Линза»: всё круглое одного стекла; у инструментов кольцо по краю кружка — ряд обрезан по высоте, снаружи срезалось", () => {
    expect(CSS).toContain(".sa-look-lens .de-medal{border-radius:50%;background:var(--lk-glass)");
    expect(CSS).toContain('.sa-look-lens [data-tool-disc]::after{content:"";position:absolute;inset:0;border-radius:50%;border:1px solid var(--lk-ring);pointer-events:none}');
    expect(CSS).toContain('.sa-look-lens [data-tool-disc]::before{content:"";position:absolute;inset:2.5px;border-radius:50%;background:var(--lk-glass)');
    expect(CSS).not.toMatch(/\[data-tool-disc\]::after\{[^}]*inset:-/);
    expect(CSS).toContain(".sa-look-lens [data-orb-glass]{background:var(--lk-glass)!important");
    expect(CSS).toContain("html.sa-light .sa-look{");
  });
  it("варианты, которые не выбраны («Хрусталь», «Оправа», «Строчка», «Меню»), в приложение не попали", () => {
    expect(CSS).not.toMatch(/sa-lens-crystal|sa-lens-bezel|sa-look-stitch|sa-look-menu/);
  });
  it("демо: «Вид: …» в строке (Линза или как было), выбор переживает смену человека", () => {
    expect(BOOT).toContain('<label class="look"><span class="lk-l">Вид:</span><b></b><select aria-label="Вид главной"></select></label>');
    expect(BOOT).not.toContain("lsSet(LOOK_KEY");
    expect(BOOT).toContain("const keep = new Set([K_SRV, K_WHO, K_DAY, K_T, LOOK_KEY]);");
  });
});

describe("v101: главная целиком на экране (lib/home-fit.js)", () => {
  it("k = 0 — размеры прежние до пикселя: логотип 152×121, поля 16/8, разделитель 19 + 10, девиз 4/8/8, под девизом 12 + 20", () => {
    const v = fitValues(0);
    expect([v.logoW, v.logoH, v.logoPadTop, v.logoPadBottom]).toEqual([152, 121, 16, 8]);
    expect([v.greetPb, v.stripPb, v.cardPb, v.tilesPb, v.toolsMb, v.titlePb]).toEqual([8, 8, 9, 8, 8, 8]);
    expect([v.divH, v.divPb, v.quoteMt, v.quotePt, v.quotePb]).toEqual([19, 10, 4, 8, 8]);
    expect(fitTail(null)).toEqual({ quoteMb: 12, tailPb: 20 });
    expect(FIT_TAIL).toBe(32);
    expect(fitValues("x")).toEqual(v);
    expect(fitValues(-1)).toEqual(v);
  });
  it("k = 1 — меньше всего, но не мельче: логотип 90×72, поля не меньше 0, ничего не пропадает", () => {
    const v = fitValues(1);
    expect([Math.round(v.logoW), v.logoH]).toEqual([90, 72]);
    for (const [key, [a, b]] of Object.entries(FIT_ITEMS)) { expect(b).toBeLessThanOrEqual(a); expect(b).toBeGreaterThanOrEqual(0); expect(v[key]).toBe(b); }
    expect(fitValues(2)).toEqual(v);
    expect(FIT_ABOVE).toBe(115);
    expect(FIT_GAP).toBe(8);
    expect(FIT_NONE).toEqual({ k: 0, tail: null });
    expect(Object.isFrozen(FIT_NONE)).toBe(true);
  });
  it("fitOver: девиз над меню с зазором 8 и без прокрутки при пустом хвосте; минимальная высота неизвестна — только меню", () => {
    expect(fitOver(700, 720, 600, 650)).toBe(-12);            // и над меню (−12), и в минимальной высоте (−50)
    expect(fitOver(715, 720, 600, 650)).toBe(3);              // за меню на 3 (с зазором 8)
    expect(fitOver(700, 720, 660, 650)).toBe(10);             // над меню, но страница листалась бы на 10
    expect(fitOver(700, 720, 660, NaN)).toBe(-12);
    expect(fitOver(700, 720, 660, 0)).toBe(-12);
  });
  it("fitNext: ужимаем ровно на нехватку; не влезает и так — прежний вид; запас — отпускаем; мелочь — не трогаем", () => {
    expect(fitNext(0, 0)).toBe(0);
    expect(fitNext(0, 0.4)).toBe(0);
    expect(fitNext(0, 23)).toBe(0.2);
    expect(fitNext(0.2, 11.5)).toBe(0.3);
    expect(fitNext(0, 116)).toBe(0);           // и при k = 1 девиз под меню — вид прежний
    expect(fitNext(0.5, 60)).toBe(0);
    expect(fitNext(0.5, -20)).toBe(+(0.5 - 17 / 115).toFixed(4));
    expect(fitNext(0.1, -40)).toBe(0);
    expect(fitNext(0.5, -5)).toBe(0.5);         // без дрожания на пару пикселей
    expect(fitNext(0, -40)).toBe(0);
    expect(fitNext(0.5, NaN)).toBe(0.5);
  });
  it("место под девизом: до низа главной при её минимальной высоте, не больше 32; сначала уходит хвост, потом поле девиза", () => {
    expect(fitTailFor(600, 650)).toBe(null);    // 50 ≥ 32 — как было
    expect(fitTailFor(630, 650)).toBe(20);
    expect(fitTailFor(630.6, 650)).toBe(19);    // с округлением вниз — страница точно не листается
    expect(fitTailFor(660, 650)).toBe(0);
    expect(fitTailFor(600, NaN)).toBe(null);
    expect(fitTailFor(600, 0)).toBe(null);
    expect(fitTail(20)).toEqual({ quoteMb: 12, tailPb: 8 });
    expect(fitTail(7)).toEqual({ quoteMb: 7, tailPb: 0 });
    expect(fitTail(0)).toEqual({ quoteMb: 0, tailPb: 0 });
    expect(fitTail(99)).toEqual({ quoteMb: 12, tailPb: 20 });
  });
  it("предохранитель: не больше 20 подгонок в секунду для размера окна; сверх — стоит, другой размер — заново", () => {
    const m = {};
    for (let i = 0; i < 20; i++) expect(fitBudget(m, 1000 + i, 440, 795)).toBe(true);
    expect(fitBudget(m, 1021, 440, 795)).toBe(false);
    expect(m.frozen).toEqual({ w: 440, h: 795 });
    expect(fitBudget(m, 5000, 440, 795)).toBe(false);        // этот размер — больше не подгоняем
    expect(fitBudget(m, 5001, 440, 760)).toBe(true);         // окно сменилось — можно
    const m2 = {};
    for (let i = 0; i < 15; i++) fitBudget(m2, 1000 + i, 440, 795);
    for (let i = 0; i < 15; i++) expect(fitBudget(m2, 2100 + i, 440, 795)).toBe(true);   // через секунду счёт заново
    const m3 = {};
    for (let i = 0; i < 15; i++) fitBudget(m3, 1000 + i, 440, 700 + i);                  // окно раскрывается — каждый размер свой счёт
    expect(m3.frozen).toBeUndefined();
  });
  it("в коде нет среза отрицательным полем (в браузере iPhone срез рос без конца — React #185)", () => {
    const src = rd("lib/home-fit.js");
    expect(src).not.toMatch(/export function fitCut/);
    expect(rd("ui/screens-roleselect.jsx")).not.toMatch(/marginBottom: -fit|data-home-cut|scrollHeight - sc\.clientHeight/);
  });
});

describe("v101: подгонка в RoleSelect", () => {
  const RS = rd("ui/screens-roleselect.jsx");
  it("размеры главной — из fitValues и fitTail; без подгонки (лёжа, две колонки) — прежние при любом состоянии", () => {
    expect(RS).toContain('import { fitValues, fitOver, fitNext, fitTailFor, fitTail, fitBudget, FIT_ABOVE, FIT_NONE } from "../lib/home-fit";');
    expect(RS).toContain("const F = fitValues(fitOn ? fit.k : 0), FT = fitTail(fitOn ? fit.tail : null);");
    expect(RS).toContain("data-home-fit={fitOn && fit.k ? fit.k.toFixed(2) : undefined} data-home-tail={fitOn && fit.tail !== null ? fit.tail : undefined}");
    expect(RS).toContain("<div ref={rootRef} style={T.screen} className=");
    for (const s of ['F.logoPadTop + "px 24px " + F.logoPadBottom + "px"', "width: short ? 118 : F.logoW, height: short ? 94 : F.logoH",
      '"2px 20px " + F.greetPb + "px"', '"0 14px " + F.stripPb + "px"', '"0 14px " + F.cardPb + "px"', '"0 14px " + F.tilesPb + "px"',
      'margin:"0 14px " + F.toolsMb + "px"', 'height:F.divH, padding:"0 20px " + F.divPb + "px"', 'padding:"0 14px " + F.titlePb + "px"',
      'margin: F.quoteMt + "px 16px " + FT.quoteMb + "px", padding: F.quotePt + "px 14px " + F.quotePb + "px"', 'padding:"0 14px " + FT.tailPb + "px"'])
      expect(RS).toContain(s);
    // лёжа логотип прежний (118×94), поля — как были
    expect(RS).toContain('padding: short ? "6px 24px 4px" : F.logoPadTop');
  });
  it("меряем только свёрнутую главную: раскрыт список треков или карточка трека — работает прокрутка, ничего не прыгает", () => {
    expect(RS).toContain('if (!root || listOpen || root.querySelector("[data-track-open]")) return;');
    expect(RS).toContain("const fitOn = !!role && !wideCols && !short;");
    expect(RS).toContain("tr.top < H * 0.6");
  });
  it("замер от подгонки не зависит: низ девиза — от верха главной (сдвиг въезда сокращается), минимальная высота — из стиля", () => {
    expect(RS).toContain("const rel = q.getBoundingClientRect().bottom - rr.top, minH = parseFloat(getComputedStyle(root).minHeight);");
    expect(RS).toContain("const over = fitOver(top0 + rel + sc.scrollTop + (window.scrollY || 0), tr.top, rel, minH);");
    expect(RS).toContain("par.getBoundingClientRect().top + (parseFloat(getComputedStyle(par).paddingTop) || 0)");
    expect(RS).toContain("else put({ k: fit.k, tail: over <= 0.5 ? fitTailFor(rel, minH) : null });");
  });
  it("каждая подгонка — через предохранитель; сработал — для этого размера окна подгонка стоит", () => {
    expect(RS).toContain("const put = (v) => { if ((v.k !== fit.k || v.tail !== fit.tail) && fitBudget(FIT_MEMO, Date.now(), W, H)) setFit(v); };");
    expect(RS).toContain("if (FIT_MEMO.frozen && FIT_MEMO.frozen.w === W && FIT_MEMO.frozen.h === H) return;");
    expect((RS.match(/setFit\(/g) || []).length).toBe(1);   // setFit зовёт только put
  });
  it("пересчёт при смене высоты главной и окна, но не пока раскрыт трек или список; возврат на главную — сразу в нужном размере", () => {
    expect(RS).toContain("ro = new ResizeObserver(bump); ro.observe(el);");
    expect(RS).toContain('window.addEventListener("resize", bump);');
    expect(RS).toContain('const bump = () => { if (fitOnRef.current && !el.querySelector("[data-track-open],[data-tracks-list]")) setFitTick((t) => t + 1); };');
    expect(RS).toContain("const [fit, setFitState] = React.useState(fitStart);");
    expect(RS).toContain("FIT_MEMO.fail = { w: W, h: H, over0 }");
  });
});
