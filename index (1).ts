// Service Academy - shift-reminder: "Завтра смена" в Telegram
// Секреты: TG_BOT_TOKEN, APP_URL, TZ_OFFSET_HOURS (по умолчанию 3 = Москва)
import { createClient } from "npm:@supabase/supabase-js@2";

function norm(x) {
  return String(x || "").toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ").trim();
}
function toks(x) {
  return new Set(norm(x).split(" ").filter(Boolean));
}
function allIn(a, b) {
  for (const w of a) {
    if (!b.has(w)) return false;
  }
  return true;
}
function sameSize(a, b) {
  return a.size === b.size;
}

Deno.serve(async (req) => {
  const botToken = Deno.env.get("TG_BOT_TOKEN");
  const appUrl = Deno.env.get("APP_URL") || "";
  const tz = Number(Deno.env.get("TZ_OFFSET_HOURS") || "3");
  if (!botToken) {
    return new Response("TG_BOT_TOKEN не задан", { status: 500 });
  }
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const sb = createClient(url, key);

  // Завтра в часовом поясе заведения
  const now = new Date(Date.now() + tz * 3600 * 1000);
  const tmr = new Date(now);
  tmr.setUTCDate(tmr.getUTCDate() + 1);
  const Y = tmr.getUTCFullYear();
  const M = tmr.getUTCMonth();
  const D = tmr.getUTCDate();
  const mkey = Y + "-" + String(M + 1).padStart(2, "0");
  const dry = new URL(req.url).searchParams.get("dry") === "1";

  const venues = await sb.from("schedule_venues").select("restaurant, venue_key, config");
  if (venues.error) {
    return new Response("venues: " + venues.error.message, { status: 500 });
  }
  const months = await sb.from("schedule_months").select("restaurant, venue_key, payload").eq("month", mkey);
  if (months.error) {
    return new Response("months: " + months.error.message, { status: 500 });
  }
  const profiles = await sb.from("profiles").select("name, surname, restaurant, tg_chat_id").not("tg_chat_id", "is", null);
  if (profiles.error) {
    return new Response("profiles: " + profiles.error.message, { status: 500 });
  }

  const out = [];
  for (const v of venues.data || []) {
    const m = (months.data || []).find((x) => x.restaurant === v.restaurant && x.venue_key === v.venue_key);
    if (!m) continue;
    const cfg = v.config || {};
    const plan = (m.payload || {}).plan || {};
    const days = (m.payload || {}).days || {};
    const shifts = cfg.shifts || [];
    const note = days[D] && days[D].note;
    for (const st of cfg.staff || []) {
      if (st.till && mkey > st.till) continue;
      const k = (plan[st.id] || {})[D];
      const sh = k && shifts.find((q) => q.k === k);
      if (!sh) continue;
      const stT = toks(st.name);
      const cands = [];
      for (const p of profiles.data || []) {
        if (p.restaurant !== v.restaurant) continue;
        const pt = toks((p.name || "") + " " + (p.surname || ""));
        if (!pt.size || !stT.size) continue;
        if (allIn(pt, stT) || allIn(stT, pt)) cands.push({ p, pt });
      }
      let prof = null;
      const exact = cands.find((c) => sameSize(c.pt, stT));
      if (exact) prof = exact.p;
      else if (cands.length === 1) prof = cands[0].p;
      if (!prof) continue;
      const to = sh.to === 24 ? "24" : String(sh.to);
      const when = sh.from + ":00–" + to + ":00";
      let text = "✦ SERVICE ACADEMY\n\nЗавтра смена: " + sh.name + " · " + when;
      if (note) text += "\n✎ " + note;
      text += "\n\nПовтори, что подзабыл, и хорошей смены ✦";
      out.push({ chat_id: prof.tg_chat_id, name: st.name, text });
    }
  }

  let sent = 0;
  if (!dry) {
    for (const o of out) {
      try {
        const body = { chat_id: o.chat_id, text: o.text };
        if (appUrl) {
          // web_app — кнопка открывает мини-апп внутри Telegram, а не браузер
          body.reply_markup = { inline_keyboard: [[{ text: "Открыть график ✦", web_app: { url: appUrl } }]] };
        }
        const r = await fetch("https://api.telegram.org/bot" + botToken + "/sendMessage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (r.ok) sent++;
      } catch (_e) {
        // один чат не ломает рассылку
      }
    }
  }
  const result = {
    ok: true,
    date: Y + "-" + (M + 1) + "-" + D,
    planned: out.length,
    sent,
    dry,
    preview: out.slice(0, 5).map((o) => o.name),
  };
  return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json" } });
});
