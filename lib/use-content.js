// lib/use-content.js — хук «версия контента» (Дополнение 132).
// Компоненты, которые считают что-то по MODULES внутри useMemo, добавляют
// useContentVersion() в зависимости — и пересчитывают, когда роль догрузилась.
import { useEffect, useState } from "react";
import { contentVersion, onContentChange, loadAllModules } from "../data/modules";

export function useContentVersion() {
  const [v, setV] = useState(contentVersion());
  useEffect(() => onContentChange(setV), []);
  return v;
}

// v79 (Доп. 392): экраны, которые считают по программе ВСЕХ ролей (книга отзывов, статистика, карточка сотрудника,
// аналитика), сами просят её догрузить и пересчитываются, когда роли приехали. До v79 всю программу на каждом старте
// подтягивала уборка банка ошибок — теперь её грузит фоновый прогрев после главной, а этот хук — на случай, если экран
// открыли раньше (или сеть бережётся и прогрева не было).
export function useAllModules() {
  const v = useContentVersion();
  useEffect(() => { loadAllModules().catch(() => {}); }, []);
  return v;
}
