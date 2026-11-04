// ui/bar-print.jsx — v130 (Доп. 443): «Барная карта для печати», как «Меню для печати» (ui/menu-print.jsx).
//
// Владелец (02.11): «Давай в барную карту добавим возможность распечатать информацию. Имею ввиду, как в меню» — на восемь
// предложений «Да, давай все». Вход — «Печать» в строке под вкладками «Барной карты»; что печатать — «Коктейли · Вина ·
// Крепкое · Вся карта» (сразу — вкладка, откуда пришёл; был выбран раздел, поиск или подбор — «Только показанные»). Лист
// рисуется на холсте, как у меню: светлая бумага, разделы как в карте, у позиции то же, что в карточке (lib/bar-print.js);
// у коктейля — бокал в его цвете (контур витража, ui/cocktail-art.jsx), у вин и крепкого — фото бутылки («С фото / Без
// фото»). Страницы под А4: позиция не рвётся между страницами. «Картинкой» — страницы листаются, «Отправить страницу»,
// «Все N» (в галерею и в любой мессенджер, коды входа не нужны); «Печать» — системный диалог (принтер или PDF) с теми же
// страницами, по одной на лист; в Telegram печать закрыта — там «Отправить». «Текстом» — в буфер, вставить в чат команды.
import React from "react";
import { createPortal } from "react-dom";
import { onActivate, vibrate } from "../lib/utils";
import { GOLD, labelStyle } from "./tokens";
import { PRINT_KINDS, KIND_RU, printSections, printText, paginate, rowsCount, posWord, PAGE } from "../lib/bar-print";
import { dishesOf } from "../lib/reference-context";
import { GLASS } from "./cocktail-art";
import { drawBottle } from "../lib/bottle-art";   // v136: где нет фото — нарисованная бутылка (контуром, без чужих картинок: холст не «пачкается»)

const SERIF = "Georgia, 'Times New Roman', serif";
// бумага — та же, что у «Меню для печати»
const C = { bg: "#FBF7EE", text: "#2A1F0E", dim: "#6B5B40", faint: "#8A7A5C", line: "#DED3BC", acc: "#7A5A22", warn: "#8A5A12", glass: "#7A5D2A", box: "#F1E8D6" };
const F = (s) => s + "px Georgia, serif";
const FONT = { title: "600 " + F(17), tag: F(12.5), orig: "italic " + F(13), meta: F(13), line: F(15), price: "600 " + F(14), dim: F(13.5), guest: "italic " + F(13.5), faint: F(13), warn: F(12.5) };
const LH = { title: 21, orig: 17, meta: 17, line: 20, price: 19, dim: 18, guest: 18, faint: 17, warn: 17 };
const MAXL = { title: 2, orig: 1, meta: 2, line: 3, price: 2, dim: 3, guest: 3, faint: 2, warn: 2 };
const COL = { title: C.text, tag: C.faint, orig: C.dim, meta: C.faint, line: C.text, price: C.acc, dim: C.dim, guest: C.text, faint: C.faint, warn: C.warn };
const ART = { w: 56, h: 73 }, PH = { w: 64, h: 96 };   // бокал коктейля (витраж 200 × 260) и фото бутылки
const GARN = { orange: "#E2A63A", peel: "#E2A63A", "peel-lemon": "#E8CF4A", lemon: "#E8CF4A", lime: "#8DBA4E", mint: "#7FA05A", olive: "#7F8F3A", onion: "#EFE4C8", cherry: "#C4483A", cream: "#EFE4C8", salt: "#FFFFFF" };
const BOTTLE = "M8 2h4v9c0 2 4 4 4 9v20a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V20c0-5 4-7 4-9z";   // силуэт без фото (как в карте)
// печать: на бумаге — только страницы, по одной на лист А4, без полей; на экране их нет
export const PRINT_CSS = "#sa-bar-print{display:none}@media print{@page{size:A4;margin:0}html,body{height:auto!important;min-height:0!important;overflow:visible!important;background:#fff!important}"
  + "body>*:not(#sa-bar-print){display:none!important}#sa-bar-print{display:block!important}#sa-bar-print img{display:block;width:100%;height:auto;break-after:page;page-break-after:always}"
  + "#sa-bar-print img:last-child{break-after:auto;page-break-after:auto}}";

const inTelegram = () => { try { return !!(window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData); } catch (e) { return false; } };
const wrap = (x, t, max) => { const words = String(t || "").split(" "); const out = []; let ln = "";
  for (const w of words) { const p = ln ? ln + " " + w : w; if (x.measureText(p).width > max && ln) { out.push(ln); ln = w; } else ln = p; } if (ln) out.push(ln); return out; };
// не больше n строк; не влезло — последняя с многоточием
const clamp = (x, t, max, n) => {
  const ls = wrap(x, t, max); if (ls.length <= n) return ls;
  const out = ls.slice(0, n); let base = out[n - 1];
  while (base && x.measureText(base + "…").width > max) base = base.slice(0, -1);
  out[n - 1] = base.trimEnd() + "…"; return out;
};
const loadImg = (src) => new Promise((res) => {
  if (!src) return res(null);
  const img = new Image(); let done = false;
  const finish = (v) => { if (!done) { done = true; res(v); } };
  img.crossOrigin = "anonymous";
  img.onload = () => finish(img); img.onerror = () => finish(null);
  setTimeout(() => finish(null), 4000);   // медленная сеть не держит весь лист
  img.src = src;
});
const box = (X, Y, w, h, r) => { const p = new Path2D(); if (p.roundRect) p.roundRect(X, Y, w, h, r); else p.rect(X, Y, w, h); return p; };
// бокал коктейля: контур и жидкость витража (верх и низ цвета, слои), гарниш — точкой у кромки
function drawArt(x, c, gx, gy) {
  const g = GLASS[c.glass] || GLASS.rocks, k = ART.w / 200;
  x.save(); x.translate(gx, gy); x.scale(k, k);
  x.fillStyle = "rgba(122, 93, 42, 0.07)"; x.fill(new Path2D(g.body.split(" M")[0]));
  const layers = Array.isArray(c.layers) && c.layers.length ? c.layers : null;
  const cols = layers || (Array.isArray(c.color) && c.color.length ? c.color : ["#D9B26A", "#B98A3E"]);
  const ys = (g.liq.match(/-?\d+(\.\d+)?/g) || []).map(Number).filter((_, i) => i % 2 === 1);
  const gr = x.createLinearGradient(0, Math.min(...ys), 0, Math.max(...ys));
  if (layers) { const n = cols.length; cols.slice().reverse().forEach((col, i) => { gr.addColorStop(i / n, col); gr.addColorStop((i + 1) / n, col); }); }
  else { gr.addColorStop(0, cols[0]); gr.addColorStop(1, cols[1] || cols[0]); }
  x.globalAlpha = 0.92; x.fillStyle = gr; x.fill(new Path2D(g.liq)); x.globalAlpha = 1;
  x.strokeStyle = C.glass; x.lineWidth = 5; x.lineJoin = "round"; x.lineCap = "round"; x.stroke(new Path2D(g.body));
  if (c.garnish && c.garnish !== "none") { const [rx, ry, rw] = g.rim; x.beginPath(); x.arc(rx + rw * 0.72, ry - 6, 12, 0, Math.PI * 2); x.fillStyle = GARN[c.garnish] || "#E2A63A"; x.fill(); x.lineWidth = 3.5; x.stroke(); }
  x.restore();
}
// фото бутылки целиком (вписано, не обрезано); нет фото — нарисованная бутылка (v136), без вида — силуэт
function drawPhoto(x, img, X, Y, look = null) {
  const b = box(X, Y, PH.w, PH.h, 10);
  x.fillStyle = C.box; x.fill(b);
  if (img) { x.save(); x.clip(b); const k = Math.min(PH.w / img.width, PH.h / img.height), w = img.width * k, h = img.height * k; x.drawImage(img, X + (PH.w - w) / 2, Y + (PH.h - h) / 2, w, h); x.restore(); }
  else if (look) drawBottle(x, look.kind, look, X + 6, Y + 6, PH.w - 12, PH.h - 12);
  else { x.save(); x.translate(X + PH.w / 2 - 15, Y + PH.h / 2 - 33); x.scale(1.5, 1.5); x.strokeStyle = C.faint; x.lineWidth = 1.2; x.lineJoin = "round"; x.stroke(new Path2D(BOTTLE)); x.restore(); }
  x.strokeStyle = C.line; x.lineWidth = 1; x.stroke(b);
}
// строка листа: колонка картинки, переносы строк и высота
function layout(probe, r, photo) {
  const m = r.art ? ART : photo ? PH : null;
  const TX = PAGE.PAD + (m ? m.w + 16 : 0), TW = PAGE.W - TX - PAGE.PAD;
  const segs = [];
  const add = (k, t) => { if (!t) return; probe.font = FONT[k]; segs.push({ k, lines: clamp(probe, t, TW - (k === "title" && r.tag ? 60 : 0), MAXL[k]) }); };
  add("title", r.title); add("orig", r.orig); add("meta", r.meta);
  for (const [k, t] of r.lines) add(k, t);
  const th = segs.reduce((a, s) => a + s.lines.length * LH[s.k] + 3, 0);
  return { ...r, m, TX, segs, h: Math.max(m ? m.h + 16 : 0, th + 16) };
}
const copyText = async (t) => {
  try { if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(t); return true; } } catch (e) {}
  try { const ta = document.createElement("textarea"); ta.value = t; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select(); const ok = document.execCommand("copy"); ta.remove(); return !!ok; } catch (e) { return false; }
};
const frames = (n) => new Promise((res) => { let i = 0; const f = () => (++i >= n ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); });

// start: { kind, ids, label } — вкладка, откуда пришёл, и что на ней было показано (раздел, поиск, подбор)
export function BarPrint({ T, a11y, restaurant = "", cocktails = [], wines = [], spirits = [], start = null, onBack }) {
  const gold = a11y ? "#7A5D2A" : GOLD, text = T.modTitle.color, sub = T.modSub.color;
  const lists = React.useMemo(() => ({ cocktail: (cocktails || []).filter((c) => c && !c.archived), wine: wines || [], spirit: spirits || [] }), [cocktails, wines, spirits]);
  const kinds = PRINT_KINDS.filter(([k]) => lists[k].length).map(([k]) => k);
  const filt = start && Array.isArray(start.ids) && start.ids.length && lists[start.kind] && lists[start.kind].length ? start : null;
  const [kind, setKind0] = React.useState(() => (start && kinds.includes(start.kind) ? start.kind : kinds[0] || "cocktail"));
  const [scope, setScope0] = React.useState(filt ? "shown" : "all");
  const [withPhoto, setWithPhoto0] = React.useState(true);
  const [shot, setShot] = React.useState(null);   // [{ url, blob, name }]
  const [page, setPage] = React.useState(0);
  const [busy, setBusy] = React.useState("");     // "draw" | "print"
  const [hint, setHint] = React.useState("");
  const [copied, setCopied] = React.useState(false);
  const tg = React.useMemo(inTelegram, []);
  const shotRef = React.useRef(null); shotRef.current = shot;
  React.useEffect(() => { try { const r = document.getElementById("root"); if (r) r.scrollTop = 0; } catch (e) {} }, []);
  React.useEffect(() => () => { (shotRef.current || []).forEach((sh) => URL.revokeObjectURL(sh.url)); }, []);
  // выбор поменялся — прежние страницы уже не про то
  const reset = () => { if (shotRef.current) shotRef.current.forEach((sh) => URL.revokeObjectURL(sh.url)); setShot(null); setPage(0); setHint(""); };
  const setKind = (k) => { if (k === kind) return; vibrate("light"); reset(); setKind0(k); };
  const setScope = (s) => { if (s === scope) return; vibrate("light"); reset(); setScope0(s); };
  const togglePhoto = () => { vibrate("light"); reset(); setWithPhoto0((v) => !v); };

  const dishes = React.useMemo(() => { try { return dishesOf(restaurant) || []; } catch (e) { return []; } }, [restaurant]);
  const ctx = React.useMemo(() => ({ cocktails: lists.cocktail, spirits: lists.spirit, dishName: (id) => (dishes.find((d) => d && d.id === id) || {}).name || "" }), [lists, dishes]);
  const useShown = !!filt && kind === filt.kind && scope === "shown";
  const parts = React.useMemo(() => (kind === "all" ? kinds : [kind]).map((k) => {
    const items = useShown && k === filt.kind ? lists[k].filter((x) => filt.ids.includes(x.id)) : lists[k];
    return { kind: k, label: KIND_RU[k] + (useShown && k === filt.kind && filt.label ? ": " + filt.label : ""), sections: printSections(k, items, ctx) };
  }), [kind, kinds.join(","), useShown, lists, ctx]);   // eslint-disable-line react-hooks/exhaustive-deps
  const n = parts.reduce((a, p) => a + rowsCount(p.sections), 0);
  const hasPhotos = parts.some((p) => p.kind !== "cocktail" && p.sections.some((s) => s.rows.some((r) => r.img)));
  // v136: бутылки есть у любого вина и крепкого (нет фото — нарисованная), переключатель — когда они есть в выбранном
  const hasBottles = parts.some((p) => p.kind !== "cocktail" && rowsCount(p.sections) > 0);

  const build = async (photo) => {
    const S = 2, { W, H, PAD, HEAD, FOOT, SEC } = PAGE;
    const probe = document.createElement("canvas").getContext("2d");
    const urls = photo ? [...new Set(parts.filter((p) => p.kind !== "cocktail").flatMap((p) => p.sections.flatMap((s) => s.rows.map((r) => r.img)).filter(Boolean)))] : [];
    const loaded = await Promise.all(urls.map(loadImg));
    const imgOf = new Map(urls.map((u, i) => [u, loaded[i]]));
    // страницы по видам: каждый вид — с новой страницы; номера — сквозные
    const pages = [];
    for (const p of parts) {
      const rows = p.sections.flatMap((s) => s.rows.map((r) => ({ ...layout(probe, r, photo && p.kind !== "cocktail"), sec: s.label })));
      for (const pg of paginate(rows, H - HEAD - FOOT, SEC)) pages.push({ part: p, rows: pg, n: rowsCount(p.sections) });
    }
    const date = new Date().toLocaleDateString("ru-RU"), N = pages.length, out = [];
    for (let pi = 0; pi < N; pi++) {
      const { part, rows } = pages[pi];
      const cv = document.createElement("canvas"); cv.width = W * S; cv.height = H * S;
      const x = cv.getContext("2d"); x.scale(S, S); x.textBaseline = "middle";
      x.fillStyle = C.bg; x.fillRect(0, 0, W, H);
      x.fillStyle = C.text; x.font = "600 " + F(26); x.fillText((restaurant ? restaurant + " · " : "") + "барная карта", PAD, 40);
      x.fillStyle = C.dim; x.font = F(14); x.fillText(`${part.label} · ${posWord(pages[pi].n)} · ${date} · страница ${pi + 1} из ${N}`, PAD, 68);
      x.strokeStyle = C.line; x.lineWidth = 1; x.beginPath(); x.moveTo(PAD, 86); x.lineTo(W - PAD, 86); x.stroke();
      let y = HEAD, last = null;
      for (const r of rows) {
        if (r.sec !== last) { last = r.sec; x.fillStyle = C.faint; x.font = "600 " + F(11); x.fillText(String(r.sec).toUpperCase(), PAD, y + 6); y += SEC; }
        if (r.m === ART) drawArt(x, r.art, PAD, y - 2);
        else if (r.m === PH) drawPhoto(x, imgOf.get(r.img) || null, PAD, y - 2, r.look || null);
        let yy = y + 9;
        for (const s of r.segs) {
          s.lines.forEach((ln, i) => {
            x.font = FONT[s.k]; x.fillStyle = COL[s.k]; x.fillText(ln, r.TX, yy);
            if (s.k === "title" && r.tag && i === s.lines.length - 1) { const tw = x.measureText(ln).width; x.font = FONT.tag; x.fillStyle = COL.tag; x.fillText(r.tag, r.TX + tw + 10, yy + 1); }
            yy += LH[s.k];
          });
          yy += 3;
        }
        y += r.h;
        x.strokeStyle = C.line; x.lineWidth = 1; x.beginPath(); x.moveTo(PAD, y - 7); x.lineTo(W - PAD, y - 7); x.stroke();
      }
      x.fillStyle = C.faint; x.font = F(12); x.fillText(`Service Academy · как в «Барной карте» · ${pi + 1}/${N}`, PAD, H - 26);
      const blob = await new Promise((res, rej) => { try { cv.toBlob((b) => (b ? res(b) : rej(new Error("blob"))), "image/png"); } catch (e) { rej(e); } });
      out.push({ url: URL.createObjectURL(blob), blob, name: ("Барная_карта_" + (restaurant ? restaurant + "_" : "") + (pi + 1) + ".png").replace(/[\s,]+/g, "_") });
    }
    return out;
  };
  // «Картинкой»: страницы листа. Чужое фото без разрешения браузера «пачкает» холст — тогда тот же лист без фото
  const draw = async () => {
    if (busy || !n) return null;
    setBusy("draw"); setHint(""); reset();
    let out = null;
    try { out = await build(withPhoto && hasBottles); }
    catch (e) {
      if (withPhoto && hasPhotos) { setWithPhoto0(false); setHint("С фото не вышло. Собрал без них"); try { out = await build(false); } catch (e2) { out = null; } }
      if (!out) setHint("Не удалось собрать картинку");
    }
    if (out) { setShot(out); setPage(0); vibrate("success"); }
    setBusy("");
    return out;
  };
  const share = async (all) => {
    if (!shot || !shot.length) return;
    vibrate("light");
    const items = all ? shot : [shot[page]];
    try { const files = items.map((sh) => new File([sh.blob], sh.name, { type: "image/png" }));
      if (navigator.canShare && navigator.canShare({ files })) { await navigator.share({ files, title: "Барная карта" + (restaurant ? " · " + restaurant : "") }); return; } } catch (e) {}
    // без «Поделиться» (компьютер) — файлами: ссылка в документе (иначе браузер может забыть имя файла), по одной с паузой
    // (пачку разом браузер считает навязчивой и часть файлов не отдаёт)
    const save = (sh) => { const a = document.createElement("a"); a.href = sh.url; a.download = sh.name; a.rel = "noopener"; a.style.display = "none"; document.body.appendChild(a); a.click(); a.remove(); };
    items.forEach((sh, i) => setTimeout(() => save(sh), i * 350));
  };
  // «Печать»: те же страницы, по одной на лист; в Telegram печать закрыта (кнопки нет)
  const print = async () => {
    if (tg || busy) return;
    vibrate("light");
    const out = shot || (await draw());
    if (!out || !out.length) return;
    setBusy("print");
    for (let i = 0; i < 30 && document.querySelectorAll("#sa-bar-print img").length < out.length; i++) await frames(1);
    await Promise.all([...document.querySelectorAll("#sa-bar-print img")].map((im) => (im.decode ? im.decode().catch(() => {}) : null)));
    try { window.print(); } catch (e) { setHint("Печать недоступна. Отправь страницы или скопируй текстом"); }
    setBusy("");
  };
  const copy = async () => {
    if (!n) return;
    const ok = await copyText(printText({ restaurant, parts }));
    if (ok) { setCopied(true); vibrate("success"); setTimeout(() => setCopied(false), 2000); }
    else { vibrate("error"); setHint("Не удалось скопировать. Попробуй «Картинкой»"); }
  };

  const chip = (on) => ({ flexShrink: 0, padding: "6px 12px", borderRadius: 999, fontSize: 13, fontFamily: SERIF, cursor: "pointer", whiteSpace: "nowrap",
    border: `1px solid ${on ? gold : gold + "44"}`, background: on ? (a11y ? "rgba(139,106,48,0.14)" : "rgba(214,178,102,0.16)") : "transparent", color: on ? text : sub });
  const { marginTop: _mt, ...btnBase } = T.doneBtn || {};
  const btn = (main) => ({ ...btnBase, width: "auto", flex: main ? "1.4 1 0" : "1 1 0", minWidth: "min-content", whiteSpace: "nowrap", margin: 0, padding: "12px 10px", fontSize: 14.5, fontFamily: SERIF,
    ...(main ? { background: gold, color: "#1A1008", border: "none" } : { background: "transparent", color: text, border: `1px solid ${gold}77` }) });
  const kindChip = (k, label, cnt) => <button key={k} type="button" aria-pressed={kind === k} data-bar-print-kind={k} data-lens-btn={kind === k ? "tab" : "soft"} data-lens-ink=""
    onClick={() => setKind(k)} style={chip(kind === k)}>{label + " · " + cnt}</button>;
  const fLabel = filt ? (String(filt.label || "").length > 30 ? String(filt.label).slice(0, 29).trimEnd() + "…" : String(filt.label || "")) : "";
  return (
    <div style={T.screen} className="sa-screen" data-bar-print={kind} data-bar-print-n={n}>
      {shot ? <style>{PRINT_CSS}</style> : null}
      {shot && typeof document !== "undefined" ? createPortal(<div id="sa-bar-print" aria-hidden="true">{shot.map((sh, i) => <img key={sh.url} src={sh.url} alt={"Страница " + (i + 1)} />)}</div>, document.body) : null}
      <div style={{ padding: "16px 16px 6px", display: "flex", alignItems: "center", gap: 10 }}>
        <button className="sa-btn" data-lens="back" onClick={onBack} {...onActivate(onBack)} aria-label="Назад" style={{ border: "none", background: "transparent", color: gold, fontSize: 21, cursor: "pointer", padding: "4px 8px 4px 0" }}>‹</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ ...labelStyle(13.5), color: gold }}>Барная карта · экспорт</div>
          <div style={{ fontFamily: SERIF, fontSize: 21, color: text, lineHeight: 1.15 }}>Барная карта для печати</div>
        </div>
      </div>
      <div style={{ padding: "4px 16px 0" }}>
        <div style={{ ...labelStyle(13.5), color: gold, margin: "4px 2px 8px" }}>Что печатать</div>
        <div role="group" aria-label="Что печатать" style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {kinds.map((k) => kindChip(k, KIND_RU[k], lists[k].length))}
          {kinds.length > 1 ? kindChip("all", "Вся карта", kinds.reduce((a, k) => a + lists[k].length, 0)) : null}
        </div>
        {filt && kind === filt.kind ? (
          <div role="group" aria-label="Сколько" style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
            <button type="button" aria-pressed={scope === "shown"} data-bar-print-scope="shown" data-lens-btn={scope === "shown" ? "tab" : "soft"} data-lens-ink="" onClick={() => setScope("shown")} style={chip(scope === "shown")}>
              {"Только показанные: " + (fLabel ? fLabel + ", " : "") + filt.ids.filter((id) => lists[filt.kind].some((x) => x.id === id)).length}</button>
            <button type="button" aria-pressed={scope === "all"} data-bar-print-scope="all" data-lens-btn={scope === "all" ? "tab" : "soft"} data-lens-ink="" onClick={() => setScope("all")} style={chip(scope === "all")}>
              {"Все " + lists[filt.kind].length}</button>
          </div>) : null}
        {hasBottles ? <div style={{ marginTop: 8 }}>
          <span role="button" tabIndex={0} aria-pressed={withPhoto} data-bar-print-photo={withPhoto ? "on" : "off"} data-lens-btn="soft" data-lens-hi={withPhoto ? "" : undefined} onClick={togglePhoto} {...onActivate(togglePhoto)}
            style={{ display: "inline-block", padding: "7px 12px", borderRadius: 999, fontSize: 12.5, cursor: "pointer", border: `1px solid ${withPhoto ? gold : gold + "44"}`, background: withPhoto ? "rgba(214,178,102,0.16)" : "transparent", color: withPhoto ? text : sub }}>
            {withPhoto ? (hasPhotos ? "С фото бутылок ✓" : "С бутылками ✓") : hasPhotos ? "Без фото" : "Без бутылок"}</span>
        </div> : null}
      </div>
      <div style={{ padding: "14px 16px 10px", display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" className="sa-btn" data-lens-btn="main" data-bar-print-go="" onClick={draw} disabled={!!busy || !n} style={{ ...btn(true), opacity: busy || !n ? 0.6 : 1 }}>{busy === "draw" ? "Собираю…" : "Картинкой"}</button>
        <button type="button" className="sa-btn" data-lens-btn="soft" data-bar-print-text="" onClick={copy} disabled={!n} style={btn(false)}>{copied ? "Скопировано ✓" : "Текстом"}</button>
        {!tg ? <button type="button" className="sa-btn" data-lens-btn="soft" data-lens-ink="" data-bar-print-sys="" onClick={print} disabled={!!busy || !n} style={btn(false)}>{busy === "print" ? "Готовлю…" : "Печать"}</button> : null}
      </div>
      {hint ? <div role="status" data-bar-print-hint="" style={{ padding: "0 16px 6px", fontSize: 12.5, color: gold, lineHeight: 1.5 }}>{hint}</div> : null}
      <div data-bar-print-sum="" style={{ padding: "0 16px 8px", fontSize: 12.5, color: sub, lineHeight: 1.5 }}>
        {(n ? "Позиций: " + n + (shot ? ", страниц: " + shot.length : "") + ". " : "") + "Страницы под А4: сохраняются в галерею и уходят в любой мессенджер, коды входа не нужны. "
          + (tg ? "В Telegram печать закрыта: отправь страницы себе или сохрани в галерею и печатай оттуда." : "«Печать» откроет системный диалог: принтер или PDF.")}</div>
      {shot && shot.length > 0 ? (
        <div className="sa-fadein" data-bar-print-pages={shot.length} style={{ margin: "0 16px 14px", padding: 12, borderRadius: 14, border: `1px solid ${gold}55` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span data-bar-print-page={page + 1} style={{ ...labelStyle(13.5), color: gold, flex: 1 }}>Страница {page + 1} из {shot.length}</span>
            {shot.length > 1 ? <>
              <button type="button" className="sa-btn" data-bar-print-prev="" aria-label="Предыдущая страница" disabled={!page} onClick={() => setPage((p) => Math.max(0, p - 1))}
                style={{ border: "none", background: "transparent", color: page ? gold : sub, cursor: "pointer", padding: "2px 10px", fontSize: 18 }}>‹</button>
              <button type="button" className="sa-btn" data-bar-print-next="" aria-label="Следующая страница" disabled={page >= shot.length - 1} onClick={() => setPage((p) => Math.min(shot.length - 1, p + 1))}
                style={{ border: "none", background: "transparent", color: page < shot.length - 1 ? gold : sub, cursor: "pointer", padding: "2px 10px", fontSize: 18 }}>›</button>
            </> : null}
          </div>
          <img data-bar-print-img={page + 1} src={shot[page].url} alt={"Барная карта · страница " + (page + 1)} style={{ width: "100%", borderRadius: 12, display: "block", border: `1px solid ${gold}33` }} />
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <button type="button" className="sa-btn" data-lens-btn="main" data-bar-print-share="page" onClick={() => share(false)} style={btn(true)}>Отправить страницу</button>
            {shot.length > 1 ? <button type="button" className="sa-btn" data-lens-btn="soft" data-bar-print-share="all" onClick={() => share(true)} style={btn(false)}>Все {shot.length}</button> : null}
            <button type="button" className="sa-btn" data-lens-btn="soft" data-lens-ink="" data-bar-print-close="" onClick={() => { vibrate("light"); reset(); }} style={{ ...btn(false), color: sub }}>Закрыть</button>
          </div>
        </div>) : null}
      <div style={{ height: 90 }} />
    </div>
  );
}
