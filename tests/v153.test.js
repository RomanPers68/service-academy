// v153 (Доп. 477): интернет — Наставнику в переписке и «вкусным описаниям» блюд. Владелец (13.11): на «Пригодился бы интернет
// только Наставнику в переписке команды… Сделать?» — «Да, давай😉 И я думаю будет полезно ассистенту, который дописывает
// варианты вкусного описания блюд, что бы было больше и разнообразнее описаний😉».
// «@Наставник …» о марке напитка, которой нет в карте, и «найди в интернете…» — /api/web-answer (chat: true), ссылки —
// последней строкой ответа (lib/ai-web.js), в переписке — именами сайтов. Редактор меню: «Пять вариантов описания» —
// пять углов за нажатие из десяти (lib/dish-desc.js), идеи из интернета (mode "desc"), без интернета — Наставник.
// Экран — tools/claude/e2e-v153.mjs.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { DESC_N, DESC_ANGLES, DESC_LABEL, descAngles, descPrompt, descParse, DESC_SYSTEM, DESC_RULES } from "../lib/dish-desc";
import { WEB_LINE, webLineText, splitWebLine, openOut, unpackWeb } from "../lib/ai-web";
import { makeServer } from "../tools/claude/demo-app/fake-server.js";

const rd = (p) => readFileSync(p, "utf8");
const memStore = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); }, clear: () => m.clear() }; };

describe("v153: варианты описания блюда (lib/dish-desc.js)", () => {
  it("десять углов, пять за нажатие; следующее нажатие — другие пять, потом по кругу", () => {
    expect([DESC_ANGLES.length, DESC_N]).toEqual([10, 5]);
    expect(descAngles(0).map((a) => a[0])).toEqual(["taste", "origin", "play", "doubt", "star"]);
    expect(descAngles(1).map((a) => a[0])).toEqual(["craft", "mood", "simple", "gourmet", "fact"]);
    expect(descAngles(2)).toEqual(descAngles(0));
    expect(descAngles(-3)).toEqual(descAngles(0));
    expect(DESC_LABEL).toMatchObject({ taste: "Вкус и текстура", origin: "Откуда блюдо", doubt: "Если гость сомневается", fact: "Интересный факт" });
  });
  it("правила: только ингредиенты из состава (аллергии), факты — только уверенные, без цен и штампов, все варианты разные", () => {
    expect(DESC_RULES).toContain("Упоминай только ингредиенты из состава блюда и то, что в пометках ресторана. Ничего не добавляй: у гостя могут быть");
    expect(DESC_RULES).toContain("Факты о происхождении, истории и технике — только те, в которых уверен.");
    expect(DESC_RULES).toContain("Без цен, скидок, граммовок и обещаний, которых нет в данных");
    expect(DESC_RULES).toContain("Уже показанные варианты не повторяй.");
    expect(DESC_SYSTEM).toContain("Это для фактов и идей — текст пиши сам, фразы с сайтов не копируй");
    expect(DESC_SYSTEM).toContain(DESC_RULES);
  });
  it("вопрос: блюдо, раздел, состав, пометки, углы нажатия, уже показанное; с интернетом — JSON, без — абзацы «1.»…", () => {
    const dish = { name: "Борщ", cat: "Супы", ingredients: "свёкла, говядина, , капуста", note: "подаём со сметаной" };
    const w = descPrompt({ restaurant: "Два моря", dish, seen: ["Старый вариант", ""], round: 1, web: true });
    expect(w).toContain("Ресторан: «Два моря».\nБлюдо: «Борщ» (раздел: Супы).\nСостав: свёкла, говядина, капуста.\nПометки ресторана: подаём со сметаной.");
    expect(w).toContain("1. craft — как готовим и подаём — только то, что следует из состава и пометок");
    expect(w).toContain("5. fact — интересный факт или маленькая история о блюде");
    expect(w).toContain("Уже показаны — не повторяй ни мысль, ни начало фразы:\n— Старый вариант");
    expect(w).toContain('Ответ — только JSON-массив без пояснений: [{"angle": "craft", "text": "…"}');
    expect(w).not.toContain("Правила:");   // с интернетом правила — в системной подсказке
    const p = descPrompt({ dish: { name: "Борщ", ingredients: [] } });
    expect(p.startsWith("Напиши «вкусные описания» блюда для гостя: их говорит официант. Правила:\n" + DESC_RULES)).toBe(true);
    expect(p).toContain("Состав: не указан.");
    expect(p).toContain("1. про вкус и текстуру: что гость почувствует");
    expect(p).toContain("Формат ответа строго: 5 абзацев по порядку углов, каждый начинается с «1.», «2.» и так далее.");
    expect(p).not.toContain("Ресторан:");
    expect(p).not.toContain("Уже показаны");
  });
  it("разбор: JSON с углами, абзацы с номерами (вступление не в счёт), без повторов и показанного, не больше пяти", () => {
    const j = descParse('```json\n[{"angle":"origin","text":"«Борщ» пришёл из домашней кухни: его варят долго и неспешно."},{"angle":"zzz","text":"Второй вариант — тоже вполне длинный и разный."},'
      + '{"text":"коротко"},"Строкой: свёкла и говядина дают глубину, а капуста — хруст."]\n```', 0, ["второй вариант тоже вполне длинный и разный"]);
    expect(j).toEqual([{ angle: "origin", label: "Откуда блюдо", text: "«Борщ» пришёл из домашней кухни: его варят долго и неспешно." },
      { angle: "doubt", label: "Если гость сомневается", text: "Строкой: свёкла и говядина дают глубину, а капуста — хруст." }]);
    const n = descParse("Вот варианты:\n1. «Сочный борщ на говяжьем бульоне, со свёклой»\n2) [[go:menu]]Простыми словами — суп со свёклой и говядиной.\n3. Тот же. Тот же. Тот же текст.\n4. Тот же. Тот же. Тот же текст.", 1, []);
    expect(n.map((v) => [v.angle, v.text])).toEqual([["craft", "Сочный борщ на говяжьем бульоне, со свёклой"], ["mood", "Простыми словами — суп со свёклой и говядиной."],
      ["simple", "Тот же. Тот же. Тот же текст."]]);
    const many = descParse(JSON.stringify(Array.from({ length: 8 }, (_, i) => ({ text: "Вариант номер " + i + " — достаточно длинный текст." }))), 0, []);
    expect(many.length).toBe(5);
    expect(descParse("Один абзац без номеров, но длинный и по делу.", 0, [])).toEqual([{ angle: "taste", label: "Вкус и текстура", text: "Один абзац без номеров, но длинный и по делу." }]);
    expect(descParse("", 0, [])).toEqual([]);
  });
});

describe("v153: /api/web-answer — описания блюда (mode desc) и вопрос из переписки (chat)", () => {
  const real = globalThis.fetch;
  let H, bodies = [], whoOk = true, reply = "[]";
  beforeAll(async () => {
    globalThis.fetch = async (url, init = {}) => {
      if (/rpc\/whoami/.test(url)) return { ok: whoOk, json: async () => (whoOk ? { ok: true, employee: { id: "u1" } } : {}) };
      const body = JSON.parse(init.body); bodies.push(body);
      return { ok: true, status: 200, json: async () => ({ model: body.model, choices: [{ message: { content: reply, annotations: [{ type: "url_citation", url_citation: { url: "https://food.example/borsch", title: "Борщ" } }] } }], usage: { server_tool_use_details: { web_search_requests: 1 } } }) };
    };
    process.env.OPENROUTER_API_KEY = "k";
    H = await import("../api/web-answer.js");
  });
  afterAll(() => { globalThis.fetch = real; delete process.env.OPENROUTER_API_KEY; });
  const call = (body) => new Promise((ok) => { const res = { code: 0, status(c) { this.code = c; return this; }, json(j) { ok({ code: this.code, j }); return this; } }; H.default({ method: "POST", body }, res); });

  it("без названия — 400; без сессии — auth; ответ — пять вариантов с подписями и ссылки", async () => {
    expect((await call({ token: "d1", mode: "desc", dish: { name: " " } })).code).toBe(400);
    whoOk = false;
    expect((await call({ token: "d1", mode: "desc", dish: { name: "Борщ" } })).j).toMatchObject({ ok: false, error: "auth" });
    whoOk = true;
    reply = JSON.stringify(descAngles(1).map(([angle], i) => ({ angle, text: "Вариант " + angle + " про борщ: достаточно длинный текст " + i })));
    bodies = [];
    const r = await call({ token: "d1", mode: "desc", restaurant: "Два моря", round: 1, seen: ["Показанный раньше вариант"], dish: { name: "Борщ", cat: "Супы", ingredients: ["свёкла"], note: "" } });
    expect(r.j.ok).toBe(true);
    expect(r.j.variants.map((v) => v.angle)).toEqual(["craft", "mood", "simple", "gourmet", "fact"]);
    expect(r.j.variants[0]).toEqual({ angle: "craft", label: "Как готовим", text: "Вариант craft про борщ: достаточно длинный текст 0" });
    expect(r.j.sources).toEqual([{ url: "https://food.example/borsch", title: "Борщ" }]);
    const b = bodies[0];
    expect(b.messages[0]).toEqual({ role: "system", content: DESC_SYSTEM });
    expect(b.messages[1].content).toBe(descPrompt({ restaurant: "Два моря", dish: { name: "Борщ", cat: "Супы", ingredients: ["свёкла"], note: "" }, seen: ["Показанный раньше вариант"], round: 1, web: true }));
    expect(b.tools[0].type).toBe("openrouter:web_search");
    expect(b.max_tool_calls).toBe(2);
  });
  it("ответ не по формату — понятная ошибка (приложение пойдёт к Наставнику без интернета); лимит описаний — свой, 60 в час", async () => {
    reply = "Не могу.";
    expect((await call({ token: "d2", mode: "desc", dish: { name: "Борщ" } })).j).toMatchObject({ ok: false, error: "server", message: "AI ответил не по формату" });
    reply = JSON.stringify([{ text: "Достаточно длинный вариант описания для проверки." }]);
    let last;
    for (let i = 0; i < 61; i++) last = await call({ token: "d3", mode: "desc", dish: { name: "Борщ" } });
    expect(last.j).toMatchObject({ ok: false, error: "rate_limit" });
    expect((await call({ token: "d3", question: "Что за вино Château Margaux?" })).j.ok).toBe(true);   // у вопросов ассистента лимит свой
  });
  it("chat: true — модель знает, что ответ увидит вся команда", () => {
    expect(H.webPrompt({ question: "Что за виски?", chat: true })).toContain("[Вопрос задан в общем чате смены, ответ увидит вся команда: коротко, 2–4 предложения, без списков.]");
    expect(H.webPrompt({ question: "Что за виски?" })).not.toContain("общем чате");
    expect(rd("api/web-answer.js")).toContain("webPrompt({ question, context: b.context, check: b.check, chat: b.chat === true })");
  });
});

describe("v153: ссылки последней строкой ответа (lib/ai-web.js)", () => {
  it("строка: до 3 адресов http(s), без повторов и длинных; нет ссылок — пусто", () => {
    expect(webLineText([{ url: "https://a.ru/x" }, "https://b.ru", { url: "https://a.ru/x" }, { url: "javascript:x" }, { url: "https://c.ru/" + "z".repeat(300) }, { url: "https://d.ru" }, { url: "https://e.ru" }]))
      .toBe(WEB_LINE + " https://a.ru/x · https://b.ru · https://d.ru");
    expect(webLineText([])).toBe("");
    expect(webLineText(null)).toBe("");
  });
  it("разбор: последняя строка — ссылками, текст — без неё; не последняя или без адресов — как есть", () => {
    expect(splitWebLine("Ответ.\n\nНашёл в интернете: https://a.ru/x · https://b.ru")).toEqual({ text: "Ответ.", src: [{ url: "https://a.ru/x" }, { url: "https://b.ru" }] });
    expect(splitWebLine("Ответ без ссылок.")).toEqual({ text: "Ответ без ссылок.", src: [] });
    expect(splitWebLine("Нашёл в интернете: https://a.ru\nи ещё строка")).toEqual({ text: "Нашёл в интернете: https://a.ru\nи ещё строка", src: [] });
    expect(splitWebLine("Ответ.\nНашёл в интернете: ничего")).toEqual({ text: "Ответ.\nНашёл в интернете: ничего", src: [] });
    expect(splitWebLine(null)).toEqual({ text: "", src: [] });
  });
  it("открыть: в Telegram — его браузером, иначе — новой вкладкой", () => {
    const seen = [];
    globalThis.window = { open: (u, t, f) => seen.push(["open", u, t, f]) };
    openOut("https://a.ru");
    globalThis.window.Telegram = { WebApp: { initData: "x", openLink: (u) => seen.push(["tg", u]) } };
    openOut("https://b.ru");
    expect(seen).toEqual([["open", "https://a.ru", "_blank", "noopener"], ["tg", "https://b.ru"]]);
    delete globalThis.window;
  });
});

describe("v153: Наставник в переписке ищет в интернете (lib/chat-ai.js)", () => {
  const real = globalThis.fetch;
  let C, calls = [], webOk = true;
  beforeAll(async () => {
    globalThis.localStorage = memStore();
    localStorage.setItem("sa_session_token", "tok");
    localStorage.setItem("sa_menu_shared", JSON.stringify({ "Два моря": [{ id: "sp-1", kind: "spirit", name: "Lagavulin 16", producer: "Lagavulin", cat: "whisky" }] }));
    globalThis.fetch = async (url, init = {}) => {
      const body = JSON.parse(init.body || "{}"); calls.push({ url: String(url), body });
      // v155: webPost читает ответ текстом (не JSON — запасной путь), поэтому у ответа есть text()
      const resp = (j) => ({ status: 200, headers: new Map(), json: async () => j, text: async () => JSON.stringify(j) });
      if (/\/api\/web-answer/.test(url)) return resp(webOk ? { ok: true, reply: "Château Margaux — первое гран крю Медока.", sources: [{ url: "https://w.example/margaux", title: "W" }], searched: 1 } : { ok: false, error: "server" });
      return resp({ ok: true, reply: "Обычный ответ Наставника." });
    };
    C = await import("../lib/chat-ai");
  });
  afterAll(() => { globalThis.fetch = real; delete globalThis.localStorage; });
  const prof = { restaurant: "Два моря" };

  it("марка не из карты — /api/web-answer (chat: true, ресторан в данных), ответ — со строкой ссылок; ai-chat не спрашивали", async () => {
    calls = [];
    const a = await C.chatAi("что за вино Château Margaux?", prof, {});
    expect(a.text).toBe("Château Margaux — первое гран крю Медока.\n\nНашёл в интернете: https://w.example/margaux");
    expect(calls.map((c) => c.url)).toEqual(["/api/web-answer"]);
    // v155: запрос упакован ({ token, z }) — читаем обратно
    const sent = await unpackWeb(calls[0].body);
    expect(sent).toMatchObject({ token: "tok", question: "что за вино Château Margaux?", chat: true });
    expect(sent.context.startsWith("Ресторан: Два моря.")).toBe(true);
    expect(splitWebLine(a.text).src).toEqual([{ url: "https://w.example/margaux" }]);
  });
  it("марка из карты и обычные вопросы — как раньше (ai-chat); интернет не ответил — тоже ai-chat", async () => {
    calls = [];
    expect((await C.chatAi("есть ли у нас виски Lagavulin 16?", prof, {})).text).toBe("Обычный ответ Наставника.");
    expect((await C.chatAi("как закрыть смену?", prof, {})).text).toBe("Обычный ответ Наставника.");
    expect(calls.every((c) => /functions\/v1\/ai-chat/.test(c.url))).toBe(true);
    webOk = false; calls = [];
    expect((await C.chatAi("найди в интернете, что такое кальвадос", prof, {})).text).toBe("Обычный ответ Наставника.");
    expect(calls.map((c) => (/web-answer/.test(c.url) ? "web" : "ai"))).toEqual(["web", "ai"]);
    webOk = true;
  });
  it("длинный ответ режется у текста, строка ссылок целая; всё — не длиннее 1990 знаков", () => {
    const t = C.withWebLine("слово ".repeat(500), [{ url: "https://a.ru/" + "p".repeat(250) }, { url: "https://b.ru" }]);
    expect(t.length).toBeLessThanOrEqual(1990);
    expect(t.endsWith("\n\nНашёл в интернете: https://a.ru/" + "p".repeat(250) + " · https://b.ru")).toBe(true);
    expect(t).toContain("слово…");
    expect(C.withWebLine("Коротко.", [])).toBe("Коротко.");
  });
});

describe("v153: демо-сервер — chat_ai_post, как этап 38", () => {
  const P = [{ id: "u-m", name: "Мария", surname: "Ким", restaurant: "R", position: "manager" }, { id: "e-a", name: "Анна", surname: "Смирнова", restaurant: "R", position: "waiter" }];
  const mk = () => makeServer({ today: "2026-11-13", clock: () => new Date("2026-11-13T15:00:00").getTime(), rest: "R", people: P, tok: { tm: "u-m", ta: "e-a" }, sstaff: [], cfg: { shifts: [], staff: [] }, plan: {}, menu: [], cheers: false });
  it("проверка, ответ, второй раз — already; чужой вопрос и без «@Наставник» — bad_request; карточки — только известных видов", () => {
    const s = mk(), team = s.teamOf("R");
    const q = s.rpc("chat_send", { p_token: "ta", p_chat: team.id, p_body: "@Наставник что за вино Château Margaux?" }).msg;
    expect(s.rpc("chat_ai_post", { p_token: "ta", p_chat: team.id, p_reply: q.id, p_body: null })).toEqual({ ok: true, check: true, left: 30 });
    expect(s.rpc("chat_ai_post", { p_token: "tm", p_chat: team.id, p_reply: q.id, p_body: null }).error).toBe("bad_request");
    const r = s.rpc("chat_ai_post", { p_token: "ta", p_chat: team.id, p_reply: q.id, p_body: "Ответ.\n\n\n\nНашёл в интернете: https://w.example/m",
      p_cards: [{ kind: "dish", id: "d1", title: "Борщ" }, { kind: "web", id: "w", title: "x" }] });
    expect([r.ok, r.msg.kind, r.msg.emp, r.msg.body, r.msg.card]).toEqual([true, "ai", "ai", "Ответ.\n\nНашёл в интернете: https://w.example/m", { t: "ai", cards: [{ kind: "dish", id: "d1", title: "Борщ" }] }]);
    expect(s.rpc("chat_ai_post", { p_token: "ta", p_chat: team.id, p_reply: q.id, p_body: "Ещё" }).error).toBe("already");
    const plain = s.rpc("chat_send", { p_token: "ta", p_chat: team.id, p_body: "просто вопрос" }).msg;
    expect(s.rpc("chat_ai_post", { p_token: "ta", p_chat: team.id, p_reply: plain.id, p_body: null }).error).toBe("bad_request");
  });
});

describe("v153: экраны", () => {
  const M = rd("ui/menu-trainer.jsx"), CC = rd("ui/chat-cards.jsx");
  it("переписка: строка «Нашёл в интернете» — именами сайтов, касание открывает страницу", () => {
    // v155: и по одной ссылке на сайт (oneSite)
    expect(CC).toContain('import { splitWebLine, siteOf, oneSite, openOut } from "../lib/ai-web";');
    expect(CC).toContain("const wl0 = splitWebLine(m.body), wl = { ...wl0, src: oneSite(wl0.src) }, sites = wl.src.map((x) => siteOf(x.url));"); 
    expect(CC).toContain('<span className="ch-tx">{wl.text}</span>');
    expect(CC).toContain("data-chat-ai-web={wl.src.length}");
    expect(CC).toContain("onClick={(e) => { e.stopPropagation(); vibrate(\"light\"); openOut(x.url); }}");
  });
  it("редактор меню: «Пять вариантов описания» — сначала с интернетом, без него — Наставник; подпись угла, «Идеи из интернета»", () => {
    // v155: тот же запрос — через webPost (запасной путь через /api/wine-import)
    expect(M).toContain('webPost({ token: saToken(), mode: "desc", restaurant, round, seen, dish }).then(w => {');
    expect(M).toContain("messages: [{ role: \"user\", content: descPrompt({ restaurant, dish, seen, round }) }]");
    expect(M).toContain('{aiBusy === "web" ? "Ищу идеи в интернете…" : aiBusy ? "Наставник пишет…" : aiVariants.length ? "Ещё пять вариантов" : "Пять вариантов описания"}');
    expect(M).toContain("{x.label ? <div data-menu-desc-angle=\"\"");
    expect(M).toContain("Идеи из интернета: {oneSite(aiWeb).map(");   // v155: по одной ссылке на сайт
    expect(M).toContain("descSeen.current = { texts: [...sr.texts, ...vars.map(v => v.text)].slice(-20), round: round + 1 };");
    expect(M).not.toContain("Три варианта описания");
  });
});

describe("v153: метка и журнал", () => {
  it("метка «сборка v153», Дополнение 477 со словами владельца, e2e-v153 в README", () => {
    const n = [...rd("ui/menu-trainer.jsx").matchAll(/· сборка v(\d+)<\/span>/g)].map((m) => Number(m[1]));
    expect(n.length).toBe(1);
    expect(n[0]).toBeGreaterThanOrEqual(153);
    const c = rd("CHANGES.md");
    expect(c).toMatch(/# Дополнение 477 — .*\(v153\)/);
    expect(c).toContain("будет полезно ассистенту, который дописывает варианты вкусного описания блюд");
    expect(rd("tools/claude/README.md")).toContain("`e2e-v153.mjs` — v153 (Доп. 477)");
  });
});
