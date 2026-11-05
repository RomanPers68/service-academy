// v137 (Доп. 450): уведомления на телефон (Web Push), как у «Плати по миру». Владелец (04.11): «можно ли это реализовать в
// приложении?» — на семь предложений «Да, берём все». Функция push-send (шифрование RFC 8291 по примеру из стандарта,
// подпись VAPID без почты), сервис-воркер (показ, число на иконке, касание — нужный экран), lib/push.js (где можно
// включить, ключ, подписка), lib/push-text.js (текст бота → уведомление, как этап 48), ссылки ?go=… (goLinkOk в App.jsx),
// демо-сервер, окно «Напоминания», «Я», «Сервер», этап 48 (SQL — tools/claude/sql/test48.sh), e2e — tools/claude/e2e-v137.mjs.
// Доп. 451 (05.11, «Давай как обычно, все»): текст как в мессенджере, одно уведомление на переписку, касание — сразу ответ,
// кнопки под уведомлением (Android), просто текст в Telegram — в переписку, подпись VAPID из запаса.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import React from "react";
import { renderToString } from "react-dom/server";
import { encryptPush, vapidAuth, vapidJwt, vapidCache, JWT_REUSE, newKeys, vapidSub, payloadOf, topicOf, sendOne, handle, b64uEnc, b64uDec } from "../supabase/functions/push-send/index.ts";
import { pushTextOf, pushCut, pushGoOf, pushActsOf, pushNew, pushCap } from "../lib/push-text.js";
import { pushEnv, pushCan, pushEnvNote, iosVersion, urlB64ToBytes, bytesToUrlB64, fetchPushKey, remindSub, pushRowSub, pushError, CHANNELS } from "../lib/push.js";
import { STAGES, pushReport, pushErrText } from "../lib/server-check.js";
import { makeServer } from "../tools/claude/demo-app/fake-server.js";
import { PushBlock, ChannelPick } from "../ui/push-block.jsx";

const rd = (f) => readFileSync(f, "utf8");
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
const dashes = (s) => (code(s).match(/[А-Яа-яЁё»)"]\s—\s[А-Яа-яЁё«]/g) || []).length;
const te = new TextEncoder(), td = new TextDecoder();

// RFC 8291, приложение A
const RFC = {
  plain: "V2hlbiBJIGdyb3cgdXAsIEkgd2FudCB0byBiZSBhIHdhdGVybWVsb24",
  asPriv: "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw",
  asPub: "BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8",
  uaPub: "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
  auth: "BTBZMqHH6r4Tts7J_aSIgg",
  salt: "DGv6ra1nlYgDCS1FRnbzlw",
  header: "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8",
  ct: "8pfeW0KbunFT06SuDKoJH9Ql87S1QUrdirN6GcG7sFz1y1sqLgVi1VhjVkHsUoEsbI_0LpXMuGvnzQ",
};
const hk = async (salt, ikm, info, n) => new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info },
  await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]), n * 8));
// телефон: расшифровать тело уведомления своим ключом (как браузер)
async function decrypt(msg, phone, phonePub, auth) {
  const salt = msg.slice(0, 16), idlen = msg[20], asPub = msg.slice(21, 21 + idlen), ct = msg.slice(21 + idlen);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: await crypto.subtle.importKey("raw", asPub, { name: "ECDH", namedCurve: "P-256" }, false, []) }, phone, 256));
  const ikm = await hk(auth, ecdh, new Uint8Array([...te.encode("WebPush: info"), 0, ...phonePub, ...asPub]), 32);
  const cek = await hk(salt, ikm, new Uint8Array([...te.encode("Content-Encoding: aes128gcm"), 0]), 16);
  const nonce = await hk(salt, ikm, new Uint8Array([...te.encode("Content-Encoding: nonce"), 0]), 12);
  const pt = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce }, await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["decrypt"]), ct));
  return { rs: new DataView(msg.buffer, msg.byteOffset + 16, 4).getUint32(0), last: pt[pt.length - 1], text: td.decode(pt.slice(0, -1)) };
}
async function phoneKeys() {
  const kp = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const pub = new Uint8Array(await crypto.subtle.exportKey("raw", kp.publicKey));
  const auth = crypto.getRandomValues(new Uint8Array(16));
  return { priv: kp.privateKey, pub, auth, p256dh: b64uEnc(pub), authS: b64uEnc(auth) };
}

describe("v137: функция push-send — шифрование и подпись", () => {
  it("RFC 8291, приложение A: тот же заголовок и шифротекст байт в байт", async () => {
    const out = await encryptPush(RFC.uaPub, RFC.auth, b64uDec(RFC.plain), { asPriv: RFC.asPriv, asPub: RFC.asPub, salt: RFC.salt });
    expect(b64uEnc(out)).toBe(b64uEnc(new Uint8Array([...b64uDec(RFC.header), ...b64uDec(RFC.ct)])));
    expect(out.length).toBe(144);
  });
  it("новые ключи на каждое уведомление: телефон расшифровывает своим ключом (запись 4096, разделитель 0x02)", async () => {
    const ph = await phoneKeys();
    const body = payloadOf({ t: "Анна С. пишет тебе", b: "Можно поменяться сменой?", go: "chat_5_10", badge: 3 });
    const a = await encryptPush(ph.p256dh, ph.authS, body), b = await encryptPush(ph.p256dh, ph.authS, body);
    expect(b64uEnc(a)).not.toBe(b64uEnc(b));
    const d = await decrypt(a, ph.priv, ph.pub, ph.auth);
    expect(d).toEqual({ rs: 4096, last: 2, text: '{"t":"Анна С. пишет тебе","b":"Можно поменяться сменой?","go":"chat_5_10","badge":3}' });
  });
  it("испорченные ключи телефона — bad_keys; большой текст — too_big", async () => {
    await expect(encryptPush("abc", RFC.auth, "x")).rejects.toThrow("bad_keys");
    await expect(encryptPush(RFC.uaPub, "AAAA", "x")).rejects.toThrow("bad_keys");
    await expect(encryptPush(RFC.uaPub, RFC.auth, "я".repeat(2000))).rejects.toThrow("too_big");
  });
  it("ключи VAPID: открытый — 87 знаков (65 байт, 0x04), закрытый — 43; подпись ES256 проверяется открытым ключом", async () => {
    const k = await newKeys();
    expect(k.pub).toMatch(/^[A-Za-z0-9_-]{87}$/); expect(k.priv).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(b64uDec(k.pub)[0]).toBe(4);
    const a = await vapidAuth("https://web.push.apple.com/QGuQyavXutnMH", k.pub, k.priv, "https://app.example", Date.parse("2026-11-05T10:00:00Z"));
    const m = a.match(/^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/);
    expect(m).not.toBe(null);
    expect(JSON.parse(td.decode(b64uDec(m[1])))).toEqual({ typ: "JWT", alg: "ES256" });
    expect(JSON.parse(td.decode(b64uDec(m[2])))).toEqual({ aud: "https://web.push.apple.com", exp: Date.parse("2026-11-05T10:00:00Z") / 1000 + 12 * 3600, sub: "https://app.example" });
    expect(m[4]).toBe(k.pub);
    const P = b64uDec(k.pub);
    const vk = await crypto.subtle.importKey("jwk", { kty: "EC", crv: "P-256", x: b64uEnc(P.slice(1, 33)), y: b64uEnc(P.slice(33, 65)) }, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
    expect(b64uDec(m[3]).length).toBe(64);
    expect(await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, vk, b64uDec(m[3]), te.encode(m[1] + "." + m[2]))).toBe(true);
  });
  it("отправитель в подписи — https-адрес приложения, иначе адрес Supabase; почты не бывает", () => {
    expect(vapidSub("https://service-academy.vercel.app/", "https://x.supabase.co")).toBe("https://service-academy.vercel.app");
    expect(vapidSub("mailto:owner@example.com", "https://gvx.supabase.co")).toBe("https://gvx.supabase.co");
    expect(vapidSub("", "https://gvx.supabase.co/")).toBe("https://gvx.supabase.co");
    const src = rd("supabase/functions/push-send/index.ts");
    expect(src).not.toMatch(/mailto:/);
    expect(rd("supabase/supabase-stage48-push.sql")).not.toMatch(/mailto:/);
  });
  it("что получает телефон: заголовок, текст, экран — только допустимый, число на иконке — целое", () => {
    expect(JSON.parse(payloadOf({ t: "Т", b: "Б", go: "chat_1_2", badge: 4 }))).toEqual({ t: "Т", b: "Б", go: "chat_1_2", badge: 4 });
    expect(JSON.parse(payloadOf({ t: "", b: null, go: "javascript:alert(1)", badge: -1 }))).toEqual({ t: "Service Academy", b: "" });
    expect(JSON.parse(payloadOf({ t: "x".repeat(300), b: "y".repeat(500), badge: 1.5 })).t.length).toBe(120);
  });
  it("Доп. 451: переписка (c) и кнопки — только с ключом и адресом; не больше двух, надпись до 24 знаков; Topic — c<чат>", () => {
    const K = "a".repeat(64), U = "https://gvx.supabase.co/functions/v1/push-send?act=1";
    const A = [{ a: "reply", t: "Ответить" }, { a: "read", t: "Прочитано" }, { a: "cg", t: "Иду" }];
    expect(JSON.parse(payloadOf({ t: "Вся команда · 2 новых", b: "Пётр О.: ок", go: "chat_1_5_r", badge: 2, c: 1, a: A, k: K }, U)))
      .toEqual({ t: "Вся команда · 2 новых", b: "Пётр О.: ок", go: "chat_1_5_r", badge: 2, c: 1, a: A.slice(0, 2), k: K, u: U });
    expect(JSON.parse(payloadOf({ t: "Т", a: A, k: K }))).toEqual({ t: "Т", b: "" });                         // без адреса — без кнопок
    expect(JSON.parse(payloadOf({ t: "Т", a: A, k: "short" }, U))).toEqual({ t: "Т", b: "" });               // без ключа — тоже
    expect(JSON.parse(payloadOf({ t: "Т", a: [{ a: "rm", t: "x" }, { a: "cl", t: "Принято и ещё очень длинная надпись" }], k: K, c: -1 }, U)))
      .toEqual({ t: "Т", b: "", a: [{ a: "cl", t: "Принято и ещё очень длин" }], k: K, u: U });
    expect(topicOf({ c: 12 })).toBe("c12"); expect(topicOf({ c: 0 })).toBe(undefined); expect(topicOf({})).toBe(undefined);
  });
  it("Доп. 451: подпись VAPID — одна на службу и 6 часов из запаса (Apple: не чаще раза в час); другой ключ или старше — новая", async () => {
    const keys = await newKeys(), now = Date.UTC(2026, 10, 5, 10, 0, 0), sec = Math.floor(now / 1000);
    const old = await vapidJwt("https://web.push.apple.com", keys.pub, keys.priv, "https://app.example", now - 3600e3);
    const cache = { "https://web.push.apple.com": { t: old, at: sec - 3600, k: keys.pub } };
    const vc = vapidCache(keys, "https://app.example", cache, now);
    expect(await vc.get("https://web.push.apple.com/abc")).toBe("vapid t=" + old + ", k=" + keys.pub);
    expect(vc.changed()).toBe(false);
    const [a, b] = await Promise.all([vc.get("https://fcm.googleapis.com/fcm/send/1"), vc.get("https://fcm.googleapis.com/fcm/send/2")]);
    expect(a).toBe(b); expect(vc.changed()).toBe(true);                                                        // параллельно — одна подпись
    expect(cache["https://fcm.googleapis.com"]).toMatchObject({ at: sec, k: keys.pub });
    const claims = JSON.parse(new TextDecoder().decode(b64uDec(cache["https://fcm.googleapis.com"].t.split(".")[1])));
    expect(claims).toEqual({ aud: "https://fcm.googleapis.com", exp: sec + 12 * 3600, sub: "https://app.example" });
    expect(JWT_REUSE).toBe(6 * 3600);
    const stale = vapidCache(keys, "https://app.example", { "https://web.push.apple.com": { t: old, at: sec - JWT_REUSE, k: keys.pub } }, now);
    expect(await stale.get("https://web.push.apple.com/x")).not.toContain(old);
    const other = vapidCache(keys, "https://app.example", { "https://web.push.apple.com": { t: old, at: sec, k: "ДРУГОЙ" } }, now);
    expect(await other.get("https://web.push.apple.com/x")).not.toContain(old);
  });
});

describe("v137: функция push-send — отправка", () => {
  const SUB = (over = {}) => ({ id: 7, emp: "e1", endpoint: "https://web.push.apple.com/abc", p256dh: RFC.uaPub, auth: RFC.auth, ...over });
  const K = async () => newKeys();
  it("201 — доставлено; 410 и 404 — подписки нет; 403 — причина из ответа; испорченные ключи — подписки нет", async () => {
    const keys = await K();
    const calls = [];
    const f = (st, body = "") => async (url, init) => { calls.push({ url, init }); return new Response(body, { status: st }); };
    expect(await sendOne(SUB(), "{}", keys, "https://app.example", f(201))).toEqual({ id: 7, ok: true, code: 201 });
    const h = calls[0].init.headers;
    expect(h.TTL).toBe("86400"); expect(h["Content-Encoding"]).toBe("aes128gcm"); expect(h.Urgency).toBe("high");
    expect(h.Authorization).toMatch(/^vapid t=[^.]+\.[^.]+\.[^,]+, k=[A-Za-z0-9_-]{87}$/);
    expect(calls[0].init.body.length).toBeGreaterThan(86);
    expect(await sendOne(SUB(), "{}", keys, "https://app.example", f(410))).toEqual({ id: 7, gone: true, code: 410 });
    expect(await sendOne(SUB(), "{}", keys, "https://app.example", f(404))).toEqual({ id: 7, gone: true, code: 404 });
    expect(await sendOne(SUB(), "{}", keys, "https://app.example", f(403, '{"reason":"BadJwtToken"}'))).toEqual({ id: 7, ok: false, code: 403, err: "BadJwtToken" });
    expect(await sendOne(SUB({ p256dh: "abc" }), "{}", keys, "https://app.example", f(201))).toEqual({ id: 7, gone: true, err: "bad_keys" });
    expect(await sendOne(SUB(), "{}", keys, "https://app.example", async () => { throw new Error("timeout"); })).toEqual({ id: 7, ok: false, err: "timeout" });
    expect(h.Topic).toBe(undefined);
    calls.length = 0;
    await sendOne(SUB(), "{}", keys, "https://app.example", f(201), { auth: async (ep) => "vapid t=ИЗ_ЗАПАСА:" + new URL(ep).origin + ", k=1", topic: "c12" });
    expect(calls[0].init.headers.Authorization).toBe("vapid t=ИЗ_ЗАПАСА:https://web.push.apple.com, k=1");
    expect(calls[0].init.headers.Topic).toBe("c12");
    await sendOne(SUB(), "{}", keys, "https://app.example", f(201), { topic: "плохо!" });
    expect(calls[1].init.headers.Topic).toBe(undefined);
  });
  it("GET: без ?init — подсказка текстом; ?init=1 — ключ (создаёт, если нет); этапа 48 нет — no_stage; OPTIONS — CORS", async () => {
    const env = { url: "https://gvx.supabase.co", service: "eyJservice" };
    let seen = null;
    const db = async (url, init) => { seen = { url, body: JSON.parse(init.body), h: init.headers }; return new Response(JSON.stringify({ ok: true, pub: "STORED" }), { status: 200 }); };
    const t = await handle(new Request("https://gvx.supabase.co/functions/v1/push-send"), env, db);
    expect(await t.text()).toMatch(/^Service Academy: уведомления на телефон/);
    const r = await handle(new Request("https://gvx.supabase.co/functions/v1/push-send?init=1"), env, db);
    expect(await r.json()).toEqual({ ok: true, key: "STORED" });
    expect(r.headers.get("access-control-allow-origin")).toBe("*");
    expect(seen.url).toBe("https://gvx.supabase.co/rest/v1/rpc/sa_push_keys");
    expect(seen.body.p_pub).toMatch(/^[A-Za-z0-9_-]{87}$/); expect(seen.body.p_priv).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(seen.h.Authorization).toBe("Bearer eyJservice");
    const n = await handle(new Request("https://x/functions/v1/push-send?init=1"), env, async () => new Response('{"code":"PGRST202"}', { status: 404 }));
    expect(await n.json()).toEqual({ ok: false, error: "no_stage" });
    const o = await handle(new Request("https://x/functions/v1/push-send", { method: "OPTIONS" }), env, db);
    expect(o.status).toBe(204); expect(o.headers.get("access-control-allow-headers")).toMatch(/apikey/);
  });
  it("POST: без секрета — 401; чужой — 403; ключей нет — создаёт, шлёт каждому телефону, итог — в базу", async () => {
    const env = { url: "https://gvx.supabase.co", service: "sb_secret_x" };
    expect((await handle(new Request("https://x/p", { method: "POST", body: "{}" }), env, async () => new Response("{}"))).status).toBe(401);
    const bad = await handle(new Request("https://x/p", { method: "POST", headers: { "x-sa-push": "nope" }, body: JSON.stringify({ items: [{ emp: "e1", t: "Т" }] }) }), env,
      async () => new Response(JSON.stringify({ ok: false, error: "secret" })));
    expect(bad.status).toBe(403);
    const ph1 = await phoneKeys(), ph2 = await phoneKeys();
    let keys = null; const log = [], pushed = [];
    const f = async (url, init) => {
      if (/\/rest\/v1\/rpc\//.test(url)) {
        const fn = url.split("/").pop(), b = JSON.parse(init.body); log.push([fn, b, init.headers]);
        if (fn === "sa_push_take") return new Response(JSON.stringify({ ok: true, pub: keys && keys.pub, priv: keys && keys.priv, sub: "https://app.example",
          subs: [{ id: 1, emp: "e1", endpoint: "https://web.push.apple.com/one", p256dh: ph1.p256dh, auth: ph1.authS }, { id: 2, emp: "e1", endpoint: "https://fcm.googleapis.com/fcm/send/two", p256dh: ph2.p256dh, auth: ph2.authS },
            { id: 3, emp: "e2", endpoint: "https://web.push.apple.com/three", p256dh: ph2.p256dh, auth: ph2.authS }] }));
        if (fn === "sa_push_keys") { keys = { pub: b.p_pub, priv: b.p_priv }; return new Response(JSON.stringify({ ok: true, pub: b.p_pub })); }
        if (fn === "sa_push_done") return new Response(JSON.stringify({ ok: true }));
      }
      pushed.push({ url, init }); return new Response("", { status: /two$/.test(url) ? 410 : 201 });
    };
    const r = await handle(new Request("https://x/p", { method: "POST", headers: { "x-sa-push": "SECRET" }, body: JSON.stringify({ items: [{ emp: "e1", t: "Через час смена: Вечер", b: "Разминка", go: "warmup", badge: 2 }, { bad: 1 }] }) }), env, f);
    expect(await r.json()).toEqual({ ok: true, sent: 1, gone: 1, failed: 0 });
    expect(log.map((x) => x[0])).toEqual(["sa_push_take", "sa_push_keys", "sa_push_take", "sa_push_done"]);
    expect(log[0][1]).toEqual({ p_secret: "SECRET", p_emps: ["e1"] });
    expect(log[0][2]).toEqual({ apikey: "sb_secret_x", "Content-Type": "application/json" });   // новый ключ — только apikey
    expect(log[3][1]).toMatchObject({ p_secret: "SECRET", p_res: [{ id: 1, ok: true, code: 201 }, { id: 2, gone: true, code: 410 }] });
    expect(Object.keys(log[3][1].p_jwt).sort()).toEqual(["https://fcm.googleapis.com", "https://web.push.apple.com"]);   // Доп. 451: новые подписи — в базу
    expect(pushed.map((x) => x.url).sort()).toEqual(["https://fcm.googleapis.com/fcm/send/two", "https://web.push.apple.com/one"]);   // отправка параллельная
    const one = pushed.find((x) => /one$/.test(x.url));
    expect(one.init.headers.Authorization).toContain(", k=" + keys.pub);
    const d = await decrypt(new Uint8Array(one.init.body), ph1.priv, ph1.pub, ph1.auth);
    expect(JSON.parse(d.text)).toEqual({ t: "Через час смена: Вечер", b: "Разминка", go: "warmup", badge: 2 });
  });
  it("Доп. 451: переписка — Topic c<чат>, кнопки с адресом из базы (?act=1); подписи — из запаса базы, новых нет — p_jwt не шлём", async () => {
    const env = { url: "http://kong:8000", service: "eyJservice" };
    const ph = await phoneKeys(), keys = await newKeys(), now = Date.now();
    const jwt = await vapidJwt("https://web.push.apple.com", keys.pub, keys.priv, "https://app.example", now);
    const K = "c".repeat(64), log = [], pushed = [];
    const f = async (url, init) => {
      if (/\/rest\/v1\/rpc\//.test(url)) {
        const fn = url.split("/").pop(); log.push([fn, JSON.parse(init.body)]);
        if (fn === "sa_push_take") return new Response(JSON.stringify({ ok: true, pub: keys.pub, priv: keys.priv, sub: "https://app.example", url: "https://gvx.supabase.co",
          jwt: { "https://web.push.apple.com": { t: jwt, at: Math.floor(now / 1000) - 60, k: keys.pub } },
          subs: [{ id: 1, emp: "e1", endpoint: "https://web.push.apple.com/one", p256dh: ph.p256dh, auth: ph.authS }] }));
        return new Response(JSON.stringify({ ok: true }));
      }
      pushed.push({ url, init }); return new Response("", { status: 201 });
    };
    const it0 = { emp: "e1", t: "Вся команда · 2 новых", b: "Пётр О.: ок", go: "chat_1_5_r", badge: 2, c: 1, k: K, a: [{ a: "reply", t: "Ответить" }, { a: "read", t: "Прочитано" }] };
    const r = await handle(new Request("https://x/p", { method: "POST", headers: { "x-sa-push": "S" }, body: JSON.stringify({ items: [it0] }) }), env, f);
    expect(await r.json()).toEqual({ ok: true, sent: 1, gone: 0, failed: 0 });
    expect(pushed[0].init.headers.Topic).toBe("c1");
    expect(pushed[0].init.headers.Authorization).toBe("vapid t=" + jwt + ", k=" + keys.pub);   // из запаса: новой подписи нет
    expect(log.at(-1)).toEqual(["sa_push_done", { p_secret: "S", p_res: [{ id: 1, ok: true, code: 201 }] }]);
    const d = JSON.parse((await decrypt(new Uint8Array(pushed[0].init.body), ph.priv, ph.pub, ph.auth)).text);
    expect(d).toEqual({ ...it0, emp: undefined, u: "https://gvx.supabase.co/functions/v1/push-send?act=1" });
  });
  it("Доп. 451: кнопка под уведомлением — POST ?act=1 без секрета: ключ и кнопка — в базу (sa_push_act); в ответ — текст и число", async () => {
    const env = { url: "https://gvx.supabase.co", service: "eyJservice" };
    let seen = null;
    const f = async (url, init) => { seen = { url, body: JSON.parse(init.body) }; return new Response(JSON.stringify({ ok: true, text: "Ушло в «Вся команда».", badge: 3 })); };
    const K = "b".repeat(64);
    const r = await handle(new Request("https://gvx.supabase.co/functions/v1/push-send?act=1", { method: "POST", body: JSON.stringify({ k: K, a: "reply", r: "Иду" }) }), env, f);
    expect(await r.json()).toEqual({ ok: true, text: "Ушло в «Вся команда».", badge: 3 });
    expect(r.headers.get("access-control-allow-origin")).toBe("*");
    expect(seen).toEqual({ url: "https://gvx.supabase.co/rest/v1/rpc/sa_push_act", body: { p_key: K, p_action: "reply", p_text: "Иду" } });
    expect((await handle(new Request("https://x/p?act=1", { method: "POST", body: JSON.stringify({ k: "x", a: "reply" }) }), env, f)).status).toBe(400);
    expect((await handle(new Request("https://x/p?act=1", { method: "POST", body: JSON.stringify({ k: K, a: "delete" }) }), env, f)).status).toBe(400);
    const used = await handle(new Request("https://x/p?act=1", { method: "POST", body: JSON.stringify({ k: K, a: "read" }) }), env, async () => new Response(JSON.stringify({ ok: false, error: "used" })));
    expect(await used.json()).toEqual({ ok: false, error: "used" });
    const nost = await handle(new Request("https://x/p?act=1", { method: "POST", body: JSON.stringify({ k: K, a: "read" }) }), env, async () => new Response('{"code":"PGRST202"}', { status: 404 }));
    expect(await nost.json()).toEqual({ ok: false, error: "no_stage" });
  });
  it("код функции: один файл для редактора Supabase, Deno.serve — только в Deno, деплой и Verify JWT — в шапке", () => {
    const src = rd("supabase/functions/push-send/index.ts");
    expect(src).not.toMatch(/^import /m);
    expect(src).toContain("const D = (globalThis as any).Deno;");
    expect(src).toMatch(/Deploy a new function → Via Editor → имя push-send/);
    expect(src).toMatch(/supabase functions deploy push-send --no-verify-jwt/);
  });
});

describe("v137: текст бота → уведомление (lib/push-text.js, как _sa_push_text этапа 48)", () => {
  it("HTML бота: заголовок — первая строка, текст — остальное одной строкой", () => {
    expect(pushTextOf("<b>Что дало обучение · октябрь</b>\nДва моря, Океан · 1–15 октября\n\n<b>Чему учились</b>\nУроков: 8, было 7"))
      .toEqual({ t: "Что дало обучение · октябрь", b: "Два моря, Океан · 1–15 октября Чему учились Уроков: 8, было 7", m: false });
    expect(pushTextOf("Тест &amp; &lt;вино&gt; &quot;Кьянти&quot;")).toEqual({ t: 'Тест & <вино> "Кьянти"', b: "", m: false });
    expect(pushTextOf(" \n <b></b> ")).toBe(null);
  });
  it("Доп. 451, как в мессенджере: личное — «Анна С.» и текст; ответ, упоминание, «всем» — чат и «кто: что»; «Итог:» без текста — как есть", () => {
    expect(pushTextOf("Анна С. пишет тебе:\nМожно поменяться сменой?")).toEqual({ t: "Анна С.", b: "Можно поменяться сменой?", m: true });
    expect(pushTextOf("Пётр О. отвечает тебе в «Вся команда»:\nДа, возьму")).toEqual({ t: "Вся команда", b: "Пётр О. отвечает тебе: Да, возьму", m: true });
    expect(pushTextOf("Пётр О. упоминает тебя в «Вся команда»:\n@Мария, на банкет нужен ещё один официант"))
      .toEqual({ t: "Вся команда", b: "Пётр О.: @Мария, на банкет нужен ещё один официант", m: true });
    expect(pushTextOf("Мария К. пишет всем в «Старшие»:\n@все собрание в 15:00")).toEqual({ t: "Старшие", b: "Мария К. всем: @все собрание в 15:00", m: true });
    expect(pushTextOf("Анна С. пишет тебе:")).toEqual({ t: "Анна С. пишет тебе:", b: "", m: false });   // без сообщения — не сообщение
    expect(pushTextOf("Итог:")).toEqual({ t: "Итог:", b: "", m: false });
  });
  it("Доп. 451: опоздание, «отдаю смену», «ищем в смену» — кто что сверху, подробности с заглавной ниже; короткий вызов — как есть", () => {
    expect(pushTextOf("Дарья Л. опаздывает на 20 минут: будет в 12:20 (смена с 12:00).\n«автобус сломался»"))
      .toEqual({ t: "Дарья Л. опаздывает на 20 минут", b: "Будет в 12:20, смена с 12:00 · «автобус сломался»", m: false });
    expect(pushTextOf("Пётр О. отдаёт смену: суббота, 8 ноября · день 12:00–20:00. Забрать можно прямо здесь."))
      .toEqual({ t: "Пётр О. отдаёт смену", b: "Суббота, 8 ноября · день 12:00–20:00", m: false });
    expect(pushTextOf("Мария К. ищет официанта в смену: пятница, 7 ноября · вечер 18:00–24:00. Выйти можно прямо здесь."))
      .toEqual({ t: "Мария К. ищет официанта в смену", b: "Пятница, 7 ноября · вечер 18:00–24:00", m: false });
    expect(pushTextOf("Марк зовёт тебя: к столу 6")).toEqual({ t: "Марк зовёт тебя: к столу 6", b: "", m: false });
    expect(pushTextOf("Утро руководителя за 5 ноября: stop-лист пуст, опозданий нет, все смены закрыты").b).toBe("Stop-лист пуст, опозданий нет, все смены закрыты");
    expect(pushTextOf("Здесь приходят сообщения академии: разминка перед сменой, вопрос дня, лига недели, чат смены. Уроки и тесты ждут в приложении."))
      .toEqual({ t: "Здесь приходят сообщения академии", b: "Разминка перед сменой, вопрос дня, лига недели, чат смены. Уроки и тесты ждут в приложении", m: false });
    expect(pushCap("ёлка")).toBe("Ёлка"); expect(pushCap("Ok")).toBe("Ok"); expect(pushCap("")).toBe("");
  });
  it("длинная первая строка без «что: …» — 80 знаков по слову, остальное в тексте", () => {
    expect(pushTextOf("Здесь приходят сообщения академии про разминку перед сменой, вопрос дня, лигу недели и чат смены, а уроки ждут в приложении"))
      .toEqual({ t: "Здесь приходят сообщения академии про разминку перед сменой, вопрос дня, лигу…", b: "…недели и чат смены, а уроки ждут в приложении", m: false });
    const x = pushTextOf("Заголовок\n" + "слово ".repeat(80));
    expect(Array.from(x.b).length).toBeLessThanOrEqual(240); expect(x.b.endsWith("слово…")).toBe(true);
    expect(pushCut("короткий", 10)).toBe("короткий");
  });
  it("экран по касанию: кнопка мини-приложения, ссылка t.me, «Вопрос дня» — qday", () => {
    expect(pushGoOf([[{ text: "Открыть чат", web_app: { url: "https://app.example/?go=chat_5_10" } }]])).toBe("chat_5_10");
    expect(pushGoOf([[{ text: "А", callback_data: "cg:1" }, { text: "Н", url: "https://t.me/SA_RestaurantBot?startapp=go_mentor" }]])).toBe("mentor");
    expect(pushGoOf([[{ text: "А", callback_data: "qd:7:0" }]])).toBe("qday");
    expect(pushGoOf([])).toBe(null); expect(pushGoOf(null)).toBe(null);
  });
  it("Доп. 451: кнопки уведомления — у сообщения «Ответить» и «Прочитано», у карточек — кнопки бота (не больше двух); «N новых»", () => {
    expect(pushActsOf(null, "chat_5_77", true)).toEqual([{ a: "reply", t: "Ответить", id: 77, c: 5 }, { a: "read", t: "Прочитано", id: 77, c: 5 }]);
    expect(pushActsOf(null, "chat_5", true)).toBe(null);   // без сообщения отвечать не на что
    expect(pushActsOf([[{ text: "", callback_data: "ct:1" }, { text: "Иду", callback_data: "cg:2" }, { text: "Принято", callback_data: "cl:3" }]], null, false))
      .toEqual([{ a: "ct", id: 1, t: "Забрать" }, { a: "cg", id: 2, t: "Иду" }]);
    expect(pushActsOf([[{ text: "Выйду", callback_data: "ct:9" }], [{ text: "Открыть чат", web_app: { url: "https://app.example/?go=chat_1_9" } }]], "chat_1_9", false))
      .toEqual([{ a: "ct", id: 9, t: "Выйду" }]);
    expect(pushActsOf([[{ text: "А", callback_data: "qd:7:0" }, { text: "1", callback_data: "cv:9:0" }]], "qday", false)).toBe(null);
    expect([2, 3, 5, 11, 21, 101, 111].map(pushNew)).toEqual(["2 новых", "3 новых", "5 новых", "11 новых", "21 новое", "101 новое", "111 новых"]);
  });
  it("SQL этапа 48 — те же правила (проверка в test48.sh: и сравнение с этим файлом)", () => {
    const sql = rd("supabase/supabase-stage48-push.sql"), t = rd("tools/claude/sql/test48.sh");
    expect(sql).toContain("if right(ttl, 1) = ':' and btrim(rest) <> '' then ttl := rtrim(ttl, ': '); end if;");
    expect(sql).toContain("if coalesce(b->>'callback_data', '') ~ '^qd:' then qd := true; end if;");
    expect(sql).toContain("mm := regexp_match(ttl, '^(.{1,60}) (отвечает тебе|упоминает тебя|пишет всем) в «(.{1,60})»:$');");
    expect(sql).toContain("aft := regexp_replace(aft, '\\.?\\s*(Забрать|Выйти) можно прямо здесь\\.?$', '');");
    expect(sql).toContain("select n || ' ' || case when n % 10 = 1 and n % 100 <> 11 then 'новое' else 'новых' end");
    expect(t).toContain("Дарья Л\\. опаздывает на 20 минут#Будет в 12:20, смена с 12:00 · «автобус сломался»");
  });
});

describe("v137: где можно включить (lib/push.js)", () => {
  const IOS = (v) => "Mozilla/5.0 (iPhone; CPU iPhone OS " + v + " like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/" + v.replace("_", ".") + " Mobile/15E148 Safari/604.1";
  const W = ({ ua = "Mozilla/5.0 (Linux; Android 14) Chrome/130", standalone = false, api = true, perm = "default", tg = false, touch = 5 } = {}) => {
    const w = { navigator: { userAgent: ua, maxTouchPoints: touch, standalone: standalone && /iPhone/.test(ua) ? true : undefined }, matchMedia: () => ({ matches: standalone }) };
    if (api) { w.navigator.serviceWorker = {}; w.PushManager = function () {}; w.Notification = { permission: perm }; }
    if (tg) w.Telegram = { WebApp: { initData: "user=1&hash=x" } };
    return w;
  };
  it("Telegram, iPhone в Safari, старый iOS, без поддержки, запрещено, уже разрешено, можно", () => {
    expect(pushEnv(W({ tg: true }))).toBe("telegram");
    expect(pushEnv(W({ ua: IOS("17_5") }))).toBe("ios-browser");
    expect(pushEnv(W({ ua: IOS("16_3"), standalone: true }))).toBe("ios-old");
    expect(pushEnv(W({ ua: IOS("16_4"), standalone: true }))).toBe("ok");
    expect(pushEnv(W({ ua: IOS("18_1"), standalone: true, perm: "granted" }))).toBe("granted");
    expect(pushEnv(W({ api: false }))).toBe("no");
    expect(pushEnv(W({ perm: "denied" }))).toBe("denied");
    expect(pushEnv(W())).toBe("ok");
    expect(pushEnv({ __saPushShim: { env: "ios-browser" } })).toBe("ios-browser");
    expect(pushCan("ok") && pushCan("granted") && !pushCan("telegram") && !pushCan("denied")).toBe(true);
  });
  it("версия iOS: iPhone, iPad (Macintosh с касаниями), не Apple", () => {
    expect(iosVersion(IOS("16_4"))).toEqual([16, 4]);
    expect(iosVersion("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15", 5)).toEqual([17, 2]);
    expect(iosVersion("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.2 Safari/605.1.15", 0)).toBe(null);
    expect(iosVersion("Mozilla/5.0 (Linux; Android 14) Chrome/130")).toBe(null);
  });
  it("что сказать, где включить нельзя: по-человечески, без тире-ритма", () => {
    expect(pushEnvNote("ios-browser")).toBe("На iPhone уведомления приходят, когда академия открыта с экрана «Домой». Как её туда добавить:");
    expect(pushEnvNote("ios-old")).toMatch(/iOS 16\.4/);
    expect(pushEnvNote("telegram")).toMatch(/^Здесь сообщения присылает бот Telegram/);
    expect(pushEnvNote("ok")).toBe("");
    for (const e of ["telegram", "ios-browser", "ios-old", "denied", "no"]) expect(dashes('"' + pushEnvNote(e) + '"'), e).toBe(0);
    expect(pushError("no_fn", true)).toMatch(/«Команда», «Сервер»/);
    expect(pushError("no_fn")).toMatch(/Скажи руководителю/);
    expect(pushError("often")).toMatch(/15 секунд/);
  });
  it("ключ сервера: base64url туда и обратно; функция push-send — 404, 401, ключ", async () => {
    const b = urlB64ToBytes(RFC.uaPub);
    expect(b.length).toBe(65); expect(bytesToUrlB64(b)).toBe(RFC.uaPub);
    const rs = (st, j) => async () => new Response(JSON.stringify(j || {}), { status: st });
    expect(await fetchPushKey(rs(404))).toEqual({ ok: false, error: "no_fn" });
    expect(await fetchPushKey(rs(401))).toEqual({ ok: false, error: "jwt" });
    expect(await fetchPushKey(rs(200, { ok: true, key: "KEY" }))).toEqual({ ok: true, key: "KEY" });
    expect(await fetchPushKey(rs(200, { ok: false, error: "no_stage" }))).toEqual({ ok: false, error: "no_stage" });
    expect(await fetchPushKey(async () => { throw new Error("x"); })).toEqual({ ok: false, error: "net" });
  });
  it("строки в «Смене» и «Я»; выбор «Куда присылать»", () => {
    expect(remindSub({ push: true, tg: true })).toBe("На телефон и в Telegram: разминка, чат, вопрос дня");
    expect(remindSub({ tg: true })).toBe("Включено: за час до смены зовёт на разминку");
    expect(remindSub({})).toBe("Разминка за час до смены, чат, вопрос дня");
    expect(pushRowSub("ok", true)).toBe("Включены на этом телефоне");
    expect(pushRowSub("ios-browser", false)).toBe("Как у приложения: с экрана «Домой»");
    expect(CHANNELS).toEqual([["both", "Telegram и телефон"], ["push", "Только телефон"], ["tg", "Только Telegram"]]);
  });
});

describe("v137: ссылки ?go=… — и из уведомлений (goLinkOk в App.jsx)", () => {
  const m = rd("App.jsx").match(/^const goLinkOk = (\(v\) => [\s\S]*?v === "remind"\));$/m);
  const goLinkOk = m ? new Function("return " + m[1])() : () => false;
  it("прежние ссылки на месте; новые — qday и remind; чужое — нет", () => {
    expect(m).not.toBe(null);
    for (const v of ["pair", "league", "cellar", "chat", "schedule", "morning", "newbies", "qday", "remind", "chat_5", "chat_5_10", "lesson_s1-2", "gain", "gain_2026-10"]) expect(goLinkOk(v), v).toBe(true);
    for (const v of ["", "warmup", "chat_x", "gain_2026-13", "javascript:alert(1)", null, 5]) expect(goLinkOk(v), String(v)).toBe(false);
  });
  it("ссылка при запуске и касание уведомления — одной проверкой", () => {
    const a = rd("App.jsx");
    expect(a).toContain('goLinkRef.current = goLinkOk(v) ? v : "";');
    expect(a).toContain("else if (goLinkOk(v)) goLinkRef.current = v;");
  });
  it("Доп. 451: chat_<чат>_<сообщение>_r — переписка сразу с ответом на сообщение (в группе — цитата, в личной — строка ввода)", () => {
    for (const v of ["chat_5_10_r", "chat_123456789012_123456789012345_r"]) expect(goLinkOk(v), v).toBe(true);
    for (const v of ["chat_5_r", "chat_5_10_x", "chat_5_10_rr", "chat__10_r"]) expect(goLinkOk(v), v).toBe(false);
    const a = rd("App.jsx"), c = rd("ui/chat.jsx");
    expect(a).toContain('const [, cid, mid, r] = g.split("_"); setChatOpen({ intent: { kind: "chat", id: Number(cid), msg: mid ? Number(mid) : null, reply: r === "r" && !!mid, at: Date.now() } });');
    expect(c).toContain('setInit(it.msg ? { msg: it.msg, reply: !!it.reply } : null); setCurId(it.id); return;');
    expect(c).toContain("if (group && q && !q.del && String(q.emp) !== String(meId)) startReply(q);");
    expect(c).toContain("else setTimeout(() => { if (inputRef.current) inputRef.current.focus(); }, 30);");
  });
});

describe("v137: сервис-воркер — показ и касание", () => {
  const load = (o = {}) => {
    const H = {}, shown = [], badge = [], posted = [], opened = [], focused = [], fetched = [];
    let clients = [], notes = o.notes || [];
    const self = {
      addEventListener: (k, f) => { H[k] = f; },
      registration: { showNotification: (t, op) => { if (o.noActions && op.actions) return Promise.reject(new TypeError("actions")); shown.push([t, op]); return Promise.resolve(); },
        getNotifications: async (f) => notes.filter((n) => !f || !f.tag || n.tag === f.tag) },
      navigator: { setAppBadge: (n) => { badge.push(n); return Promise.resolve(); }, clearAppBadge: () => { badge.push(0); return Promise.resolve(); } },
      clients: { matchAll: async () => clients, openWindow: async (u) => { opened.push(u); } },
      location: { origin: "https://app.example" }, skipWaiting: () => {},
    };
    const fetch = async (url, init) => { fetched.push({ url, body: JSON.parse(init.body) }); if (o.net === "down") throw new Error("offline"); return { json: async () => o.answer || { ok: true } }; };
    vm.runInNewContext(rd("public/sw.js"), { self, caches: {}, fetch, URL, Response, Request, console, Promise, setTimeout: (f) => f(), Math, JSON, String, Number, Array });
    const run = async (k, ev) => { let p = null; H[k]({ ...ev, waitUntil: (x) => { p = x; } }); await p; };
    return { H, shown, badge, posted, opened, focused, fetched, run, setClients: (c) => { clients = c; }, setNotes: (n) => { notes = n; } };
  };
  const data = (o) => ({ json: () => o, text: () => JSON.stringify(o) });
  it("уведомление: заголовок, текст, значок, экран; число на иконке; пустое — «Service Academy»", async () => {
    const s = load();
    await s.run("push", { data: data({ t: "Через час смена: Вечер", b: "Разминка до смены", go: "warmup", badge: 3 }) });
    expect(s.shown[0]).toEqual(["Через час смена: Вечер", { body: "Разминка до смены", icon: "/icons/icon-192.png", badge: "/icons/badge-96.png", lang: "ru",
      data: { go: "warmup", c: null, k: "", u: "", id: expect.any(String) } }]);
    expect(s.badge).toEqual([3]);
    await s.run("push", { data: data({ t: "Т", go: "<script>", badge: 0 }) });
    expect(s.shown[1][1].data.go).toBe(""); expect(s.badge).toEqual([3, 0]);
    await s.run("push", { data: null });
    expect(s.shown[2][0]).toBe("Service Academy");
    await s.run("push", { data: { json: () => { throw new Error("not json"); }, text: () => "просто текст" } });
    expect(s.shown[3][1].body).toBe("просто текст");
  });
  const K = "e".repeat(64), U = "https://gvx.supabase.co/functions/v1/push-send?act=1";
  const CHAT = { t: "Вся команда · 2 новых", b: "Пётр О.: ок", go: "chat_1_5_r", badge: 2, c: 1, k: K, u: U, a: [{ a: "reply", t: "Ответить" }, { a: "read", t: "Прочитано" }] };
  it("Доп. 451: переписка — тег chat-<c> (Android заменяет), кнопки «Ответить» (поле в уведомлении) и «Прочитано»; iPhone — прежние этой переписки закрыты", async () => {
    let closed = [];
    const s = load({ notes: [{ data: { c: 1, id: "старое" }, close: () => closed.push("старое") }, { data: { c: 2, id: "другая" }, close: () => closed.push("другая") }] });
    await s.run("push", { data: data(CHAT) });
    const [t, o] = s.shown[0];
    expect(t).toBe("Вся команда · 2 новых");
    expect(o).toMatchObject({ tag: "chat-1", renotify: true, data: { go: "chat_1_5_r", c: 1, k: K, u: U } });
    expect(o.actions).toEqual([{ action: "reply", title: "Ответить", type: "text", placeholder: "Ответ…" }, { action: "read", title: "Прочитано" }]);
    expect(closed).toEqual(["старое"]);
    const z = load();
    await z.run("push", { data: data({ ...CHAT, u: "http://evil.example/x" }) });   // кнопки без https-адреса — не показываем
    expect(z.shown[0][1].actions).toBe(undefined); expect(z.shown[0][1].data.k).toBe("");
  });
  it("Доп. 451: кнопки не поддерживаются — всё равно показываем (iPhone выключил бы подписку): просто текст", async () => {
    const s = load({ noActions: true });
    await s.run("push", { data: data(CHAT) });
    expect(s.shown[0]).toEqual(["Вся команда · 2 новых", { body: "Пётр О.: ок", icon: "/icons/icon-192.png", lang: "ru", data: { go: "chat_1_5_r", c: 1, id: expect.any(String) } }]);
  });
  it("Доп. 451: «Ответить» с текстом — в функцию (ключ, кнопка, ответ), на телефоне — «Ушло…» и число; без текста или без сети — переписка с готовым ответом", async () => {
    const s = load({ answer: { ok: true, text: "Ушло в «Вся команда».", badge: 1 } });
    const note = { data: { go: "chat_1_5_r", c: 1, k: K, u: U }, close: () => {} };
    await s.run("notificationclick", { notification: note, action: "reply", reply: "  Иду  " });
    expect(s.fetched).toEqual([{ url: U, body: { k: K, a: "reply", r: "Иду" } }]);
    expect(s.shown[0][0]).toBe("Ушло в «Вся команда»."); expect(s.shown[0][1]).toMatchObject({ tag: "sa-done", silent: true });
    expect(s.badge).toEqual([1]); expect(s.opened).toEqual([]);
    await s.run("notificationclick", { notification: note, action: "reply", reply: "" });
    expect(s.fetched.length).toBe(1); expect(s.opened).toEqual(["/?go=chat_1_5_r"]);
    const off = load({ net: "down" });
    await off.run("notificationclick", { notification: note, action: "read" });
    expect(off.fetched[0].body).toEqual({ k: K, a: "read" }); expect(off.opened).toEqual(["/?go=chat_1_5_r"]);
    const no = load({ answer: { ok: false, error: "used" } });
    await no.run("notificationclick", { notification: { data: { go: "chat_1_9", k: K, u: U }, close: () => {} }, action: "ct" });
    expect(no.opened).toEqual(["/?go=chat_1_9"]);
    const rd2 = load({ answer: { ok: true, text: null, badge: 0 } });
    await rd2.run("notificationclick", { notification: note, action: "read" });
    expect(rd2.shown).toEqual([]); expect(rd2.badge).toEqual([0]); expect(rd2.opened).toEqual([]);   // «Прочитано» — тихо
    const bad = load();
    await bad.run("notificationclick", { notification: note, action: "delete" });
    expect(bad.fetched).toEqual([]); expect(bad.opened).toEqual(["/?go=chat_1_5_r"]);
  });
  it("касание: приложение открыто — сообщение sa-go и на передний план; закрыто — /?go=…", async () => {
    const s = load();
    let closed = 0;
    const msgs = [], foc = [];
    s.setClients([{ url: "https://other.example/", postMessage: () => msgs.push("чужое") }, { url: "https://app.example/", postMessage: (m) => msgs.push(m), focus: async () => { foc.push(1); } }]);
    await s.run("notificationclick", { notification: { data: { go: "qday" }, close: () => { closed++; } } });
    expect(closed).toBe(1); expect(msgs).toEqual([{ type: "sa-go", go: "qday" }]); expect(foc).toEqual([1]); expect(s.opened).toEqual([]);
    s.setClients([]);
    await s.run("notificationclick", { notification: { data: { go: "chat_5_10" }, close: () => {} } });
    await s.run("notificationclick", { notification: { data: {}, close: () => {} } });
    expect(s.opened).toEqual(["/?go=chat_5_10", "/"]);
  });
  it("кэш и сеть — как раньше (версия sa-sw-v1)", () => {
    const sw = rd("public/sw.js");
    expect(sw).toContain('const VERSION = "sa-sw-v1";');
    expect(sw).toContain('self.addEventListener("push", (e) => {');
    expect(sw).toContain('self.addEventListener("notificationclick", (e) => {');
  });
});

describe("v137: демо-сервер — как этап 48", () => {
  const PEOPLE = [{ id: "u-m", name: "Мария", surname: "Ким", restaurant: "R", position: "manager", is_admin: true }, { id: "e-a", name: "Анна", surname: "Смирнова", restaurant: "R", position: "waiter" },
    { id: "e-o", name: "Ольга", surname: "Лис", restaurant: "R", position: "hostess" }];
  const SUBJ = (ep) => ({ endpoint: "https://web.push.apple.com/" + ep, keys: { p256dh: RFC.uaPub, auth: RFC.auth } });
  const mk = (o = {}) => {
    const pings = [], pushes = [];
    const s = makeServer({ today: "2026-11-05", rest: "R", people: PEOPLE, tok: { tm: "u-m", ta: "e-a", to: "e-o" }, sstaff: [], cfg: { shifts: [], staff: [] }, plan: {}, menu: [],
      tgLinked: ["u-m", "e-a"], ping: (...a) => pings.push(a), push: (...a) => pushes.push(a), ...o });
    return { s, pings, pushes };
  };
  it("включить, пробное, «только телефон», упоминание в чате — на телефон с экраном переписки", () => {
    const { s, pings, pushes } = mk();
    expect(s.rpc("push_status", { p_token: "ta" })).toMatchObject({ ok: true, n: 0, here: false, channel: "both", tg: true, pseudo: false });
    expect(s.rpc("push_subscribe", { p_token: "ta", p_sub: { endpoint: "http://x" } }).error).toBe("bad_sub");
    expect(s.rpc("push_subscribe", { p_token: "ta", p_sub: SUBJ("a1") })).toMatchObject({ ok: true, n: 1, here: true });
    expect(s.rpc("push_test", { p_token: "ta" }).ok).toBe(true);
    expect(s.rpc("push_test", { p_token: "ta" }).error).toBe("often");
    expect(pushes[0]).toEqual(["e-a", { t: "Уведомления работают", b: "Так будут приходить сообщения: чат, смены, вопрос дня.", go: "remind", badge: 0 }]);
    expect(s.rpc("push_channel", { p_token: "ta", p_channel: "push" }).channel).toBe("push");
    s.rpc("chat_send", { p_token: "tm", p_chat: 1, p_body: "@Анна, возьмёшь банкет?" });
    expect(pushes[1][0]).toBe("e-a"); expect(pushes[1][1].t).toBe("Вся команда"); expect(pushes[1][1].b).toBe("Мария К.: @Анна, возьмёшь банкет?");   // Доп. 451
    expect(pushes[1][1].go).toMatch(/^chat_1_\d+_r$/); expect(pushes[1][1].badge).toBe(1); expect(pushes[1][1].c).toBe(1);
    expect(pushes[1][1].a).toEqual([{ a: "reply", t: "Ответить" }, { a: "read", t: "Прочитано" }]); expect(pushes[1][1].k).toMatch(/^[0-9a-f]{64}$/);
    expect(pings.filter((p) => p[0] === "e-a").length).toBe(0);   // только телефон: Telegram молчит
  });
  it("без Telegram — «чат» без Telegram; выключил последний — убрался; этапа нет — PGRST202; руководителю — сервер", () => {
    const { s } = mk({ pushSubs: ["e-a"] });
    expect(s.rpc("push_status", { p_token: "tm" }).srv).toMatchObject({ subs: 1, people: 1, pseudo: 0 });
    expect(s.rpc("push_subscribe", { p_token: "to", p_sub: SUBJ("o1") }).pseudo).toBe(true);
    expect(s.S.tgLinked).toContain("e-o");
    expect(s.rpc("push_unsubscribe", { p_token: "to", p_endpoint: "https://web.push.apple.com/o1" })).toMatchObject({ n: 0, pseudo: false });
    expect(s.S.tgLinked).not.toContain("e-o");
    expect(mk({ noStage48: true }).s.rpc("push_status", { p_token: "ta" }).code).toBe("PGRST202");
    expect(s.rpc("server_check", { p_token: "tm", p_fns: ["push_subscribe"] }).fns).toEqual(["push_subscribe"]);
    expect(mk({ noStage48: true }).s.rpc("server_check", { p_token: "tm", p_fns: ["push_subscribe"] }).fns).toEqual([]);
  });
  it("Доп. 451: личное — «Мария Ким» и текст, ответ из уведомления — в переписку, ключ один раз; второе в чате — «· 2 новых»", () => {
    const { s, pushes, pings } = mk({ pushSubs: ["e-a"] });
    const dm = s.rpc("chat_dm", { p_token: "tm", p_emp: "e-a" }).chat.id;
    s.rpc("chat_send", { p_token: "tm", p_chat: dm, p_body: "Можно поменяться сменой?" });
    const n = pushes.at(-1)[1];
    expect(n).toMatchObject({ t: "Мария Ким", b: "Можно поменяться сменой?", c: dm });
    expect(n.go).toMatch(new RegExp("^chat_" + dm + "_\\d+_r$"));
    expect(s.pushAct(n.k, "ct")).toEqual({ ok: false, error: "bad_action" });
    expect(s.pushAct(n.k, "reply", "   ")).toEqual({ ok: false, error: "empty" });
    expect(s.pushAct(n.k, "reply", "Да, конечно")).toMatchObject({ ok: true, text: "Ушло в личную переписку." });
    expect(s.pushAct(n.k, "reply", "ещё")).toEqual({ ok: false, error: "used" });
    expect(s.pushAct("x".repeat(64), "read")).toEqual({ ok: false, error: "bad_key" });
    expect(s.S.msgs.filter((x) => x.chat === dm).at(-1)).toMatchObject({ emp: "e-a", body: "Да, конечно", reply: null });   // в личной — без цитаты
    expect(pings.at(-1).slice(0, 2)).toEqual(["e-a", "Мария Ким пишет тебе:\nМожно поменяться сменой?"]);   // Мария сейчас в переписке — ей бот не пишет
    s.bot.say("e-o", "Кто закроет зал?");
    s.rpc("chat_send", { p_token: "tm", p_chat: 1, p_body: "@Анна, возьмёшь?" });
    const g = pushes.at(-1)[1];
    expect(g).toMatchObject({ t: "Вся команда · 2 новых", b: "Мария К.: @Анна, возьмёшь?", c: 1 });
    expect(s.pushAct(g.k, "read")).toMatchObject({ ok: true, text: null });
    expect(s.rpc("chat_list", { p_token: "ta" }).chats.find((c) => c.id === 1).unread).toBe(0);
  });
  it("Доп. 451: Telegram — просто текст после сообщения о переписке: в чат ответом, «Ушло…»; «Отменить» — стёрто; через 30 минут — нет", () => {
    let t = Date.UTC(2026, 10, 5, 9, 0, 0);
    const { s } = mk({ clock: () => t });
    const m = s.bot.say("e-o", "@Анна, кто закроет зал?");
    expect(s.tg.last("e-a")).toMatchObject({ chat: 1, msg: m.id });
    const r = s.tg.quick("e-a", "Я закрою");
    expect(r).toMatchObject({ ok: true, chat: 1, text: "Ушло в «Вся команда»." });
    expect(s.msgOf(r.id)).toMatchObject({ emp: "e-a", body: "Я закрою", reply: m.id });
    expect(s.tg.undo("e-o", r.id)).toEqual({ ok: false });                               // чужое — нельзя
    expect(s.tg.undo("e-a", r.id)).toEqual({ ok: true });
    expect(s.msgOf(r.id).del).toBe(true);
    t += 31 * 60000;
    expect(s.tg.quick("e-a", "Ещё")).toEqual({ ok: false, error: "none" });
  });
  it("напоминания в Telegram выключены, включил телефон — только телефон; выключил — Telegram снова молчит", () => {
    const { s } = mk();
    expect(s.rpc("tg_set", { p_token: "ta", p_remind: false }).remind).toBe(false);
    expect(s.rpc("push_subscribe", { p_token: "ta", p_sub: SUBJ("a2") })).toMatchObject({ channel: "push", tg: true });
    expect(s.rpc("push_unsubscribe", { p_token: "ta", p_endpoint: "https://web.push.apple.com/a2" })).toMatchObject({ channel: "both", tg: false });
    expect(s.rpc("tg_status", { p_token: "ta" })).toEqual({ ok: true, bot: true, linked: true, remind: false, minutes: 60 });
  });
});

describe("v137: экраны", () => {
  const C = { text: "#fff", sub: "#aaa", gold: "#c9a", line: "#333", bg: "#000" };
  const withWin = (w, f) => { const was = globalThis.window; globalThis.window = w; try { return f(); } finally { if (was === undefined) delete globalThis.window; else globalThis.window = was; } };
  it("«На телефон»: iPhone в Safari — три шага; Telegram — бот пишет; можно — «Проверяю…» до ответа сервера", () => {
    const ios = withWin({ __saPushShim: { env: "ios-browser" } }, () => renderToString(<PushBlock a11y={false} c={C} />));
    expect(ios).toContain('data-push-block="ios-browser"');
    expect(ios).toContain("data-push-ios");
    expect(ios).toContain("Внизу Safari нажми «Поделиться»");
    const tg = withWin({ __saPushShim: { env: "telegram" } }, () => renderToString(<PushBlock a11y={false} c={C} />));
    expect(tg).toContain('data-push-block="telegram"'); expect(tg).toContain("Здесь сообщения присылает бот Telegram");
    const ok = withWin({ __saPushShim: { env: "ok", reg: null } }, () => renderToString(<PushBlock a11y={false} c={C} />));
    expect(ok).toContain('data-push-block="load"'); expect(ok).toContain("Проверяю…");
  });
  it("«Куда присылать»: три варианта, выбранный — aria-pressed, подпись по выбору", () => {
    const h = renderToString(<ChannelPick a11y={false} c={C} ps={{ channel: "push" }} />);
    expect(h).toContain('data-push-channel="push"');
    expect(h).toMatch(/aria-pressed="true" data-push-ch="push"/);
    expect(h).toContain("Telegram молчит, пока уведомления на телефоне включены.");
  });
  it("окно «Напоминания»: телефон и Telegram, «Куда присылать», «Что ещё присылать» — одно на оба", () => {
    const d = rd("ui/day-cards.jsx");
    expect(d).toContain('aria-label="Напоминания"');
    expect(d).toContain("{inTg ? <>{tgPart}{pushPart}</> : <>{pushPart}{tgPart}</>}");
    expect(d).toContain("{linked && phones > 0 ? <ChannelPick a11y={a11y} c={c} ps={ps} onState={onPs} /> : null}");
    expect(d).toContain("const linked = st.phase === \"ready\" && st.linked && !(ps && ps.pseudo);");
    expect(d).not.toContain("Напоминания в Telegram</h3>");
  });
  it("App: «Смена» → «Напоминания», «Я» → «Уведомления на телефон», число на иконке, касание при открытом приложении, выход", () => {
    const a = rd("App.jsx");
    expect(a).toContain('{ key:"remind", group:"На смене", icon:"bell", label:"Напоминания", sub: remindSub({ push: pushHere, tg: tgRemind }), onClick:() => setRemindOpen(true) },');
    expect(a).toContain('{ key:"push", group:"Помощь и настройки", icon:"bell", label:"Уведомления на телефон", sub: pushRowSub(pushEnv(), pushHere), onClick:() => setRemindOpen("push") },');
    expect(a).toContain("useEffect(() => { if (profile) setAppBadge(chatUnread); }, [chatUnread, profile]);");
    expect(a).toContain('window.addEventListener("sa-go", onWin);');
    expect(a).toContain('if (sw && typeof sw.addEventListener === "function") sw.addEventListener("message", onSw);');
    expect(a).toContain('else if (g === "qday") { navigate("roleSelect"); loadQday(true); }');
    expect(a).toContain('else if (g === "remind") setRemindOpen("push");');
    expect(a).toContain("if (readPushFlag(uk)) pushUnsubscribe({ uk, token: saToken() }).catch(() => {}); } catch (e) {}");
    expect(a).toContain('focus={layerData(layers, "remind") === "push" ? "push" : null}');
    expect((a.match(/goTick\]\);/g) || []).length).toBe(3);
  });
  it("«Сервер»: этап 48, функция push-send, телефоны, доставка и ошибка", () => {
    // v139 (Доп. 454): после 48 — этап 49 («О нас»)
    expect(STAGES.find((x) => x.n === "48")).toEqual({ n: "48", file: "supabase-stage48-push.sql", what: "Уведомления на телефон", fn: "push_subscribe" });
    const r = pushReport({ srv: { subs: 3, people: 2, pseudo: 1, ok_at: "2026-11-05T09:00:00Z", err: "BadJwtToken (код 403)", err_at: "2026-11-05T10:00:00Z" } }, "ok", Date.parse("2026-11-05T10:30:00Z"));
    expect(r).toMatchObject({ fn: "ok", people: 2, subs: 3, pseudo: 1, okAgo: "2 часа назад", errNew: true, todo: 0 });
    expect(pushReport(null, "no_fn").todo).toBe(1);
    expect(pushReport({ srv: { ok_at: "2026-11-05T10:00:00Z", err: "x", err_at: "2026-11-05T09:00:00Z" } }, "ok").errNew).toBe(false);
    expect(pushErrText("no_url")).toMatch(/адрес сервера/);
    expect(pushErrText("BadJwtToken (код 403)")).toMatch(/^служба уведомлений не приняла подпись/);
    const sv = rd("ui/server.jsx");
    expect(sv).toContain('{h("Уведомления на телефон")}');
    expect(sv).toContain("setSt((x) => (x.rep === rep ? { ...x, push, rep: { ...rep, todo: rep.todo + push.todo } } : x));");
    expect(sv).toContain("const n = Math.max(0, rep.tg.linked - (push ? push.pseudo : 0));");
  });
});

describe("v137: сервер, документы, метка", () => {
  it("этап 48: функции, отправка бота с телефоном, вебхук обёрнут, права", () => {
    const s = rd("supabase/supabase-stage48-push.sql");
    for (const f of ["push_status", "push_subscribe", "push_unsubscribe", "push_channel", "push_test", "sa_push_take", "sa_push_keys", "sa_push_done", "sa_push_tg", "_sa_push_route"]) expect(s, f).toContain("create or replace function " + f + "(");
    expect((s.match(/if not _sa_push_route\(/g) || []).length).toBe(3);
    expect(s).toContain("alter function public.sa_tg_update(text, jsonb) rename to _sa_tg_update_core;");
    expect(s).toContain("perform set_config('sa.tg_from'");
    expect(s).toContain("create trigger sa_push_tg_gone after delete on tg_links for each row execute function _sa_push_tg_gone();");
    expect(s).toMatch(/grant execute on function push_status\(text, text, text, text\), push_subscribe\(text, jsonb, text\), push_unsubscribe\(text, text\), push_channel\(text, text\), push_test\(text\)\n {2}to anon, authenticated;/);
  });
  it("shift-reminder: сначала на телефон (sa_push_tg), Telegram — если надо", () => {
    const f = rd("supabase/functions/shift-reminder/index.ts");
    expect(f).toContain('const pr = await sb.rpc("sa_push_tg", { p_chat: o.chat_id, p_text: o.text, p_go: "schedule" });');
    expect(f).toContain("if (!toTg) { sent++; continue; }");
  });
  it("README этапов и функций, README проверок, CHANGES, гид, метка v137", () => {
    const r = rd("supabase/README.md");
    expect(r).toContain("supabase-stage48-push.sql");
    expect(r).toMatch(/\| `push-send` \|/);
    expect(rd("tools/claude/README.md")).toContain("e2e-v137.mjs");
    expect(rd("tools/claude/README.md")).toContain("test48.sh");
    expect(rd("CHANGES.md")).toContain("Дополнение 450");
    expect(rd("CHANGES.md")).toContain("# Дополнение 451 — уведомления красивее и удобнее");
    expect(rd("supabase/README.md")).toContain("`sa_push_act` (кнопка под уведомлением)");
    expect(rd("tools/claude/README.md")).toContain("(78 проверок)");
    const g = rd("ui/guide.jsx");
    expect(g).toContain('{ key: "push", title: "Уведомления на телефон"');
    expect(g).toContain('{ key: "remind", title: "Напоминания", text: "«Смена» → «Напоминания»');
    expect(rd("ui/menu-trainer.jsx")).toMatch(/· сборка v(13[7-9]|1[4-9]\d|[2-9]\d\d)<\/span>/);
  });
  it("тексты: без тире-ритма и эмодзи в новых файлах; почта нигде не уходит", () => {
    for (const f of ["ui/push-block.jsx", "lib/push.js", "lib/push-text.js", "ui/server.jsx", "ui/gain.jsx", "ui/morning.jsx"]) {
      expect(dashes(rd(f)), f).toBe(0);
      expect(code(rd(f)), f).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
    }
    for (const f of ["lib/push.js", "ui/push-block.jsx", "supabase/functions/push-send/index.ts", "supabase/supabase-stage48-push.sql", "public/sw.js"]) expect(rd(f), f).not.toMatch(/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z]{2,}/);
  });
});
