// lib/use-content.js — хук «версия контента» (Дополнение 132).
// Компоненты, которые считают что-то по MODULES внутри useMemo, добавляют
// useContentVersion() в зависимости — и пересчитывают, когда роль догрузилась.
import { useEffect, useState } from "react";
import { contentVersion, onContentChange } from "../data/modules";

export function useContentVersion() {
  const [v, setV] = useState(contentVersion());
  useEffect(() => onContentChange(setV), []);
  return v;
}
