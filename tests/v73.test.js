// v73 (Доп. 386): «без примет нейросети» — шрифт и украшения.
// Владелец: «в мире такая тенденция, что если это сделано нейрослопом, то априори отталкивает… мы можем сделать так, чтобы
// это не выглядело нейрослопом?» Три узнаваемые приметы сгенерированных интерфейсов: моноширинный капс вразрядку в каждой
// подписи («ЛИДЕРЫ РЕСТОРАНА», «ДО СМЕНЫ · 14:00»), звёздочки ✦ «для красоты» и косые блики с цветными полосками слева.
// Стало: подписи — тем же шрифтом с засечками, курсивом и обычными буквами (как в меню ресторана), моноширинный — только
// цифрам; декоративных ✦ нет; бликов и полосок нет. Девиз — слово в слово. Вид — tools/claude/e2e-v73.mjs.
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { readFileSync, readdirSync } from "node:fs";
import { labelStyle, LABEL_CSS, LABEL_FONT } from "../ui/tokens";
import { S, A } from "../ui/styles";

const rd = (f) => readFileSync(f, "utf8");
const h = React.createElement;
const R = (el) => renderToString(el).replace(/<!-- -->/g, "").replace(/ /g, " ");
const UI = ["App.jsx", ...readdirSync("ui").filter((f) => /\.(jsx|js)$/.test(f)).map((f) => "ui/" + f)];
// код без комментариев: звёздочки в пояснениях к коду не считаем
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");

describe("v73: подпись-метка — курсив с засечками", () => {
  it("labelStyle и LABEL_CSS: Georgia курсивом, обычными буквами, без разрядки; размер и добавки — параметрами", () => {
    expect(LABEL_FONT).toBe("Georgia, 'PT Serif', serif");
    expect(labelStyle()).toEqual({ fontFamily: LABEL_FONT, fontStyle: "italic", fontWeight: "normal", fontSize: 13, letterSpacing: 0.1, textTransform: "none" });
    expect(labelStyle(14.5, { color: "#C9A867" })).toMatchObject({ fontSize: 14.5, color: "#C9A867", fontStyle: "italic" });
    expect(LABEL_CSS).toBe("font-family:Georgia,'PT Serif',serif;font-style:italic;font-weight:normal;letter-spacing:.1px;text-transform:none");
  });
  it("общие стили: подпись раздела, бирка раздела и счётчик теста — курсивом; в светлой теме крупнее и тёмным золотом", () => {
    for (const k of ["secTitle", "modTag", "quizProgress"]) {
      expect([k, S[k].fontStyle, S[k].textTransform]).toEqual([k, "italic", "none"]);
      expect(String(S[k].fontFamily)).not.toMatch(/monospace/);
      expect(A[k].fontSize).toBeGreaterThan(S[k].fontSize);
    }
    expect(S.secTitle).toMatchObject({ fontSize: 13.5, color: "#C9A867", padding: "10px 20px 4px" });
    expect(A.secTitle).toMatchObject({ fontSize: 15, color: "#7A5A1E" });
    expect(S.a11yLabel.fontFamily).toBe("Georgia, serif");
    expect(S.a11yBtn.fontFamily).toBe("Georgia, serif");
  });
  it("моноширинный капс остался только в рисунках: подписи под бокалами справочника и детали станции «Сборки»", () => {
    const obj = /\{\{[^{}]*?(monospace|fontFamily:\s*mono\b|\.\.\.MONO\b)[^{}]*?textTransform:\s*"uppercase"[^{}]*\}\}|\{\{[^{}]*?textTransform:\s*"uppercase"[^{}]*?(monospace|fontFamily:\s*mono\b|\.\.\.MONO\b)[^{}]*\}\}/g;
    const css = /\{[^{}]*monospace[^{}]*text-transform:\s*uppercase[^{}]*\}/g;
    const left = UI.map((f) => [f, (rd(f).match(obj) || []).length + (rd(f).match(css) || []).length]).filter(([, n]) => n).sort((x, y) => (x[0] < y[0] ? -1 : 1));
    expect(left).toEqual([["ui/css.js", 3], ["ui/reference-illustrations.jsx", 5]]);
    // те три правила в css.js — детали нарисованной станции (печать на бутылке, зона, подпись бокала)
    expect([...rd("ui/css.js").matchAll(/\.(sa-bld-[a-z]+)\{font-family:ui-monospace[^}]*text-transform:uppercase/g)].map((m) => m[1])).toEqual(["sa-bld-sealtext", "sa-bld-zname", "sa-bld-glabel"]);
  });
});

describe("v73: главная и вкладки", () => {
  const home = rd("ui/screens-roleselect.jsx");
  it("главная: заведение, «пульс недели», ранг книги, «бета», «новое» и «скоро» — курсивом; ✦ нет; полосок у треков нет", () => {
    expect(home).toContain('<div style={{ ...labelStyle(a11y ? 14 : 13), color: T.modSub.color, whiteSpace:"nowrap" }}>{profile.restaurant}</div>');
    expect(home).toContain('>хорошей смены</div> : null}');
    expect(home).toContain('const MOOD_TITLE = { good: "Хорошая смена", ok:');
    expect(home).toContain('<span style={{ ...labelStyle(a11y ? 13.5 : 12.5), color: a11y ? "#7A5D2A" : "#C8A96E" }}>Пульс недели</span>');
    expect(home).toContain("{bs.rank.label}</span>");
    expect(home).toContain(">бета</span>}");
    expect(home).toContain(">новое</div>");
    expect(home).toContain(">скоро</div>");
    expect(code(home)).not.toContain("✦");
    expect(home).not.toContain("T.roleAccent");
    expect(home).not.toMatch(/fontFamily:"monospace"[^}]*textTransform:"uppercase"/);
    // разделитель над «Треками обучения» — одна линия той же высоты (19 + 10)
    expect(home).toContain('<div style={{ display:"flex", alignItems:"center", height:19, padding:"0 20px 10px" }}>');
  });
  it("девиз — «Сервис — это забота» (выбор владельца); в уроке «Что такое сервис?» фраза прежняя", () => {
    expect(home).toContain("«Сервис — это забота»");
    expect(code(home)).not.toContain("не обслуживание, а забота");   // в коде — только новый (в комментарии упомянут прежний)
    expect(rd("data/modules-seasonal.js")).toContain('"content": "Сервис — это не обслуживание, а забота.');
  });
  it("вкладки: подписи групп и карточек курсивом обычными буквами, косого блика на плитках нет", async () => {
    const hubs = rd("ui/home-hubs.jsx");
    expect(hubs).not.toContain("linear-gradient(118deg");
    expect(hubs).not.toMatch(/monospace/);
    expect(code(hubs)).not.toContain("✦");
    const { HubScreen, ShiftHero, TeamHero, TeamFeed } = await import("../ui/home-hubs");
    const hub = R(h(HubScreen, { T: S, a11y: false, title: "Смена", items: [{ key: "a", group: "На смене", icon: "schedule", label: "График", sub: "Смены", onClick() {} }] }));
    expect(hub).toMatch(/data-hub-group="На смене"[^>]*style="[^"]*font-style:italic[^"]*font-size:14\.5px[^"]*">На смене</);
    const sh = R(h(ShiftHero, { a11y: false, shift: { off: false, label: "День · 11:00–24:00" } }));
    expect(sh).toMatch(/font-style:italic[^"]*">Сегодня · [а-я]+, \d+ [а-я]+</);
    expect(R(h(ShiftHero, { a11y: false, shift: { off: true } }))).toContain(">Выходной</div>");
    expect(R(h(TeamHero, { a11y: true, leaderboard: [], profile: {} }))).toMatch(/font-style:italic[^"]*">Лидеры ресторана</);
    expect(R(h(TeamFeed, { a11y: false, items: [{ kind: "thanks", who: "Ольга", text: "— спасибо команде", at: Date.now() }] }))).toContain(">Жизнь команды</div>");
  });
  it("табличка дня: подписи под цифрами курсивом (были моноширинным капсом), у мастера — без ✦", () => {
    const dc = rd("ui/day-cards.jsx");
    expect(dc).toContain(".sa-dp-cap{display:block;${LABEL_CSS};font-size:12.5px;margin-top:3px;white-space:nowrap;line-height:1.1}");
    expect(dc).toContain(".sa-dp.lt .sa-dp-cap{font-size:13.5px}");
    expect(dc).toContain('mm.mode === "master" ? "мастер" :');
    expect(dc).toContain(">Что ещё присылать</div>");
    // пример сообщения бота — как у бота дословно; v74 (этап 29): без шапки «✦ SERVICE ACADEMY» и звёздочек
    expect(dc).not.toContain("SERVICE ACADEMY</div>");
    expect(dc).toContain(">Разминка до смены: 2 минуты, 3 задания из того, что уже прошёл. Хорошей смены!</div>");
  });
});

describe("v73: App и верхняя строка", () => {
  const app = rd("App.jsx");
  it("«SA» — шрифтом с засечками, без ✦; заставка и экран ошибки — без моноширинного капса", () => {
    expect(app).toContain('fontSize:14, letterSpacing:2.5, fontFamily:"Georgia, serif" }}>SA</span>');
    expect(app).toContain(">Загрузка…</div>");
    expect(app).toContain(">Для поддержки · сделай скриншот</div>");
    expect(app).not.toContain("✦ SA");
  });
  it("надзаголовки и подписи без ✦: «Все уроки пройдены», «Экзамен сдан», «Раунд мастера», «Мастер роли · …»", () => {
    expect(app).toContain('eyebrow: "Все уроки пройдены",');
    expect((app.match(/eyebrow: "Экзамен сдан",/g) || []).length).toBe(2);
    expect(app).toContain('intro: { title: "Раунд мастера", sub: mod.title,');
    expect(app).toContain('? "Мастер роли · " + mShown.bronze');
    // v73 оставляла две ✦ — искры праздника и знак в правилах раунда; v75 заменила их конфетти и значком короны
    expect(code(app)).not.toContain("✦");
  });
});

describe("v73: ✦ — только там, где это сам знак", () => {
  it("в коде интерфейса декоративных ✦ нет: остались знаки (мастер у имени, свой раздел, аватар наставника, печати, искры)", () => {
    const left = UI.map((f) => [f, (code(rd(f)).match(/✦/g) || []).length]).filter(([, n]) => n);
    const allowed = new Set(["App.jsx", "ui/screens-gamification.jsx", "ui/screens-learning.jsx", "ui/cellar.jsx", "ui/screens-dialogue.jsx", "ui/together.jsx",
      "ui/guestbook.jsx", "ui/table.jsx", "ui/mastery.jsx", "ui/mastery-card.jsx", "ui/day-cards.jsx", "ui/guide.jsx", "ui/css.js"]);
    expect(left.filter(([f]) => !allowed.has(f))).toEqual([]);
    const total = left.reduce((a, [, n]) => a + n, 0);
    expect(total).toBeLessThanOrEqual(40);   // было больше двухсот
  });
  it("тексты, которые раньше заканчивались звёздочкой", async () => {
    const M = await import("../lib/mastery.js");
    expect(M.masterTitle(["bar"])).toBe("Мастер роли «Бар»");
    expect(rd("ui/module-menu.jsx")).toContain('"Золото" + NB + "· ещё" + NB + "раз"');
    expect(rd("ui/module-menu.jsx")).not.toMatch(/Раунд мастера ✦|Золото ✦/);
    expect(rd("data/hints.js")).toContain("«Мастер роли» — главная награда:");
    expect(rd("data/reference.js")).toContain("выходные («Отдыхай»)");
  });
});

describe("v73: меню раздела — строки-подписи с заглавной", () => {
  it("свежесть, печать и подвал — с заглавной (капс раньше давал CSS)", async () => {
    const mm = rd("ui/module-menu.jsx");
    expect(mm).toContain('.replace(/^./, (c) => c.toUpperCase()).split(" · ");');
    expect(mm).toContain(">Раздел пройден · печать</div>");
    expect(mm).toContain('"Раздел пройден целиком" : "Пройдено " + doneN');
    const css = rd("ui/css.js");
    expect(css).toContain("html.sa-desk .tbm-eyebrow { font-size: 14px; }");
    expect(css).toContain("html.sa-desk .tbm-ck { font-size: 13.5px; }");
    expect(css).toContain("html.sa-desk .tbm-foot { font-size: 14px; }");
  });
});

describe("v73: картинки «поделиться»", () => {
  it("итоги месяца и сертификат: подписи курсивом, знак «SERVICE ACADEMY» — прописными с засечками, без ✦ по краям", () => {
    const rc = rd("lib/recap-image.js"), ms = rd("lib/master-image.js");
    expect(rc).toContain('ctx.fillText("Итоги · " + String(r.title || "").toLowerCase()');
    expect(rc).toContain('spaced(ctx, "SERVICE ACADEMY", L, H - 96, 6);');
    expect(rc).not.toMatch(/monospace/);
    expect(ms).toContain('spacedCenter(ctx, "SERVICE ACADEMY", cx, 170, 6);');
    expect(ms).not.toContain("✦ SERVICE ACADEMY ✦");
    expect(ms).not.toMatch(/ui-monospace/);
  });
});

describe("v73: логотип не пропадает при переходах", () => {
  // владелец (две записи с iPhone, 23.10): логотип на главной и во вкладках «исчезает ненадолго» при переходе
  it("файл логотипа загружается один раз и держится в памяти (blob:), экспорт — живой", () => {
    const logo = rd("assets/logo.js");
    expect(logo).toContain('export let LOGO_SRC_DARK = "/assets/logo-dark.webp";');
    expect(logo).toContain("const u = URL.createObjectURL(b), im = new Image();");
    expect(logo).toContain('im.decoding = "sync"; im.src = u; held.push(im);');
    expect(logo).toContain('if (typeof im.decode === "function") im.decode().then(ready, () => {}); else im.onload = ready;');
    expect(logo).toContain("hold(LOGO_SRC_DARK, (u) => { LOGO_SRC_DARK = u; });");
    expect(logo).toContain('if (!b || !/^image\\//.test(b.type || "")) return;');   // не картинка (ошибка, страница) — прежний адрес
  });
  it("все пять картинок логотипа раскодируются сразу (decoding=sync): главная, вкладки, загрузка, вход, сертификаты", () => {
    const n = UI.reduce((a, f) => a + (rd(f).match(/<img src=\{LOGO_SRC_DARK[^>]*decoding="sync"/g) || []).length, 0);
    expect(n).toBe(5);
    const all = UI.reduce((a, f) => a + (rd(f).match(/<img src=\{LOGO_SRC_DARK/g) || []).length, 0);
    expect(all).toBe(5);
  });
});

describe("v73: метка и журнал", () => {
  it("«сборка v73», «Дополнение 386»", () => {
    expect(rd("ui/menu-trainer.jsx")).toMatch(/· сборка v(7[3-9]|[89]\d)<\/span>/);   // v74: метка идёт дальше
    expect(rd("CHANGES.md")).toContain("# Дополнение 386 — без примет нейросети: подписи курсивом, без ✦, бликов и полосок (v73)");
  });
});
