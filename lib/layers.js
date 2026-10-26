// lib/layers.js — v31: «диспетчер слоёв» поверх вкладок.
//
// Раньше каждое окно поверх экрана (разминка, чек недели, освежить/зачёт/раунд мастера,
// живой гость, радио, итоги месяца, свеча на двоих, напоминания, Наставник) включалось своим
// флагом — их было восемь, и ничто не мешало открыться двум сразу: урок мог оказаться под
// столом «Освежить» (находка ревью v30). Теперь слой один, а Наставник («Разобрать с
// Наставником») — единственный, кто открывается поверх него.
//
// Состояние — список слоёв снизу вверх: [{ kind, data }]. Чистые функции — без React.

export const TOP_KINDS = new Set(["mentor", "chat"]);   // эти открываются поверх, остальные — вместо (v90: чат смены)

export function layersReducer(state, action) {
  const list = Array.isArray(state) ? state : [];
  if (!action || typeof action !== "object") return list;
  switch (action.type) {
    case "open": {
      if (!action.kind) return list;
      const layer = { kind: action.kind, data: action.data === undefined ? true : action.data };
      if (TOP_KINDS.has(action.kind)) return [...list.filter((l) => l.kind !== action.kind), layer];
      // уже открыт — обновляем данные на месте: окна поверх (Наставник) не закрываются,
      // когда слою приходит поздний ответ сервера (ревью v31: рекорды раунда мастера)
      if (list.some((l) => l.kind === action.kind)) return list.map((l) => (l.kind === action.kind ? layer : l));
      return [layer];
    }
    case "close": {
      if (!list.some((l) => l.kind === action.kind)) return list;
      return list.filter((l) => l.kind !== action.kind);
    }
    case "closeAll":
      return list.length ? [] : list;
    default:
      return list;
  }
}

// данные слоя или null, если он не открыт
export function layerData(state, kind) {
  const l = (Array.isArray(state) ? state : []).find((x) => x.kind === kind);
  return l ? l.data : null;
}

// какой слой сейчас сверху (для кнопки «Назад» Telegram)
export function topLayer(state) {
  const list = Array.isArray(state) ? state : [];
  return list.length ? list[list.length - 1].kind : null;
}
