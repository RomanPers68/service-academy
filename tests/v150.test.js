// v150 (Доп. 474): визуал без кардинальных изменений. Владелец (13.11): «По поводу визуала… Что мы можем улучшить, из того
// что уже есть, не меняя кардинально…?» — и на список из семи правок: «Да, делай, пожалуйста 🙏».
// 1) у заголовков «Смена» и «Команда» — значок вкладки в линзе, у «Я» — инициалы, как в «Аккаунте» (был логотип 44×36, не
// читался); 2) плитки модуля («Я это умею», «Освежить», «Раунд мастера») и «Погреб тем» — шрифтом текста, с засечками (были
// системным); 3) список «•» в уроках и «О нас» — перенесённая строка под текстом, а не под точкой; 4) неразрывные пробелы:
// тире не начинает строку, «3 см» не разрывается (lib/typo.js, как в советах); 5) на странице трека одна лупа — в верхней
// панели; 6) «Для чтения»: «Выйти с этого устройства» — тёмно-красный, зелёные числа «Меню» — тёмно-зелёные; 7) пустые
// печати «Книги отзывов» в тёмной — тонкое золотое кольцо. Экран — tools/claude/e2e-v150.mjs.
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { readFileSync } from "node:fs";
import { typo } from "../lib/typo";
import { S, A } from "../ui/styles";
import { TABLE_CSS } from "../ui/table-css";
import { RED_DARK, GREEN_DARK } from "../ui/tokens";
import { CORE_MODULES } from "../data/modules-core";
import { SEASONAL_MODULES } from "../data/modules-seasonal";
import { BAR_MODULES } from "../data/modules-bar";
import { MANAGER_MODULES } from "../data/modules-manager";
import { SERVICE_MANAGER_MODULES } from "../data/modules-service_manager";
import { SPG_MODULES } from "../data/modules-spg";

const store = {};
globalThis.localStorage = globalThis.localStorage || { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
if (typeof globalThis.window === "undefined") globalThis.window = globalThis;
if (!globalThis.document) globalThis.document = { body: { appendChild() {} }, createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }) };
if (typeof globalThis.navigator === "undefined") globalThis.navigator = { userAgent: "node", onLine: true };

const rd = (p) => readFileSync(p, "utf8");
const h = React.createElement;
const R = (el) => renderToString(el).replace(/<!-- -->/g, "");
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
const NB = " ";
// WCAG: контраст двух цветов #rrggbb
const lum = (hex) => { const v = hex.replace("#", "").match(/../g).map((x) => parseInt(x, 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const LIGHT_BG = "#E0D1BC";   // «Для чтения»: самый тёмный фон у кнопок «Аккаунта» на снимке 390 px (в остальных местах светлее)
const MENU_BG = "#EBE2CE";    // «Для чтения»: фон строки «Блюд в базе…» в «Меню» на снимке (самое тёмное место строки)

describe("v150: неразрывные пробелы (lib/typo.js)", () => {
  it("короткие слова и числа не остаются в конце строки, цепочки склеиваются", () => {
    expect(typo("и в зале")).toBe(`и${NB}в${NB}зале`);
    expect(typo("Подойдите к столу")).toBe(`Подойдите к${NB}столу`);
    expect(typo("без каблука выше 3 см")).toBe(`без каблука выше 3${NB}см`);
    expect(typo("0,5 л воды")).toBe(`0,5${NB}л${NB}воды`);
    expect(typo("налей 250 мл")).toBe(`налей 250${NB}мл`);
    expect(typo("(в зале)")).toBe(`(в${NB}зале)`);
    expect(typo("«А где?»")).toBe(`«А${NB}где?»`);
  });
  it("тире не начинает строку: перед ним неразрывный пробел, и в конце, и в начале куска текста", () => {
    expect(typo("больше тебя — временно")).toBe(`больше тебя${NB}— временно`);
    expect(typo("Ликёры —")).toBe(`Ликёры${NB}—`);
    expect(typo(" — сладкие настойки")).toBe(`${NB}— сладкие настойки`);
    expect(typo("с 10 – 12 лет")).toBe(`с${NB}10${NB}– 12${NB}лет`);
  });
  it("кусок текста перед **жирным** или термином: «в » — с неразрывным пробелом в конце", () => {
    expect(typo("в ")).toBe(`в${NB}`);
    expect(typo("Работай ")).toBe("Работай ");
  });
  it("начало строки не трогает: «• », «1. », «**…**», «— » в начале; латиница и длинные слова — как были", () => {
    expect(typo("• В зале").startsWith("• ")).toBe(true);
    expect(typo("1. Подойти к столу").startsWith("1. Подойти")).toBe(true);
    expect(typo("**Важно**: в зале")).toBe(`**Важно**: в${NB}зале`);
    expect(typo("— Здравствуйте!")).toBe("— Здравствуйте!");
    expect(typo("OK go now")).toBe("OK go now");
    expect(typo("Приветствие гостя")).toBe("Приветствие гостя");
  });
  it("повторно — то же; не строка — как есть", () => {
    for (const s of ["и в зале — тоже", "без каблука выше 3 см", "в ", "Ликёры —"]) expect(typo(typo(s))).toBe(typo(s));
    expect(typo(null)).toBe(null);
    expect(typo(undefined)).toBe(undefined);
    expect(typo("")).toBe("");
    expect(typo(5)).toBe(5);
  });
  it("в текстах уроков меняются только пробелы: буквы, знаки и порядок — те же", () => {
    let n = 0;
    for (const mods of [CORE_MODULES, SEASONAL_MODULES, BAR_MODULES, MANAGER_MODULES, SERVICE_MANAGER_MODULES, SPG_MODULES]) for (const m of mods) for (const l of m.lessons || []) {
      for (const s of [l.title, l.content].filter((x) => typeof x === "string")) {
        for (const ln of s.split("\n")) {
          const t = typo(ln);
          expect(t.replace(/[\s ]+/g, " ")).toBe(ln.replace(/[\s ]+/g, " "));
          n++;
        }
      }
    }
    expect(n).toBeGreaterThan(5000);
  });
});

describe("v150: уроки и «О нас» — неразрывные пробелы при выводе, список с висячей строкой", () => {
  const L = rd("ui/screens-learning.jsx");
  it("урок: typo — уже при выводе кусков; строка с терминами ищется по исходному тексту (подсветка не теряется)", () => {
    expect(L).toContain('import { typo } from "../lib/typo";');
    expect(L).toMatch(/const lineData = processedLines\.find\(l =>\s*l\.parts\.map\(p => p\.text\)\.join\(""\) === text\s*\);/);
    expect(L).toContain("if (!lineData) return <span>{typo(text)}</span>;");
    expect(L).toContain("if (part.isPlain) return <span key={idx}>{typo(part.text)}</span>;");
    expect((code(L).match(/\{typo\(part\.text\)\}/g) || []).length).toBe(2);
    expect(L).toContain("<span key={k} style={{ color: hi }}>{typo(part.slice(2, -2))}</span>");
  });
  it("«О нас»: BlockText — неразрывные пробелы и висячая строка у «•»", async () => {
    const { BlockText } = await import("../ui/concept");
    const html = R(h(BlockText, { T: S, text: "**Внешний вид**\n• Обувь закрытая, без каблука выше 3 см\nМы — команда, и в зале тоже\n«А где наш столик?»" }));
    expect(html).toContain(`выше 3${NB}см`);
    expect(html).toContain(`Мы${NB}— команда, и${NB}в${NB}зале тоже`);
    expect(html).toContain(`«А${NB}где наш столик?»`);
    expect(html).toMatch(/padding-left:calc\(2px \+ 0\.6em\);text-indent:-0\.6em[^"]*">• Обувь/);
    expect(html).toContain(">Внешний вид</div>");
  });
  it("стиль «•»: отступ слева = сдвиг первой строки (висячая точка), в «Для чтения» — тот же", () => {
    expect(S.bullet.paddingLeft).toBe("calc(2px + 0.6em)");
    expect(S.bullet.textIndent).toBe("-0.6em");
    expect(A.bullet.paddingLeft).toBe(S.bullet.paddingLeft);
    expect(A.bullet.textIndent).toBe(S.bullet.textIndent);
    expect(A.bullet.fontSize).toBe(18);
  });
});

describe("v150: заголовки «Смена», «Команда», «Я»", () => {
  const T = { modCard: {}, modSub: { color: "#9C8760" }, modTitle: { color: "#EFE4C8" }, screen: {}, lessHead: {}, lessHeadTitle: {}, backBtn2: {}, para: {} };
  it("«Смена» и «Команда» — значок вкладки (как в панели) в линзе 44 px, без логотипа", async () => {
    const { HubScreen } = await import("../ui/home-hubs");
    const { NAV_ICONS } = await import("../ui/icons");
    for (const [hubId, icon] of [["shift", "daily"], ["team", "team"]]) {
      const html = R(h(HubScreen, { T, a11y: false, title: "Смена", items: [], hubId }));
      expect(html).toMatch(new RegExp(`data-hub-mark="${hubId}" data-lens="disc" aria-hidden="true" style="width:44px;height:44px;box-sizing:border-box;border-radius:50%`));
      expect(html).not.toContain("<img");
      expect(html).toContain(renderToString(NAV_ICONS[icon]("#C8A96E")).slice(0, 60));
    }
  });
  it("«Я» — инициалы в такой же линзе, золотом (у владельца — золотая корона); без имени — прежний логотип", async () => {
    // владелец (13.11) про золотой круг с белыми инициалами: «Может иконку сотрудника тоже линзой сделаем?»
    const { HubScreen } = await import("../ui/home-hubs");
    const lens = 'data-lens="disc" aria-hidden="true" style="width:44px;height:44px;box-sizing:border-box;border-radius:50%;flex-shrink:0;display:grid;place-items:center;';
    const me = R(h(HubScreen, { T, a11y: false, title: "Анна", items: [], hubId: "me", avatar: { initials: "АС", admin: false } }));
    expect(me).toContain('data-hub-mark="avatar" ' + lens + 'background:rgba(200,169,110,0.13);border:1px solid #D2A85A55">'
      + '<span style="color:#D2A85A;font-size:16px;font-weight:bold;font-family:Georgia, serif;letter-spacing:0.5px;line-height:1">АС</span></span>');
    expect(me).not.toContain('data-lens="avatar"');
    expect(me).not.toContain("#C8A96E 0%, #7A5D2A 100%");
    expect(me).not.toContain("<img");
    const light = R(h(HubScreen, { T, a11y: true, title: "Анна", items: [], hubId: "me", avatar: { initials: "АС", admin: false } }));
    expect(light).toContain('background:rgba(139,106,48,0.10);border:1px solid #7A5D2A55"><span style="color:#7A5D2A;');
    const own = R(h(HubScreen, { T, a11y: false, title: "Роман", items: [], hubId: "me", avatar: { initials: "РП", admin: true } }));
    expect(own).toMatch(/data-hub-mark="avatar" data-lens="disc"[^>]*><svg/);
    const crown = own.slice(own.indexOf('data-hub-mark="avatar"'), own.indexOf("</svg>", own.indexOf('data-hub-mark="avatar"')));
    expect(crown).toContain("#D2A85A");
    expect(crown).not.toContain("#fff");
    expect(own).not.toContain(">РП<");
    for (const avatar of [null, { initials: "", admin: false }]) {
      const none = R(h(HubScreen, { T, a11y: false, title: "Я", items: [], hubId: "me", avatar }));
      expect(none).not.toContain("data-hub-mark");
      expect(none).toContain("<img");
    }
    const other = R(h(HubScreen, { T, a11y: false, title: "Прочее", items: [] }));
    expect(other).toContain("<img");
  });
  it("«Аккаунт» и карточка сотрудника у руководителя — тоже линза, инициалы и корона золотом", () => {
    const src = rd("ui/screens-team.jsx");
    expect(src).toContain('const avatarInk = (a11y) => (a11y ? "#7A5D2A" : "#D2A85A");');
    expect(src).toContain('background: a11y ? "rgba(139,106,48,0.10)" : "rgba(200,169,110,0.13)", border:`1px solid ${avatarInk(a11y)}55` });');
    expect(src).toContain('<div data-lens="disc" data-account-avatar="" style={avatarLens(a11y, 54)}>');
    expect(src).toContain('{profile?.is_admin ? UI_SVG.crown(avatarInk(a11y), 24) :');
    expect(src).toContain('<div data-lens="disc" style={avatarLens(a11y, 50)}>');
    expect(src).toContain('{selected.is_admin ? UI_SVG.crown(avatarInk(a11y), 22) :');
    expect(src).not.toContain('data-lens="avatar"');
    expect(src).not.toContain('UI_SVG.crown("#fff"');
    const acc = src.slice(src.indexOf("data-account-avatar"), src.indexOf("</div>", src.indexOf("data-account-avatar")));
    expect(acc).not.toContain("linear-gradient");
    expect(acc).not.toContain('color:"#fff"');
    // «Сотрудник недели» — медаль с короной, не значок сотрудника: прежнее золото
    expect(rd("ui/screens-gamification.jsx")).toContain('<div data-lens="avatar" style={{ width:46, height:46, borderRadius:"50%"');
  });
  it("App: у «Я» — инициалы из имени и фамилии и признак владельца", () => {
    const app = rd("App.jsx");
    expect(app).toContain('avatar={{ initials: (((profile.name || "")[0] || "") + ((profile.surname || "")[0] || "")).toUpperCase(), admin: !!profile.is_admin }}');
    expect(app).toMatch(/hubId="me"/);
  });
});

describe("v150: плитки модуля и «Погреб тем» — шрифтом текста", () => {
  const rule = (sel) => { const i = TABLE_CSS.indexOf(sel + "{"); return i < 0 ? "" : TABLE_CSS.slice(i, TABLE_CSS.indexOf("}", i)); };
  it(".tbm-act — var(--font-body) (Georgia), «Погреб тем» — 600 14px var(--font-body), подсказка темы — курсив с засечками", () => {
    expect(rule(".tbm-act")).toContain("font-family:var(--font-body)");
    expect(rule(".tbm-act")).not.toContain("system-ui");
    expect(rule(".tbm-cellar")).toContain("font:600 14px/1.2 var(--font-body)");
    expect(rule(".tbp-peek span")).toContain("font:italic 12.5px/1.3 Georgia,'Times New Roman',serif");
    expect(TABLE_CSS).toContain("--font-body:Georgia,'Times New Roman',serif");
    expect(TABLE_CSS).not.toMatch(/\.tbm-(act|cellar)\{[^}]*system-ui/);
  });
});

describe("v150: одна лупа на странице трека", () => {
  it("App не передаёт HomeScreen onSearch — остаётся лупа верхней панели", () => {
    const app = rd("App.jsx");
    const call = app.slice(app.indexOf("<HomeScreen role="), app.indexOf("/>", app.indexOf("<HomeScreen role=")));
    expect(call.length).toBeGreaterThan(200);
    expect(call).not.toContain("onSearch");
    expect(app).toContain("data-top-search");
    // сама кнопка у HomeScreen осталась (для чужих вызовов), но без onSearch не рисуется
    expect(rd("ui/screens-learning.jsx")).toContain('{onSearch && <button style={{ ...T.changeRoleBtn, display:"inline-flex"');
  });
});

describe("v150: «Для чтения» — контраст красного и зелёного", () => {
  it("«Выйти с этого устройства» и «Выйти» в подтверждении — RED_DARK на светлом, в тёмной — как было", () => {
    const src = rd("ui/screens-team.jsx");
    const out = src.slice(src.indexOf('data-lens-btn="danger" onClick={() => setConfirmOut(true)}'), src.indexOf("Выйти с этого устройства"));
    expect(out).toContain("color: a11y ? RED_DARK : RED");
    expect(out).toContain('border: a11y ? "1px solid rgba(139,48,32,0.42)" : "1px solid rgba(224,120,120,0.45)"');
    expect(src).toContain('background: a11y ? RED_DARK : RED, color:"#fff"');
    expect(RED_DARK).toBe("#8B3020");
    expect(contrast(RED_DARK, LIGHT_BG)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(RED_DARK, "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
  });
  it("«Меню»: числа «с сервера команды» и «Пищевая ценность» — тёмно-зелёные на светлом", () => {
    const src = rd("ui/menu-trainer.jsx");
    expect(src).toContain('const greenInk = a11y ? "#2A6B45" : green;');
    expect(src).toContain("· с сервера команды: <b style={{ color: greenInk }}>{shared.length}</b>");
    expect(src).toContain("Пищевая ценность: <b style={{ color: miss.length ? gold : greenInk }}>{have}</b>");
    expect(GREEN_DARK).toBe("#2A6B45");
    expect(contrast("#2A6B45", MENU_BG)).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#5DBB8A", MENU_BG)).toBeLessThan(3);   // было
  });
});

describe("v150: печати «Книги отзывов»", () => {
  it("пустая печать в тёмной — тонкое золотое кольцо, размер 13 px (border-box); в светлой — как было", () => {
    const src = rd("ui/screens-roleselect.jsx");
    const slot = src.slice(src.indexOf("const EmptySealSlot = ({ a11y }) => ("), src.indexOf(");", src.indexOf("const EmptySealSlot = ({ a11y }) => (")));
    expect(slot).toContain('data-seal-empty=""');
    expect(slot).toContain("width: 13, height: 13");
    expect(slot).toContain('boxSizing: "border-box"');
    expect(slot).toContain('border: a11y ? "none" : "1px solid rgba(200,169,110,0.42)"');
    expect(slot).toContain('background: a11y ? "rgba(120,90,40,0.18)" : "rgba(0,0,0,0.28)"');
  });
});

describe("v150: метка и журнал", () => {
  it("метка «сборка v150», Дополнение 474 со словами владельца, e2e-v150 в README", () => {
    const n = [...rd("ui/menu-trainer.jsx").matchAll(/· сборка v(\d+)<\/span>/g)].map((m) => Number(m[1]));
    expect(n.length).toBe(1);
    expect(n[0]).toBeGreaterThanOrEqual(150);
    const c = rd("CHANGES.md");
    expect(c).toMatch(/# Дополнение 474 — .*\(v150\)/);
    expect(c).toContain("Что мы можем улучшить, из того что уже есть, не меняя кардинально");
    expect(c).toContain("Да, делай, пожалуйста");
    expect(rd("tools/claude/README.md")).toContain("`e2e-v150.mjs` — v150 (Доп. 474)");
  });
});
