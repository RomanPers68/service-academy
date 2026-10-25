#!/usr/bin/env python3
# v84 (Доп. 397): читает QR-коды с картинок (OpenCV) и сверяет с ожидаемым текстом.
#   python3 qr-check.py <картинка> <ожидаемый текст> [<картинка> <текст> …]
# Печатает по строке на картинку: «✓ файл» или «✗ файл → прочитано», в конце — «OK n» или «FAIL n».
# Код ищется на картинке как есть и, если не нашёлся, — с белым полем вокруг (камера тоже видит поле стола).
import sys
import cv2

def read(path):
    img = cv2.imread(path, cv2.IMREAD_GRAYSCALE)
    if img is None:
        return None
    det = cv2.QRCodeDetector()
    for pad in (0, 40, 120):
        im = cv2.copyMakeBorder(img, pad, pad, pad, pad, cv2.BORDER_CONSTANT, value=255) if pad else img
        val, _, _ = det.detectAndDecode(im)
        if val:
            return val
    try:
        val, _, _ = cv2.QRCodeDetectorAruco().detectAndDecode(img)
        return val or ""
    except Exception:
        return ""

args = sys.argv[1:]
bad = 0
for i in range(0, len(args) - 1, 2):
    got = read(args[i])
    if got == args[i + 1]:
        print("✓", args[i])
    else:
        bad += 1
        print("✗", args[i], "→", repr(got))
print(("FAIL %d" % bad) if bad else ("OK %d" % (len(args) // 2)))
sys.exit(1 if bad else 0)
