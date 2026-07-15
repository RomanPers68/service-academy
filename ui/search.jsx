// ui/search.jsx
// Глобальный поиск: уроки текущей роли + глоссарий + меню ресторана + справочник.
// Кейс: гость спросил про глютен — сотрудник вбивает слово и за 5 секунд видит
// и определение, и блюда с этим аллергеном, и урок с протоколом.

import React from "react";
import { GLOSSARY } from "../data/glossary";
import { RESTAURANT_MENUS } from "../data/menu";
import { REFERENCE_COURSE, REFERENCE_WINE_COURSE } from "../data/reference";
import { onActivate, vibrate } from "../lib/utils";
import { UI_SVG } from "./icons";

const norm = (s) => (s || "").toLowerCase().replace(/ё/g, "е");

// Фрагмент текста вокруг найденного слова — чтобы было видно контекст
const snippet = (content, q) => {
  const plain = (content || "").replace(/\[img:[^\]]*\]/g, "").replace(/[*#•☑]/g, "").replace(/\s+/g, " ").trim();
  const i = norm(plain).indexOf(q);
  if (i < 0) return plain.slice(0, 90) + (plain.length > 90 ? "…" : "");
  const start = Math.max(0, i - 40);
  const end = Math.min(plain.length, i + q.length + 70);
  return (start > 0 ? "…" : "") + plain.slice(start, end) + (end < plain.length ? "…" : "");
};

// Меню ресторана: базовые блюда (если не скрыты) + добавленные менеджером в редакторе
const dishesFor = (restaurant) => {
  if (!restaurant) return [];
  let hide = {}, custom = {};
  try { hide = JSON.parse(localStorage.getItem("sa_menu_hide_samples") || "{}"); } catch (e) {}
  try { custom = JSON.parse(localStorage.getItem("sa_menu_custom") || "{}"); } catch (e) {}
  const samples = hide[restaurant] ? [] : (RESTAURANT_MENUS[restaurant] || []);
  return [...samples, ...(custom[restaurant] || [])];
};

const REF_COURSES = [REFERENCE_COURSE, REFERENCE_WINE_COURSE];

export function SearchScreen({ T, a11y, role, modules = [], profile, onOpen, onReferenceLesson, onBack }) {
  const [q, setQ] = React.useState("");
  const [openKey, setOpenKey] = React.useState(null);
  const gold = a11y ? "#8B6A30" : "#C8A96E";
  const red = a11y ? "#A03828" : "#E07878";
  const textColor = a11y ? "#2e211a" : "#F5EFE2";
  const query = norm(q.trim());

  const dishes = React.useMemo(() => dishesFor(profile?.restaurant), [profile?.restaurant]);

  const results = React.useMemo(() => {
    if (query.length < 2) return { terms: [], lessons: [], menu: [], ref: [] };
    const terms = GLOSSARY.filter(g => norm(g.term).includes(query) || norm(g.def).includes(query)).slice(0, 8);

    const menu = dishes.filter(d => {
      const hay = norm([d.name, d.cat, d.desc, (d.ingredients || []).join(" "), (d.allergens || []).join(" "), d.note, d.pairing].join(" "));
      return hay.includes(query);
    }).slice(0, 8).map(d => ({ d, byAllergen: (d.allergens || []).some(a => norm(a).includes(query)) }));

    const ref = [];
    for (const course of REF_COURSES) {
      for (const l of (course.lessons || [])) {
        if (l.type !== "lesson") continue;
        const inTitle = norm(l.title).includes(query);
        if (inTitle || norm(l.content || "").includes(query)) {
          ref.push({ course, l, inTitle });
          if (ref.length >= 6) break;
        }
      }
      if (ref.length >= 6) break;
    }
    ref.sort((a, b) => (b.inTitle ? 1 : 0) - (a.inTitle ? 1 : 0));

    const lessons = [];
    outer:
    for (const m of modules) {
      for (const l of (m.lessons || [])) {
        if (l.type !== "lesson") continue;
        const inTitle = norm(l.title).includes(query);
        const inBody = !inTitle && norm(l.content || "").includes(query);
        if (inTitle || inBody) {
          lessons.push({ m, l, inTitle });
          if (lessons.length >= 20) break outer;
        }
      }
    }
    lessons.sort((a, b) => (b.inTitle ? 1 : 0) - (a.inTitle ? 1 : 0));
    return { terms, lessons, menu, ref };
  }, [query, modules, dishes]);

  const nothing = query.length >= 2 && !results.terms.length && !results.lessons.length && !results.menu.length && !results.ref.length;
  const toggle = (key) => { vibrate("light"); setOpenKey(openKey === key ? null : key); };

  return (
    <div style={T.screen} className="sa-screen">
      <div style={T.lessHead}>
        <button style={T.backBtn2} onClick={onBack}>‹</button>
        <div style={T.lessHeadTitle}>Поиск</div>
      </div>
      <div style={{ padding: "10px 16px 6px" }}>
        <input
          autoFocus
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpenKey(null); }}
          placeholder="Глютен, прожарки, жалоба, декантация…"
          style={{ width: "100%", boxSizing: "border-box", padding: "13px 15px", borderRadius: 14, border: `1px solid ${gold}88`, borderTop: `1px solid ${gold}55`, background: a11y ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.25)", boxShadow: "0 2px 6px rgba(0,0,0,0.12) inset", color: textColor, fontSize: 16, outline: "none" }}
        />
      </div>

      {query.length < 2 && (
        <div style={{ textAlign: "center", padding: "44px 24px" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔎</div>
          <div style={{ fontSize: 14, lineHeight: 1.6, color: T.para?.color }}>Введи минимум 2 буквы — найду по урокам твоей роли, глоссарию, меню ресторана и справочнику.</div>
        </div>
      )}

      {nothing && (
        <div style={{ textAlign: "center", padding: "44px 24px" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🤔</div>
          <div style={{ fontSize: 14, color: T.para?.color }}>Ничего не нашлось. Попробуй другое слово или его часть.</div>
        </div>
      )}

      {/* ── Меню — первым: в смене чаще всего ищут блюдо или аллерген ── */}
      {results.menu.length > 0 && <div style={T.secTitle}>Меню{results.menu.some(x => x.byAllergen) ? " · найдено по аллергену" : ""}</div>}
      <div style={{ padding: "0 14px" }}>
        {results.menu.map(({ d, byAllergen }) => {
          const key = "dish:" + (d.id || d.name);
          const open = openKey === key;
          return (
            <div key={key} className="sa-card"
              style={{ ...T.modCard, margin: "0 0 10px", flexDirection: "column", alignItems: "stretch", cursor: "pointer" }}
              onClick={() => toggle(key)} {...onActivate(() => toggle(key))}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ ...T.modBar, background: byAllergen ? red : gold }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={T.modTitle}>{d.name}</div>
                  <div style={{ ...T.modSub, whiteSpace: "normal" }}>{d.cat || "Блюдо"}{byAllergen ? " · содержит искомый аллерген" : ""}</div>
                </div>
                <div style={T.modArrow}>{open ? "˅" : "›"}</div>
              </div>
              {open && (
                <div style={{ marginTop: 8, paddingLeft: 10, borderLeft: `2px solid ${byAllergen ? red : gold}` }}>
                  {d.desc && <div style={{ fontSize: 13, color: T.para?.color, lineHeight: 1.55, marginBottom: 8, whiteSpace: "normal" }}>{d.desc}</div>}
                  {(d.ingredients || []).length > 0 && (
                    <div style={{ fontSize: 12.5, color: T.para?.color, lineHeight: 1.5, marginBottom: 8, whiteSpace: "normal" }}>
                      <span style={{ color: gold, fontWeight: "bold" }}>Состав: </span>{d.ingredients.join(", ")}
                    </div>
                  )}
                  {(d.allergens || []).length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8 }}>
                      {d.allergens.map(a => (
                        <span key={a} style={{ fontSize: 10.5, fontWeight: "bold", color: red, border: `1px solid ${red}66`, background: a11y ? "rgba(160,56,40,0.06)" : "rgba(224,120,120,0.08)", borderRadius: 9, padding: "3px 8px" }}>{a}</span>
                      ))}
                    </div>
                  )}
                  {d.note && <div style={{ fontSize: 12, color: T.modSub.color, fontStyle: "italic", lineHeight: 1.5, whiteSpace: "normal" }}>{d.note}</div>}
                  <div style={{ fontSize: 11, color: T.modSub.color, marginTop: 8, whiteSpace: "normal", display: "flex", gap: 7, alignItems: "flex-start" }}><span style={{ flexShrink: 0, marginTop: 1, display: "inline-flex" }}>{UI_SVG.pin(gold, 12)}</span><span style={{ flex: 1 }}>Сомневаешься в аллергенах — подтверди у шефа. База — подсказка, не замена протоколу.</span></div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {results.terms.length > 0 && <div style={T.secTitle}>Глоссарий</div>}
      <div style={{ padding: "0 14px" }}>
        {results.terms.map((g) => {
          const key = "term:" + g.term;
          return (
            <div key={key} className="sa-card"
              style={{ ...T.modCard, margin: "0 0 10px", flexDirection: "column", alignItems: "stretch", cursor: "pointer" }}
              onClick={() => toggle(key)} {...onActivate(() => toggle(key))}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ ...T.modBar, background: gold }} />
                <div style={{ ...T.modTitle, flex: 1 }}>{g.term}</div>
                <div style={T.modArrow}>{openKey === key ? "˅" : "›"}</div>
              </div>
              {openKey === key && (
                <div style={{ fontSize: 13.5, color: T.para?.color, whiteSpace: "normal", lineHeight: 1.55, marginTop: 8, paddingLeft: 10, borderLeft: `2px solid ${gold}` }}>{g.def}</div>
              )}
            </div>
          );
        })}
      </div>

      {results.ref.length > 0 && <div style={T.secTitle}>Справочник</div>}
      <div style={{ padding: "0 14px" }}>
        {results.ref.map(({ course, l }) => (
          <div key={l.id} className="sa-card"
            style={{ ...T.modCard, margin: "0 0 10px", cursor: onReferenceLesson ? "pointer" : "default" }}
            onClick={() => { if (onReferenceLesson) { vibrate("light"); onReferenceLesson(l.id); } }}
            {...onActivate(() => { if (onReferenceLesson) { vibrate("light"); onReferenceLesson(l.id); } })}>
            <div style={{ ...T.modBar, background: gold }} />
            <div style={{ flex: 1, minWidth: 0, padding: "2px 0" }}>
              <div style={{ fontSize: 11, color: gold, letterSpacing: 1, marginBottom: 2, fontFamily: "monospace" }}>{course.title}</div>
              <div style={T.modTitle}>{l.title}</div>
              <div style={{ ...T.modSub, whiteSpace: "normal", lineHeight: 1.5 }}>{snippet(l.content, query)}</div>
            </div>
            <div style={T.modArrow}>›</div>
          </div>
        ))}
      </div>

      {results.lessons.length > 0 && <div style={T.secTitle}>Уроки</div>}
      <div style={{ padding: "0 14px 20px" }}>
        {results.lessons.map(({ m, l }) => (
          <div key={l.id} className="sa-card"
            style={{ ...T.modCard, margin: "0 0 10px" }}
            onClick={() => { vibrate("light"); onOpen(m, l); }}
            {...onActivate(() => { vibrate("light"); onOpen(m, l); })}>
            <div style={{ ...T.modBar, background: m.color }} />
            <div style={{ flex: 1, minWidth: 0, padding: "2px 0" }}>
              <div style={{ fontSize: 11, color: m.color, letterSpacing: 1, marginBottom: 2, fontFamily: "monospace" }}>{m.title}</div>
              <div style={T.modTitle}>{l.title}</div>
              <div style={{ ...T.modSub, whiteSpace: "normal", lineHeight: 1.5 }}>{snippet(l.content, query)}</div>
            </div>
            <div style={T.modArrow}>›</div>
          </div>
        ))}
      </div>
    </div>
  );
}
