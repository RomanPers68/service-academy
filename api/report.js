// api/report.js — Доп. 309: файл отчёта (Excel или PDF) по билету — для Telegram.
// GET /api/report?t=<билет> → .xlsx или .pdf.
// В Telegram файл нельзя «скачать» из памяти приложения: нужна ссылка. Поэтому приложение
// собирает отчёт у себя (права на данные проверены при чтении — этап 23), кладёт его под
// билет (report_ticket: 3 минуты, одно скачивание) и открывает эту ссылку через
// Telegram.WebApp.downloadFile. Здесь билет меняется на отчёт (report_take) и рисуется файл.
// Как резервная копия (api/backup.js): в ссылке нет ни токена, ни ключей; ключи Vercel не нужны.

import { teamXlsx, personXlsx, teamFileName, personFileName } from "../lib/report-xlsx.js";
import { personPdf, teamPdf } from "../lib/report-pdf.js";
import { XLSX_MIME } from "../lib/xlsx.js";

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  "https://gvxhgdynjuaisswplroh.supabase.co";
const SUPABASE_KEY =
  process.env.SUPABASE_KEY ||
  process.env.VITE_SUPABASE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2eGhnZHluanVhaXNzd3Bscm9oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4NjA1ODgsImV4cCI6MjA5NjQzNjU4OH0._4aLd4eb7cSfcqS9EvSwChJR-SixW2tsgn4ksCM5S3g";

const asciiName = (name, ext) => "service-academy-report." + ext;

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).send("Только GET");
  const t = String((req.query && req.query.t) || "");
  if (!/^[0-9a-f]{64}$/.test(t)) return res.status(400).send("Нет билета на скачивание — нажми «Excel» или «PDF» в приложении ещё раз");

  let data;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/report_take`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ p_ticket: t }),
    });
    data = await r.json();
    if (!r.ok) {
      const msg = (data && (data.message || data.hint)) || ("HTTP " + r.status);
      return res.status(502).send("Supabase не ответил: " + msg + (/report_take/.test(msg) ? " — примени supabase-stage23-reports.sql" : ""));
    }
  } catch (e) {
    return res.status(502).send("Нет связи с Supabase: " + (e && e.message ? e.message : "unknown"));
  }
  if (!data || data.ok !== true || !data.payload) {
    return res.status(403).send("Билет недействителен или истёк (3 минуты, одно скачивание) — нажми кнопку в приложении ещё раз");
  }

  let bytes, name, type, ext;
  try {
    const m = data.payload;
    if (data.kind === "team_xlsx") { bytes = teamXlsx(m); ext = "xlsx"; name = teamFileName(m, ext); type = XLSX_MIME; }
    else if (data.kind === "person_xlsx") { bytes = personXlsx(m); ext = "xlsx"; name = personFileName(m, ext); type = XLSX_MIME; }
    else if (data.kind === "team_pdf") { bytes = teamPdf(m); ext = "pdf"; name = teamFileName(m, ext); type = "application/pdf"; }
    else if (data.kind === "person_pdf") { bytes = personPdf(m); ext = "pdf"; name = personFileName(m, ext); type = "application/pdf"; }
    else return res.status(400).send("Неизвестный вид отчёта");
  } catch (e) {
    return res.status(422).send("Не удалось собрать файл: " + (e && e.message ? e.message : "ошибка"));
  }
  res.setHeader("Content-Type", type);
  res.setHeader("Content-Disposition", `attachment; filename="${asciiName(name, ext)}"; filename*=UTF-8''${encodeURIComponent(name)}`);
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).send(Buffer.from(bytes));
}
