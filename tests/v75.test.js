// v75 (Доп. 388): свои значки вместо эмодзи и звёздочек ✦ — третья версия плана владельца «без примет нейросети»
// (v73 — шрифт и украшения, v74 — тексты, v75 — значки). Знаки: медаль мастера, домик своего раздела, «AI» Наставника,
// корона золота, лавровый венок легенды, конфетти праздника; эмодзи на экранах — линейными значками (ui/signs.jsx,
// lib/situation-icons.js) или убраны из текста. Вид — tools/claude/e2e-v75.mjs.
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { readFileSync, readdirSync } from "node:fs";

const rd = (f) => readFileSync(f, "utf8");
const h = React.createElement;
const R = (el) => renderToString(el).replace(/<!-- -->/g, "").replace(/ /g, " ");
// код без комментариев (как в v73 и v74)
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
// эмодзи — то, что телефон рисует картинкой, и наши «приметы» ✦ ✧ ✨ ⚠ ❄
const EM = /\p{Emoji_Presentation}|\p{Extended_Pictographic}️|[✦✧✨⚠❄]/gu;
const emojiIn = (s) => (String(s).match(EM) || []);
const FILES = ["App.jsx", "main.jsx", ...readdirSync("ui").filter((f) => /\.(jsx|js)$/.test(f)).map((f) => "ui/" + f),
  ...readdirSync("lib").filter((f) => /\.js$/.test(f)).map((f) => "lib/" + f), "data/hints.js", "data/roles.js", "data/skills.js", "data/reviews.js", "data/positions.js"];

describe("v75: эмодзи в коде остались только ключами и маркерами", () => {
  it("где эмодзи ещё есть — это ключи значков, маркеры строк урока и разбор данных; больше их не становится", () => {
    // файл → сколько эмодзи осталось после v75 (ключи MOD_SVG, маркеры ✅/❌/📌 в шпаргалках SOS и уроках,
    // карта «эмодзи → значок», правила значков своих разделов, иконки ролей и семейств в данных)
    const ALLOWED = {
      "ui/ReferenceSection.jsx": 9, "ui/candidate.jsx": 3, "ui/content-editor.jsx": 21, "ui/icons.jsx": 38, "ui/radio.jsx": 1,
      "ui/screens-dialogue.jsx": 7, "ui/screens-learning.jsx": 13, "ui/sos.jsx": 38, "ui/table.jsx": 11, "ui/widgets.jsx": 1,
      "lib/custom-modules.js": 3, "lib/mastery.js": 14, "lib/pdf.js": 2, "lib/practice-mistake.js": 1, "lib/radio.js": 1,
      "lib/reference-context.js": 1, "lib/situation-icons.js": 82, "lib/table-pick.js": 1, "lib/tracks.js": 20, "data/roles.js": 6,
    };
    const per = Object.fromEntries(FILES.map((f) => [f, emojiIn(code(rd(f))).length]).filter(([, n]) => n));
    for (const [f, n] of Object.entries(per)) expect([f, n <= (ALLOWED[f] || 0)]).toEqual([f, true]);
  });
  it("звёздочки ✦ в коде интерфейса нет; осталась только снятие ✦ со старых итогов диалога и замена для PDF", () => {
    const left = FILES.map((f) => [f, (code(rd(f)).match(/✦/g) || []).length]).filter(([, n]) => n);
    expect(left).toEqual([["ui/screens-dialogue.jsx", 1], ["lib/pdf.js", 2]]);
    expect(code(rd("ui/screens-dialogue.jsx"))).toContain('export const dlgTip = (tip) => String(tip || "").replace(/^\\s*✦\\s*/, "").trim();');
  });
  it("значка-искры «sparkle» больше нет: ни в наборе, ни в местах, где его брали", () => {
    for (const f of FILES) expect([f, code(rd(f)).includes("sparkle")]).toEqual([f, false]);
  });
  it("в данных диалогов итог без ✦, свой диалог из редактора — тоже", async () => {
    expect(rd("data/dialogues.js")).not.toContain("✦");
    const { DIALOGUES_DATA } = await import("../data/dialogues.js");
    const tips = DIALOGUES_DATA.flatMap((d) => d.steps.filter((s) => s.type === "result").map((s) => s.tip));
    expect(tips.length).toBeGreaterThanOrEqual(30);
    for (const t of tips) expect(t, t).not.toMatch(/^[✦\s]/);
    expect(rd("lib/custom-modules.js")).toContain('tip: (d.tip || "").trim() || DLG_TIP');
  });
});

describe("v75: знаки — свои значки", () => {
  it("ui/signs.jsx: каждый значок рисуется линией в 24×24, цвет — от текста или из c", async () => {
    const { Sign, SIGN_KEYS } = await import("../ui/signs");
    for (const n of ["master", "own", "crown", "laurel", "ai", "door", "lock", "heart", "heartFull", "hourglass", "phone", "cloud", "plug", "party", "garnish", "stopwatch", "candle", "target", "shaker", "ice", "flag", "chart"]) {
      expect([n, SIGN_KEYS.includes(n)]).toEqual([n, true]);
      const html = R(h(Sign, { n, s: 16 }));
      expect([n, /^<svg[^>]*viewBox="0 0 24 24"[^>]*stroke="currentColor"/.test(html)]).toEqual([n, true]);
    }
    expect(R(h(Sign, { n: "нет такого" }))).toBe("");
    expect(R(h(Sign, { n: "lock", c: "#C8A96E", title: "закрыто" }))).toMatch(/role="img" aria-label="закрыто"[^>]*color:#C8A96E/);
    // свои значки доступны и там, где значок берут по имени из UI_SVG (ачивки, «что сейчас», статистика)
    const { UI_SVG } = await import("../ui/icons");
    for (const n of ["laurel", "ai", "party", "lock", "master"]) expect([n, typeof UI_SVG[n]]).toEqual([n, "function"]);
    expect(UI_SVG.sparkle).toBeUndefined();
  });
  it("знак мастера у имени — медаль на ленте (svg), подпись — словами", async () => {
    const { MasterMark } = await import("../ui/screens-gamification");
    const html = R(h(MasterMark, { roles: ["core"] }));
    expect(html).toMatch(/^<span data-master-mark="" role="img" title="Мастер роли «Ядро»" aria-label="Мастер роли «Ядро»"[^>]*><svg[^>]*><circle cx="12" cy="9.2" r="6.3"/);
    expect(html).not.toContain("✦");
    // список «Мастера заведения» — та же медаль (FamIcon master), карточка поздравления — словами
    expect(rd("ui/mastery.jsx")).toContain('<FamIcon id="master" size={19} color={tierColor(3, a11y)} strokeWidth={1.8} />');
    expect(rd("ui/mastery-card.jsx")).toContain("Коллеги увидят знак мастера у\\u00A0твоего имени.");
  });
  it("«Путь мастера»: в значках нет четырёхлучевых звёздочек — медаль с точкой, корона с камнем, у гостя — облачко реплики", () => {
    const mc = rd("ui/mastery-card.jsx"), mi = rd("lib/master-image.js");
    expect(mc).not.toContain("star4");
    expect(mi).not.toContain("star4");
    expect(mc).toContain('masterIn: (c) => <><path d="M4.8 16.2l1.1-7.4 3.9 3.3L12 7.4l2.2 4.7 3.9-3.3 1.1 7.4z" /><path d="M5.2 19.4h13.6" /><circle cx="12" cy="3.6" r="1.35" fill={c} stroke="none" /></>,');
    expect(mc).toContain('<circle cx="9.5" cy="9.5" r="2.6" fill={c.gold} />');   // чип «Путь мастера»: точка в кольце
    expect(mi).toContain("rhomb(ctx, cx, y, 10)");
  });
  it("свои разделы ресторана — домик и номер; словами — «свой раздел 2»", async () => {
    const { TopicNo, topicNoText } = await import("../ui/signs");
    expect(R(h(TopicNo, { label: "7" }))).toBe("7");
    const two = R(h(TopicNo, { label: "own2" }));
    expect(two).toMatch(/^<span class="sa-own-no"[^>]*><svg[^>]*>[\s\S]*<\/svg>2<\/span>$/);
    expect(R(h(TopicNo, { label: "own" }))).toMatch(/<\/svg><\/span>$/);
    expect([topicNoText("own2"), topicNoText("own"), topicNoText("12")]).toEqual(["свой раздел 2", "свой раздел", "12"]);
    const sl = rd("ui/screens-learning.jsx");
    expect(sl).toContain('return customNo.n > 1 ? "own" + customNo.map[m.id] : "own";');
    expect(sl).toContain('data-n={own ? lb.slice(3) : lb} data-own={own ? "" : undefined}');
    expect(rd("ui/table-css.js")).toContain('.tbp-ind-row span[data-own]::after{content:attr(data-n)}');
    expect(rd("ui/cellar.jsx")).toContain('<TopicNo label={r.label} />');
  });
  it("правила «Раунда мастера» и «Зачёта на опыт» — значками; печать «Золото» — с короной", () => {
    const app = rd("App.jsx"), tb = rd("ui/table.jsx");
    expect(app).toContain('icons: ["stopwatch", "x", "candle", "crown"] } });');
    expect((app.match(/icons: \["pencil", "x", "check", "moon"\] \},/g) || []).length).toBe(2);
    expect(tb).toContain('{ic ? (SIGN_KEYS.includes(ic) ? <Sign n={ic} s={15} /> : ic) : ""}');
    expect(tb).toContain('<span className="r-goldseal" aria-hidden="true"><span><Sign n="crown" s={17} sw={1.9} /></span><small>ЗОЛОТО</small></span>');
    const gb = rd("ui/guestbook.jsx");
    expect(gb).toContain('<Sign n="crown" s={15} sw={1.9} />');
    expect(gb).toContain('<Sign n="laurel" s={18} sw={1.4} />');
  });
  it("праздник — конфетти без текста: кружок, полоска, квадратик", () => {
    expect(rd("App.jsx")).toContain('<span key={i} className={"c-spark k" + (i % 3)} aria-hidden="true" style={{ "--dx": dx + "px", "--dy": dy + "px", animationDelay: (i * 0.04) + "s" }} />');
    const css = rd("ui/css.js");
    expect(css).toContain(".sa-celeb .c-spark.k1 { width:4px; height:11px;");
    expect(css).not.toMatch(/\.c-spark \{[^}]*font-size/);
    expect(rd("ui/mastery-card.jsx")).toContain('<i key={i} className={"k" + (i % 3)} style={{ "--dx": x + "px", "--dy": y + "px", animationDelay: 120 + i * 45 + "ms" }} />');
  });
  it("ачивки: значок по имени из набора (мишень, секундомер, молния, шейкер, свеча, венок), без ◎ ✦ ⏱ ⚡ ●", async () => {
    const { BADGES } = await import("../lib/achievements");
    const { SIGN_KEYS } = await import("../ui/signs");
    for (const b of BADGES) { expect([b.title, SIGN_KEYS.includes(b.icon)]).toEqual([b.title, true]); expect(b.sign).toBeUndefined(); }
    expect(BADGES.filter((b) => b.icon === "laurel").map((b) => b.title)).toEqual(["Легенда зала", "Хранитель карты", "Месяц"]);
    expect(rd("App.jsx")).toContain('setNewAchievement({ icon: "rocket", label: "Первопроходец" });');
    expect(rd("App.jsx")).toContain('achieved.push({ icon:"laurel", label:"Бог сервиса", key:"god" });');
  });
});

describe("v75: живой диалог — без эмодзи", () => {
  it("реакция и настроение гостя — лица 1…5, подписи словами", async () => {
    const { dlgReaction, DLG_REACT_WORDS } = await import("../ui/screens-dialogue");
    expect([2, 1, 0, -1, -3].map((d) => dlgReaction({ moodDelta: d, correct: true }))).toEqual([5, 4, 3, 2, 1]);
    expect(DLG_REACT_WORDS).toEqual(["раздражение", "сомнение", "спокойно", "одобрение", "восторг"]);
    const src = rd("ui/screens-dialogue.jsx");
    expect(src).toContain('aria-label={"Реакция гостя: " + (DLG_REACT_WORDS[mm.react - 1] || "")}>{moodFace(mm.react, 18, a11y)}</span>');
    expect(src).not.toContain("moodEmoji");
  });
  it("у Наставника в кружке — «AI», у гостя — первая буква имени, уход — дверь", () => {
    const src = rd("ui/screens-dialogue.jsx");
    expect((src.match(/<span className="dc-coach-av" aria-hidden="true">AI<\/span>/g) || []).length).toBe(2);
    expect(src).toContain('const avatar = name.trim().charAt(0).toUpperCase() || "?";');
    expect(src).toContain('<Sign n="door" s={40}');
    expect(src).toContain('{mm.walk ? <Sign n="door" s={14}');
  });
  it("в редакторе своих разделов: значок сцены и настроение — значками; выбора эмодзи-аватара нет", () => {
    const ce = rd("ui/content-editor.jsx");
    expect(ce).not.toContain("GUEST_AVATARS");
    expect(ce).toContain('<SitIcon name={iconForEmoji(e) || "guest"} s={18} />');
    expect(ce).toContain("{moodFace(k, 19)}");
    expect(ce).toContain("падает до самого низкого");
    expect(ce).toContain("{UI_SVG.ai(gold, 17)}");
  });
});

describe("v75: тексты уроков — эмодзи значками", () => {
  it("эмодзи в начале строки: первое — по нему значок, срезаются все; строка из одних эмодзи — разделитель со значком", async () => {
    const { LEAD_EMOJI_RE, ONE_EMOJI_RE, iconForEmoji } = await import("../lib/situation-icons");
    const lead = (s) => { const m = s.match(LEAD_EMOJI_RE); return m ? [m[1], s.slice(m[0].length)] : null; };
    expect(lead("🦶 1. Встреча")).toEqual(["🦶", "1. Встреча"]);
    expect(lead("😮‍💨 **Уставший**")).toEqual(["😮‍💨", "**Уставший**"]);
    expect(lead("👣👣👣")).toEqual(["👣", ""]);
    expect(lead("Обычная строка")).toBe(null);
    expect("🛡️".match(ONE_EMOJI_RE)[0]).toBe("🛡️");
    expect(["🦶", "👣", "🛡️", "🌱", "⚠️", "💰", "🍽️", "⏱️", "🧘", "🤯"].map(iconForEmoji)).toEqual(["steps", "steps", "shield", "sprout", "alert", "bill", "dish", "clock", "smile", "worry"]);
    expect(iconForEmoji("🦄")).toBe(null);
  });
  it("экран урока рисует значки вместо эмодзи и не показывает эмодзи в тексте", async () => {
    globalThis.localStorage = globalThis.localStorage || { getItem: () => null, setItem() {}, removeItem() {} };
    const { LessonScreen } = await import("../ui/screens-learning");
    const { S } = await import("../ui/styles");
    const lesson = { id: "t-1", title: "Проба", type: "lesson", minutes: 2, content: "👣👣👣\nКаждый визит гостя — шаги.\n\n🦶 1. Встреча\n🌱 **Новичок** — первые дни\n🦄 Строка без значка\n✅ Так — хорошо" };
    const html = R(h(LessonScreen, { lesson, color: "#C8A96E", onBack() {}, onComplete() {}, quizState: { answers: [], done: false }, practiceState: { situations: [], step: 0, lives: 3, score: 0, results: [], combo: 0, choice: null, isAnswered: false, done: false }, setPracticeState() {}, T: S }));
    expect(emojiIn(html)).toEqual([]);
    expect(html).toContain('data-lesson-sticker="steps"');
    expect((html.match(/data-lesson-lead="steps"/g) || []).length).toBe(1);
    expect(html).toContain('data-lesson-lead="sprout"');
    expect(html).toContain('data-lesson-lead=""');   // эмодзи без значка — строка без него
    expect(html).toContain("1. Встреча");
  });
  it("классический вид практики: жизни, очки, комбо — значками; отклик без эмодзи", () => {
    const sl = code(rd("ui/screens-learning.jsx"));
    expect(sl).toContain("data-practice-lives={practiceState.lives}");
    expect(sl).toContain('<Sign n="heartFull" s={17} />');
    expect(sl).toContain("Комбо ×{practiceState.combo} · +20");
    expect(sl).toContain("`Минус жизнь, осталось ${practiceState.lives}`");
    expect(sl).toContain("<SitIcon name={iconForSituation(sit)} s={44} />");
    expect(sl).not.toMatch(/<Mm id="(star_eyes|thumbs_up|thumbs_down|pensive)"/);
  });
});

describe("v75: Наставник, картинки и метка", () => {
  it("ai-chat: свои разделы — «домиком с номером», без ✦ и подмигиваний в примерах", () => {
    const ai = rd("supabase/functions/ai-chat/index.ts");
    expect(ai).toContain("Свои разделы ресторана отмечены домиком с номером.");
    expect(ai).not.toContain("✦");
    expect(ai).not.toContain("😉");
    expect(ai).toContain("Без списков, нумерации, заголовков, жирного и эмодзи.");
  });
  it("картинки «поделиться»: снежинка заморозки — линиями, без символа ❄", async () => {
    expect(code(rd("lib/recap-image.js"))).not.toContain("❄");
    const { drawRecap } = await import("../lib/recap-image");
    const { monthRecap } = await import("../lib/month-recap");
    const said = [];
    const grad = { addColorStop() {} };
    const ctx = new Proxy({ font: "10px x", fillStyle: "", strokeStyle: "", lineWidth: 1, textAlign: "left" }, {
      get(t, k) { if (k in t) return t[k]; if (k === "measureText") return (s) => ({ width: String(s).length * 12 }); if (k === "createRadialGradient" || k === "createLinearGradient") return () => grad; if (k === "fillText") return (s) => said.push(String(s)); return () => {}; },
      set(t, k, v) { t[k] = v; return true; },
    });
    const act = {}; for (let d = 1; d <= 9; d++) act["2026-10-0" + d] = { st: 2 };
    drawRecap(ctx, monthRecap({ act, month: "2026-10", now: new Date(2026, 9, 12) }), { name: "Анна", surname: "Смирнова" });
    expect(said.some((s) => emojiIn(s).length)).toBe(false);
  });
  it("«сборка v75», «Дополнение 388»", () => {
    expect(rd("ui/menu-trainer.jsx")).toContain("· сборка v75</span>");
    expect(rd("CHANGES.md")).toContain("# Дополнение 388 — свои значки вместо эмодзи и звёздочек ✦ (v75)");
  });
});
