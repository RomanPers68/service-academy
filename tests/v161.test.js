// v161 (Доп. 486): лица рядом с сообщениями коллег в общих чатах.
//
// После v160 владельцу предложено: «Могу следующим шагом поставить лица рядом с сообщениями в общем чате — сейчас там
// только имя». Ответ: «Да».
//   • В общем чате у каждого столбика чужих сообщений — кружок автора слева у последнего пузыря (того, что с хвостиком):
//     фото, а у кого его нет — буквы. Нажатие открывает карточку коллеги, как имя над пузырём.
//   • У ответа Наставника — свой кружок в той же колонке; значок из строки имени уходит.
//   • В личных чатах и на сервере без этапа 52 лента прежняя.
//   • На узком телефоне фото в пузыре уже, чтобы не вылезало из пузыря рядом с кружком.
// Вид в браузере (обе темы, 320 px, нажатия, личный чат, сервер без этапа 52) — tools/claude/e2e-v161.mjs.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { readFileSync, readdirSync } from "node:fs";

const store0 = {};
globalThis.localStorage = { getItem: (k) => (k in store0 ? store0[k] : null), setItem: (k, v) => { store0[k] = String(v); }, removeItem: (k) => { delete store0[k]; } };
if (typeof globalThis.window === "undefined") globalThis.window = globalThis;
if (!globalThis.document) globalThis.document = { body: { appendChild() {} }, createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }) };
if (typeof globalThis.navigator === "undefined") globalThis.navigator = { userAgent: "node", onLine: true };

import { setPhotoBackend, memoryBackend } from "../lib/photo-store";
import { loadStaffPhotos, staffThumbUrl, _resetStaffPhotos } from "../lib/staff-photo";
import { feedRows, photoBox } from "../lib/chat";
import { makeServer } from "../tools/claude/demo-app/fake-server.js";

const rd = (p) => readFileSync(p, "utf8");
const h = React.createElement;
const R = (el) => renderToString(el).replace(/<!-- -->/g, "").replace(/ /g, " ").replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, "&");
const count = (s, part) => s.split(part).length - 1;
const noop = () => {};

// ── сервер в памяти (тот же, что в демо) и «телефон» ────────────────────────────────────────────────
const R0 = "Два моря, Океан";
const PEOPLE = [
  { id: "u-maria", name: "Мария", surname: "Ким", restaurant: R0, position: "manager", is_admin: false },
  { id: "e-anna", name: "Анна", surname: "Смирнова", restaurant: R0, position: "waiter", is_admin: false },
  { id: "e-ksenia", name: "Ксения", surname: "Миронова", restaurant: R0, position: "waiter", is_admin: false },
];
const TOK = { tm: "u-maria", ta: "e-anna", tk: "e-ksenia" };
const F1 = "QUJD".repeat(40), T1 = "REVG".repeat(12);
const url = (x) => "data:image/jpeg;base64," + x;
const realFetch = globalThis.fetch, realLS = globalThis.localStorage;
const phone = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); } }; };
const enter = async () => {
  globalThis.localStorage = phone(); setPhotoBackend(memoryBackend()); _resetStaffPhotos();
  const srv = makeServer({ today: "2026-11-14", rest: R0, people: PEOPLE, tok: TOK, sstaff: [], cfg: null, plan: {}, menu: [], cheers: false, staffPhotos: { "u-maria": { full: F1, thumb: T1 } } });
  globalThis.fetch = async (u, init = {}) => ({ ok: true, status: 200, json: async () => srv.rpc(String(u).split("/rpc/")[1], JSON.parse(init.body || "{}")) });
  globalThis.localStorage.setItem("sa_session_token", "ta");
  const list = await loadStaffPhotos();
  await Promise.all(list.items.map((x) => staffThumbUrl(x.id, x.ver)));
  return list;
};
const leave = () => { globalThis.fetch = realFetch; globalThis.localStorage = realLS; setPhotoBackend(null); _resetStaffPhotos(); };

describe("v161: у какого пузыря стоит кружок автора (lib/chat.js feedRows)", () => {
  const NOW = new Date("2026-11-14T19:30:00");
  const at = (min) => new Date(NOW.getTime() - min * 60000).toISOString();
  const msgs = [
    { id: 1, emp: "u-maria", name: "Мария Ким", body: "раз", at: at(30) },
    { id: 2, emp: "u-maria", name: "Мария Ким", body: "два", at: at(29) },
    { id: 3, emp: "e-ksenia", name: "Ксения Миронова", body: "три", at: at(28) },
    { id: 4, emp: "e-anna", name: "Анна Смирнова", body: "я", at: at(27) },
    { id: 5, emp: "u-maria", name: "Мария Ким", body: "четыре", at: at(26) },
    { id: 6, emp: "u-maria", name: "Мария Ким", kind: "call", body: "", at: at(25), call: { who: "all", why: "pass" } },
    { id: 7, emp: "u-maria", name: "Мария Ким", body: "пять", at: at(24) },
    { id: 8, emp: "ai", name: "Наставник", kind: "ai", body: "ответ", at: at(23) },
  ];
  const rows = feedRows(msgs, "e-anna", true, NOW).filter((r) => r.type === "msg");
  // правило ленты: кружок — у чужого пузыря, после которого этот же человек подряд не пишет
  const withAva = (list) => list.filter((r) => r.side === "in" && !r.cont).map((r) => r.m.id);
  it("кружок — у последнего пузыря столбика; имя — над первым; у своих и у карточек посередине кружка нет", () => {
    expect(rows.map((r) => r.side)).toEqual(["in", "in", "in", "out", "in", "mid", "in", "in"]);
    expect(withAva(rows)).toEqual([2, 3, 5, 7, 8]);
    expect(rows.filter((r) => r.showName).map((r) => r.m.id)).toEqual([1, 3, 5, 7, 8]);
    expect(rows.find((r) => r.m.id === 1).cont).toBe(true);                       // первый из двух — без кружка
    expect(rows.find((r) => r.m.id === 6).side).toBe("mid");                      // вызов рвёт столбик: у «четыре» свой кружок
  });
  it("человек дописал ещё — кружок переезжает к новому последнему пузырю", () => {
    const more = feedRows([...msgs.slice(0, 3)], "e-anna", true, NOW).filter((r) => r.type === "msg");
    expect(withAva(more)).toEqual([2, 3]);
    const next = feedRows([...msgs.slice(0, 3), { id: 9, emp: "e-ksenia", name: "Ксения Миронова", body: "ещё", at: at(27) }], "e-anna", true, NOW).filter((r) => r.type === "msg");
    expect(withAva(next)).toEqual([2, 9]);
  });
  it("разметка ленты держится этого правила", () => {
    const c = rd("ui/chat.jsx");
    expect(c).toContain("{ava && !out && !row.cont ? <MsgAva m={m} onWho={onWho && m.emp && m.emp !== \"ai\" ? onWho : null} /> : null}");
    expect(rd("ui/chat-cards.jsx")).toContain('{ava && !row.cont ? <span className="ch-ava team ch-mava" data-chat-ava="ai" aria-hidden="true">{IC.ai}</span> : null}');
  });
});

describe("v161: кружок автора (ui/chat.jsx MsgAva)", () => {
  let MsgAva, AiMsg;
  beforeAll(async () => { await enter(); ({ MsgAva } = await import("../ui/chat.jsx")); ({ AiMsg } = await import("../ui/chat-cards.jsx")); });
  afterAll(leave);
  it("фото есть — оно в кружке; нажатие открывает карточку коллеги; диктору кружок не читается, в обход не встаёт", () => {
    const html = R(h(MsgAva, { m: { id: 1, emp: "u-maria", name: "Мария Ким" }, onWho: noop }));
    expect(html).toMatch(/^<button type="button" class="ch-ava ch-mava" data-chat-ava="u-maria" tabindex="-1" aria-hidden="true">МК<img data-face="u-maria" src="/);
    expect(html).toContain('src="' + url(T1) + '"');
    expect(html).toContain("pointer-events:none");                               // фото касаний не ловит — нажимается сам кружок
    expect(html).not.toContain("data-face-zoom");                                // крупно — в карточке коллеги
  });
  it("фото нет — буквы; карточки коллеги на сервере нет — кружок не кнопка", () => {
    expect(R(h(MsgAva, { m: { id: 2, emp: "e-ksenia", name: "Ксения Миронова" }, onWho: noop }))).toBe('<button type="button" class="ch-ava ch-mava" data-chat-ava="e-ksenia" tabindex="-1" aria-hidden="true">КМ</button>');
    const plain = R(h(MsgAva, { m: { id: 1, emp: "u-maria", name: "Мария Ким" } }));
    expect(plain).toMatch(/^<span class="ch-ava ch-mava" data-chat-ava="u-maria" aria-hidden="true">МК<img data-face="u-maria" /);
    expect(plain).not.toContain("<button");
  });
  it("ответ Наставника: в ленте с лицами — свой кружок со значком; без лиц — как был", () => {
    const row = { m: { id: 8, emp: "ai", name: "Наставник", kind: "ai", body: "К белой рыбе подойдёт шабли.", at: "2026-11-14T19:00:00" }, side: "in", same: false, cont: false };
    const on = R(h(AiMsg, { row, me: { id: "e-anna" }, onAct: noop, onMenu: noop, ava: true }));
    expect(on).toMatch(/<span class="ch-ava team ch-mava" data-chat-ava="ai" aria-hidden="true"><svg/);
    expect(on).toContain('<div class="ch-ai-nm" aria-hidden="true"><span class="ch-ai-d">');   // значок в имени остаётся в разметке — прячет его стиль
    const off = R(h(AiMsg, { row, me: { id: "e-anna" }, onAct: noop, onMenu: noop }));
    expect(off).not.toContain("data-chat-ava");
    expect(on.replace(/<span class="ch-ava team ch-mava"[\s\S]*?<\/span>(?=<\/div>$)/, "")).toBe(off);   // больше ничего не изменилось
    expect(R(h(AiMsg, { row: { ...row, cont: true }, me: { id: "e-anna" }, onAct: noop, onMenu: noop, ava: true }))).not.toContain("data-chat-ava");
  });
});

describe("v161: лента с лицами — когда и как (ui/chat.jsx, ui/chat-cards.jsx)", () => {
  const c = rd("ui/chat.jsx"), k = rd("ui/chat-cards.jsx");
  it("лица — в общих чатах и когда сервер знает фото; личный чат и сервер без этапа 52 — лента прежняя", () => {
    expect(c).toContain("const faces = useStaffPhotos();");
    expect(c).toContain('const avaOn = group && !!faces && faces !== "missing";');
    expect(c).toContain('<div className={"ch-feed" + (avaOn ? " ava" : "")}>');
    expect(c).toContain("names={names} leadIds={leadIds} ava={avaOn} />;");
    expect(c).toContain("onMenu={(x) => setSheet({ msg: x })} ava={avaOn} />;");
    expect(c).toContain('import { FaceImg, FaceZoomHint, useStaffPhotos } from "./staff-photo";');
    // хук стоит в начале ленты, до первых выходов из функции
    const thread = c.slice(c.indexOf("function Thread("));
    expect(thread.indexOf("const faces = useStaffPhotos();")).toBeLessThan(thread.indexOf("React.useState"));
  });
  it("стили: пузыри сдвинуты на ширину кружка, кружок 30 px у нижнего края столбика, касанию — 44 px", () => {
    expect(c).toContain(".ch-feed.ava .ch-row.in{padding:0 8% 0 42px}");
    expect(c).toContain(".ch-row.in{align-items:flex-start;padding:0 12% 0 6px}");   // без лиц — как было
    expect(c).toContain(".ch-mava{position:absolute;left:4px;bottom:0;width:30px;height:30px;font-size:11.5px;");
    expect(c).toContain('button.ch-mava::before{content:"";position:absolute;inset:-7px;border-radius:50%}');   // ::after занят: в «Линзе» это внешнее кольцо кружка
    expect(rd("ui/home-look.jsx")).toContain("html.sa-lens .ch-ava::after,");
    expect(c).toContain(".ch-feed.ava .ch-typing{margin-left:42px}");
    expect(k).toContain(".ch-feed.ava .ch-ai-nm{margin-left:12px}");
    expect(k).toContain(".ch-feed.ava .ch-ai-nm .ch-ai-d{display:none}");
    // кружок описан после общего .ch-ava: его position и размер должны победить
    expect(c.indexOf(".ch-mava{")).toBeGreaterThan(c.indexOf(".ch-ava{"));
    expect(c).not.toMatch(/\.ch-mava\{[^}]*font-size:(8|8\.5|9|9\.5|10)px/);
  });
  it("кружков с фото в чате стало на один больше: кружок автора", () => {
    expect(count(c, "<FaceImg ")).toBe(8);
    expect(c).toContain("const body = <>{chatInitials(m.name)}<FaceImg who={{ id: m.emp }} /></>;");
  });
});

describe("v161: фото в пузыре на узком телефоне (photoMaxW)", () => {
  let photoMaxW; const w0 = globalThis.window.innerWidth;
  beforeAll(async () => { ({ photoMaxW } = await import("../ui/chat.jsx")); });
  afterAll(() => { globalThis.window.innerWidth = w0; });
  it("обычный экран — прежние 260 px; уже 352 px — 250, а рядом с кружком автора — 224", () => {
    for (const [vw, plain, ava] of [[390, 260, 260], [360, 260, 260], [352, 260, 260], [351, 250, 224], [320, 250, 224]]) {
      globalThis.window.innerWidth = vw;
      expect([vw, photoMaxW(false), photoMaxW(true)]).toEqual([vw, plain, ava]);
    }
    globalThis.window.innerWidth = undefined;
    expect(photoMaxW(true)).toBe(260);                                           // ширина неизвестна — как на обычном экране
  });
  it("пузырь с фото помещается в строку: 320 px — с кружком и без", () => {
    // лента 320 − 2×10; строка с кружком: слева 42, справа 8%; без кружка: слева 6, справа 12%
    const feed = 320 - 20, withAva = feed - 42 - feed * 0.08, plain = feed - 6 - feed * 0.12;
    expect(photoBox(1280, 960, 224).w + 6).toBeLessThanOrEqual(withAva);
    expect(photoBox(1280, 960, 250).w + 6).toBeLessThanOrEqual(plain);
    expect(photoBox(1280, 960, 260).w + 6).toBeGreaterThan(plain);               // прежние 260 на таком экране не помещались
    const c = rd("ui/chat.jsx");
    expect(c).toContain("const box = ph ? photoBox(m.photo.w, m.photo.h, photoMaxW(ava && !out)) : null;");
    expect(c).toContain("const box = p.photo ? photoBox(p.photo.w, p.photo.h, photoMaxW(false)) : null;");
  });
});

describe("v161: сборка, журнал, памятки", () => {
  it("«сборка v161» и новее; CHANGES — Дополнение 486; проверки названы в памятке; гид знает про лица в чате", () => {
    const vers = readdirSync("tests").map((f) => /^v(\d+)\.test\.js$/.exec(f)).filter(Boolean).map((m) => +m[1]);
    const label = +/· сборка v(\d+)/.exec(rd("ui/menu-trainer.jsx"))[1];
    expect(label).toBe(Math.max(...vers));
    expect(label).toBeGreaterThanOrEqual(161);
    const ch = rd("CHANGES.md");
    expect(ch).toMatch(/^# Дополнение 486 — [^\n]*\(v161\)$/m);
    const part = ch.slice(ch.indexOf("# Дополнение 486"));
    for (const w of ["«Да»", "общих чатах", "Наставник", "этап", "320", "tests/v161.test.js", "e2e-v161.mjs"]) expect([w, part.includes(w)]).toEqual([w, true]);
    expect(rd("tools/claude/README.md")).toContain("e2e-v161.mjs");
  });
});
