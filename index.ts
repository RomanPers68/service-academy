// Service Academy — photo-upload: фото блюда в Storage (Дополнение 135).
// POST { token, restaurant, dishId, image } → { ok, url }.
// image — data:image/jpeg;base64,… (уже сжато на телефоне до ~400 КБ).
// Права: живая сессия (whoami) + менеджер/старший/владелец — как у редактора меню.
// Пишет сервисным ключом (SUPABASE_SERVICE_ROLE_KEY даётся Edge Functions автоматически).
// Деплой: Supabase → Edge Functions → Deploy a new function → Via Editor → имя photo-upload.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const TR: Record<string, string> = { а:"a",б:"b",в:"v",г:"g",д:"d",е:"e",ё:"e",ж:"zh",з:"z",и:"i",й:"y",к:"k",л:"l",м:"m",н:"n",о:"o",п:"p",р:"r",с:"s",т:"t",у:"u",ф:"f",х:"h",ц:"c",ч:"ch",ш:"sh",щ:"sch",ъ:"",ы:"y",ь:"",э:"e",ю:"yu",я:"ya" };
// Ключ объекта в Storage — только латиница, цифры и дефис: «Океан» → okean
// Доп. 191: у Supabase два формата ключей. Старые — JWT (eyJ…): apikey + Authorization Bearer.
// Новые (sb_secret_… / sb_publishable_…) — только apikey; в Bearer их класть нельзя
// («Invalid Compact JWS» — журнал функции 06.09).
const isJwt = (k: string) => /^eyJ/.test(k || "");
const keyHeaders = (k: string): Record<string, string> => isJwt(k) ? { apikey: k, Authorization: "Bearer " + k } : { apikey: k };

const slug = (s: string) => (s || "x").toLowerCase().split("").map(ch => TR[ch] ?? ch).join("")
  .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "x";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anon = Deno.env.get("SUPABASE_ANON_KEY");
    if (!url || !service) return json({ ok: false, error: "no_env" }, 500);

    const body = await req.json();
    const token = String(body?.token || "");
    const restaurant = String(body?.restaurant || "");
    const dishId = String(body?.dishId || "");
    const image = String(body?.image || "");
    const m = image.match(/^data:(image\/(jpeg|png|webp));base64,(.+)$/);
    if (!token || !restaurant || !dishId || !m) return json({ ok: false, error: "bad_request" }, 400);

    // Кто это и можно ли ему редактировать меню
    const who = await fetch(`${url}/rest/v1/rpc/whoami`, {
      method: "POST",
      headers: { ...keyHeaders(anon || service), "Content-Type": "application/json" },
      body: JSON.stringify({ p_token: token }),
    }).then(r => r.json()).catch(() => null);
    const emp = who && who.ok ? who.employee : null;
    if (!emp) return json({ ok: false, error: "auth" }, 401);
    const allowed = !!emp.is_admin || ["manager", "senior"].includes(String(emp.position || ""));
    if (!allowed) return json({ ok: false, error: "forbidden" }, 403);

    const bytes = Uint8Array.from(atob(m[3]), c => c.charCodeAt(0));
    if (bytes.length > 2 * 1024 * 1024) return json({ ok: false, error: "too_large" }, 413);
    const ext = m[2] === "jpeg" ? "jpg" : m[2];
    const path = `${slug(restaurant)}/${slug(dishId)}-${Date.now()}.${ext}`;

    const up = await fetch(`${url}/storage/v1/object/menu-photos/${path}`, {
      method: "POST",
      headers: { ...keyHeaders(service), "Content-Type": m[1], "x-upsert": "true", "cache-control": "public, max-age=31536000" },
      body: bytes,
    });
    if (!up.ok) {
      const t = await up.text().catch(() => "");
      console.error("photo-upload storage", up.status, t.slice(0, 300));
      // Доп. 190: отдаём текст ответа хранилища как есть — по нему видно настоящую причину
      let msg = t.slice(0, 220);
      try { const j = JSON.parse(t); msg = [j.error, j.message, j.statusCode].filter(Boolean).join(" · ").slice(0, 220) || msg; } catch (e) {}
      return json({ ok: false, error: "storage", status: up.status, detail: `HTTP ${up.status}: ${msg}`, path }, 502);
    }
    return json({ ok: true, url: `${url}/storage/v1/object/public/menu-photos/${path}` });
  } catch (e) {
    return json({ ok: false, error: "server", detail: String((e as any)?.message || e) }, 500);
  }
});
