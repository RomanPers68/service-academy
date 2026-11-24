// ui/dish-step.jsx — v193 (Доп. 518): блюдо в разминке до смены. Владелец: «меню вживить в ежедневный повтор…
// ненавязчиво». После ситуаций — 2–3 блюда (сколько — «Напоминания» → «Блюда в разминке»): название и фото, вспомни состав
// и аллергены, переверни — «Знаю» или «Не уверен». Почему блюдо здесь — подписью: спрашивали, просит руководитель,
// гоу-лист смены, новинка, пора повторить. Карточка живёт в столе разминки (ui/table.jsx), кнопки — в его подвале.
// Данные блюда готовит App (lib/menu-pack.js dishBrief): состав строкой, аллергены подписями, как рассказать гостю.
import React from "react";
import { WHY_LABEL } from "../lib/menu-repeat";

const box = { borderRadius: 18, border: "1px solid var(--edge-gold)", background: "var(--glass)", padding: "14px 16px 15px",
  boxShadow: "inset 0 0 22px var(--inner), inset 0 1px 0 var(--hi)" };
const lbl = { fontFamily: "Georgia, serif", fontStyle: "italic", fontSize: 13, color: "var(--gold-ink)", margin: "0 0 3px" };
const txt = { fontSize: 15, lineHeight: 1.5, color: "var(--text)" };

/** item: { id, name, why, say, brief: { img, cat, comp, al, desc, pair } }; flipped — показан состав; onFlip — перевернуть. */
export function DishCard({ item, flipped = false, onFlip }) {
  const b = (item && item.brief) || {};
  const why = WHY_LABEL[item && item.why] || "";
  const flip = () => { if (!flipped && onFlip) onFlip(); };
  return (
    <div data-warm-dish={item ? item.id : ""} data-dish-flipped={flipped ? "1" : "0"}>
      <div className="tb-scene-row"><span className="tb-where">меню{why ? " · " + why : ""}</span></div>
      <div role={flipped ? undefined : "button"} tabIndex={flipped ? undefined : 0} onClick={flip}
        onKeyDown={(e) => { if (!flipped && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); flip(); } }}
        aria-label={flipped ? undefined : (item ? item.name : "") + ". Показать состав"} style={{ ...box, cursor: flipped ? "default" : "pointer" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {b.img ? <img src={b.img} alt="" loading="eager" decoding="async" style={{ width: flipped ? 56 : 84, height: flipped ? 56 : 84, objectFit: "cover", borderRadius: 14, flexShrink: 0, transition: "width .25s, height .25s" }} /> : null}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "var(--font-display, Georgia, serif)", fontSize: 20, lineHeight: 1.2, color: "var(--text)" }}>{item ? item.name : ""}</div>
            {b.cat ? <div style={{ fontSize: 12.5, color: "var(--sub)", marginTop: 3 }}>{b.cat}</div> : null}
          </div>
        </div>
        {!flipped ? (
          <p style={{ margin: "12px 0 0", fontSize: 14, lineHeight: 1.45, color: "var(--sub)", fontStyle: "italic" }}>Вспомни, что в составе и какие аллергены. Потом переверни карточку.</p>
        ) : (
          <div className="sa-fadein" data-dish-back="" style={{ marginTop: 12 }}>
            <div style={lbl}>Состав</div>
            <div style={txt}>{b.comp || "Состав ещё не заполнили"}</div>
            <div style={{ ...lbl, marginTop: 10 }}>Аллергены</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {(b.al || []).length ? b.al.map((a) => <span key={a} style={{ padding: "2px 9px", borderRadius: 9, border: "1px solid var(--bad-edge)", color: "var(--bad-ink)", fontSize: 13 }}>{a}</span>)
                : <span style={{ fontSize: 14, color: "var(--ok-ink)" }}>нет из «большой восьмёрки»</span>}
            </div>
            {b.desc ? <><div style={{ ...lbl, marginTop: 10 }}>Как рассказать гостю</div><div style={{ ...txt, fontSize: 14 }}>{b.desc}</div></> : null}
            {item && item.say ? <><div style={{ ...lbl, marginTop: 10 }}>Фраза гостю из гоу-листа</div><div style={{ ...txt, fontSize: 14 }}>«{item.say}»</div></> : null}
          </div>
        )}
      </div>
    </div>
  );
}
