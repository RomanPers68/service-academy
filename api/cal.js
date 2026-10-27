// api/cal.js — v99 (Доп. 412): смены в календаре телефона.
// GET /api/cal?k=<ключ>        → файл календаря (text/calendar): смены человека за месяц назад и два вперёд. Календарь
//                                телефона забирает его сам раз в несколько часов и обновляет смены, когда меняется график.
// GET /api/cal?k=<ключ>&page=1 → страница «Добавить в календарь» для браузера (webcal-ссылка и как в Google Календарь).
// Ключ — личная ссылка из приложения (этап 39, cal_key); сам файл отдаёт security definer-функция cal_feed по ключу,
// поэтому здесь только anon-ключ Supabase, как у резервной копии (api/backup.js). Уволен или ссылку сбросили — 404.
import { buildIcs, calPage } from "../lib/ical.js";

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  "https://gvxhgdynjuaisswplroh.supabase.co";
const SUPABASE_KEY =
  process.env.SUPABASE_KEY ||
  process.env.VITE_SUPABASE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2eGhnZHluanVhaXNzd3Bscm9oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4NjA1ODgsImV4cCI6MjA5NjQzNjU4OH0._4aLd4eb7cSfcqS9EvSwChJR-SixW2tsgn4ksCM5S3g";

const MON = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const WD = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];
// «пт, 30 октября · вечер 16:00–24:00» — для списка «Ближайшие» на странице
const line = (s) => { const [y, m, d] = String(s.date).split("-").map(Number); const dt = new Date(Date.UTC(y, m - 1, d)); return WD[dt.getUTCDay()] + ", " + d + " " + MON[m - 1] + " · " + String(s.label || "").toLowerCase() + " " + (s.time || ""); };

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") return res.status(405).send("Только GET");
  const k = String((req.query && req.query.k) || "");
  const text = (status, msg) => { res.setHeader("Content-Type", "text/plain; charset=utf-8"); res.setHeader("Cache-Control", "no-store"); return res.status(status).send(msg); };
  if (!/^[0-9a-f]{32}$/.test(k)) return text(400, "Ссылка неполная. В приложении: «Смена» → «Смены в календаре телефона» → «Подписаться».");
  const page = !!(req.query && req.query.page);   // страница «Подписаться» — ещё не календарь: «забирал смены» не отмечается
  let data;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/cal_feed`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ p_key: k, p_page: page }),
    });
    data = await r.json().catch(() => null);
    if (!r.ok) return text(502, "Сервер не ответил" + (data && /cal_feed/.test(String(data.message || "")) ? ": нужен этап 39 (supabase-stage39-everyday.sql)" : "") + ". Попробуй позже.");
  } catch (e) {
    return text(502, "Нет связи с сервером. Календарь попробует ещё раз сам.");
  }
  if (!data || data.ok !== true) return text(404, "Ссылка больше не работает: её сбросили или доступ закрыт. В приложении: «Смена» → «Смены в календаре телефона».");
  if (page) {
    const proto = String(req.headers["x-forwarded-proto"] || "https").split(",")[0];
    const host = String(req.headers["x-forwarded-host"] || req.headers.host || "");
    const https = proto + "://" + host + "/api/cal?k=" + k;
    let today = new Date().toISOString().slice(0, 10);
    try { if (data.tz) today = new Intl.DateTimeFormat("en-CA", { timeZone: data.tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); } catch (e) { /* пояс неизвестен — UTC */ }
    const next = (data.shifts || []).filter((s) => s && s.date >= today).slice(0, 3).map(line);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(calPage({ name: data.name, rest: data.rest, https, next }));
  }
  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader("Content-Disposition", 'inline; filename="smeny.ics"');
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).send(buildIcs(data));
}
