// ui/use-ref-book.js — v167 (Доп. 492): правки справочника в экранах. Список правок — из памяти или с телефона сразу,
// с сервера — следом (раз за заход); сменился — экран перерисуется. Сам справочник и слияние — lib/ref-book.js.
import React from "react";
import { refBookNow, refBookSubscribe, loadRefBook } from "../lib/ref-book";

/** → { ver, items, can, missing, loaded } */
export function useRefBook() {
  const [book, setBook] = React.useState(refBookNow);
  React.useEffect(() => {
    const off = refBookSubscribe((b) => setBook(b || refBookNow()));
    setBook(refBookNow());
    loadRefBook();
    return off;
  }, []);
  return book;
}
