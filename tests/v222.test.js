// v222 (Доп. 548): APK-пробник для Android. Оболочка Trusted Web Activity над сайтом (android/), собирается на GitHub
// (.github/workflows/android-apk.yml) и лежит в выпуске android-test; ключ подписи — android/signing-key.enc,
// зашифрованный паролем из секрета APK_KEY_PASSWORD; сайт подтверждает приложение в public/.well-known/assetlinks.json.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";

const rd = (f) => readFileSync(f, "utf8");
const MAN = rd("android/app/src/main/AndroidManifest.xml"), GR = rd("android/app/build.gradle"), WF = rd(".github/workflows/android-apk.yml");
const STR = rd("android/app/src/main/res/values/strings.xml"), COL = rd("android/app/src/main/res/values/colors.xml");
const WEB = JSON.parse(rd("public/manifest.webmanifest"));
const SITE = "https://service-academy-16te.vercel.app";
const LINKS = JSON.parse(rd("public/.well-known/assetlinks.json"));
const FP = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/;
const png = (f) => { const b = readFileSync(f); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
const DENS = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

describe("v222 · версия и журнал", () => {
  it("сборка v222, Дополнение 548, строки не длиннее 120", () => {
    const n = Number(/· сборка v(\d+)/.exec(rd("ui/menu-trainer.jsx"))[1]);
    const max = Math.max(...readdirSync("tests").map((f) => { const m = /^v(\d+)\.test\.js$/.exec(f); return m ? Number(m[1]) : 0; }));
    expect(n).toBe(max);
    expect(max).toBeGreaterThanOrEqual(222);
    const c = rd("CHANGES.md"), part = c.slice(c.indexOf("# Дополнение 548"));
    expect(part).toMatch(/^# Дополнение 548 — .*\(v222\)/);
    for (const w of ["releases/download/android-test/service-academy.apk", "app.serviceacademy.twa", "android/signing-key.enc", "APK_KEY_PASSWORD", "assetlinks.json", "docs/android-apk.md"]) expect(part, w).toContain(w);
    for (const line of part.split("\n")) expect(line.length, line).toBeLessThanOrEqual(120);
  });
  it("docs/android-apk.md: постоянная ссылка, как поставить, ключ не менять, старая сборка", () => {
    const d = rd("docs/android-apk.md");
    expect(d).toContain("https://github.com/RomanPers68/service-academy/releases/download/android-test/service-academy.apk");
    for (const w of ["Всё равно установить", "Куда присылать", "Run workflow", "APK_KEY_PASSWORD", "Не менять и не удалять", "app.vercel.service_academy_16te.twa"]) expect(d, w).toContain(w);
    expect(d).not.toContain("ЗАМЕНИТЬ_НА_ОТПЕЧАТОК");
  });
});

describe("v222 · оболочка (android/)", () => {
  it("пакет, версии сборки, библиотека TWA, подпись из окружения", () => {
    expect(GR).toContain('namespace "app.serviceacademy.twa"');
    expect(GR).toContain('applicationId "app.serviceacademy.twa"');
    expect(GR).toContain("compileSdk 36");
    expect(GR).toContain("minSdk 24");
    expect(GR).toContain("targetSdk 35");
    expect(GR).toContain('implementation "com.google.androidbrowserhelper:androidbrowserhelper:2.7.4"');
    expect(GR).toContain('storeFile file(env("APK_KEYSTORE", "missing.jks"))');
    expect(GR).toContain('storePassword System.getenv("APK_KEY_PASSWORD")');
    expect(rd("android/build.gradle")).toContain('id "com.android.application" version "8.9.1" apply false');
    expect(rd("android/settings.gradle")).toContain('include ":app"');
  });
  it("манифест: открывает сайт приложения (app_url), ссылки на него — в приложении", () => {
    expect(MAN).toContain('android:name="com.google.androidbrowserhelper.trusted.LauncherActivity"');
    expect(MAN).toContain('android:name="android.support.customtabs.trusted.DEFAULT_URL"\n                android:value="' + SITE + '/" />');
    expect(MAN).toContain('<intent-filter android:autoVerify="true">');
    expect(MAN).toContain('android:host="service-academy-16te.vercel.app"');
    expect(MAN).toContain('<category android:name="android.intent.category.LAUNCHER" />');
    expect(MAN).toContain('<meta-data\n            android:name="asset_statements"\n            android:resource="@string/assetStatements" />');
    const st = /name="assetStatements"[^>]*>(.*)<\/string>/.exec(STR)[1].replace(/\\"/g, '"');
    expect(JSON.parse(st)).toEqual([{ relation: ["delegate_permission/common.handle_all_urls"], target: { namespace: "web", site: SITE } }]);
  });
  it("уведомления от имени приложения: DelegationService, разрешение Android 13+, значок уведомления", () => {
    expect(MAN).toContain('<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />');
    expect(MAN).toContain('android:name="com.google.androidbrowserhelper.trusted.DelegationService"\n            android:enabled="true"\n            android:exported="true">');
    expect(MAN).toContain('<action android:name="android.support.customtabs.trusted.TRUSTED_WEB_ACTIVITY_SERVICE" />');
    expect(MAN).toContain('android:name="android.support.customtabs.trusted.SMALL_ICON"\n                android:resource="@drawable/ic_notification_icon" />');
    expect(MAN).toContain('<activity android:name="com.google.androidbrowserhelper.trusted.NotificationPermissionRequestActivity" />');
    expect(MAN).toContain('<uses-permission android:name="android.permission.VIBRATE" />');
  });
  it("заставка через FileProvider: один и тот же адрес у провайдера и у LauncherActivity", () => {
    expect((MAN.match(/\$\{applicationId\}\.fileprovider/g) || []).length).toBe(2);
    expect(rd("android/app/src/main/res/xml/filepaths.xml")).toContain('<files-path name="twa_splash" path="twa_splash/" />');
  });
  it("имя, цвета — как в манифесте сайта", () => {
    expect(STR).toContain(`<string name="appName" translatable="false">${WEB.name}</string>`);
    expect(STR).toContain(`<string name="launcherName" translatable="false">${WEB.short_name}</string>`);
    for (const k of ["colorPrimary", "navigationColor", "backgroundColor", "iconBackground"]) expect(COL, k).toContain(`<color name="${k}">${WEB.theme_color}</color>`);
    expect(WEB.background_color).toBe(WEB.theme_color);
  });
  it("значки по всем плотностям: 48 dp, адаптивный слой 108 dp, уведомление 24 dp, заставка 160 dp", () => {
    const R = "android/app/src/main/res";
    for (const [d, k] of Object.entries(DENS)) {
      expect(png(`${R}/mipmap-${d}/ic_launcher.png`), d).toEqual([Math.round(48 * k), Math.round(48 * k)]);
      expect(png(`${R}/mipmap-${d}/ic_launcher_foreground.png`), d).toEqual([Math.round(108 * k), Math.round(108 * k)]);
      expect(png(`${R}/drawable-${d}/ic_notification_icon.png`), d).toEqual([Math.round(24 * k), Math.round(24 * k)]);
      expect(png(`${R}/drawable-${d}/splash.png`), d).toEqual([Math.round(160 * k), Math.round(160 * k)]);
    }
    const a = rd(`${R}/mipmap-anydpi-v26/ic_launcher.xml`);
    expect(a).toContain('<background android:drawable="@color/iconBackground" />');
    expect(a).toContain('<foreground android:drawable="@mipmap/ic_launcher_foreground" />');
  });
});

describe("v222 · ключ подписи и assetlinks.json", () => {
  it("ключ — только зашифрованный (openssl, соль), в репозитории нет ни .jks, ни пароля", () => {
    const k = readFileSync("android/signing-key.enc");
    expect(k.subarray(0, 8).toString("latin1")).toBe("Salted__");
    expect(k.length).toBeGreaterThan(1000);
    expect(readdirSync("android").filter((f) => /\.(jks|keystore)$/.test(f))).toEqual([]);
    expect(rd("android/.gitignore")).toContain("*.jks");
    const ks = rd("android/key.sh");
    expect(ks).toContain("openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -in \"$1\" -out \"$KS\" -pass env:APK_KEY_PASSWORD");
    expect(ks).not.toMatch(/echo[^\n]*\$APK_KEY_PASSWORD/);
    expect(ks.indexOf("if [ -f android/signing-key.enc ]")).toBeLessThan(ks.indexOf("keytool -genkeypair"));
  });
  it("assetlinks.json: новый пакет с отпечатком ключа, строка старой сборки на месте, отдаётся как JSON", () => {
    const neu = LINKS.find((x) => x.target.package_name === "app.serviceacademy.twa");
    const old = LINKS.find((x) => x.target.package_name === "app.vercel.service_academy_16te.twa");
    expect(LINKS.length).toBe(2);
    for (const x of [neu, old]) {
      expect(x.relation).toEqual(["delegate_permission/common.handle_all_urls"]);
      expect(x.target.namespace).toBe("android_app");
      expect(x.target.sha256_cert_fingerprints.length).toBe(1);
      expect(x.target.sha256_cert_fingerprints[0]).toMatch(FP);
    }
    expect(neu.target.sha256_cert_fingerprints[0]).not.toBe(old.target.sha256_cert_fingerprints[0]);
    const v = JSON.parse(rd("vercel.json"));
    expect(v.headers.find((h) => h.source === "/.well-known/assetlinks.json").headers).toContainEqual({ key: "Content-Type", value: "application/json" });
  });
});

describe("v222 · сборка на GitHub (.github/workflows/android-apk.yml)", () => {
  it("когда: оболочка поменялась или вручную; пишет только в выпуск", () => {
    expect(WF).toContain("workflow_dispatch:");
    for (const p of ['"android/**"', '"public/manifest.webmanifest"', '"public/icons/**"', '".github/workflows/android-apk.yml"']) expect(WF, p).toContain("      - " + p);
    expect(WF).toContain("permissions:\n  contents: write");
    expect(WF).toContain("APK_KEY_PASSWORD: ${{ secrets.APK_KEY_PASSWORD }}");
    expect(WF).toContain("TAG: android-test");
  });
  it("шаги: ключ → сборка → APK подписан тем же ключом → выпуск", () => {
    const at = (s) => WF.indexOf(s);
    expect(at("run: bash android/key.sh")).toBeGreaterThan(0);
    expect(at("run: bash android/key.sh")).toBeLessThan(at("gradle -p android --no-daemon --stacktrace assembleRelease"));
    expect(at("assembleRelease")).toBeLessThan(at('"$BT/apksigner" verify --print-certs service-academy.apk'));
    expect(WF).toContain('[ "$CERT" = "$APK_FP" ] || { echo "::error::APK подписан не тем ключом: $CERT, а нужен $APK_FP"; exit 1; }');
    expect(at("apksigner")).toBeLessThan(at("run: bash android/release.sh"));
  });
  it("выпуск: сначала новый ключ, потом APK; ключ из репозитория — копия из выпуска убирается", () => {
    const r = rd("android/release.sh");
    expect(r.indexOf('gh release upload "$TAG" "$RUNNER_TEMP/signing-key.enc" --clobber')).toBeLessThan(r.indexOf('gh release upload "$TAG" service-academy.apk --clobber'));
    expect(r).toContain('if [ -f android/signing-key.enc ]; then gh release delete-asset "$TAG" signing-key.enc -y 2>/dev/null || true; fi');
    expect(r).toContain('"package_name": "app.serviceacademy.twa"');
    expect(existsSync("android/signing-key.enc")).toBe(true);
  });
});
