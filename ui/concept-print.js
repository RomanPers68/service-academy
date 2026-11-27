// ui/concept-print.js — v192 (Доп. 517): «О нас» для печати и лист ознакомления — собрать модель и отдать файл.
//
// Владелец (23.11), про семь идей для «О нас»: «Ты правильно понял. Делаем все 7». Модель для lib/concept-pdf.js
// собирается здесь: блоки (сотруднику — его трека, руководителю — все), фото целиком из базы (concept_photo), даты
// словами по часам телефона. Файл: в браузере рисуется на телефоне и скачивается; в Telegram скачать из памяти нельзя —
// модель уходит под билет (concept_ticket, этап 58) и файл рисует /api/report (как отчёты, ui/report.jsx).
import { rpc, saToken, rpcMissing } from "../lib/supabase";
import { kindOf, conceptSection, conceptHero, blockFor, dayWords, dayDots } from "../lib/concept";
import { lessonize } from "../lib/lesson-look";
import { POSITION_LABEL } from "../data/positions";
import { conceptPhotoUrl } from "./concept-photo";

const PHOTO_BUDGET = 2300000;   // столько base64 фото в одном файле (билет — до 3,5 МБ, ответ хостинга — до 4,5 МБ)

export { dayWords, dayDots };

const b64of = (url) => (typeof url === "string" && url.startsWith("data:image/jpeg") ? url.slice(url.indexOf(",") + 1) : "");

/**
 * Модель «О нас» для печати. track — трек сотрудника (его блоки), all — все блоки (руководитель). Фото — целиком, пока
 * хватает места, дальше превью; не JPEG — без фото.
 */
export async function conceptPrintModel(c, { track = "", all = false } = {}) {
  const sec = conceptSection(c);
  const vis = (b) => all || blockFor(b, track);
  const parts = [{ where: "Вся сеть", list: c.net.blocks.filter(vis) }, ...(c.venue ? [{ where: c.venue.name, list: c.venue.blocks.filter(vis) }] : [])].filter((p) => p.list.length);
  let budget = PHOTO_BUDGET;
  const photo = async (id, cap) => {
    let url = budget > 300000 ? await conceptPhotoUrl(id, true) : null;
    if (!b64of(url)) url = await conceptPhotoUrl(id, false);
    const b64 = b64of(url);
    if (!b64 || b64.length > budget) return null;
    budget -= b64.length;
    return { b64, cap: cap || "" };
  };
  const hero = conceptHero(c, all ? "" : track);
  const heroP = hero ? await photo(hero.id, hero.cap) : null;
  const out = [];
  for (const p of parts) {
    const blocks = [];
    for (const b of p.list) {
      const photos = [];
      for (const ph of b.photos) {
        if (heroP && hero && ph.id === hero.id) continue;   // фото с обложки второй раз не печатаем
        const x = await photo(ph.id, ph.cap);
        if (x) photos.push(x);
      }
      blocks.push({ label: b.kind === "own" ? "" : kindOf(b.kind).title, title: b.title, body: lessonize(b.body || ""), photos });
    }
    out.push({ where: p.where, blocks });
  }
  const edition = [c.net.blocks.length ? c.net.at : "", c.venue && c.venue.blocks.length ? c.venue.at : ""].filter(Boolean).sort().slice(-1)[0] || "";
  return { title: sec.title, sub: sec.sub, where: c.venue ? c.venue.name : "", edition: dayWords(edition), made: dayDots(new Date().toISOString()),
    hero: heroP, parts: out };
}

/** Модель листа ознакомления по ответу concept_reads. */
export function acksPrintModel(c, reads) {
  const sec = conceptSection(c);
  const edition = [reads.net_at, reads.venue_at].filter(Boolean).sort().slice(-1)[0] || "";
  return { title: sec.title, sub: sec.sub, where: reads.restaurant || (c.venue ? c.venue.name : ""), edition: dayWords(edition), made: dayDots(new Date().toISOString()),
    rows: (reads.rows || []).map((r) => ({ name: r.name, pos: POSITION_LABEL[r.pos] || "", at: r.at ? dayDots(r.at) : "" })), blanks: 4 };
}

/**
 * Отдать PDF: в браузере — нарисовать здесь и скачать; в Telegram — билет и ссылка (/api/report). → "file" | "tg" |
 * "cancel"; ошибка — исключение с понятным текстом.
 */
export async function deliverPdf(kind, model) {
  const tg = typeof window !== "undefined" && window.Telegram && window.Telegram.WebApp;
  const lib = () => import("../lib/concept-pdf.js");
  if (tg && tg.initData) {
    const r = await rpc("concept_ticket", { p_token: saToken(), p_kind: kind, p_payload: model });
    if (rpcMissing(r)) throw new Error("Нужен этап 58 на сервере (supabase-stage58-concept-acks.sql).");
    if (!r || !r.ok || !r.ticket) throw new Error(r && r.error === "too_big" ? "Слишком много фото для одного файла." : r && r.error === "no_reports" ? "Нужен этап 23 на сервере (отчёты)." : "Сервер не выдал файл. Попробуй ещё раз.");
    const url = window.location.origin + "/api/report?t=" + r.ticket;
    const { conceptFileName, acksFileName } = await lib();
    const name = kind === "concept_acks_pdf" ? acksFileName(model) : conceptFileName(model);
    if (typeof tg.downloadFile === "function") {
      return new Promise((res) => { try { tg.downloadFile({ url, file_name: name }, (ok) => res(ok ? "tg" : "cancel")); } catch (e) { try { tg.openLink(url); } catch (e2) { /* */ } res("tg"); } });
    }
    try { tg.openLink(url); } catch (e) { window.open(url, "_blank"); }
    return "tg";
  }
  const m = await lib();
  const bytes = kind === "concept_acks_pdf" ? m.acksPdf(model) : m.conceptPdf(model);
  const name = kind === "concept_acks_pdf" ? m.acksFileName(model) : m.conceptFileName(model);
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = name; a.rel = "noopener";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => { try { URL.revokeObjectURL(url); } catch (e) { /* */ } }, 60000);
  try { window.__saLastPdf = { kind, name, size: bytes.length }; } catch (e) { /* */ }   // для проверок (e2e-v192)
  return "file";
}
