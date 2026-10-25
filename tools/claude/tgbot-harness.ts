// tools/claude/tgbot-harness.ts — v81: функция tg-bot без сети и Supabase (Bun): bun tools/claude/tgbot-harness.ts
// Подменяем Deno.env/Deno.serve и fetch: RPC sa_tg_update / sa_tg_setup_take и Bot API (getWebhookInfo, setWebhook).
let handler: (req: Request) => Promise<Response>;
const env: Record<string, string> = { SUPABASE_URL: "https://sb.example", SUPABASE_SERVICE_ROLE_KEY: "eyJsvc" };
(globalThis as any).Deno = { env: { get: (k: string) => env[k] }, serve: (h: any) => { handler = h; } };
const calls: { url: string; body: any; headers: any }[] = [];
let script: Record<string, (url: string, body: any) => Response> = {};
(globalThis as any).fetch = async (url: string, init: any = {}) => {
  let body: any = init.body; try { body = typeof init.body === "string" ? JSON.parse(init.body) : init.body; } catch (e) {}
  calls.push({ url, body, headers: init.headers || {} });
  for (const [k, f] of Object.entries(script)) if (url.includes(k)) return f(url, body);
  return new Response("null", { status: 404 });
};
await import("../../supabase/functions/tg-bot/index.ts");
const results: string[] = [];
const ok = (n: string, c: boolean, x = "") => results.push((c ? "✓ " : "✗ ") + n + (x ? " — " + x : ""));
const ME = "https://sb.example/functions/v1/tg-bot";
let hook = "";   // какой вебхук «стоит» у бота
const base = () => {
  calls.length = 0;
  script = {
    "/rpc/sa_tg_update": () => new Response(JSON.stringify({ ok: true })),
    "/rpc/sa_tg_setup_take": (_u, b) => new Response(JSON.stringify(b.p_code === "good" ? { ok: true, token: "123:SECRET", secret: "s3cr3t" } : { ok: false, error: "code" })),
    "/getWebhookInfo": () => new Response(JSON.stringify({ ok: true, result: { url: hook } })),
    "/setWebhook": (_u, b) => { hook = b.url; return new Response(JSON.stringify({ ok: true, result: true })); },
  };
};
const get = async (q: string) => { const r = await handler(new Request(ME + q)); return { status: r.status, t: await r.text(), ct: r.headers.get("content-type") || "" }; };
const post = async (body: any, headers: Record<string, string> = {}) => { const r = await handler(new Request(ME, { method: "POST", headers, body: JSON.stringify(body) })); return { status: r.status, t: await r.text() }; };

// ── нажатия
base();
let p = await post({ callback_query: { id: "1" } });
ok("POST без секрета — 200, в базу не идём", p.status === 200 && p.t === "ok" && !calls.length);
base();
const upd = { update_id: 5, callback_query: { id: "9", data: "qd:3:1", from: { id: 111 }, message: { message_id: 7, chat: { id: 111 } } } };
p = await post(upd, { "X-Telegram-Bot-Api-Secret-Token": "s3cr3t" });
const c = calls.find((x) => x.url.includes("/rpc/sa_tg_update"));
ok("POST с секретом — sa_tg_update с секретом и всем обновлением, сервисным ключом", p.status === 200 && !!c && c.body.p_secret === "s3cr3t" && c.body.p_update.callback_query.data === "qd:3:1" && c.headers.apikey === "eyJsvc" && c.headers.Authorization === "Bearer eyJsvc", JSON.stringify(c && c.body));
base(); script["/rpc/sa_tg_update"] = () => new Response("boom", { status: 500 });
p = await post(upd, { "X-Telegram-Bot-Api-Secret-Token": "s3cr3t" });
ok("база упала — Telegram всё равно получает 200 (иначе повторял бы нажатие)", p.status === 200 && p.t === "ok");
base();
const r0 = await handler(new Request(ME, { method: "POST", headers: { "X-Telegram-Bot-Api-Secret-Token": "s3cr3t" }, body: "не json" }));
ok("мусор вместо JSON — 200, в базу не идём", r0.status === 200 && !calls.some((x) => x.url.includes("/rpc/")));

// ── подключение
base();
let g = await get("");
ok("GET без кода — пояснение простым текстом", g.status === 200 && /^Бот Service Academy/.test(g.t) && /text\/plain/.test(g.ct) && !calls.length);
base();
g = await get("?setup=bad");
ok("неверный код — 400 и как получить новый", g.status === 400 && /select sa_tg_setup_code\(\);/.test(g.t) && !calls.some((x) => x.url.includes("api.telegram.org")));
base(); hook = "";
g = await get("?setup=good");
const sw = calls.find((x) => x.url.includes("/setWebhook"));
ok("вебхука нет — ставим свой: адрес функции, секрет, только нажатия и сообщения", g.status === 200 && /^Готово/.test(g.t) && !!sw && sw.body.url === ME && sw.body.secret_token === "s3cr3t" && JSON.stringify(sw.body.allowed_updates) === '["callback_query","message"]', JSON.stringify(sw && sw.body));
ok("код использован (p_use: true) после успешной установки", calls.filter((x) => x.url.includes("/rpc/sa_tg_setup_take")).map((x) => x.body.p_use).join() === "false,true");
ok("токен бота — только в адресе Bot API, не в ответе", !g.t.includes("123:SECRET") && calls.filter((x) => x.url.includes("api.telegram.org")).every((x) => x.url.includes("/bot123:SECRET/")));
base(); hook = ME;
g = await get("?setup=good");
ok("уже наш — ставим заново (тот же адрес, свежий секрет)", g.status === 200 && calls.some((x) => x.url.includes("/setWebhook")));
base(); hook = "https://other.example/bot";
g = await get("?setup=good");
ok("чужой вебхук — не трогаем, показываем адрес и ссылку с заменой", g.status === 409 && g.t.includes("https://other.example/bot") && g.t.includes(ME + "?setup=good&force=1") && !calls.some((x) => x.url.includes("/setWebhook")));
ok("код не использован, пока ничего не меняли", calls.filter((x) => x.url.includes("/rpc/sa_tg_setup_take")).every((x) => x.body.p_use === false));
base(); hook = "https://other.example/bot";
g = await get("?setup=good&force=1");
ok("с заменой — ставим свой, в ответе — какой адрес больше не получает события", g.status === 200 && hook === ME && g.t.includes("Прежний адрес https://other.example/bot"));
base(); script["/getWebhookInfo"] = () => new Response("bad", { status: 502 });
g = await get("?setup=good");
ok("Telegram не ответил — 502, ничего не ставим", g.status === 502 && !calls.some((x) => x.url.includes("/setWebhook")));
base(); hook = ""; script["/setWebhook"] = () => new Response(JSON.stringify({ ok: false, description: "Bad Request: bad webhook" }));
g = await get("?setup=good");
ok("Telegram не принял — его причина, код не использован", g.status === 502 && g.t.includes("bad webhook") && calls.filter((x) => x.url.includes("/rpc/sa_tg_setup_take")).length === 1);

console.log(results.join("\n"));
console.log("\n" + results.filter((r) => r.startsWith("✓")).length + " из " + results.length + " проверок прошли");
