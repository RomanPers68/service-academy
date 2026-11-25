#!/usr/bin/env python3
"""Сценарий ролика против титров — слово в слово (v197, Доп. 522).

    python3 check_text.py сценарий.txt chunks/service_manager_chunks.txt

Сценарий — текст сцены из HeyGen (get_video_scenes, поле text у script) или раздел роли из scripts.md: паузы
<break …/> не мешают. Титры читаются так же, как их читает make_captions.py: строки с «#» пропускаются, «!» золотой
плашки не считается. Совпало — «совпадает», код 0; нет — что заменить в титрах, код 1.

Нужно перед каждой новой привязкой: 25.11 в ролике сервис-менеджера сменились три фразы, а титры показывали прежние
(v194–v196). Средняя правдоподобность звука по ролику этого не видит: три плашки из 34.
"""
import difflib
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import make_captions  # noqa: E402


def script_words(text):
    return re.sub(r"<break[^>]*/>", " ", text).split()


def chunk_words(path):
    return [w for c in make_captions.load_chunks(path) for w in c["words"]]


def text_diff(script, chunks):
    """[(в титрах, в сценарии)] для каждого несовпавшего места; пустой список — слово в слово"""
    sm = difflib.SequenceMatcher(a=chunks, b=script, autojunk=False)
    return [(" ".join(chunks[i1:i2]), " ".join(script[j1:j2]))
            for op, i1, i2, j1, j2 in sm.get_opcodes() if op != "equal"]


def main(argv):
    if len(argv) != 3:
        print(__doc__)
        return 2
    with open(argv[1], encoding="utf-8") as f:
        script = script_words(f.read())
    chunks = chunk_words(argv[2])
    diff = text_diff(script, chunks)
    if not diff:
        print("совпадает: %d слов" % len(script))
        return 0
    for was, now in diff:
        print("в титрах «%s», в сценарии «%s»" % (was or "—", now or "—"))
    return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))
