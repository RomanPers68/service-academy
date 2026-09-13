import React from "react";
import { onActivate, vibrate } from "../lib/utils";
import { GOLD } from "./tokens";
import { COCKTAILS } from "../data/cocktails";
import { readBarcard, cachedShared, houseCocktails, isFullCocktail } from "../lib/deck-extras";
import { buildScenario, GLASS_RU, GARNISH_RU } from "../lib/bar-lab";
import { GLASS_PATH, LIQ_BOX, ING_COLOR } from "./bar-lab";
import { CocktailArt } from "./cocktail-art";

// ── Дополнение 244: карта бара для печати — спеки и сборка всех коктейлей карты, одним листом ─────
// «Печать / PDF» — системный диалог печати (в браузере: сохранить как PDF). В Telegram печати может не быть —
// тогда «Скопировать текстом»: тот же лист в буфер, вставить в заметки или сообщение.

export function BarCardPrint({ T, a11y, profile, onBack }) {
  const gold = a11y ? "#8B6A30" : GOLD; const text = T.modTitle.color, sub = T.modSub.color;
  const restaurant = profile?.restaurant || "";
  const shared = cachedShared(restaurant); const card = readBarcard(shared);
  const all = [...houseCocktails(shared).filter(isFullCocktail), ...COCKTAILS];
  const list = all.filter(c => !c.stop && (c.house || !card || card.includes(c.id)));
  const [copied, setCopied] = React.useState(false);
  const [shot, setShot] = React.useState(null);   // Доп. 251/254: [{ url, blob, name }] — страницы картинками
  const [page, setPage] = React.useState(0);
  const [busy, setBusy] = React.useState(false);
  const asText = () => list.map(c => { const sc = buildScenario(c, COCKTAILS).steps; return `${c.name.toUpperCase()} · ${c.method} · ${GLASS_RU[c.glass] || c.glass}\n${c.ing.map(i => `  ${i[0]} — ${i[1] ?? ""} ${i[2] || (i[1] ? "мл" : "")}`.trimEnd()).join("\n")}\n  Сборка: ${sc.map((s, k) => `${k + 1}) ${s.label}`).join(" · ")}`; }).join("\n\n");
  const copy = async () => { try { await navigator.clipboard.writeText(`КАРТА БАРА · ${restaurant}\n\n` + asText()); setCopied(true); vibrate("success"); setTimeout(() => setCopied(false), 2000); } catch (e) { vibrate("error"); } };
  // Доп. 246: Telegram блокирует window.print() — открываем в системном браузере, там печать и «Сохранить в PDF» есть
  const tg = typeof window !== "undefined" && window.Telegram && window.Telegram.WebApp;
  const inTelegram = !!(tg && tg.initData !== undefined);
  const [hint, setHint] = React.useState("");
  const openBrowser = () => { const url = location.origin + location.pathname + "?print=bar"; try { if (tg && tg.openLink) { tg.openLink(url, { try_instant_view: false }); return; } } catch (e) {} try { window.open(url, "_blank"); } catch (e) { setHint("Не удалось открыть браузер — скопируй текстом"); } };
  // ── Доп. 251: карта картинкой — как «Мои смены» в графике.
  // Ссылка в браузер бесполезна: у сотрудников одноразовые коды входа, повторно
  // они не зайдут. PNG сохраняется в галерею и уходит в любой мессенджер.
  const PER_PAGE = 12;                              // Доп. 254: лист на 56 позиций был в 12 000 точек — режем по страницам
  const drawSheet = async () => {
    setBusy(true);
    try {
      const C = { bg: "#FBF7EE", text: "#2A1F0E", dim: "#6B5B40", faint: "#8A7A5C", line: "#DED3BC", acc: "#7A5A22" };
      const S = 2, W = 760, PAD = 28, HEAD = 104;
      const wrap = (x, t, max) => { const words = String(t).split(" "); const out = []; let ln = "";
        for (const w of words) { const probe = ln ? ln + " " + w : w; if (x.measureText(probe).width > max && ln) { out.push(ln); ln = w; } else ln = probe; } if (ln) out.push(ln); return out; };
      // Доп. 255: бокал рисуем прямо на холсте (Path2D по тем же контурам, что в приложении) —
      // в PNG витраж не попадал, потому что он React-компонент, а не пиксели.
      const mixCol = (cols) => { if (!cols.length) return "#D6B266"; const rgb = cols.map(h => [1,3,5].map(i => parseInt(h.slice(i,i+2),16))); const a = [0,1,2].map(k => Math.round(rgb.reduce((q,c2)=>q+c2[k],0)/rgb.length)); return "#" + a.map(v => v.toString(16).padStart(2,"0")).join(""); };
      const drawGlass = (x2, c, gx, gy, size) => {
        const full = GLASS_PATH[c.glass] || GLASS_PATH.rocks;   // весь силуэт, включая ножку
        const path = full.split(" M")[0];                       // чаша — по ней клипуем жидкость
        const box = LIQ_BOX[c.glass] || LIQ_BOX.rocks;
        const k = size / 120;
        x2.save(); x2.translate(gx, gy); x2.scale(k, k);
        const p2 = new Path2D(path);
        x2.save(); x2.clip(p2);
        const [bx, by, bw, bh] = box; const lh = bh * 0.72;
        x2.fillStyle = mixCol((c.ing || []).map(i => ING_COLOR(i[0])));
        x2.globalAlpha = 0.85; x2.fillRect(bx, by + bh - lh, bw, lh); x2.globalAlpha = 1;
        if (c.ice) { x2.fillStyle = "rgba(255,255,255,0.55)"; for (let i = 0; i < 3; i++) x2.fillRect(bx + 6 + i * (bw / 3.2), by + bh - lh + 4 + i * 6, bw / 4, bw / 4); }
        x2.restore();
        x2.strokeStyle = "#8B6A30"; x2.lineWidth = 2.4; x2.lineJoin = "round"; x2.lineCap = "round"; x2.stroke(new Path2D(full));
        if (c.garnish && c.garnish !== "none") { x2.beginPath(); x2.arc(box[0] + box[2] - 4, Math.max(14, box[1] - 2), 8, 0, 7); x2.fillStyle = c.garnish === "cherry" ? "#C4483A" : /mint|olive/.test(c.garnish) ? "#7FA05A" : c.garnish === "cream" ? "#EFE4C8" : "#E2A63A"; x2.fill(); x2.strokeStyle = "#8B6A30"; x2.lineWidth = 1.2; x2.stroke(); }
        x2.restore();
      };
      const probe = document.createElement("canvas").getContext("2d");
      const GW = 62, TX = PAD + GW + 14;                 // ширина бокала и левый край текста
      const rows = list.map(c => { const sc = buildScenario(c, COCKTAILS).steps;
        probe.font = "15px Georgia, serif"; const ing = wrap(probe, c.ing.map(i => `${i[0]}${i[1] ? " " + i[1] + " " + (i[2] || "мл") : ""}`).join(" · "), W - TX - PAD);
        probe.font = "13px Georgia, serif"; const steps = wrap(probe, sc.map((s2, k) => `${k + 1}. ${s2.label}`).join("  →  "), W - TX - PAD);
        return { c, ing, steps, h: Math.max(GW + 22, 26 + ing.length * 20 + steps.length * 18 + 16) }; });
      const pages = [];
      for (let i = 0; i < rows.length; i += PER_PAGE) pages.push(rows.slice(i, i + PER_PAGE));
      const out = [];
      for (let pi = 0; pi < pages.length; pi++) {
      const part = pages[pi];
      const H = HEAD + part.reduce((a, r) => a + r.h, 0) + 54;
      const cv = document.createElement("canvas"); cv.width = W * S; cv.height = H * S;
      const x = cv.getContext("2d"); x.scale(S, S); x.textBaseline = "middle";
      x.fillStyle = C.bg; x.fillRect(0, 0, W, H);
      x.fillStyle = C.text; x.font = "600 26px Georgia, serif"; x.fillText(`${restaurant} · карта бара`, PAD, 42);
      x.fillStyle = C.dim; x.font = "14px Georgia, serif";
      x.fillText(`${new Date().toLocaleDateString("ru-RU")} · ${list.length} позиций · страница ${pi + 1} из ${pages.length}`, PAD, 70);
      x.strokeStyle = C.line; x.lineWidth = 1; x.beginPath(); x.moveTo(PAD, 88); x.lineTo(W - PAD, 88); x.stroke();
      let y = HEAD;
      for (const r of part) {
        drawGlass(x, r.c, PAD, y - 4, GW);
        x.fillStyle = C.text; x.font = "600 17px Georgia, serif"; x.fillText(r.c.name, TX, y + 8);
        const nw = x.measureText(r.c.name).width;
        x.fillStyle = C.faint; x.font = "12.5px Georgia, serif";
        x.fillText(`${r.c.method} · ${GLASS_RU[r.c.glass] || r.c.glass}${r.c.garnish && r.c.garnish !== "none" ? " · " + GARNISH_RU[r.c.garnish] : ""}`, TX + nw + 12, y + 9);
        let yy = y + 30;
        x.fillStyle = C.text; x.font = "15px Georgia, serif";
        for (const ln of r.ing) { x.fillText(ln, TX, yy); yy += 20; }
        x.fillStyle = C.dim; x.font = "13px Georgia, serif";
        for (const ln of r.steps) { x.fillText(ln, TX, yy); yy += 18; }
        y += r.h;
        x.strokeStyle = C.line; x.beginPath(); x.moveTo(PAD, y - 8); x.lineTo(W - PAD, y - 8); x.stroke();
      }
      x.fillStyle = C.faint; x.font = "12px Georgia, serif";
      x.fillText(`Service Academy · порядок сборки как в тренажёре «Собрать руками» · ${pi + 1}/${pages.length}`, PAD, H - 26);
      const blob = await new Promise(res => cv.toBlob(res, "image/png"));
      const name = `Карта_бара_${restaurant}_${pi + 1}.png`.replace(/\s/g, "_");
      out.push({ url: URL.createObjectURL(blob), blob, name });
      }
      setShot(out); setPage(0); vibrate("success");
    } catch (e) { setHint("Не удалось собрать картинку"); setTimeout(() => setHint(""), 3000); }
    setBusy(false);
  };
  const shareShot = async (all = false) => {
    if (!shot || !shot.length) return;
    const items = all ? shot : [shot[page]];
    try {
      const files = items.map(sh => new File([sh.blob], sh.name, { type: "image/png" }));
      if (navigator.canShare && navigator.canShare({ files })) { await navigator.share({ files, title: `Карта бара · ${restaurant}` }); return; }
    } catch (e) {}
    items.forEach(sh => { const a = document.createElement("a"); a.href = sh.url; a.download = sh.name; a.click(); });
  };
  const print = () => {
    if (inTelegram) { openBrowser(); setHint("Открываю в браузере — там «Поделиться → Печать» и «Сохранить в PDF»"); setTimeout(() => setHint(""), 6000); return; }
    try { window.print(); } catch (e) { setHint("Печать недоступна — скопируй текстом"); }
  };
  return (
    <div style={T.screen} className="sa-screen">
      <style>{`@media print { body * { visibility: hidden !important; } #sa-print, #sa-print * { visibility: visible !important; } #sa-print { position: absolute; left: 0; top: 0; width: 100%; padding: 0 !important; color: #1a1408 !important; background: #fff !important; } #sa-print .sa-noprint { display: none !important; } #sa-print .sa-pcard { break-inside: avoid; border-bottom: 1px solid #ccc; } }`}</style>
      <div style={{ padding: "16px 16px 6px", display: "flex", alignItems: "center", gap: 10 }} className="sa-noprint">
        <button className="sa-btn" onClick={onBack} {...onActivate(onBack)} aria-label="Назад" style={{ border: "none", background: "transparent", color: gold, fontSize: 22, cursor: "pointer", padding: "4px 8px 4px 0" }}>‹</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 10.5, letterSpacing: 1.5, color: gold }}>КОЛОДА БАРМЕНА · ЭКСПОРТ</div>
          <div style={{ fontFamily: "Georgia, serif", fontSize: 22, color: text, lineHeight: 1.15 }}>Карта бара для печати</div>
        </div>
      </div>
      <div style={{ padding: "4px 16px 12px", display: "flex", gap: 8 }} className="sa-noprint">
        <button className="sa-btn" onClick={drawSheet} disabled={busy} style={{ ...T.doneBtn, flex: 1.4, marginTop: 0, background: gold, opacity: busy ? 0.6 : 1 }}>{busy ? "Собираю…" : "Картинкой"}</button>
        <button className="sa-btn" onClick={copy} style={{ ...T.doneBtn, flex: 1, marginTop: 0, background: "transparent", border: `1px solid ${gold}88`, color: text }}>{copied ? "Скопировано ✓" : "Текстом"}</button>
        <button className="sa-btn" onClick={print} style={{ ...T.doneBtn, flex: 1, marginTop: 0, background: "transparent", border: `1px solid ${gold}55`, color: sub }}>{inTelegram ? "В браузере" : "Печать"}</button>
      </div>
      {hint && <div style={{ padding: "0 16px 6px", fontSize: 12.5, color: gold, lineHeight: 1.5 }} className="sa-noprint">{hint}</div>}
      <div style={{ padding: "0 16px 6px", fontSize: 12, color: sub, lineHeight: 1.5 }} className="sa-noprint">{list.length} коктейлей карты, без стопа. «Картинкой» — лист PNG: сохранить в галерею или отправить в чат, вход не требуется. {inTelegram ? "«В браузере» — если нужен именно PDF (там придётся войти заново)." : "«Печать» — системный диалог печати."}</div>
      {shot && shot.length > 0 && (
        <div className="sa-fadein sa-noprint" style={{ margin: "0 16px 14px", padding: 12, borderRadius: 16, border: `1px solid ${gold}55` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 10.5, letterSpacing: 1.5, color: gold, fontFamily: "monospace", flex: 1 }}>СТРАНИЦА {page + 1} ИЗ {shot.length}</span>
            {shot.length > 1 && <>
              <span onClick={() => setPage(p => Math.max(0, p - 1))} style={{ color: page ? gold : sub, cursor: "pointer", padding: "2px 8px", fontSize: 17 }}>‹</span>
              <span onClick={() => setPage(p => Math.min(shot.length - 1, p + 1))} style={{ color: page < shot.length - 1 ? gold : sub, cursor: "pointer", padding: "2px 8px", fontSize: 17 }}>›</span>
            </>}
          </div>
          <img src={shot[page].url} alt={`Карта бара · страница ${page + 1}`} style={{ width: "100%", borderRadius: 12, display: "block", border: `1px solid ${gold}33` }} />
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <button className="sa-btn" onClick={() => shareShot(false)} style={{ ...T.doneBtn, flex: 1.4, marginTop: 0, background: gold }}>Отправить страницу</button>
            {shot.length > 1 && <button className="sa-btn" onClick={() => shareShot(true)} style={{ ...T.doneBtn, flex: 1.2, marginTop: 0, background: "transparent", border: `1px solid ${gold}88`, color: text }}>Все {shot.length}</button>}
            <button className="sa-btn" onClick={() => { shot.forEach(sh => URL.revokeObjectURL(sh.url)); setShot(null); }} style={{ ...T.doneBtn, flex: 1, marginTop: 0, background: "transparent", border: `1px solid ${gold}66`, color: sub }}>Закрыть</button>
          </div>
          <div style={{ fontSize: 11.5, color: sub, marginTop: 10, lineHeight: 1.55 }}>По {PER_PAGE} коктейлей на страницу — удобно печатать и листать. Сохраняется в галерею, уходит в любой мессенджер, коды входа не нужны.</div>
        </div>
      )}
      <div id="sa-print" style={{ padding: "0 16px 100px" }}>
        <div style={{ fontFamily: "Georgia, serif", fontSize: 20, color: text, margin: "8px 0 4px" }}>{restaurant} · карта бара</div>
        <div style={{ fontSize: 11, color: sub, marginBottom: 10 }}>{new Date().toLocaleDateString("ru-RU")} · {list.length} позиций · спеки и порядок сборки как в Колоде</div>
        {list.map(c => { const sc = buildScenario(c, COCKTAILS).steps; return (
          <div key={c.id} className="sa-pcard" style={{ display: "flex", gap: 12, padding: "10px 0", borderBottom: `1px solid ${gold}22` }}>
            <div style={{ width: 56, flexShrink: 0 }}><CocktailArt c={c} w={56} light={true} /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "Georgia, serif", fontSize: 16, color: text }}>{c.name}<span style={{ fontSize: 11, color: sub, marginLeft: 8 }}>{c.method} · {GLASS_RU[c.glass] || c.glass}{c.garnish && c.garnish !== "none" ? ` · ${GARNISH_RU[c.garnish]}` : ""}</span></div>
              <div style={{ fontSize: 12.5, color: text, marginTop: 3, lineHeight: 1.5 }}>{c.ing.map(i => `${i[0]}${i[1] ? " " + i[1] + " " + (i[2] || "мл") : ""}`).join(" · ")}</div>
              <div style={{ fontSize: 11.5, color: sub, marginTop: 3, lineHeight: 1.5 }}>{sc.map((s, k) => `${k + 1}. ${s.label}`).join(" → ")}</div>
            </div>
          </div>); })}
      </div>
    </div>
  );
}
