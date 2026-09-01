// ─────────────────────────────────────────────────────────────────────
// Service Academy · shift-reminder — «Завтра смена» в Telegram.
// Читает живой график (schedule_venues + schedule_months), находит, у кого
// завтра смена, сопоставляет с профилями (токен-движок имён, как в
// приложении) и шлёт каждому личное сообщение с кнопкой в Академию.
// Секреты (Edge Functions → Secrets): TG_BOT_TOKEN, APP_URL,
//   TZ_OFFSET_HOURS (часовой пояс заведения, по умолчанию 3 = Москва).
// Запуск: по расписанию (см. telegram-reminders.sql) или вручную.
// ─────────────────────────────────────────────────────────────────────
// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";

const norm = (x: any) => String(x || "").toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ").trim();
const toks = (x: any) => new Set(norm(x).split(" ").filter(Boolean));
const allIn = (a: Set<string>, b: Set<string>) => [...a].every(w => b.has(w));

Deno.serve(async (req) => {
  const botToken = Deno.env.get("TG_BOT_TOKEN");
  const appUrl = Deno.env.get("APP_URL") || "";
  const tz = Number(Deno.env.get("TZ_OFFSET_HOURS") ?? "3");
  if (!botToken) return new Response("TG_BOT_TOKEN не задан", { status: 500 });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // «Завтра» в часовом поясе заведения
  const now = new Date(Date.now() + tz * 3600 * 1000);
  const tmr = new Date(now); tmr.setUTCDate(tmr.getUTCDate() + 1);
  const Y = tmr.getUTCFullYear(), M = tmr.getUTCMonth(), D = tmr.getUTCDate();
  const mkey = `${Y}-${String(M + 1).padStart(2, "0")}`;
  const dry = new URL(req.url).searchParams.get("dry") === "1";

  const { data: venues, error: e1 } = await sb.from("schedule_venues").select("restaurant, venue_key, config");
  if (e1) return new Response("venues: " + e1.message, { status: 500 });
  const { data: months, error: e2 } = await sb.from("schedule_months").select("restaurant, venue_key, payload").eq("month", mkey);
  if (e2) return new Response("months: " + e2.message, { status: 500 });
  const { data: profiles, error: e3 } = await sb.from("profiles").select("name, surname, restaurant, tg_chat_id").not("tg_chat_id", "is", null);
  if (e3) return new Response("profiles: " + e3.message, { status: 500 });

  const out: any[] = [];
  for (const v of venues ?? []) {
    const m = (months ?? []).find(x => x.restaurant === v.restaurant && x.venue_key === v.venue_key);
    if (!m) continue;
    const cfg = v.config || {}, plan = (m.payload || {}).plan || {}, days = (m.payload || {}).days || {};
    const shifts: any[] = cfg.shifts || [];
    const note = days[D] && days[D].note;
    for (const st of (cfg.staff || [])) {
      if (st.till && mkey > st.till) continue;              // закрыт месяцем
      const k = (plan[st.id] || {})[D];
      const sh = k && shifts.find((q: any) => q.k === k);
      if (!sh) continue;
      const stT = toks(st.name);
      const cands = (profiles ?? []).filter(p => p.restaurant === v.restaurant && (() => {
        const pt = toks((p.name || "") + " " + (p.surname || ""));
        return pt.size && stT.size && (allIn(pt, stT) || allIn(stT, pt));
      })());
      const prof = cands.find(p => toks((p.name || "") + " " + (p.surname || "")).size === stT.size) || (cands.length === 1 ? cands[0] : null);
      if (!prof) continue;
      const when = `${sh.from}:00–${sh.to === 24 ? "24" : sh.to}:00`;
      const text = `✦ SERVICE ACADEMY\n\nЗавтра смена: ${sh.name} · ${when}${note ? `\n✎ ${note}` : ""}\n\nПовтори, что подзабыл, и хорошей смены ✦`;
      out.push({ chat_id: prof.tg_chat_id, name: st.name, text });
    }
  }

  let sent = 0;
  if (!dry) for (const o of out) {
    try {
      const r = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: o.chat_id, text: o.text,
          reply_markup: appUrl ? { inline_keyboard: [[{ text: "Открыть график ✦", url: appUrl }]] } : undefined }),
      });
      if (r.ok) sent++;
    } catch (_e) { /* один чат не ломает рассылку */ }
  }
  return new Response(JSON.stringify({ ok: true, date: `${Y}-${M + 1}-${D}`, planned: out.length, sent, dry, preview: out.slice(0, 5).map(o => o.name) }),
    { headers: { "Content-Type": "application/json" } });
});
