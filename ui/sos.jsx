import { ACCENT_SERIF } from "./styles";
// ui/sos.jsx
// «SOS в смене» — экстренная шпаргалка: здоровье гостя, аллергия, конфликт, эвакуация.
// Выжимка из уроков безопасности (модули s-er / s-al / s-hy) — только действия, без теории.
// Контент лежит в бандле → работает без сети. Обе темы: тёмная и «Для чтения».

import React from "react";
import { onActivate, vibrate } from "../lib/utils";
import { GOLD, GREEN, RED } from "./tokens";
import { UI_SVG, MARKER_RE } from "./icons";

// Красный акцент SOS: в тёмной теме мягкий, в светлой — глубже (читаемость на крем-фоне)
const sosRed = (a11y) => (a11y ? "#A03828" : "#E07878");

// Стеклянная плашка — те же токены, что у карточек уроков (обе темы), красная оправа
const glass = (T, a11y, open) => ({
  background: T.lessGlass?.bg || "linear-gradient(155deg, #382810 0%, #281C08 100%)",
  border: open
    ? `1px solid ${a11y ? "rgba(160,56,40,0.45)" : "rgba(224,120,120,0.42)"}`
    : (T.lessGlass?.border || "1px solid rgba(150,112,42,0.38)"),
  borderTop: open
    ? `1px solid ${a11y ? "rgba(160,56,40,0.55)" : "rgba(224,120,120,0.55)"}`
    : (T.lessGlass?.borderTop || "1px solid rgba(215,170,68,0.46)"),
  boxShadow: T.lessGlass?.shadow || "0 6px 22px rgba(0,0,0,0.50), 0 2px 0 rgba(200,160,60,0.18) inset, 0 -2px 4px rgba(0,0,0,0.38) inset",
  backdropFilter: T.lessGlass?.blur || "none",
  WebkitBackdropFilter: T.lessGlass?.blur || "none",
  borderRadius: 18,
});

// Иконки разделов — фирменный stroke 1.8, скруглённые концы
const I = {
  lungs: (c, s = 20) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v8"/><path d="M12 11c0 3-1.5 4-3.5 4S4 13.5 4 10.5 5.5 5 7 6.5"/><path d="M12 11c0 3 1.5 4 3.5 4s4.5-1.5 4.5-4.5S18.5 5 17 6.5"/></svg>
  ),
  alert: (c, s = 20) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3L2.5 20h19L12 3z"/><path d="M12 9.5v4.5"/><path d="M12 17.2v.1"/></svg>
  ),
  heart: (c, s = 20) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20.5S4 15 4 9.5A4.5 4.5 0 0 1 12 6.7a4.5 4.5 0 0 1 8 2.8c0 5.5-8 11-8 11z"/><path d="M4.5 12h4l1.5-3 2.5 5 1.5-2h5"/></svg>
  ),
  flame: (c, s = 20) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21c-3.9 0-6.5-2.5-6.5-6 0-3 2-5.3 3.5-7 .3 1.4 1 2.3 2 2.7C11 8.5 11.5 5.5 13.5 3c.5 3 5 5.5 5 10 0 4.5-2.6 8-6.5 8z"/></svg>
  ),
  shield: (c, s = 20) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6l7-3z"/><path d="M9.5 12l1.8 1.8 3.2-3.3"/></svg>
  ),
  glassCup: (c, s = 20) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3h8l-1.2 11a2.8 2.8 0 0 1-5.6 0L8 3z"/><path d="M12 16.8V21"/><path d="M9 21h6"/><path d="M8.6 8h6.8"/></svg>
  ),
  exit: (c, s = 20) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M13 4h6v16h-6"/><path d="M4 12h11"/><path d="M11 8l4 4-4 4"/></svg>
  ),
  phone: (c, s = 14) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 4h4l1.5 4.5L8 10a12 12 0 0 0 6 6l1.5-2.5L20 15v4a1.5 1.5 0 0 1-1.7 1.5C10.5 19.8 4.2 13.5 3.5 5.7A1.5 1.5 0 0 1 5 4z"/></svg>
  ),
};

// ── Контент шпаргалки: только действия. Источник — уроки безопасности приложения ──
const SOS_CARDS = [
  {
    id: "choke", icon: "lungs", title: "Гость подавился",
    sub: "Кашель · полная закупорка",
    lines: [
      "✅ Кашляет — не мешай: кашель сам выталкивает кусок. Будь рядом.",
      "✅ Не может дышать и говорить — зови на помощь и 103, наклони гостя вперёд.",
      "✅ Чередуй: 5 ударов ладонью между лопаток → 5 толчков в живот (приём Геймлиха) — до результата или прибытия помощи.",
      "🚫 Не бей по спине кашляющего — кусок уйдёт глубже.",
      "🚫 Не давай воду.",
    ],
  },
  {
    id: "ana", icon: "alert", title: "Аллергическая реакция",
    sub: "Отёк, зуд, удушье после еды",
    lines: [
      "✅ Это анафилаксия — скорая 103 немедленно + менеджер. Минуты решают.",
      "✅ Спроси про автоинъектор и помоги: укол в бедро.",
      "✅ Не оставляй гостя одного. Зуд во время еды — уже сигнал: спроси, зови менеджера, готовься вызвать скорую.",
      "🚫 Не жди «само пройдёт» — при отёке горла счёт идёт на минуты.",
    ],
  },
  {
    id: "med", icon: "heart", title: "Сердце · обморок · судороги",
    sub: "Когда решают секунды",
    lines: [
      "✅ Боль в груди — 103 сразу. Лучше вызвать и ошибиться.",
      "✅ Обморок — уложи, подними ноги, дай воздух, не толпитесь.",
      "✅ Судороги — убери опасное вокруг, засеки время, будь рядом.",
      "🚫 Никаких лекарств от персонала — чужое лекарство может убить.",
      "🚫 Не разжимай зубы и не держи силой — это травма.",
    ],
  },
  {
    id: "burn", icon: "flame", title: "Ожог · стекло в еде",
    sub: "Первая помощь · замена блюда",
    lines: [
      "✅ Ожог: прохладная проточная вода 10–20 минут.",
      "✅ Сними кольца и часы рядом с ожогом, пока не отекло.",
      "🚫 Масло, сметана, лёд, зубная паста — вредят.",
      "✅ Стекло или осколок у еды — только полная замена блюда и честность.",
      "🚫 Не «вылавливай» осколок — его можно не заметить. Блюдо дешевле здоровья.",
    ],
  },
  {
    id: "allerg", icon: "shield", title: "Аллергия в заказе",
    sub: "Протокол трёх шагов",
    lines: [
      "1️⃣ Уточни у гостя, на что именно аллергия — «без орехов» и «аллергия на орехи» это разное.",
      "2️⃣ Передай кухне лично + первой строкой крупно в заказе. Один канал — мало.",
      "3️⃣ Подтверди безопасные варианты у шефа. При подаче назови вслух, что блюдо безопасно.",
      "🚫 «Наверное, нет» и «уберу сверху» — недопустимы: следы остаются.",
      "📌 Целиакия — отдельный протокол: только блюда, подтверждённые шефом.",
    ],
  },
  {
    id: "conflict", icon: "glassCup", title: "Агрессия · пьяный гость",
    sub: "Деэскалация и границы",
    lines: [
      "✅ Чем громче гость — тем спокойнее ты. Признай чувство, не спорь, не оправдывайся.",
      "✅ Угрозы или оскорбления — сразу менеджер. Не геройствуй в одиночку.",
      "✅ Убери конфликт из публичной зоны — другим гостям неловко.",
      "✅ Явно пьяному не подаём: вода, еда, замедление, менеджер.",
      "🚫 Пьяного за руль — никогда: такси + менеджер. Это может спасти жизни.",
      "📌 Твоя безопасность так же важна, как безопасность гостя.",
    ],
  },
  {
    id: "evac", icon: "exit", title: "Эвакуация",
    sub: "Пожар · дым · тревога",
    lines: [
      "✅ Спокойно и твёрдо — к ближайшему выходу. Твоя зона — твои гости.",
      "✅ Помоги уязвимым: детям, пожилым, тем, кому трудно.",
      "✅ В дыму — ниже к полу.",
      "🚫 Не кричи «пожар!» — это сеет давку.",
      "🚫 Никого не пускай обратно за вещами — частая причина беды.",
      "🚫 Не лифт. Никогда не возвращайся внутрь — только спасатели.",
    ],
  },
];

export function SOSScreen({ T, a11y, onBack }) {
  const red = sosRed(a11y);
  const gold = a11y ? "#8B6A30" : GOLD;
  const text = a11y ? "#2e211a" : "#F5EFE2";
  const sub = T.modSub?.color || "#948872";
  const [open, setOpen] = React.useState(null);

  const toggle = (id) => { vibrate("light"); setOpen(open === id ? null : id); };

  return (
    <div style={T.screen} className="sa-screen">
      <div style={{ padding: "18px 18px 26px" }}>
        <button style={T.backBtn} onClick={onBack} {...onActivate(onBack)}>‹ Назад</button>

        {/* ── Шапка: красная печать SOS ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
          <div style={{
            width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: a11y ? "rgba(160,56,40,0.10)" : "rgba(224,120,120,0.12)",
            border: `1.5px solid ${a11y ? "rgba(160,56,40,0.45)" : "rgba(224,120,120,0.5)"}`,
            boxShadow: a11y ? "0 2px 8px rgba(160,56,40,0.18)" : "0 2px 10px rgba(224,120,120,0.22)",
          }}>
            <span style={{ color: red, fontSize: 12, fontWeight: "bold", fontFamily: "monospace", letterSpacing: 1 }}>SOS</span>
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ color: text, fontSize: 21, fontWeight: "bold", fontFamily: ACCENT_SERIF, lineHeight: 1.15 }}>SOS в смене</div>
            <div style={{ color: sub, fontSize: 12, marginTop: 2 }}>Только действия. Открой нужное — и действуй.</div>
          </div>
        </div>

        {/* ── Номера — всегда на виду ── */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10, margin: "12px 0 16px",
          padding: "9px 13px", borderRadius: 13,
          background: a11y ? "rgba(160,56,40,0.07)" : "rgba(224,120,120,0.08)",
          border: `1px solid ${a11y ? "rgba(160,56,40,0.28)" : "rgba(224,120,120,0.28)"}`,
        }}>
          {I.phone(red, 15)}
          <span style={{ color: text, fontSize: 12.5, lineHeight: 1.4 }}>
            <b style={{ color: red, fontFamily: "monospace" }}>112</b> — единый номер · <b style={{ color: red, fontFamily: "monospace" }}>103</b> — скорая. Вызвал — сообщи менеджеру.
          </span>
        </div>

        {/* ── Карточки-аккордеон ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {SOS_CARDS.map((c) => {
            const isOpen = open === c.id;
            return (
              <div key={c.id} style={{ ...glass(T, a11y, isOpen), overflow: "hidden" }}>
                <div onClick={() => toggle(c.id)} {...onActivate(() => toggle(c.id))}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 14px", cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: a11y ? "rgba(160,56,40,0.08)" : "rgba(224,120,120,0.10)",
                    border: `1px solid ${a11y ? "rgba(160,56,40,0.30)" : "rgba(224,120,120,0.30)"}`,
                  }}>
                    {I[c.icon](red, 18)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: text, fontSize: 14.5, fontWeight: "bold", lineHeight: 1.2 }}>{c.title}</div>
                    <div style={{ color: sub, fontSize: 11, marginTop: 2 }}>{c.sub}</div>
                  </div>
                  <div style={{ color: isOpen ? red : gold, fontSize: 18, fontWeight: "bold", transform: isOpen ? "rotate(90deg)" : "none", transition: "transform .18s ease" }}>›</div>
                </div>
                {isOpen && (
                  <div style={{ padding: "0 14px 14px 62px" }}>
                    {c.lines.map((line, i) => {
                      // Маркеры — те же перерисованные иконки, что в уроках
                      const keycap = line.match(/^([1-9])️⃣/);
                      const icon = line.startsWith("✅") ? UI_SVG.checkCircle(GREEN, 14)
                        : line.startsWith("🚫") ? UI_SVG.ban(red, 14)
                        : line.startsWith("📌") ? UI_SVG.pin(gold, 14)
                        : keycap ? (
                            <span style={{ width: 19, height: 19, borderRadius: 10, border: `1.5px solid ${red}`, color: red, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10.5, fontWeight: "bold", fontFamily: "Georgia, serif" }}>{keycap[1]}</span>
                          )
                        : null;
                      return (
                        <div key={i} style={{ color: text, fontSize: 13.5, lineHeight: 1.55, marginBottom: 7, display: "flex", gap: 9, alignItems: "flex-start", opacity: line.startsWith("🚫") ? 0.92 : 1 }}>
                          {icon && <span style={{ flexShrink: 0, marginTop: 3, display: "inline-flex" }}>{icon}</span>}
                          <span style={{ flex: 1 }}>{line.replace(MARKER_RE, "")}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Подпись-принцип, как везде в приложении ── */}
        <div style={{ margin: "18px 2px 0", padding: "8px 14px", borderLeft: `2px solid ${a11y ? "rgba(160,56,40,0.35)" : "rgba(224,120,120,0.35)"}` }}>
          <span style={{ color: sub, fontSize: 12, fontStyle: "italic", lineHeight: 1.6 }}>
            «Ты не врач. Заметить, вызвать помощь и не навредить — этого достаточно, чтобы спасти.»
          </span>
        </div>
      </div>
    </div>
  );
}
