// v55 (Доп. 368): быстро и твёрдо — старт без ожидания сервера, экраны не «болтаются», силуэты вместо «Загрузка…».
//
// Владелец — на предложения «как сделать, чтобы было приятно заходить»: «Давай все😉 И да, пройди и собери
// неудобства». По кнопке AI: «пусть останется как есть, просто сделай отступ». Вид в браузере — tools/claude/e2e-v55.mjs,
// замер старта — tools/claude/perf-v55b.mjs.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const rd = (f) => readFileSync(f, "utf8");

describe("v55: быстрый старт — профиль с телефона сразу, whoami фоном", () => {
  const app = rd("App.jsx");
  it("профиль на телефоне есть — открываемся без ожидания сервера, сверка — после показа", () => {
    expect(app).toContain("if (cached && typeof cached === \"object\" && cached.id && cached.name) {");
    expect(app).toContain("verify = { token, cached };");
    expect(app).toContain("if (verify) verifyLater(verify.token, verify.cached);   // v55: сервер подтверждает вход уже после показа");
    // сверка идёт сразу после setStorageLoaded(true) — экран уже показан
    expect(app).toContain("clearTimeout(fallback);\n      setStorageLoaded(true);\n      if (verify) verifyLater(verify.token, verify.cached);");
  });
  it("первый вход на телефоне (профиля нет) — ждём сервер, как раньше", () => {
    const start = app.indexOf("// Первый вход на этом телефоне (профиля ещё нет) — ждём сервер, как раньше");
    expect(start).toBeGreaterThan(0);
    expect(app.slice(start, start + 400)).toContain("try { res = await rpc(\"whoami\", { p_token: token }); } catch(e) { res = null; }");
  });
  it("сверка: сессия отозвана — на вход; поменялись ресторан/должность — сразу; имя — перечитать начисто (без петли)", () => {
    const v = app.slice(app.indexOf("const verifyLater = (token, cached) => {"), app.indexOf("(async () => {", app.indexOf("const verifyLater")));
    expect(v).toContain("if (fresh === JSON.stringify(cached)) return;");
    expect(v).toContain("try { localStorage.setItem(\"sa_profile\", fresh); saved = localStorage.getItem(\"sa_profile\") === fresh; } catch(e) {}");
    expect(v).toContain("if (saved && (prof.name !== cached.name || (prof.surname || \"\") !== (cached.surname || \"\"))) { try { window.location.reload(); } catch(e) {} return; }");
    expect(v).toContain("setProfile(prof);");
    expect(v).toContain("} else if (res && res.ok === false) {");
    expect(v).toContain("try { localStorage.removeItem(\"sa_session_token\"); } catch(e) {}");
    expect(v).toContain("setProfile(null); setScreen(\"login\");");
    expect(v).toContain("}).catch(() => {});");   // нет сети — профиль телефона, как было в офлайне
  });
  it("index.html: соединение с Supabase открывается заранее — до скрипта Telegram", () => {
    const html = rd("index.html");
    const pc = html.indexOf("<link rel=\"preconnect\" href=\"https://gvxhgdynjuaisswplroh.supabase.co\" crossorigin>");
    expect(pc).toBeGreaterThan(0);
    expect(html).toContain("<link rel=\"dns-prefetch\" href=\"https://gvxhgdynjuaisswplroh.supabase.co\">");
    expect(pc).toBeLessThan(html.indexOf("telegram-web-app.js"));
    expect(rd("api/supabase.js")).toContain("|| \"https://gvxhgdynjuaisswplroh.supabase.co\";");
  });
});

describe("v55: экраны стоят на месте", () => {
  const app = rd("App.jsx"), css = rd("ui/css.js"), st = rd("ui/styles.js");
  it("экран — видимая высота минус верхняя строка, отступ под вкладки и запас под кнопку AI", () => {
    expect(st).toContain("screen: { display:\"flex\", flexDirection:\"column\", minHeight:\"calc(100vh - var(--sa-st, 0px) - var(--sa-top, 0px) - var(--sa-padb, 0px) - var(--sa-fab, 0px))\", background:\"transparent\", overflowX:\"hidden\" },");
  });
  it("App меряет верхнюю строку «✦ SA» в --sa-top (нет строки — 0) и ставит sa-fabon / sa-navon", () => {
    expect(app).toContain("<div style={T.a11yBar} ref={saBarRef} data-sa-topbar=\"\">");   // v71: метка строки — для полноэкранного Telegram
    // v71: в полноэкранном Telegram строка стоит в строке его кнопок (position: fixed) — места у экрана не занимает, --sa-top = 0
    expect(app).toContain("h = el && getComputedStyle(el).position !== \"fixed\" ? Math.round(el.getBoundingClientRect().height) : 0;");
    expect(app).toContain("root.style.setProperty(\"--sa-top\", h + \"px\");");
    expect(app).toContain("}, [barOn, a11y]);");
    expect(app).toContain("root.classList.toggle(\"sa-fabon\", fabOn);");
    expect(app).toContain("root.classList.toggle(\"sa-navon\", tabsOn);");
    expect(app).toContain("const tabsOn = navOn && !vp.wide;");
    expect(app).toContain("{fabOn && (");
  });
  it("обёртки экранов — класс sa-tabpad вместо paddingBottom: 88 в разметке", () => {
    expect(app).not.toMatch(/<div style=\{\{ *paddingBottom: *88 *\}\}>/);
    expect(app).not.toContain("<div style={{paddingBottom: vp.wide ? 24 : 88}}>");
    expect((app.match(/<div className="sa-tabpad">/g) || []).length).toBe(20);
    expect(app).toContain("<div className={vp.wide ? \"sa-tabpad sa-tabpad-w\" : \"sa-tabpad\"}>");
  });
  it("css: поля браузера 0; отступ под вкладки — только где они есть; запас под кнопку AI", () => {
    const start = css.indexOf("/* ═══ v55 (Доп. 368)"), block = css.slice(start, css.indexOf("`;", start));
    expect(start).toBeGreaterThan(0);
    expect(block).toContain("body { margin: 0; }");
    expect(block).toContain(".sa-tabpad { padding-bottom: 88px; --sa-padb: 88px; }");
    expect(block).toContain("html:not(.sa-wide):not(.sa-navon) .sa-tabpad { padding-bottom: 24px; --sa-padb: 24px; }");
    expect(block).toContain(".sa-tabpad.sa-tabpad-w { padding-bottom: 24px; --sa-padb: 24px; }");
    expect(block).toContain("html.sa-fabon { --sa-fab: calc(104px + env(safe-area-inset-bottom, 0px)); }");
    expect(block).toContain("html.sa-fabon .sa-col { padding-bottom: var(--sa-fab); box-sizing: border-box; }");
  });
  it("кнопка AI — на прежнем месте и прежнего размера (владелец: «пусть останется как есть»)", () => {
    expect(app).toContain("style={{ position: \"fixed\", right: 14, bottom: \"calc(122px + env(safe-area-inset-bottom, 0px))\", zIndex: 350 }}>");
    expect(app).toContain("width: 58, height: 58, borderRadius: 29, cursor: \"pointer\",");
  });
  it("заголовок экрана — без пустой полосы сверху (14 px вместо 44)", () => {
    expect(st).toContain("lessHead: { display:\"flex\", alignItems:\"center\", gap:10, padding:\"14px 18px 14px\",");
    expect(st).not.toContain("padding:\"44px 18px 14px\"");
  });
});

describe("v55: силуэты вместо «Загрузка…»", () => {
  const sk = rd("ui/skeleton.jsx");
  it("SkelLines и SkelCards: мерцание .sa-skel, для диктора — «Загружаю…»", () => {
    expect(sk).toContain("export function SkelLines({ a11y, widths = [\"68%\", \"42%\"], h = 11, gap = 7, style, label = \"Загружаю…\" }) {");
    expect(sk).toContain("export function SkelCards({ a11y, rows = 3, h = 62, gap = 10, radius = 16, style, label = \"Загружаю…\" }) {");
    expect(sk).toContain("<div role=\"status\" aria-live=\"polite\" data-skel=\"cards\"");
    expect(sk).toContain("className=\"sa-skel\" aria-hidden=\"true\"");
  });
  it("в экранах не осталось надписей «Загрузка…» / «Загружаю…» вместо содержимого", () => {
    for (const f of ["ui/content-editor.jsx", "ui/together.jsx", "ui/screens-admin.jsx", "ui/screens-team.jsx", "ui/menu-trainer.jsx", "ui/screens-gamification.jsx"]) {
      const s = rd(f);
      expect(s, f).not.toMatch(/>Загрузка(…|\.\.\.)<|>Загружаю…<|note\("Загружаю…"\)|"Загружаю…"\}|>Загружаем команду\.\.\.</);
      expect(s, f).toMatch(/import \{ Skel(Cards|Lines)(, SkelLines)? \} from "\.\/skeleton";/);
    }
    expect(rd("ui/screens-team.jsx")).toContain("{list === null && <SkelCards a11y={!!T.a11y} rows={4} h={64} label=\"Загружаем команду…\"");
    expect(rd("ui/screens-gamification.jsx")).toContain("{!records && !recErr ? <SkelLines a11y={!!T.a11y} widths={[\"58%\"]} h={10} style={{ marginTop:6 }} />");
  });
});

describe("v55: метка и журнал", () => {
  it("метка сборки — v55; CHANGES — «Дополнение 368»", () => {
    expect(rd("ui/menu-trainer.jsx")).toMatch(/· сборка v\d{2}<\/span>/);   // v56 — следующая метка
    expect(rd("CHANGES.md")).toContain("# Дополнение 368 — быстро и твёрдо: старт без ожидания сервера, экраны стоят на месте (v55)");
  });
});
