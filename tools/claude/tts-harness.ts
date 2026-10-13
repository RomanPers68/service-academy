// tools/claude/tts-harness.ts — v34: radio-tts без сети и Supabase (Bun): bun tools/claude/tts-harness.ts
// Прогон radio-tts без Supabase: подменяем Deno.env/Deno.serve и fetch
let handler: (req: Request) => Promise<Response>;
const env: Record<string, string> = {};
(globalThis as any).Deno = { env: { get: (k: string) => env[k] }, serve: (h: any) => { handler = h; } };
const calls: { url: string; body: any; headers: any }[] = [];
let script: Record<string, (url: string, init: any) => Response | Promise<Response>> = {};
(globalThis as any).fetch = async (url: string, init: any = {}) => {
  let body: any = init.body; try { body = typeof init.body === "string" ? JSON.parse(init.body) : init.body; } catch (e) {}
  calls.push({ url, body, headers: init.headers || {} });
  for (const [k, f] of Object.entries(script)) if (url.includes(k)) return f(url, init);
  return new Response("null", { status: 404 });
};
await import("../../supabase/functions/radio-tts/index.ts");
const post = async (body: any) => { const r = await handler(new Request("http://x/", { method: "POST", body: JSON.stringify(body) })); return { status: r.status, j: await r.json() }; };
const results: string[] = [];
const ok = (n: string, c: boolean, x = "") => results.push((c ? "✓ " : "✗ ") + n + (x ? " — " + x : ""));
const base = () => {
  calls.length = 0;
  script = {
    "/rpc/whoami": () => new Response(JSON.stringify({ ok: true, employee: { id: "e1", name: "Анна" } })),
    "/storage/v1/bucket/radio-voice": () => new Response("{}", { status: 200 }),
    "/rpc/sa_tts_take": () => new Response(JSON.stringify({ ok: true })),
    "/storage/v1/object/public/": () => new Response("", { status: 404 }),
    "/storage/v1/object/radio-voice/": () => new Response("{}", { status: 200 }),
    "openrouter.ai/api/v1/audio/speech": () => new Response(new Uint8Array(200).fill(7), { status: 200, headers: { "content-type": "audio/mpeg" } }),
    "api.openai.com/v1/audio/speech": () => new Response(new Uint8Array(300).fill(9), { status: 200, headers: { "content-type": "audio/mpeg" } }),
  };
};
Object.assign(env, { SUPABASE_URL: "https://sb", SUPABASE_SERVICE_ROLE_KEY: "eyJsvc", SUPABASE_ANON_KEY: "eyJanon" });

// 1) нет ключей
base();
let r = await post({ token: "t", probe: true });
ok("нет ключей — проба: нет голосов", r.j.ok && r.j.configured === false && r.j.talk === false, JSON.stringify(r.j));
r = await post({ token: "t", text: "Привет", who: "guest", talk: true });
ok("нет ключей — not_configured", r.j.ok === false && r.j.error === "not_configured");

// 2) только OpenRouter
env.OPENROUTER_API_KEY = "sk-or";
base();
r = await post({ token: "t", probe: true });
ok("OpenRouter — проба: радио и разговор есть", r.j.configured === true && r.j.talk === true && r.j.provider === "openrouter", JSON.stringify(r.j));
base();
r = await post({ token: "t", text: "Добрый вечер, у вас свободно?", who: "guest_f", talk: true });
const sp = calls.find((c) => c.url.includes("openrouter.ai/api/v1/audio/speech"));
ok("разговор: звук в ответе (data:audio/mpeg)", r.j.ok && /^data:audio\/mpeg;base64,/.test(r.j.audio), JSON.stringify(r.j).slice(0, 80));
ok("разговор: OpenRouter, модель gpt-4o-mini-tts, голос гостьи shimmer, манера", !!sp && sp.body.model === "openai/gpt-4o-mini-tts-2025-12-15" && sp.body.voice === "shimmer" && /Гостья/.test(sp.body.instructions) && sp.body.response_format === "mp3" && sp.headers.Authorization === "Bearer sk-or", JSON.stringify(sp && sp.body));
ok("разговор: лимит посчитан, в Storage не кладём", calls.some((c) => c.url.includes("sa_tts_take") && c.body.p_chars === 29) && !calls.some((c) => c.url.includes("/storage/v1/object/radio-voice/")));
// первая модель не найдена — запасная
base();
let n = 0;
script["openrouter.ai/api/v1/audio/speech"] = () => (++n === 1 ? new Response(JSON.stringify({ error: { message: "model not found" } }), { status: 404, headers: { "content-type": "application/json" } }) : new Response(new Uint8Array(200).fill(1), { headers: { "content-type": "audio/mpeg" } }));
r = await post({ token: "t", text: "Наставник отвечает", who: "mentor", talk: true });
const models = calls.filter((c) => c.url.includes("audio/speech")).map((c) => c.body.model);
ok("модель не найдена — берём запасную", r.j.ok && models.join(",") === "openai/gpt-4o-mini-tts-2025-12-15,openai/gpt-4o-mini-tts", models.join(","));
// ключ не принят — понятная ошибка, без перебора
base();
script["openrouter.ai/api/v1/audio/speech"] = () => new Response(JSON.stringify({ error: { message: "bad key" } }), { status: 401, headers: { "content-type": "application/json" } });
r = await post({ token: "t", text: "Раз", who: "guest", talk: true });
ok("401 — «проверь секрет OPENROUTER_API_KEY»", r.j.ok === false && /OPENROUTER_API_KEY/.test(r.j.detail || "") && calls.filter((c) => c.url.includes("audio/speech")).length === 1, JSON.stringify(r.j));
// кредиты кончились
base();
script["openrouter.ai/api/v1/audio/speech"] = () => new Response(JSON.stringify({ error: { message: "no credits" } }), { status: 402, headers: { "content-type": "application/json" } });
r = await post({ token: "t", text: "Раз", who: "guest", talk: true });
ok("402 — «закончились кредиты»", r.j.ok === false && /кредиты/.test(r.j.detail || ""), JSON.stringify(r.j));
// v34 (ревью): текст ошибки с «чужим» типом (text/plain) звуком не считаем; mp3 без типа — звук
base();
script["openrouter.ai/api/v1/audio/speech"] = () => new Response("Upstream error: model overloaded, try again later. ".repeat(3), { status: 200, headers: { "content-type": "text/plain" } });
r = await post({ token: "t", text: "Раз", who: "guest", talk: true });
ok("text/plain в ответ — не звук, ошибка провайдера", r.j.ok === false && r.j.error === "provider", JSON.stringify(r.j).slice(0, 160));
base();
script["openrouter.ai/api/v1/audio/speech"] = () => { const b = new Uint8Array(300); b[0] = 0x49; b[1] = 0x44; b[2] = 0x33; return new Response(b, { status: 200 }); };
r = await post({ token: "t", text: "Раз", who: "guest", talk: true });
ok("mp3 (ID3) без типа — звук", r.j.ok === true && /^data:audio\/mpeg;base64,/.test(r.j.audio || ""), JSON.stringify(r.j).slice(0, 80));
// радио через OpenRouter: в Storage, ссылка
base();
r = await post({ token: "t", text: "Радио в дорогу.", who: "host" });
ok("радио через OpenRouter — mp3 в корзину, ссылка", r.j.ok && /\/storage\/v1\/object\/public\/radio-voice\/v1\/nova\//.test(r.j.url) && calls.some((c) => c.url.includes("/storage/v1/object/radio-voice/")), JSON.stringify(r.j).slice(0, 120));
// лимит исчерпан
base();
script["/rpc/sa_tts_take"] = () => new Response(JSON.stringify({ ok: false, error: "limit", limit: 400 }));
r = await post({ token: "t", text: "Ещё", who: "guest", talk: true });
ok("лимит на сегодня — error: limit", r.j.ok === false && r.j.error === "limit", JSON.stringify(r.j));
// нет сессии
base();
script["/rpc/whoami"] = () => new Response(JSON.stringify({ ok: false }));
r = await post({ token: "t", text: "Ещё", who: "guest", talk: true });
ok("чужой — 401 auth", r.status === 401 && r.j.error === "auth");

// 3) есть ключ OpenAI — напрямую (как в v31)
env.OPENAI_API_KEY = "sk-oa";
base();
r = await post({ token: "t", text: "Радио в дорогу.", who: "host" });
const oa = calls.find((c) => c.url.includes("api.openai.com"));
ok("есть OPENAI_API_KEY — напрямую в OpenAI, модель gpt-4o-mini-tts", r.j.ok && !!oa && oa.body.model === "gpt-4o-mini-tts" && !calls.some((c) => c.url.includes("openrouter")), JSON.stringify(oa && oa.body).slice(0, 120));
env.TTS_PROVIDER = "openrouter";
base();
r = await post({ token: "t", text: "Радио.", who: "host", talk: true });
ok("TTS_PROVIDER=openrouter — OpenRouter даже при ключе OpenAI", r.j.ok && calls.some((c) => c.url.includes("openrouter.ai")) && !calls.some((c) => c.url.includes("api.openai.com")));
console.log(results.join("\n"));
const bad = results.filter((x) => x.startsWith("✗")).length;
console.log(`Итого: ${results.length - bad} из ${results.length}`);
