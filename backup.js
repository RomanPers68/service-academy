// api/backup.js — Дополнение 125: скачивание резервной копии базы.
// GET /api/backup?t=<билет> → JSON-файл со всеми таблицами Supabase.
// Билет выдаёт SQL-функция backup_ticket(p_token) только владельцу (is_admin),
// живёт 3 минуты и гасится первым же скачиванием — в ссылке нет ни токена
// сессии, ни ключей. Ключи Vercel не нужны: обращение идёт anon-ключом Supabase
// к security definer-функции backup_take (см. supabase-stage10-backup.sql).

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  "https://gvxhgdynjuaisswplroh.supabase.co";
const SUPABASE_KEY =
  process.env.SUPABASE_KEY ||
  process.env.VITE_SUPABASE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2eGhnZHluanVhaXNzd3Bscm9oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4NjA1ODgsImV4cCI6MjA5NjQzNjU4OH0._4aLd4eb7cSfcqS9EvSwChJR-SixW2tsgn4ksCM5S3g";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).send("Только GET");
  const t = String((req.query && req.query.t) || "");
  if (!/^[0-9a-f]{64}$/.test(t)) return res.status(400).send("Нет билета на скачивание — нажми «Скачать копию» в приложении");

  let data;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/backup_take`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ p_ticket: t }),
    });
    data = await r.json();
    if (!r.ok) {
      const msg = (data && (data.message || data.hint)) || ("HTTP " + r.status);
      return res.status(502).send("Supabase не ответил: " + msg + (/backup_take/.test(msg) ? " — примени supabase-stage10-backup.sql" : ""));
    }
  } catch (e) {
    return res.status(502).send("Нет связи с Supabase: " + (e && e.message ? e.message : "unknown"));
  }
  if (!data || data.ok !== true) {
    return res.status(403).send("Билет недействителен или истёк (3 минуты, одно скачивание) — нажми «Скачать копию» ещё раз");
  }

  const stamp = new Date().toISOString().slice(0, 16).replace("T", "_").replace(":", "-");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="service-academy-backup-${stamp}.json"`);
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).send(JSON.stringify(data, null, 1));
}
