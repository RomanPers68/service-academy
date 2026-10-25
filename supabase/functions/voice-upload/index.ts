// Service Academy — voice-upload: голос шефа и сомелье к блюду (v80, Дополнение 393).
//
// POST { token, restaurant, dishId, kind, audio } → { ok, url }
//   kind  — chef (шеф о блюде) | som (сомелье: что налить к блюду)
//   audio — data:audio/mp4;base64,… (iPhone пишет AAC) или data:audio/wav;base64,… (Android: телефон сам
//           переводит запись в WAV 16 кГц — его играют все телефоны); до 3 МБ, это около минуты
// POST { token, restaurant, sweep: true } → { ok, kept, removed } — уборка: файлы заведения, на которые больше
//   не ссылается опубликованное меню (перезаписали или убрали запись) и которым больше 14 дней, удаляются.
//   Приложение зовёт её после публикации меню. 14 дней — запас: запись могли сохранить в блюдо на телефоне
//   и ещё не опубликовать.
//
// Права — как у фото блюда (photo-upload): живая сессия (whoami) + менеджер, старший или владелец.
// Пишет сервисным ключом (SUPABASE_SERVICE_ROLE_KEY даётся Edge Functions автоматически).
// Корзина menu-voice — этап 30 (supabase-stage30-voice.sql).
// Деплой: Supabase → Edge Functions → Deploy a new function → Via Editor → имя voice-upload → вставить код → Deploy.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const BUCKET = "menu-voice";
const MAX_BYTES = 3 * 1024 * 1024;
const KINDS = ["chef", "som"];
const KEEP_DAYS = 14;
const TYPES: Record<string, string> = { "audio/mp4": "m4a", "audio/x-m4a": "m4a", "audio/aac": "m4a", "audio/wav": "wav", "audio/x-wav": "wav", "audio/wave": "wav", "audio/mpeg": "mp3" };
const CT: Record<string, string> = { m4a: "audio/mp4", wav: "audio/wav", mp3: "audio/mpeg" };

const TR: Record<string, string> = { а:"a",б:"b",в:"v",г:"g",д:"d",е:"e",ё:"e",ж:"zh",з:"z",и:"i",й:"y",к:"k",л:"l",м:"m",н:"n",о:"o",п:"p",р:"r",с:"s",т:"t",у:"u",ф:"f",х:"h",ц:"c",ч:"ch",ш:"sh",щ:"sch",ъ:"",ы:"y",ь:"",э:"e",ю:"yu",я:"ya" };
const slug = (s: string) => (s || "x").toLowerCase().split("").map(ch => TR[ch] ?? ch).join("")
  .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "x";

// Доп. 191: старые ключи — JWT (apikey + Bearer), новые sb_secret_… — только apikey
const isJwt = (k: string) => /^eyJ/.test(k || "");
const keyHeaders = (k: string): Record<string, string> => isJwt(k) ? { apikey: k, Authorization: "Bearer " + k } : { apikey: k };


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "method" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anon = Deno.env.get("SUPABASE_ANON_KEY");
    if (!url || !service) return json({ ok: false, error: "no_env" }, 500);

    const body = await req.json().catch(() => null);
    const token = String(body?.token || "");
    const restaurant = String(body?.restaurant || "");
    if (!token || !restaurant) return json({ ok: false, error: "bad_request" }, 400);

    // Кто это и можно ли ему править меню
    const who = await fetch(`${url}/rest/v1/rpc/whoami`, {
      method: "POST",
      headers: { ...keyHeaders(anon || service), "Content-Type": "application/json" },
      body: JSON.stringify({ p_token: token }),
    }).then(r => r.json()).catch(() => null);
    const emp = who && who.ok ? who.employee : null;
    if (!emp) return json({ ok: false, error: "auth" }, 401);
    const allowed = !!emp.is_admin || ["manager", "senior"].includes(String(emp.position || ""));
    if (!allowed) return json({ ok: false, error: "forbidden" }, 403);

    const folder = slug(restaurant);

    // Уборка: что лежит в папке заведения и на что ссылается опубликованное меню
    if (body?.sweep) {
      const menu = await fetch(`${url}/rest/v1/rpc/menu_get`, {
        method: "POST",
        headers: { ...keyHeaders(anon || service), "Content-Type": "application/json" },
        body: JSON.stringify({ p_restaurant: restaurant }),
      }).then(r => r.ok ? r.text() : "").catch(() => "");
      if (!menu) return json({ ok: false, error: "menu" }, 502);   // меню не прочиталось — ничего не трогаем
      const used = new Set<string>();
      const re = new RegExp(`/storage/v1/object/public/${BUCKET}/([^"?\\\\]+)`, "g");
      for (const m of menu.matchAll(re)) used.add(decodeURIComponent(m[1]));
      const ls = await fetch(`${url}/storage/v1/object/list/${BUCKET}`, {
        method: "POST",
        headers: { ...keyHeaders(service), "Content-Type": "application/json" },
        body: JSON.stringify({ prefix: folder, limit: 1000, offset: 0 }),   // имена — относительно папки заведения
      }).then(r => r.ok ? r.json() : null).catch(() => null);
      if (!Array.isArray(ls)) return json({ ok: false, error: "storage" }, 502);
      const old = Date.now() - KEEP_DAYS * 864e5;
      const drop = ls.filter((o: any) => o && o.id && o.name && !used.has(`${folder}/${o.name}`) && Date.parse(o.created_at || o.updated_at || "") < old)
        .map((o: any) => `${folder}/${o.name}`);
      if (drop.length) {
        const del = await fetch(`${url}/storage/v1/object/${BUCKET}`, {
          method: "DELETE",
          headers: { ...keyHeaders(service), "Content-Type": "application/json" },
          body: JSON.stringify({ prefixes: drop }),
        }).catch(() => null);
        if (!del || !del.ok) return json({ ok: false, error: "storage", detail: del ? "HTTP " + del.status : "сеть" }, 502);
      }
      return json({ ok: true, kept: ls.length - drop.length, removed: drop.length });
    }

    const dishId = String(body?.dishId || "");
    const kind = String(body?.kind || "");
    const audio = String(body?.audio || "");
    const m = audio.match(/^data:(audio\/[a-z0-9.+-]+)(?:;[^,]*)?;base64,(.+)$/i);
    if (!dishId || !KINDS.includes(kind) || !m) return json({ ok: false, error: "bad_request" }, 400);
    const ext = TYPES[m[1].toLowerCase()];
    if (!ext) return json({ ok: false, error: "bad_type", detail: m[1] }, 415);

    const bytes = Uint8Array.from(atob(m[2]), c => c.charCodeAt(0));
    if (bytes.length > MAX_BYTES) return json({ ok: false, error: "too_large" }, 413);
    if (bytes.length < 1000) return json({ ok: false, error: "too_short" }, 400);
    const path = `${folder}/${slug(dishId)}-${kind}-${Date.now()}.${ext}`;

    const up = await fetch(`${url}/storage/v1/object/${BUCKET}/${path}`, {
      method: "POST",
      headers: { ...keyHeaders(service), "Content-Type": CT[ext], "x-upsert": "true", "cache-control": "public, max-age=31536000" },
      body: bytes,
    });
    if (!up.ok) {
      const t = await up.text().catch(() => "");
      console.error("voice-upload storage", up.status, t.slice(0, 300));
      let msg = t.slice(0, 220);
      try { const j = JSON.parse(t); msg = [j.error, j.message, j.statusCode].filter(Boolean).join(" · ").slice(0, 220) || msg; } catch (e) {}
      return json({ ok: false, error: "storage", status: up.status, detail: `HTTP ${up.status}: ${msg}` }, 502);
    }
    return json({ ok: true, url: `${url}/storage/v1/object/public/${BUCKET}/${path}` });
  } catch (e) {
    return json({ ok: false, error: "server", detail: String((e as any)?.message || e) }, 500);
  }
});
