#!/bin/bash
# Выпуск android-test (v222, Доп. 548): service-academy.apk для установки и assetlinks-entry.json — строка для
# public/.well-known/assetlinks.json с отпечатком ключа. Ключ новый — сначала он (зашифрованным): без него следующая
# сборка подписала бы APK другим ключом. Ключ уже в репозитории — его копия из выпуска убирается.
set -euo pipefail
NOTES=$(cat <<'TXT'
APK-пробник Service Academy для Android.

Ставить: файл service-academy.apk — открыть ссылку на телефоне, скачать, разрешить установку из этого источника,
«Установить». Play Protect может спросить про неизвестное приложение — «Всё равно установить».

Экраны и функции обновляются сами, с сайта. Новый APK нужен, только когда меняются значок, название или адрес.
Остальные файлы выпуска служебные.
TXT
)
gh release view "$TAG" >/dev/null 2>&1 \
  || gh release create "$TAG" --prerelease --title "Android — пробник" --notes "$NOTES" --target "$GITHUB_SHA"
if [ "${NEW_KEY:-}" = 1 ]; then gh release upload "$TAG" "$RUNNER_TEMP/signing-key.enc" --clobber; fi
gh release upload "$TAG" service-academy.apk --clobber
python3 - "$APK_FP" > assetlinks-entry.json <<'PY'
import json, sys
print(json.dumps({"relation": ["delegate_permission/common.handle_all_urls"],
  "target": {"namespace": "android_app", "package_name": "app.serviceacademy.twa", "sha256_cert_fingerprints": [sys.argv[1]]}}, indent=2))
PY
gh release upload "$TAG" assetlinks-entry.json --clobber
if [ -f android/signing-key.enc ]; then gh release delete-asset "$TAG" signing-key.enc -y 2>/dev/null || true; fi
URL="https://github.com/$GITHUB_REPOSITORY/releases/download/$TAG/service-academy.apk"
{ echo "### APK-пробник готов"; echo; echo "Скачать: $URL"; echo; echo "Отпечаток ключа: \`$APK_FP\`"; } >> "$GITHUB_STEP_SUMMARY"
echo "готово: $URL"
