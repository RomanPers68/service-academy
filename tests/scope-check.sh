#!/usr/bin/env bash
# Проверка областей видимости (Доп. 232): необъявленные имена и «до объявления» — то, чего не видит сборщик.
# Запуск: bash tests/scope-check.sh   (нужен typescript: npx tsc)
set -e
cat > /tmp/sa-tsconfig.json <<'JSON'
{ "compilerOptions": { "allowJs": true, "checkJs": true, "noEmit": true, "jsx": "react-jsx", "target": "es2022", "module": "esnext", "moduleResolution": "bundler", "strict": false, "skipLibCheck": true, "types": [], "allowSyntheticDefaultImports": true },
  "include": ["App.jsx", "main.jsx", "ui/**/*.jsx", "ui/**/*.js", "lib/**/*.js", "data/**/*.js"] }
JSON
cp /tmp/sa-tsconfig.json ./tsconfig.scope.json
OUT=$(npx --yes tsc -p tsconfig.scope.json 2>&1 | grep -E "error TS(2304|2552|2448|2454|2451)" | grep -vE "name '(process|Deno|Telegram|global)'" || true)
rm -f tsconfig.scope.json
if [ -n "$OUT" ]; then echo "$OUT"; echo "✗ scope errors"; exit 1; else echo "✓ scope clean"; fi
