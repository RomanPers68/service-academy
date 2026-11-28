#!/bin/bash
# Ключ подписи APK-пробника (v222, Доп. 548). Пароль — секрет GitHub APK_KEY_PASSWORD (Settings → Secrets and
# variables → Actions); сам ключ хранится зашифрованным этим паролем: android/signing-key.enc в репозитории, а до того,
# как он туда попал, — в выпуске android-test. Нет нигде — первый запуск: создаётся новый и кладётся в выпуск.
# Ключ один на все сборки: только тогда новый APK встаёт поверх старого, а отпечаток в assetlinks.json не меняется.
# Пишет в $GITHUB_ENV: APK_KEYSTORE (путь), APK_FP (отпечаток SHA-256), NEW_KEY=1 — если ключ новый.
set -euo pipefail
: "${APK_KEY_PASSWORD:?нет секрета APK_KEY_PASSWORD — Settings → Secrets and variables → Actions}"
[ ${#APK_KEY_PASSWORD} -ge 6 ] || { echo "::error::пароль APK_KEY_PASSWORD короче 6 символов — keytool такой не примет"; exit 1; }
KS="$RUNNER_TEMP/sa.jks"
dec() { openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -in "$1" -out "$KS" -pass env:APK_KEY_PASSWORD \
  || { echo "::error::ключ не расшифровался — пароль в секрете не тот, что при создании ключа"; exit 1; }; }
if [ -f android/signing-key.enc ]; then
  dec android/signing-key.enc; echo "ключ — из репозитория (android/signing-key.enc)"
elif gh release download "$TAG" -p signing-key.enc -D "$RUNNER_TEMP" --clobber 2>/dev/null; then
  dec "$RUNNER_TEMP/signing-key.enc"; echo "ключ — из выпуска $TAG"
else
  keytool -genkeypair -keystore "$KS" -storetype PKCS12 -alias sa -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass "$APK_KEY_PASSWORD" -keypass "$APK_KEY_PASSWORD" -dname "CN=Service Academy, O=Service Academy, C=RU"
  openssl enc -aes-256-cbc -pbkdf2 -iter 600000 -salt -in "$KS" -out "$RUNNER_TEMP/signing-key.enc" -pass env:APK_KEY_PASSWORD
  echo "NEW_KEY=1" >> "$GITHUB_ENV"; echo "ключ — новый (первый запуск)"
fi
FP=$(keytool -list -v -keystore "$KS" -storepass "$APK_KEY_PASSWORD" -alias sa | grep -m1 "SHA256:" | sed 's/.*SHA256: *//')
[[ "$FP" =~ ^([0-9A-F]{2}:){31}[0-9A-F]{2}$ ]] || { echo "::error::не прочитал отпечаток ключа: $FP"; exit 1; }
echo "APK_KEYSTORE=$KS" >> "$GITHUB_ENV"
echo "APK_FP=$FP" >> "$GITHUB_ENV"
echo "отпечаток ключа (SHA-256): $FP"
