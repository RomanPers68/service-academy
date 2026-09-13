import React from "react";
import { onActivate, vibrate } from "../lib/utils";
import { GOLD } from "./tokens";
import { COCKTAILS } from "../data/cocktails";
import { readBarcard, cachedShared, houseCocktails, isFullCocktail } from "../lib/deck-extras";
import { buildScenario, GLASS_RU, GARNISH_RU } from "../lib/bar-lab";
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
  const asText = () => list.map(c => { const sc = buildScenario(c, COCKTAILS).steps; return `${c.name.toUpperCase()} · ${c.method} · ${GLASS_RU[c.glass] || c.glass}\n${c.ing.map(i => `  ${i[0]} — ${i[1] ?? ""} ${i[2] || (i[1] ? "мл" : "")}`.trimEnd()).join("\n")}\n  Сборка: ${sc.map((s, k) => `${k + 1}) ${s.label}`).join(" · ")}`; }).join("\n\n");
  const copy = async () => { try { await navigator.clipboard.writeText(`КАРТА БАРА · ${restaurant}\n\n` + asText()); setCopied(true); vibrate("success"); setTimeout(() => setCopied(false), 2000); } catch (e) { vibrate("error"); } };
  const print = () => { try { window.print(); } catch (e) {} };
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
        <button className="sa-btn" onClick={print} style={{ ...T.doneBtn, flex: 1, marginTop: 0, background: gold }}>Печать / PDF</button>
        <button className="sa-btn" onClick={copy} style={{ ...T.doneBtn, flex: 1, marginTop: 0, background: "transparent", border: `1px solid ${gold}88`, color: text }}>{copied ? "Скопировано ✓" : "Скопировать текстом"}</button>
      </div>
      <div style={{ padding: "0 16px 6px", fontSize: 12, color: sub, lineHeight: 1.5 }} className="sa-noprint">{list.length} коктейлей карты, без стопа. В Telegram печати может не быть — тогда «Скопировать текстом» или открыть в браузере.</div>
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
