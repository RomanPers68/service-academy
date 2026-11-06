// lib/use-go-today.js — v141 (Доп. 458): гоу-лист дня для меню и «Барной карты»: метка «гоу-лист» у позиций, которые смена
// советует сегодня. Гоу-лист запоминает App, когда приходит брифинг дня (rememberGoToday, lib/golist-day.js), и сообщает
// событием «sa-go-today»: открытое меню перерисуется само, даже если брифинг пришёл позже.
import React from "react";
import { goToday } from "./golist-day";

const nrm = (s) => String(s || "").toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ").trim();
export function useGoToday(restaurant) {
  const [list, setList] = React.useState(() => goToday(restaurant));
  React.useEffect(() => {
    const on = () => setList(goToday(restaurant));
    on();
    if (typeof window === "undefined") return undefined;
    window.addEventListener("sa-go-today", on);
    return () => window.removeEventListener("sa-go-today", on);
  }, [restaurant]);
  // позиция в гоу-листе: по id; классика «Барной карты» и записи без своего id — по названию
  return React.useCallback((d) => !!d && list.some((g) => (d.id != null && g.id === String(d.id)) || (d.menuId != null && g.id === String(d.menuId)) || (nrm(d.name) && nrm(g.name) === nrm(d.name))), [list]);
}
