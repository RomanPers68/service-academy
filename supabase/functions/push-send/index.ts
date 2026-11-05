// Service Academy — push-send: уведомления на телефон (Web Push, v137, Дополнение 450).
//
// POST от базы (этап 48: _sa_push_post через pg_net) с заголовком x-sa-push и телом { items: [{ emp, t, b, go, badge, c,
//   a, k }] }: подписки и ключи — из базы (sa_push_take, по секрету), каждому телефону — зашифрованное уведомление
//   (RFC 8291, aes128gcm) с подписью VAPID (RFC 8292), итог — в базу (sa_push_done): подписки, которой больше нет (404,
//   410), нет и у нас. Уведомление: { t — заголовок, b — текст, go — какой экран открыть, badge — число на иконке,
//   c — переписка (одно уведомление на чат; заголовок Topic — пока телефон без сети, ждёт только последнее), a — кнопки,
//   k — их ключ, u — куда их нажимать }.
// Доп. 451: POST ?act=1 от телефона (сервис-воркер, кнопка под уведомлением) с телом { k, a, r }: ключ уведомления,
//   кнопка (reply | read | cl | ct | cg) и ответ — в базу (sa_push_act); в ответ — { ok, text, badge }. Подпись VAPID
//   одна на службу и обновляется раз в 6 часов (Apple просит не чаще раза в час): готовые — из базы, новые — туда же.
// GET ?init=1 → ключи VAPID: если их ещё нет, функция создаёт их и записывает в базу (sa_push_keys); в ответ — открытый
//   ключ (им приложение подписывает телефон). Закрытый ключ хранится в базе (sa_settings, закрыта) и в ответ не попадает.
//   Подпись VAPID называет отправителя адресом приложения (app_url), без почты.
//
// Деплой: Supabase → Edge Functions → Deploy a new function → Via Editor → имя push-send → вставить код → Deploy.
// Проверку JWT выключить (Details → «Enforce JWT verification» / «Verify JWT» — выкл.), как у tg-bot: база зовёт функцию
// со своим секретом. CLI: supabase functions deploy push-send --no-verify-jwt
// Секреты не нужны: адрес базы и сервисный ключ функция получает сама.

const te = new TextEncoder();

// ── base64url ──
export function b64uEnc(buf: ArrayBuffer | Uint8Array): string {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function b64uDec(s: string): Uint8Array {
  const t = String(s || "").replace(/-/g, "+").replace(/_/g, "/").replace(/[\s=]+/g, "");
  const bin = atob(t + "===".slice((t.length + 3) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
const cat = (...parts: Uint8Array[]): Uint8Array => {
  let n = 0;
  for (const p of parts) n += p.length;
  const out = new Uint8Array(n);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
};
const ZERO = new Uint8Array([0]);

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, len: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, len * 8));
}
// закрытый ключ P-256 по d и открытому ключу (65 байт: 04 || x || y)
function ecJwk(d: string, pub: Uint8Array): JsonWebKey {
  return { kty: "EC", crv: "P-256", d, x: b64uEnc(pub.slice(1, 33)), y: b64uEnc(pub.slice(33, 65)), ext: true };
}

// ── RFC 8291: тело уведомления для подписки телефона (p256dh, auth). opt — свои ключ и соль (для проверки по примеру
// из RFC 8291, приложение A), иначе — новые на каждое уведомление
export async function encryptPush(p256dh: string, auth: string, plain: Uint8Array | string,
  opt: { asPriv?: string; asPub?: string; salt?: string } = {}): Promise<Uint8Array> {
  const ua = b64uDec(p256dh), secret = b64uDec(auth);
  if (ua.length !== 65 || ua[0] !== 4 || secret.length < 16) throw new Error("bad_keys");
  const data = typeof plain === "string" ? te.encode(plain) : plain;
  if (data.length > 3800) throw new Error("too_big");
  let asPub: Uint8Array, asKey: CryptoKey;
  if (opt.asPriv && opt.asPub) {
    asPub = b64uDec(opt.asPub);
    asKey = await crypto.subtle.importKey("jwk", ecJwk(opt.asPriv, asPub), { name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]);
  } else {
    const kp = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]) as CryptoKeyPair;
    asKey = kp.privateKey;
    asPub = new Uint8Array(await crypto.subtle.exportKey("raw", kp.publicKey));
  }
  const uaKey = await crypto.subtle.importKey("raw", ua, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, asKey, 256));
  const salt = opt.salt ? b64uDec(opt.salt) : crypto.getRandomValues(new Uint8Array(16));
  const ikm = await hkdf(secret, ecdh, cat(te.encode("WebPush: info"), ZERO, ua, asPub), 32);
  const cek = await hkdf(salt, ikm, cat(te.encode("Content-Encoding: aes128gcm"), ZERO), 16);
  const nonce = await hkdf(salt, ikm, cat(te.encode("Content-Encoding: nonce"), ZERO), 12);
  const key = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  // одна запись: текст и разделитель 0x02 (последняя запись)
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, cat(data, new Uint8Array([2]))));
  // заголовок: соль (16), размер записи 4096 (4), длина ключа (1), открытый ключ отправителя (65)
  return cat(salt, new Uint8Array([0, 0, 16, 0]), new Uint8Array([asPub.length]), asPub, ct);
}

// ── RFC 8292: подпись VAPID (JWT) для службы aud (https://web.push.apple.com и др.), живёт 12 часов. sub — https-адрес
// приложения
export async function vapidJwt(aud: string, pub: string, priv: string, sub: string, now = Date.now()): Promise<string> {
  const head = b64uEnc(te.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = b64uEnc(te.encode(JSON.stringify({ aud, exp: Math.floor(now / 1000) + 12 * 3600, sub })));
  const key = await crypto.subtle.importKey("jwk", ecJwk(priv, b64uDec(pub)), { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, te.encode(head + "." + claims)));
  return head + "." + claims + "." + b64uEnc(sig);
}
export async function vapidAuth(endpoint: string, pub: string, priv: string, sub: string, now = Date.now()): Promise<string> {
  return "vapid t=" + await vapidJwt(new URL(endpoint).origin, pub, priv, sub, now) + ", k=" + pub;
}

// Доп. 451: запас подписей { aud: { t, at, k } } — подпись берётся из запаса, если ключ тот же и ей меньше 6 часов
// (живёт 12); иначе новая, одна на службу даже при параллельной отправке. changed() — запас обновился (в базу)
export type Jwt = { t: string; at: number; k: string };
export const JWT_REUSE = 6 * 3600;
export function vapidCache(keys: { pub: string; priv: string }, sub: string, cache: Record<string, Jwt>, now = Date.now()) {
  const pending = new Map<string, Promise<string>>();
  const sec = Math.floor(now / 1000);
  let fresh = false;
  const get = async (endpoint: string): Promise<string> => {
    const aud = new URL(endpoint).origin;
    const c = cache[aud];
    if (c && c.k === keys.pub && typeof c.t === "string" && c.t.length > 20 && Number.isFinite(c.at) && sec - c.at >= 0 && sec - c.at < JWT_REUSE) {
      return "vapid t=" + c.t + ", k=" + keys.pub;
    }
    if (!pending.has(aud)) {
      pending.set(aud, vapidJwt(aud, keys.pub, keys.priv, sub, now).then((t) => { cache[aud] = { t, at: sec, k: keys.pub }; fresh = true; return t; }));
    }
    return "vapid t=" + await pending.get(aud) + ", k=" + keys.pub;
  };
  return { get, changed: () => fresh, cache };
}

// новые ключи VAPID: открытый — 65 байт (87 знаков), закрытый — d (43 знака)
export async function newKeys(): Promise<{ pub: string; priv: string }> {
  const kp = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]) as CryptoKeyPair;
  const jwk = await crypto.subtle.exportKey("jwk", kp.privateKey);
  return { pub: b64uEnc(await crypto.subtle.exportKey("raw", kp.publicKey)), priv: String(jwk.d || "") };
}

// кто отправитель в подписи: https-адрес приложения, иначе адрес Supabase (никогда не почта)
export function vapidSub(sub: unknown, base: string): string {
  const s = String(sub || "").trim();
  if (/^https:\/\/[^\s"<>]{3,200}$/.test(s)) return s.replace(/\/+$/, "");
  try { return new URL(base).origin; } catch (_e) { return "https://supabase.co"; }
}

// уведомление как его читает приложение (public/sw.js). u — куда нажимать кнопки (адрес этой функции с ?act=1)
export const ACTS = ["reply", "read", "cl", "ct", "cg"];
export function payloadOf(it: { t?: unknown; b?: unknown; go?: unknown; badge?: unknown; c?: unknown; a?: unknown; k?: unknown }, u = ""): string {
  const p: Record<string, unknown> = { t: String(it.t || "Service Academy").slice(0, 120), b: String(it.b || "").slice(0, 300) };
  const go = String(it.go || "");
  if (/^[A-Za-z0-9_.:-]{1,90}$/.test(go)) p.go = go;
  if (Number.isInteger(it.badge) && (it.badge as number) >= 0) p.badge = Math.min(it.badge as number, 9999);
  if (Number.isInteger(it.c) && (it.c as number) > 0 && (it.c as number) < 1e15) p.c = it.c;
  const acts = (Array.isArray(it.a) ? it.a : [])
    .filter((x: any) => x && ACTS.includes(String(x.a)) && String(x.t || "").trim())
    .slice(0, 2).map((x: any) => ({ a: String(x.a), t: String(x.t).trim().slice(0, 24) }));
  const k = String(it.k || "");
  if (acts.length && /^[0-9a-f]{64}$/.test(k) && /^https:\/\/[^\s"<>]{8,200}$/.test(u)) { p.a = acts; p.k = k; p.u = u; }
  return JSON.stringify(p);
}
// одна переписка — одно уведомление и у службы: Topic (пока телефон без сети, ждёт только последнее)
export const topicOf = (it: { c?: unknown }): string | undefined =>
  Number.isInteger(it.c) && (it.c as number) > 0 && (it.c as number) < 1e15 ? "c" + it.c : undefined;

type Sub = { id: number; emp: string; endpoint: string; p256dh: string; auth: string };
type Res = { id: number; ok?: boolean; gone?: boolean; code?: number; err?: string };

const reasonOf = (txt: string): string => {
  try { const j = JSON.parse(txt); if (j && typeof j.reason === "string") return j.reason; } catch (_e) { /* не JSON */ }
  return txt.replace(/\s+/g, " ").trim().slice(0, 120);
};

// opt.auth — подпись из запаса (vapidCache), opt.topic — заголовок Topic (одна переписка — одно уведомление)
export async function sendOne(s: Sub, payload: string, keys: { pub: string; priv: string }, sub: string, fetcher: typeof fetch = fetch,
  opt: { auth?: (endpoint: string) => Promise<string>; topic?: string } = {}): Promise<Res> {
  try {
    if (!/^https:\/\//.test(s.endpoint || "")) return { id: s.id, gone: true, err: "bad_endpoint" };
    const body = await encryptPush(s.p256dh, s.auth, payload);
    const headers: Record<string, string> = {
      Authorization: opt.auth ? await opt.auth(s.endpoint) : await vapidAuth(s.endpoint, keys.pub, keys.priv, sub),
      TTL: "86400", Urgency: "high", "Content-Encoding": "aes128gcm", "Content-Type": "application/octet-stream",
    };
    if (opt.topic && /^[A-Za-z0-9_-]{1,32}$/.test(opt.topic)) headers.Topic = opt.topic;
    const r = await fetcher(s.endpoint, { method: "POST", headers, body });
    if (r.status === 404 || r.status === 410) return { id: s.id, gone: true, code: r.status };
    if (r.ok) return { id: s.id, ok: true, code: r.status };
    return { id: s.id, ok: false, code: r.status, err: reasonOf(await r.text().catch(() => "")) || "ошибка" };
  } catch (e) {
    const m = String((e as Error)?.message || e);
    // ключи телефона испорчены — такую подписку не спасти
    if (m === "bad_keys") return { id: s.id, gone: true, err: m };
    return { id: s.id, ok: false, err: m.slice(0, 120) };
  }
}

async function pool<T, R>(xs: T[], n: number, f: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(xs.length);
  let i = 0;
  const run = async () => { while (i < xs.length) { const k = i++; out[k] = await f(xs[k]); } };
  await Promise.all(Array.from({ length: Math.min(n, xs.length) }, run));
  return out;
}

// Доп. 191: старые ключи — JWT (apikey + Bearer), новые sb_secret_… — только apikey
const isJwt = (k: string) => /^eyJ/.test(k || "");
const keyHeaders = (k: string): Record<string, string> => isJwt(k) ? { apikey: k, Authorization: "Bearer " + k } : { apikey: k };
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info" };

export async function handle(req: Request, env: { url?: string; service?: string }, fetcher: typeof fetch = fetch): Promise<Response> {
  const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (!env.url || !env.service) return json({ ok: false, error: "no_env" }, 500);
  const rpc = async (fn: string, args: unknown): Promise<{ status: number; data: any }> => {
    try {
      const r = await fetcher(`${env.url}/rest/v1/rpc/${fn}`, { method: "POST", headers: { ...keyHeaders(env.service!), "Content-Type": "application/json" }, body: JSON.stringify(args) });
      const t = await r.text();
      let data: any = null;
      try { data = JSON.parse(t); } catch (_e) { data = null; }
      return { status: r.status, data };
    } catch (_e) { return { status: 0, data: null }; }
  };

  if (req.method === "GET") {
    if (new URL(req.url).searchParams.get("init") !== "1") {
      return new Response("Service Academy: уведомления на телефон. Здесь ничего делать не нужно.\n", { headers: { ...CORS, "Content-Type": "text/plain; charset=utf-8" } });
    }
    const k = await newKeys();
    const r = await rpc("sa_push_keys", { p_pub: k.pub, p_priv: k.priv });
    if (r.status === 404) return json({ ok: false, error: "no_stage" });   // этапа 48 в базе ещё нет
    if (!r.data || !r.data.ok || !r.data.pub) return json({ ok: false, error: "keys" });
    return json({ ok: true, key: r.data.pub });
  }
  if (req.method !== "POST") return json({ ok: false, error: "method" }, 405);

  // Доп. 451: кнопка под уведомлением (сервис-воркер телефона): ключ уведомления — вместо секрета
  if (new URL(req.url).searchParams.get("act") === "1") {
    const b = await req.json().catch(() => null);
    const k = String((b && b.k) || ""), a = String((b && b.a) || "");
    const r = b && typeof b.r === "string" ? b.r.slice(0, 2000) : null;
    if (!/^[0-9a-f]{64}$/.test(k) || !ACTS.includes(a)) return json({ ok: false, error: "bad_request" }, 400);
    const x = await rpc("sa_push_act", { p_key: k, p_action: a, p_text: r });
    if (x.status === 404) return json({ ok: false, error: "no_stage" });
    const d = x.data && typeof x.data === "object" ? x.data : { ok: false, error: "act" };
    return json({ ok: !!d.ok, error: d.ok ? undefined : String(d.error || "act"), text: typeof d.text === "string" ? d.text : undefined,
      badge: Number.isInteger(d.badge) ? d.badge : undefined });
  }

  const secret = req.headers.get("x-sa-push") || "";
  if (!secret) return json({ ok: false, error: "secret" }, 401);
  const body = await req.json().catch(() => null);
  const items = (body && Array.isArray(body.items) ? body.items : [])
    .filter((x: any) => x && typeof x === "object" && typeof x.emp === "string" && x.emp).slice(0, 300);
  if (!items.length) return json({ ok: true, sent: 0, gone: 0, failed: 0 });
  const emps = [...new Set(items.map((x: any) => x.emp))];
  let take = await rpc("sa_push_take", { p_secret: secret, p_emps: emps });
  if (!take.data || !take.data.ok) {
    const e = (take.data && take.data.error) || "take";
    return json({ ok: false, error: e }, e === "secret" ? 403 : 500);
  }
  if (!take.data.pub || !take.data.priv) {   // ключей ещё нет: создать (в базу пишет первый)
    const k = await newKeys();
    await rpc("sa_push_keys", { p_pub: k.pub, p_priv: k.priv });
    take = await rpc("sa_push_take", { p_secret: secret, p_emps: emps });
    if (!take.data || !take.data.ok || !take.data.pub || !take.data.priv) return json({ ok: false, error: "keys" }, 500);
  }
  const keys = { pub: String(take.data.pub), priv: String(take.data.priv) };
  const sub = vapidSub(take.data.sub, env.url);
  const subs: Sub[] = Array.isArray(take.data.subs) ? take.data.subs : [];
  const jwt = take.data.jwt && typeof take.data.jwt === "object" && !Array.isArray(take.data.jwt) ? { ...take.data.jwt } : {};
  const vc = vapidCache(keys, sub, jwt);
  // куда нажимать кнопки: адрес Supabase из базы (его видит телефон), иначе тот, что у функции
  const base = /^https:\/\/[^\s"<>]{3,200}$/.test(String(take.data.url || "")) ? String(take.data.url) : env.url;
  const actUrl = base.replace(/\/+$/, "") + "/functions/v1/push-send?act=1";
  const jobs: [Sub, string, string | undefined][] = [];
  for (const it of items) for (const s of subs) if (s.emp === it.emp) jobs.push([s, payloadOf(it, actUrl), topicOf(it)]);
  const res = await pool(jobs, 8, ([s, p, tp]) => sendOne(s, p, keys, sub, fetcher, { auth: vc.get, topic: tp }));
  if (res.length || vc.changed()) await rpc("sa_push_done", { p_secret: secret, p_res: res, ...(vc.changed() ? { p_jwt: vc.cache } : {}) });
  return json({ ok: true, sent: res.filter((r) => r.ok).length, gone: res.filter((r) => r.gone).length, failed: res.filter((r) => !r.ok && !r.gone).length });
}

const D = (globalThis as any).Deno;
if (D && typeof D.serve === "function") {
  D.serve((req: Request) => handle(req, { url: D.env.get("SUPABASE_URL"), service: D.env.get("SUPABASE_SERVICE_ROLE_KEY") }));
}
