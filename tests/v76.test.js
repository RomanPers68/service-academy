// v76 (Доп. 389): факты и тексты ИИ без примет нейросети — четвёртая версия плана владельца (v73 — шрифт и украшения,
// v74 — тексты, v75 — значки). Справочник: «карта языка» — миф, абзац о Риделе по фактам, без сгенерированного снимка
// «Английской школы». Наставник: правила стиля в подсказке и чистка ответа на экране; живой гость — действия без
// звёздочек; заготовки меню — Наставнику и гостю по тому же правилу, что в тренажёре; без восклицаний-похвал.
// Вид — tools/claude/e2e-v76.mjs.
import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { cleanReply, splitActions, stripEmoji } from "../lib/reply-clean.js";

const rd = (f) => readFileSync(f, "utf8");
// код без комментариев (как в v73–v75)
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
// стенд Deno, как в v67: функция ai-chat при загрузке вызывает Deno.serve
if (!globalThis.Deno) globalThis.Deno = { serve() {}, env: { get: () => undefined } };
const chat = await import("../supabase/functions/ai-chat/index.ts");

describe("v76: Справочник — вино по фактам", () => {
  it("глава «Бокалы»: «карта вкуса» — миф, зон языка нет; Ридель — 1958, 1973 и 1986", async () => {
    const ref = await import("../data/reference.js");
    const all = JSON.stringify(ref);
    const ch = Object.values(ref).flatMap((v) => (Array.isArray(v) ? v : v && Array.isArray(v.lessons) ? v.lessons : []))
      .find((l) => l && l.id === "win-glasses");
    expect(ch).toBeTruthy();
    const t = ch.content;
    expect(t.startsWith("Форма бокала влияет на то, как вино дышит и как раскрывается его аромат.")).toBe(true);
    expect(t).toContain("**Карта вкуса — миф**");
    expect(t).toContain("Сладкое, кислое, солёное и горькое язык чувствует всей поверхностью.");
    expect(t).toContain("из неверно пересказанного исследования 1901 года и давно опровергнута");
    expect(t).toContain("В 1958 году он отказался от тяжёлых резных фужеров и сделал тонкий гладкий бокал под бургундское, а в 1973-м выпустил первую серию бокалов под разные сорта винограда.");
    expect(t).toContain("Его сын Георг в 1986 году запустил их машинное производство");
    expect(t).toContain("(хорошая тема для разговора с гостем — повышает шанс на чаевые, проверено)");   // приписка владельца
    for (const bad of ["Кончик языка", "Ближе к гортани", "зоны языка", "Он первым доказал", "[img:wine_taste_map]", "не прихоть"]) expect([bad, all.includes(bad)]).toEqual([bad, false]);
    expect(all).toContain("📌 Хорошему вину — правильный бокал: в нём лучше раскрывается аромат.");
  });
  it("«Английская школа» — только настоящий снимок; сгенерированного и «карты языка» нет ни в карте фото, ни в файлах", async () => {
    const src = rd("data/reference.js");
    expect(src).toContain("[img:school_english_2]");
    expect(src).not.toContain("school_english_1");
    const { REFERENCE_PHOTOS } = await import("../data/reference-photos.js");
    expect(REFERENCE_PHOTOS.school_english_1).toBeUndefined();
    expect(REFERENCE_PHOTOS.wine_taste_map).toBeUndefined();
    expect(REFERENCE_PHOTOS.school_english_2).toBe("/reference/school_english_2.jpg");
    expect(existsSync("public/reference/school_english_1.jpg")).toBe(false);
    expect(existsSync("public/reference/wine_taste_map.jpg")).toBe(false);
    for (const p of Object.values(REFERENCE_PHOTOS)) expect([p, existsSync("public" + p)]).toEqual([p, true]);
  });
});

describe("v76: ответ ИИ на экране — без примет чат-бота", () => {
  it("заголовки «###» — жирной строкой, «-» и «*» — «•», цифры-эмодзи — «1.», эмодзи убраны", () => {
    const out = cleanReply("### Что делать\n1️⃣ **Извинись** перед гостем.\n2️⃣ Предложи замену 🍽️\n- Позови менеджера.\n* Не спорь.\n\n---\n✅ Главное — *спокойно*.");
    expect(out).toBe("**Что делать**\n1. **Извинись** перед гостем.\n2. Предложи замену\n• Позови менеджера.\n• Не спорь.\n\n• Главное — спокойно.");
  });
  it("похвала вопросу в начале и дежурная концовка уходят; остальное — как было", () => {
    expect(cleanReply("Отличный вопрос! 😊 Сначала пауза и вдох.\n\nНадеюсь, помог! 👍")).toBe("Сначала пауза и вдох.");
    expect(cleanReply("Хороший вопрос, Анна. Скажи гостю: «Сейчас уточню у кухни».\nЕсли остались вопросы — спрашивай!")).toBe("Скажи гостю: «Сейчас уточню у кухни».");
    expect(cleanReply("Конечно! Подойди к столу.\nОбращайся, если что.")).toBe("Подойди к столу.");
    // вопрос к гостю с «Хороший вопрос …?» — это не похвала, не трогаем
    expect(cleanReply("Хороший вопрос к шефу: «Что сегодня лучшее?»")).toBe("Хороший вопрос к шефу: «Что сегодня лучшее?»");
  });
  it("жирный, арифметика, маркеры кнопок и типографские знаки не страдают", () => {
    expect(cleanReply("**Шаг 1.** Подойди к столу.\n5 * 3 = 15, а не **16**.")).toBe("**Шаг 1.** Подойди к столу.\n5 * 3 = 15, а не **16**.");
    expect(cleanReply("Готово ✓ → дальше ★\n[[lesson:s0-2|Открыть урок]]")).toBe("Готово ✓ → дальше ★\n[[lesson:s0-2|Открыть урок]]");
    expect(cleanReply("👩‍🍳 Повар уже знает. 👍🏽")).toBe("• Повар уже знает.");
    expect(cleanReply("")).toBe("");
    expect(stripEmoji("Ок ✓ ❤️ 🔥 ✅ 3️⃣")).toBe("Ок ✓ 3.");
  });
  it("Наставник: чистка только у ответов ИИ, свой текст сотрудника — как написан", () => {
    const src = code(rd("ui/assistant.jsx"));
    expect(src).toContain('import { cleanReply } from "../lib/reply-clean";');
    expect(src).toContain('<Rich text={m.role === "assistant" ? cleanReply(clean) : clean} color={gold} />');
  });
  it("пустой экран Наставника — без «Привет, Анна!», значка в круге и «помогу с любой ситуацией»", () => {
    const src = code(rd("ui/assistant.jsx"));
    expect(src).toContain("Наставник знает уроки, Справочник и меню твоего ресторана.");
    expect(src).toContain("Спрашивай так, как спросил бы старшего в зале. Или начни с вопроса ниже.");
    expect(src).not.toContain('Привет, {profile?.name || "коллега"}!');
    expect(src).not.toContain("помогу с любой рабочей ситуацией");
    expect(src).not.toContain("UI_SVG");
    expect(src).toContain("Загляни в уроки или SOS: там тоже есть ответы.`");
  });
});

describe("v76: подсказка Наставника — правила стиля", () => {
  const anna = { name: "Анна", position: "waiter", restaurant: "Два моря, Океан" };
  it("в постоянной части: без эмодзи, «#», таблиц, похвалы вопросу, дежурной концовки и «не X, а Y»", () => {
    const { stable } = chat.buildSystemParts(anna, "");
    expect(stable).toContain("СТИЛЬ: пиши обычным текстом, как старший коллега в мессенджере. Без эмодзи, без цифр-эмодзи, без заголовков с «#» и без таблиц.");
    expect(stable).toContain("Не хвали вопрос («Отличный вопрос!») и не заканчивай дежурной фразой («Надеюсь, помог», «Если остались вопросы — обращайся»).");
    expect(stable).toContain("Без противопоставлений «не X, а Y», громких слов и афоризмов в конце.");
    expect(stable).toContain("ТЫ — НАСТАВНИК-МЕТОДИСТ. Твоя цель — развить сотрудника: дать суть, объяснить СМЫСЛ и направить учиться дальше.");
    expect(stable).not.toContain("а не справочник");
    expect(stable).not.toContain("не просто ответить, а");
    // правило стиля — сразу после тона, до карты уроков: модель читает его первым
    expect(stable.indexOf("СТИЛЬ:")).toBeGreaterThan(stable.indexOf("Тон: опытный"));
    expect(stable.indexOf("СТИЛЬ:")).toBeLessThan(stable.indexOf("КАК СТРОИТЬ ОТВЕТ:"));
  });
  it("номер функции — 76 (приложение сравнивает «не меньше 42»)", () => {
    expect(chat.AI_CHAT_V).toBe(76);
  });
});

describe("v76: живой гость — действия без звёздочек", () => {
  it("«*смотрит на часы* Простите…» → действие отдельно, эмодзи у реплики убраны", () => {
    expect(splitActions("*смотрит на часы* Простите, горячее скоро? 🙄")).toEqual([{ t: "смотрит на часы", act: true }, { t: "Простите, горячее скоро?", act: false }]);
    expect(splitActions("Здравствуйте! *оглядывается* А где тут гардероб?")).toEqual([
      { t: "Здравствуйте!", act: false }, { t: "оглядывается", act: true }, { t: "А где тут гардероб?", act: false }]);
    expect(splitActions("Без действий.")).toEqual([{ t: "Без действий.", act: false }]);
  });
  it("незакрытая звёздочка в конце — действие, которое ещё печатается", () => {
    expect(splitActions("Ну наконец-то. *вздыха")).toEqual([{ t: "Ну наконец-то.", act: false }, { t: "вздыха", act: true }]);
    expect(splitActions("")).toEqual([]);
  });
  it("в разговоре и в печатающейся реплике — GuestLine; действие серой строкой курсивом", () => {
    const src = code(rd("ui/live-guest.jsx"));
    expect(src).toContain('import { splitActions } from "../lib/reply-clean";');
    expect(src).toContain("</b><GuestLine text={m.text} /></div>");
    expect(src).toContain('<b>{guest.name}</b><span><GuestLine text={partial} /></span>');
    expect(src).toContain('? <i key={k} className="lg-act">{p.t}</i>');
    expect(src).toContain(".lg-act{display:block;font-style:italic;color:var(--sub);font-size:13.5px;line-height:1.4;margin:1px 0 2px}");
    expect(src).not.toContain("</b>{m.text}</div>");
  });
});

describe("v76: заготовки меню — Наставнику и гостю по правилу тренажёра", () => {
  const store = {};
  beforeEach(() => {
    for (const k of Object.keys(store)) delete store[k];
    globalThis.localStorage = { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = v; }, removeItem: (k) => { delete store[k]; } };
  });
  const ids = async (r) => { const { dishesOf } = await import("../lib/reference-context.js"); return dishesOf(r).map((d) => d.id); };
  it("есть меню команды — заготовок нет; нет меню — заготовки есть", async () => {
    store.sa_menu_shared = JSON.stringify({ "Марико": [{ id: "srv1", name: "Филадельфия", cat: "Роллы", ingredients: ["лосось"], allergens: ["Рыба"] }] });
    expect(await ids("Марико")).toEqual(["srv1"]);
    delete store.sa_menu_shared;
    expect(await ids("Марико")).toEqual(["mr1", "mr2", "mr3", "mr4", "mr5"]);
  });
  it("включены вручную — видны и рядом с меню команды; скрытые поштучно и свои правки не дублируются", async () => {
    store.sa_menu_shared = JSON.stringify({ "Марико": [{ id: "srv1", name: "Филадельфия" }] });
    store.sa_menu_hide_samples = JSON.stringify({ "Марико": false });
    store.sa_menu_hidden_samples = JSON.stringify({ "Марико": ["mr2"] });
    store.sa_menu_custom = JSON.stringify({ "Марико": [{ id: "mr3", name: "Мисо-суп по-нашему" }] });
    expect(await ids("Марико")).toEqual(["mr3", "srv1", "mr1", "mr4", "mr5"]);
    store.sa_menu_hide_samples = JSON.stringify({ "Марико": true });
    delete store.sa_menu_shared;
    expect(await ids("Марико")).toEqual(["mr3"]);
  });
  it("одно правило с тренажёром и поиском: dishesOf — это menuDishesFromStorage", () => {
    const src = code(rd("lib/reference-context.js"));
    expect(src).toContain('import { menuDishesFromStorage } from "./menu-dishes";');
    expect(src).toContain("export function dishesOf(restaurant) {\n  return menuDishesFromStorage(restaurant);\n}");
    expect(src).not.toContain("RESTAURANT_MENUS");
  });
});

describe("v76: без восклицаний-похвал", () => {
  it("итоги, экзамен, роли, колода, «Стол»: спокойные слова", () => {
    const has = (f, s) => code(rd(f)).includes(s);
    for (const [f, s] of [
      ["ui/ReferenceSection.jsx", '"Всё верно"'], ["ui/screens-exam.jsx", '{passed ? "Экзамен сдан" : "Почти получилось"}'],
      ["ui/menu-trainer.jsx", ">Колода пройдена</div>"], ["ui/menu-trainer.jsx", '"Меню знаешь хорошо."'],
      ["ui/screens-gamification.jsx", 'service_manager: { title:"Сервис-менеджер пройден"'], ["ui/screens-gamification.jsx", 'bar: { title:"Бар пройден"'],
      ["ui/screens-gamification.jsx", "Результат появится после первого теста"], ["ui/screens-learning.jsx", "{GAME_SVG.clock(RED, 15)}Время вышло</span>"],
      ["ui/table.jsx", 'const verdict = stars === 3 ? "Сильный раунд" : stars === 2 ? "Хороший раунд" : "Есть что повторить";'],
      ["ui/table.jsx", '(mode === "gold" ? "Мастер" : "Засчитано")'], ["ui/table.jsx", '<div className="r-thanks">Раунд пройден</div>'],
      ["ui/table.jsx", "onClick={onClose}>На смену</button>"], ["ui/table.jsx", 'const verdict = sum.activeDays >= 5 ? "Сильная неделя" :'],
      ["lib/now-card.js", 'good: { text: "Расскажи Наставнику, что сработало, и закрепим."'],
    ]) expect([f, s, has(f, s)]).toEqual([f, s, true]);
  });
  it("похвал с «!» в интерфейсе не осталось (реплики гостей, пожелания и «Спасибо!» — живая речь, их можно)", () => {
    const FILES = ["App.jsx", "ui/ReferenceSection.jsx", "ui/assistant.jsx", "ui/menu-trainer.jsx", "ui/screens-exam.jsx", "ui/screens-gamification.jsx",
      "ui/screens-learning.jsx", "ui/table.jsx", "lib/now-card.js"];
    const PRAISE = /(?:Отлично|Так держать|Мастер сервиса|Хороший результат|Тренируйся ещё|Сильная неделя|Экзамен сдан|пройден[аоы]?|Время вышло|На смену|знаешь меню|первый тест|много ответов)!/u;
    for (const f of FILES) expect([f, (code(rd(f)).match(PRAISE) || [""])[0]]).toEqual([f, ""]);
  });
});

describe("v76: метка и журнал", () => {
  it("«сборка v76», «Дополнение 389»", () => {
    expect(rd("ui/menu-trainer.jsx")).toContain("· сборка v76</span>");
    expect(rd("CHANGES.md")).toContain("# Дополнение 389 — факты Справочника и ответы ИИ без примет нейросети (v76)");
  });
});
