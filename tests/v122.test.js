// v122 (Доп. 435): фото бутылок в «Редакторе вин». Владелец (31.10): «И как думаешь, может в редактор добавим возможность
// загрузки фото бутылок?». Фото в форме (в хранилище через photo-upload, в записи — ссылка), «Заполнить по этикетке»
// (api/wine-import.js, mode "label"), «Импорт» → «Фото бутылок» пачкой (lib/wine.js: bottlePlan, applyBottles), миниатюры
// в строках карты и редактора, крупное фото в карточке вина. e2e — tools/claude/e2e-v122.mjs.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import * as W from "../lib/wine.js";

const rd = (f) => readFileSync(f, "utf8");
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
const dashes = (s) => (code(s).match(/[А-Яа-яЁё»)"]\s—\s[А-Яа-яЁё«]/g) || []).length;
const JPEG = "data:image/jpeg;base64," + "A".repeat(400);

describe("v122: lib/wine.js — фото бутылки", () => {
  it("imgOf: ссылка хранилища (https) и снимок JPEG до ~200 КБ; всё прочее — пусто", () => {
    const url = "https://abc.supabase.co/storage/v1/object/public/menu-photos/dva-morya/wn-1-1730000000000.jpg";
    expect(W.imgOf(url)).toBe(url);
    expect(W.imgOf(JPEG)).toBe(JPEG);
    expect(W.imgOf("http://abc.supabase.co/x.jpg")).toBe("");
    expect(W.imgOf("javascript:alert(1)")).toBe("");
    expect(W.imgOf("data:image/svg+xml;base64," + "A".repeat(400))).toBe("");
    expect(W.imgOf("data:image/jpeg;base64," + "A".repeat(300000))).toBe("");
    expect(W.imgOf('https://x.y/a.jpg" onerror="1')).toBe("");
    expect(W.imgOf(null)).toBe("");
  });
  it("normWine хранит фото, лишние поля по-прежнему отбрасывает", () => {
    const w = W.normWine({ name: "Шабли", img: JPEG, junk: 1 });
    expect(w.img).toBe(JPEG);
    expect(w).not.toHaveProperty("junk");
    expect(W.normWine({ name: "Шабли" }).img).toBe("");
  });
  const live = [W.normWine({ name: "Шабли", vintage: "2022" }, { id: "w-sha" }), W.normWine({ name: "Пино Нуар", img: "https://a.b/p.jpg" }, { id: "w-pin" }),
    W.normWine({ name: "Старое Мерло", archived: true }, { id: "w-old" })];
  it("bottlePlan: нет в карте — новое; есть без фото — фото к нему (отмечено); есть с фото — заменить (не отмечено); архив не в счёт", () => {
    expect(W.bottlePlan(W.normWine({ name: "Гави ди Гави" }), live)).toEqual({ kind: "new", keep: true, to: "" });
    expect(W.bottlePlan(W.normWine({ name: "Шабли", vintage: "2022" }), live)).toEqual({ kind: "attach", keep: true, to: "w-sha" });
    expect(W.bottlePlan(W.normWine({ name: "Пино Нуар" }), live)).toEqual({ kind: "replace", keep: false, to: "w-pin" });
    expect(W.bottlePlan(W.normWine({ name: "Старое Мерло" }), live).kind).toBe("new");
  });
  it("applyBottles: новое вино с фото; к вину из карты — фото и только пустые поля (с пометкой AI); не загрузилось — без фото", () => {
    const shared = [{ id: "d1", name: "Блюдо" }, ...live];
    const label = (raw) => W.normWine(raw, { ai: W.AI_FIELDS });
    const out = W.applyBottles(shared, [
      { w: label({ name: "Гави ди Гави", color: "white", producer: "La Scolca" }), plan: { kind: "new", keep: true, to: "" }, url: "https://a.b/g.jpg" },
      { w: label({ name: "Шабли", vintage: "2021", producer: "Domaine Laroche", color: "white" }), plan: { kind: "attach", keep: true, to: "w-sha" }, url: "https://a.b/s.jpg" },
      { w: label({ name: "Пино Нуар" }), plan: { kind: "replace", keep: true, to: "w-pin" }, url: "" },
    ]);
    const by = Object.fromEntries(W.wineRecords(out).map((w) => [w.name, w]));
    expect(out[0]).toEqual({ id: "d1", name: "Блюдо" });                     // блюда не тронуты
    expect(by["Гави ди Гави"]).toMatchObject({ img: "https://a.b/g.jpg", producer: "La Scolca", color: "white" });
    expect(by["Гави ди Гави"].ai).toEqual(expect.arrayContaining(["producer", "color"]));
    expect(by["Шабли"]).toMatchObject({ id: "w-sha", img: "https://a.b/s.jpg", vintage: "2022", producer: "Domaine Laroche" });   // год был — не тронут
    expect(by["Шабли"].ai).toEqual(expect.arrayContaining(["producer", "color"]));
    expect(by["Шабли"].ai).not.toContain("vintage");
    expect(by["Пино Нуар"].img).toBe("https://a.b/p.jpg");                  // фото не загрузилось — прежнее осталось
    expect(W.wineRecords(out)).toHaveLength(4);
    // ссылка не из хранилища — не записывается
    expect(W.wineRecords(W.applyBottles([], [{ w: label({ name: "Бароло" }), plan: { kind: "new", keep: true, to: "" }, url: "http://x/y.jpg" }]))[0].img).toBe("");
  });
});

describe("v122: api/wine-import.js — этикетка (mode label)", () => {
  const A = rd("api/wine-import.js");
  it("вход label: снимок бутылки; подсказка — читать этикетку, цены не заполнять; лимит — 200 запросов в час", () => {
    expect(A).toContain('} else if (b.mode === "label") {');
    expect(A).toContain("parts = [{ text: PROMPTS.label }, { image, mime }];");
    expect(A).toMatch(/label: `Ты — сомелье[\s\S]*Прочитай этикетку[\s\S]*Цены не заполняй/);
    expect(A).toContain('rateLimit("wine:" + b.token, 200, 3600_000)');
    expect(A.indexOf("verifySession(b.token)")).toBeLessThan(A.indexOf('b.mode === "label"'));
  });
  describe("ответ модели по этикетке", () => {
    const real = globalThis.fetch;
    let handler, reply = "";
    beforeAll(async () => {
      process.env.OPENROUTER_API_KEY = "sk-test";
      globalThis.fetch = async (url) => {
        if (/rpc\/whoami/.test(url)) return { ok: true, json: async () => ({ ok: true, employee: { id: "u1", name: "Мария" } }) };
        return { ok: true, status: 200, json: async () => ({ model: "m", choices: [{ message: { content: reply } }] }) };
      };
      handler = (await import("../api/wine-import.js")).default;
    });
    afterAll(() => { globalThis.fetch = real; delete process.env.OPENROUTER_API_KEY; });
    const call = (body) => new Promise((ok) => { const res = { code: 0, status(c) { this.code = c; return this; }, json(j) { ok({ code: this.code, j }); return this; } }; handler({ method: "POST", body }, res); });
    it("одно вино, без цен и «бокалом», даже если модель их вписала", async () => {
      reply = JSON.stringify([{ name: "Гави ди Гави, La Scolca", producer: "La Scolca", vintage: "2022", color: "white", priceBottle: 4600, priceGlass: 800, byGlass: true }, { name: "Лишнее" }]);
      const { code, j } = await call({ token: "t-l1", mode: "label", imageBase64: "AAAA", mime: "image/jpeg" });
      expect(code).toBe(200);
      expect(j.wines).toHaveLength(1);
      expect(j.wines[0]).toMatchObject({ name: "Гави ди Гави, La Scolca", vintage: "2022", color: "white", priceBottle: "", priceGlass: "", byGlass: false });
    });
    it("этикетку не прочитать — 422 с подсказкой, как снять; без снимка — 400", async () => {
      reply = '{"name": ""}';
      const r = await call({ token: "t-l2", mode: "label", imageBase64: "AAAA" });
      expect(r.code).toBe(422);
      expect(r.j.error).toMatch(/Этикетку не прочитать: сними бутылку ближе/);
      expect((await call({ token: "t-l3", mode: "label" })).code).toBe(400);
    });
  });
});

describe("v122: длинная карта в PDF (владелец: «У меня редактор pdf-ку не принял» — «Модель вернула не-JSON»)", () => {
  const A = rd("api/wine-import.js"), E = rd("ui/wine-editor.jsx");
  it("с листа и из PDF — только факты из карты (компактно), предел ответа 16 000; продолжение после последнего прочитанного", () => {
    expect(A).toMatch(/sheet: \(after\) => `[\s\S]*Бери только то, что написано в карте[\s\S]*Ноты, описания и подачу не пиши/);
    expect(A).toContain("${SHEET_SHAPE}");
    expect(A).not.toMatch(/SHEET_SHAPE = `[^`]*"story"/);
    expect(A).toContain("const max = sheet ? 16000 : 8000;");
    expect(A).toContain('parts = [{ text: PROMPTS.sheet(str(b.after, 120)) }, { pdf }];');
  });
  it("parseLoose: из оборванного ответа — целые вина (скобки и кавычки в строках не путают), обрывок — мимо", async () => {
    const { parseLoose } = await import("../api/wine-import.js");
    const t = '```json\n[{"name":"A","x":"}{"},{"name":"B \\"q\\""},{"name":"C","grapes":["x","y"]},{"name":"D","pr';
    expect(parseLoose(t).map((o) => o.name)).toEqual(["A", 'B "q"', "C"]);
    expect(parseLoose("нет вин")).toEqual([]);
  });
  describe("ответ модели обрывается", () => {
    const real = globalThis.fetch;
    let handler, reply = "", fin = "stop", sent = null;
    beforeAll(async () => {
      process.env.OPENROUTER_API_KEY = "sk-test";
      globalThis.fetch = async (url, init) => {
        if (/rpc\/whoami/.test(url)) return { ok: true, json: async () => ({ ok: true, employee: { id: "u1", name: "Мария" } }) };
        sent = JSON.parse(init.body);
        return { ok: true, status: 200, json: async () => ({ model: "m", choices: [{ finish_reason: fin, message: { content: reply } }] }) };
      };
      handler = (await import("../api/wine-import.js")).default;
    });
    afterAll(() => { globalThis.fetch = real; delete process.env.OPENROUTER_API_KEY; });
    const call = (body) => new Promise((ok) => { const res = { code: 0, status(c) { this.code = c; return this; }, json(j) { ok({ code: this.code, j }); return this; } }; handler({ method: "POST", body }, res); });
    it("предел длины: целые вина и cut — приложение попросит продолжение", async () => {
      fin = "length"; reply = '[{"name":"Шабли","priceBottle":5200},{"name":"Кьянти","color":"red"},{"name":"Бар';
      const { code, j } = await call({ token: "t-p1", mode: "pdf", pdfBase64: "JVBERi0=" });
      expect(code).toBe(200);
      expect(j.wines.map((w) => w.name)).toEqual(["Шабли", "Кьянти"]);
      expect(j.cut).toBe(true);
      expect(sent.max_tokens).toBe(16000);
    });
    it("продолжение: в подсказке — «начни с вина, которое идёт сразу после «Кьянти»»; весь ответ пришёл — cut нет", async () => {
      fin = "stop"; reply = '[{"name":"Бароло","color":"red"}]';
      const { j } = await call({ token: "t-p2", mode: "pdf", pdfBase64: "JVBERi0=", after: "Кьянти" });
      expect(j).toMatchObject({ cut: false });
      expect(sent.messages[0].content[0].text).toContain("начни с вина, которое идёт сразу после «Кьянти»");
    });
    it("не список совсем — 422 и начало ответа в ошибке", async () => {
      fin = "stop"; reply = "Извините, в этом PDF нет текста, только картинки.";
      const { code, j } = await call({ token: "t-p3", mode: "pdf", pdfBase64: "JVBERi0=" });
      expect(code).toBe(422);
      expect(j.error).toMatch(/^Модель ответила не списком: «Извините, в этом PDF нет текста/);
    });
    it("«по названию» — прежний предел 8 000 и без cut", async () => {
      fin = "stop"; reply = '{"name":"Шабли"}';
      const { j } = await call({ token: "t-p4", mode: "fill", name: "Шабли" });
      expect(sent.max_tokens).toBe(8000);
      expect(j.cut).toBe(false);
    });
  });
  it("приложение: оборванный ответ — ещё заход с after (до 8), повторы мимо; не дочитал — прочитанное можно добавить", () => {
    expect(E).toContain("const MAX_ROUNDS = 8;");
    expect(E).toContain("if (j.cut && n && round < MAX_ROUNDS) { after = String(j.wines[j.wines.length - 1].name || \"\"); return ask(); }");
    expect(E).toContain("const key = normName(wineTitle(w)); if (!w.name || seen.has(key)) continue;");
    expect(E).toContain('"Дочитать не получилось: " + err + ". Прочитанное можно добавить');
    expect(E).toContain('(found.length ? ", прочитано " + winesWord(found.length) : "")');
  });
  it("«Дополнить ноты и подачу через AI» в обзоре: пачками по 15, только у отмеченных без нот и фразы, в пустые поля", () => {
    expect(E).toContain('data-wine-enrich=""');
    expect(E).toContain("const idx = out.map((x, i) => i).filter((i) => out[i].keep && !out[i].w.short && !(out[i].w.notes || []).length);");
    expect(E).toContain('askAi({ mode: "names", names: part.map((i) => out[i].w.name) })');
    expect(E).toContain("out[i] = { ...out[i], w: mergeAi(out[i].w, got[j]) };");
  });
});

describe("v122: «Редактор вин» — фото в форме и «Фото бутылок» в импорте", () => {
  const E = rd("ui/wine-editor.jsx");
  it("фото: ужимается до 700 px, уходит в photo-upload под id вина (у нового — заранее, _nid); в записи — ссылка", () => {
    expect(E).toContain("700 / Math.max(img.width, img.height)");
    expect(E).toContain("fetch(`${SUPABASE_URL}/functions/v1/photo-upload`");
    expect(E).toContain("body: JSON.stringify({ token: saToken(), restaurant, dishId: id, image: data }) })");
    expect(E).toContain('const blank = () => ({ id: "", _nid: newId(), name: "",');
    expect(E).toContain("const rec = normWine(confirm ? confirmWine(form, who) : form, { id: form.id || form._nid });");
    expect(E).toContain(".then((url) => { setForm((x) => (x && (x.id || x._nid) === id ? { ...x, img: url } : x));");
    // пока фото грузится, «Сохранить» ждёт
    expect(E).toContain('disabled={busy || (pic && pic.state === "up")}');
    // в форме — снимок (одна фотография, без multiple), «Заполнить по этикетке», «Убрать»
    expect(E).toContain('<input ref={picRef} type="file" accept="image/*" data-wine-pic-input="" onChange={onPic}');
    expect(E).toContain('data-wine-label=""');
    expect(E).toContain('data-wine-pic-del=""');
  });
  it("этикетка: снимок до 1800 px → mode label; пустое название — с этикетки, остальное — только в пустые поля; новое вино без названия читается сразу", () => {
    expect(E).toContain('shrink(file).then((b) => askAi({ mode: "label", imageBase64: b, mime: "image/jpeg" }))');
    expect(E).toContain('setForm((x) => mergeAi(String(x.name || "").trim() ? x : { ...x, name: g.name || "" }, g))');
    expect(E).toContain('const id = form.id || form._nid, auto = !form.id && !String(form.name || "").trim();');
    expect(E).toContain("if (auto) readLabel(file);");
  });
  it("импорт «Фото бутылок»: пачка снимков, по одному запросу; что в карте — по bottlePlan; сохранение: сначала фото, потом меню", () => {
    expect(E).toContain('data-wine-imp="bottles"');
    expect(E).toContain('<input ref={bottleRef} type="file" accept="image/*" multiple data-wine-bottles-input=""');
    expect(E).toContain("const plan = bottlePlan(w, live); found.push({ w, data, plan, keep: plan.keep, dup: plan.kind !== \"new\" });");
    expect(E).toContain("try { url = await uploadPhoto(restaurant, x.plan.to || x.w.id, x.data); }");
    expect(E).toContain("persist(applyBottles(shared, entries),");
    expect(E).toContain('attach: "в карте без фото: фото и пустые поля с этикетки добавятся к нему"');
    // за раз — до 40 снимков, остальные — следующей пачкой (снимки держатся в памяти до сохранения)
    expect(E).toContain("const MAX_SHOTS = 40;");
    expect(E).toContain("const files = picked.slice(0, MAX_SHOTS), cut = picked.length - files.length;");
  });
  it("счётчик работы: у названий — пачками по 15, у страниц и бутылок — по одной («3 из 12»)", () => {
    expect(E).toContain("Math.min(imp.done + (imp.step || BATCH), imp.total)");
    expect(E).toContain('setImp({ stage: "work", label: "Читаю этикетку", done: k, total: files.length, step: 1 });');
    expect(E).not.toContain('"Читаю страницу " + (k + 1) + " из "');
  });
});

describe("v122: «Верно для всех в списке» (владелец: «Да, давай добавим»)", () => {
  const E = rd("ui/wine-editor.jsx");
  it("только в «Не проверено»; первое касание переспрашивает, второе подтверждает всё, что в списке (с поиском — найденное)", () => {
    expect(E).toContain('{only === "unchecked" && list.length ? (');
    expect(E).toContain("if (!sureAll) { setSureAll(true); vibrate(\"light\"); return; }");
    expect(E).toContain("persist(withWines(shared, list.map((w) => normWine(confirmWine(w, who)))), \"Проверено: \" + winesWord(list.length),");
    expect(E).toContain("React.useEffect(() => { setSureAll(false); }, [only, q]);");
    expect(E).toContain('"Верно для всех в списке: " + list.length');
  });
  it("подтверждение снимает пометки AI и пишет, кто и когда", () => {
    const w = W.confirmWine(W.normWine({ name: "Шабли", producer: "Laroche" }, { ai: ["producer"] }), "Мария Ким");
    expect(w.ai).toEqual([]);
    expect(w.checkedBy).toBe("Мария Ким");
    expect(w.checkedAt).toBeGreaterThan(0);
  });
});

describe("v122: «Винная карта» — миниатюры и фото в карточке", () => {
  const L = rd("ui/wine-list.jsx");
  it("строки: миниатюра слева, если фото есть хоть у одного вина (без фото — силуэт бутылки, строки ровно)", () => {
    expect(L).toContain("const withPics = all.some((w) => w.img);");
    expect(L).toContain("{withPics ? <WineThumb w={x} gold={gold} a11y={a11y} /> : null}");
    expect(L).toContain('<img src={w.img} alt="" loading="lazy" decoding="async"');
    expect(L).toContain("<BottleGlyph color={gold + \"80\"} w={14} />");
  });
  it("карточка вина: фото сверху целиком (не обрезано)", () => {
    expect(L).toContain('data-wine-photo-big=""');
    expect(L).toMatch(/alt=\{"Бутылка: " \+ wineTitle\(w\)\}[^>]*maxHeight: 300, borderRadius: 14, objectFit: "contain"/);
  });
});

describe("v122: демо — фото без хранилища, этикетки без нейросети", () => {
  const B = rd("tools/claude/demo-app/boot.js");
  it("photo-upload в демо возвращает сам снимок; ai «label» читает бутылки по очереди; у пяти вин — нарисованное фото", () => {
    expect(B).toContain("if (/\\/functions\\/v1\\/photo-upload/.test(url))");
    expect(B).toContain('if (b.mode === "label") { const [name, producer, country, region, vintage] = LABELS[labelN++ % LABELS.length];');
    expect(B.indexOf("/functions\\/v1\\/photo-upload/")).toBeLessThan(B.indexOf("if (/supabase\\.co/.test(url)"));
    expect(B).toContain('const WITH_PIC = ["Просекко DOC Extra Dry", "Пино Нуар", "Кьянти Классико", "Москато д’Асти", "Рислинг Кабинетт"];');
    expect(B).not.toMatch(/WITH_PIC = \[[^\]]*"Шабли"/);   // у «Шабли» фото нет — импорт бутылок добавит его
  });
});

describe("v122: крестик «закрыть» в линзе (владелец: «крестик не оцентрован, да и круги тоже»)", () => {
  const LOOK = rd("ui/home-look.jsx");
  const V122 = LOOK.slice(LOOK.indexOf("/* ── v122"), LOOK.lastIndexOf("`;"));
  const rules = code(V122).split("}").map((r) => r.trim()).filter(Boolean);
  const sels = rules.map((r) => r.split("{")[0].trim()).flatMap((x) => x.split(",").map((y) => y.trim()));
  it("раздел v122 — последний, после v121; всё под html.sa-lens; без подстановок ${…} (их не разобрать проверками разделов)", () => {
    expect(LOOK.indexOf("/* ── v122")).toBeGreaterThan(LOOK.indexOf("/* ── v121"));
    expect(LOOK.indexOf("/* ── v", LOOK.indexOf("/* ── v122") + 5)).toBe(-1);
    for (const x of sels) expect(x, x).toMatch(/^html\.sa-lens(\.sa-light)?[ [.]/);
    expect(V122).not.toContain("${");
  });
  it("буква «×» не видна (и у баннера книги, где у неё свой размер), крест — маской по центру, цветом надписи", () => {
    expect(V122).toContain("html.sa-lens [data-lens-x],html.sa-lens .sa-bookbanner [data-lens-x],html.sa-lens [data-nb-x]{font-size:0!important}");
    expect(V122).toContain("html.sa-lens [data-lens-x]>svg{display:none}");   // у тоста значка — свой значок: в линзе крест у всех один
    const r = rules.find((x) => x.startsWith("html.sa-lens [data-lens-x]::before,html.sa-lens [data-nb-x]::before{"));
    expect(r).toContain('content:"";position:absolute;left:50%;top:50%;width:10px;height:10px;margin:-5px 0 0 -5px;');
    expect(r).toContain("background:currentColor;");
    expect(r).toMatch(/-webkit-mask:url\("data:image\/svg\+xml,%3Csvg [^"]*M1\.2 1\.2l7\.6 7\.6M8\.8 1\.2l-7\.6 7\.6[^"]*"\) center\/10px 10px no-repeat;mask:url\(/);
  });
  it("все «закрыть»-линзы — буквой «×» или «✕» с подписью для чтения с экрана", () => {
    for (const f of ["ui/briefing.jsx", "ui/cal-sheet.jsx", "ui/guestbook-lite.jsx", "ui/mastery-card.jsx", "ui/tracks-row.jsx", "ui/wine-editor.jsx", "ui/newbie.jsx"]) {
      const src = rd(f);
      const i = src.search(/data-lens-x=""|data-nb-x=""/);
      expect(i, f).toBeGreaterThan(0);
      expect(src.slice(src.lastIndexOf("<button", i), src.indexOf("</button>", i)), f).toMatch(/aria-label="[^"]+"[\s\S]*>([×✕]|<XIcon \/>)$/);
    }
  });
});

describe("v122: тексты", () => {
  it("без тире-ритма и эмодзи в новом коде; метка — v122", () => {
    for (const f of ["ui/wine-list.jsx", "ui/wine-editor.jsx", "lib/wine.js"]) {
      expect(dashes(rd(f)), f).toBe(0);
      expect(code(rd(f)), f).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
    }
    expect(rd("ui/menu-trainer.jsx")).toContain("· сборка v122</span>");
  });
});
