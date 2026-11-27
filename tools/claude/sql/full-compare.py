#!/usr/bin/env python3
"""Сравнить два снимка устройства базы (full-snapshot.sql): рабочую базу и сборку с нуля (full-build.sh).

    python3 full-compare.py рабочая.json сборка.json

Печатает, чем они расходятся: функции (есть только там или тут, другое тело, права, настройки), таблицы (колонки,
RLS, доступ клиента, правила, индексы, ограничения, триггеры), задачи pg_cron, хранилище. Пусто — значит репозиторий
собирает ровно ту базу, что работает. Выход 0 — совпали, 1 — есть расхождения.
"""
import json
import sys

# Что есть только в рабочей базе и так и должно быть: это не код из репозитория.
EXPECTED = {
    "функции": {"rls_auto_enable()": "служебная функция самого Supabase: включает RLS у новых таблиц"},
    "задачи pg_cron": {"sa-shift-reminder": "ставится руками: зовёт функцию shift-reminder (supabase/README.md, «Задачи по расписанию»)"},
}


def load(path):
    with open(path, encoding="utf-8") as f:
        d = json.load(f)
    return d.get("doc", d) if isinstance(d, dict) else d


def diff_sets(title, a, b, la, lb, out, note=None):
    only_a, only_b = sorted(set(a) - set(b)), sorted(set(b) - set(a))
    exp = EXPECTED.get(title, {})
    keep = []
    for x in only_a:
        key = x.split(" | ")[0]
        if key in exp:
            if note is not None:
                note.append(f"{title}: {key} — {exp[key]}")
        else:
            keep.append(x)
    only_a = keep
    if only_a:
        out.append(f"{title} только в «{la}»: " + ", ".join(only_a))
    if only_b:
        out.append(f"{title} только в «{lb}»: " + ", ".join(only_b))


def main():
    if len(sys.argv) != 3:
        print(__doc__)
        return 2
    A, B = load(sys.argv[1]), load(sys.argv[2])
    la, lb = "рабочая", "сборка"
    out, note = [], []
    fa, fb = A.get("functions") or {}, B.get("functions") or {}
    diff_sets("функции", fa, fb, la, lb, out, note)
    for k in sorted(set(fa) & set(fb)):
        x, y = fa[k], fb[k]
        what = [f for f in ("h", "sd", "cfg", "vol", "lang", "ret", "x") if x.get(f) != y.get(f)]
        if what:
            names = {"h": "тело", "sd": "security definer", "cfg": "настройки", "vol": "volatile", "lang": "язык",
                     "ret": "результат", "x": "кто может звать"}
            det = "; ".join(f"{names[f]}: {x.get(f)!r} ↔ {y.get(f)!r}" if f != "h" else "тело другое" for f in what)
            out.append(f"функция {k}: {det}")
    ta, tb = A.get("tables") or {}, B.get("tables") or {}
    diff_sets("таблицы", ta, tb, la, lb, out)
    for t in sorted(set(ta) & set(tb)):
        x, y = ta[t], tb[t]
        for f in ("cols", "pol", "idx", "cons", "trg"):
            xa, ya = x.get(f) or [], y.get(f) or []
            if sorted(xa) != sorted(ya):
                only_x, only_y = sorted(set(xa) - set(ya)), sorted(set(ya) - set(xa))
                out.append(f"таблица {t}, {f}: только в «{la}» {only_x} · только в «{lb}» {only_y}")
        for f in ("rls", "anon", "auth"):
            if x.get(f) != y.get(f):
                out.append(f"таблица {t}, {f}: {x.get(f)!r} ↔ {y.get(f)!r}")
    for f, title in (("cron", "задачи pg_cron"), ("buckets", "корзины хранилища"), ("storage_pol", "правила хранилища")):
        diff_sets(title, A.get(f) or [], B.get(f) or [], la, lb, out, note)
    for line in note:
        print("· ожидаемо:", line)
    for line in out:
        print("•", line)
    print(f"── расхождений: {len(out)}")
    return 1 if out else 0


if __name__ == "__main__":
    sys.exit(main())
