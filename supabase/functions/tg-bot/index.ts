// Service Academy — tg-bot: вебхук бота для «Вопроса дня» (v81, Дополнение 394).
//
// POST от Telegram (нажатие кнопки, /start, /smena, ответ на сообщение) → RPC sa_tg_update (этапы 31, 38, 39): ответ
//   записывается, сообщение дополняется итогом. Запрос принимается, только если в заголовке X-Telegram-Bot-Api-Secret-Token
//   тот секрет, который сервер выдал при подключении (проверяет sa_tg_update). Telegram всегда получает 200, иначе он
//   повторял бы одно и то же нажатие.
// GET ?setup=<код> → подключить вебхук. Код даёт приложение («Команда» → «Сервер» → «Подключить бота», этап 39) или SQL:
//   select sa_tg_setup_code(); (30 минут). Функция по коду берёт токен бота и секрет (sa_tg_setup_take), спрашивает у
//   Telegram, какой вебхук стоит сейчас, и:
//     • пусто или уже наш — ставит наш (с секретом, только нажатия и сообщения);
//     • стоит чужой — ничего не трогает и показывает его адрес; заменить — та же ссылка с &force=1.
//   v99 (Доп. 412): заодно — то, чего у бота ещё нет: кнопка «Академия» у поля ввода (открывает приложение; адрес — из
//   настроек, app_url) и список команд (/smena, /start). Если в BotFather это уже настроено — не трогает.
//   Токен бота в ответ и в журнал не попадает.
//
// Деплой: Supabase → Edge Functions → Deploy a new function → Via Editor → имя tg-bot → вставить код → Deploy.
// ВАЖНО: у функции выключить проверку JWT (Details → «Enforce JWT verification» / «Verify JWT» — выкл.),
// иначе Telegram получит 401: он не присылает ключ Supabase. CLI: supabase functions deploy tg-bot --no-verify-jwt
// Секреты не нужны: адрес базы и сервисный ключ функция получает сама, токен бота — из Vault (этап 22б).

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
// Ответ человеку — простым текстом: HTML с адреса функций Supabase показывает как текст (защита от фишинга)
const page = (title: string, text: string, status = 200) =>
  new Response(title + "\n\n" + text + "\n", { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });

// Доп. 191: старые ключи — JWT (apikey + Bearer), новые sb_secret_… — только apikey
const isJwt = (k: string) => /^eyJ/.test(k || "");
const keyHeaders = (k: string): Record<string, string> => isJwt(k) ? { apikey: k, Authorization: "Bearer " + k } : { apikey: k };

// v99: команды бота (если их ещё нет) и кнопка у поля ввода
const COMMANDS = [
  { command: "smena", description: "Мои ближайшие смены" },
  { command: "start", description: "Что приходит от бота" },
];
const MENU_TEXT = "Академия";
const appUrlOk = (u: string) => /^https:\/\/[^\s"<>]{4,200}$/.test(u || "");

Deno.serve(async (req) => {
  const url = Deno.env.get("SUPABASE_URL");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !service) return json({ ok: false, error: "no_env" }, 500);
  const rpc = (fn: string, args: unknown) => fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: "POST", headers: { ...keyHeaders(service), "Content-Type": "application/json" }, body: JSON.stringify(args),
  });

  // ── Telegram: нажатие кнопки или сообщение боту
  if (req.method === "POST") {
    const secret = req.headers.get("x-telegram-bot-api-secret-token") || "";
    if (!secret) return new Response("ok");   // не Telegram — молча
    const update = await req.json().catch(() => null);
    if (update && typeof update === "object") {
      try {
        const r = await rpc("sa_tg_update", { p_secret: secret, p_update: update });
        if (!r.ok) console.error("tg-bot sa_tg_update", r.status, (await r.text().catch(() => "")).slice(0, 300));
      } catch (e) { console.error("tg-bot", String((e as any)?.message || e)); }
    }
    return new Response("ok");
  }

  if (req.method !== "GET") return new Response("ok");
  const q = new URL(req.url).searchParams;
  const code = (q.get("setup") || "").trim();
  if (!code) return page("Бот Service Academy", "Это адрес, на который Telegram присылает нажатия кнопок бота. Здесь ничего делать не нужно.");

  // ── Подключение вебхука по одноразовому коду
  const force = q.get("force") === "1";
  const take = async (use: boolean) => {
    const r = await rpc("sa_tg_setup_take", { p_code: code, p_use: use }).catch(() => null);
    return r && r.ok ? await r.json().catch(() => null) : null;
  };
  const t = await take(false);
  if (!t || !t.ok) {
    return page("Код не подошёл", "Код неверный или старше 30 минут. В приложении: «Команда» → «Сервер» → «Подключить бота». Или в SQL Editor выполни select sa_tg_setup_code(); и открой новую ссылку.\n" +
      "Если SQL пишет, что такой функции нет, сначала запусти supabase-stage31-qday.sql.", 400);
  }
  if (!t.token) return page("Нет токена бота", "В Vault нет токена бота (этап 22б): select vault.create_secret('ТОКЕН', 'sa_tg_bot_token');", 400);
  if (!t.secret) return page("Нет секрета", "Выполни select sa_tg_setup_code(); ещё раз: он создаст секрет вебхука.", 400);
  const tg = async (method: string, body: unknown) => {
    try {
      const r = await fetch(`https://api.telegram.org/bot${t.token}/${method}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      return await r.json().catch(() => null);
    } catch (_e) { return null; }
  };
  const me = `${url.replace(/\/+$/, "")}/functions/v1/tg-bot`;
  const info = await tg("getWebhookInfo", {});
  if (!info || !info.ok) return page("Telegram не ответил", "Не получилось спросить Telegram, какой вебхук стоит сейчас. Попробуй ещё раз через минуту.", 502);
  const cur = String(info.result?.url || "");
  if (cur && cur !== me && !force) {
    return page("У бота уже есть другой вебхук", `Сейчас Telegram отправляет события бота сюда:\n${cur}\n\n` +
      "Я его не трогаю: возможно, бот отвечает через другой сервис. Если этот адрес не нужен и кнопки «Вопроса дня» должны работать, " +
      `открой ту же ссылку с заменой (код живёт 30 минут):\n${me}?setup=${encodeURIComponent(code)}&force=1`, 409);
  }
  const set = await tg("setWebhook", { url: me, secret_token: t.secret, allowed_updates: ["callback_query", "message"], drop_pending_updates: false });
  if (!set || !set.ok) return page("Telegram не принял вебхук", String(set?.description || "нет ответа"), 502);
  await take(true);   // код использован

  // v99: кнопка «Академия» у поля ввода и команды — только если их ещё нет (настроенное в BotFather не трогаем)
  const lines: string[] = [];
  const app = String(t.app || "").trim().replace(/\/+$/, "");
  const mb = await tg("getChatMenuButton", {});
  const mbType = String(mb?.result?.type || "");
  if (mbType === "web_app") lines.push("Кнопка у поля ввода уже открывает приложение: не трогаю.");
  else if (!appUrlOk(app)) lines.push("Кнопку «" + MENU_TEXT + "» у поля ввода не поставил: нет адреса приложения. В приложении: «Команда» → «Сервер» → «Подключить бота».");
  else {
    const r = await tg("setChatMenuButton", { menu_button: { type: "web_app", text: MENU_TEXT, web_app: { url: app + "/" } } });
    lines.push(r && r.ok ? "Кнопка «" + MENU_TEXT + "» у поля ввода открывает приложение." : "Кнопку у поля ввода Telegram не принял: " + String(r?.description || "нет ответа"));
  }
  const cm = await tg("getMyCommands", {});
  if (cm && cm.ok && Array.isArray(cm.result) && cm.result.length) lines.push("Список команд уже настроен: не трогаю (/smena работает и так).");
  else {
    const r = await tg("setMyCommands", { commands: COMMANDS });
    lines.push(r && r.ok ? "Команды: /smena (ближайшие смены) и /start (что приходит от бота)." : "Команды Telegram не принял: " + String(r?.description || "нет ответа"));
  }

  return page("Готово", `Бот подключён: нажатия кнопок и ответы в чат приходят сюда:\n${me}\n\n` +
    (cur && cur !== me ? `Прежний адрес ${cur} больше не получает события.\n\n` : "") +
    lines.join("\n") + "\n\n" +
    "Проверить можно в Telegram: напиши боту /start, он ответит и покажет кнопку в приложение; /smena покажет твои смены.");
});
