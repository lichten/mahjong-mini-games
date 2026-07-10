# 09. Android アプリ(Capacitor)

## 結論

「四人打ち麻雀」を **Capacitor** で Android アプリ化し、Google Play で配信する。
ビルド成果物(`dist-app/`)を WebView に同梱するため、サーバー不要・完全オフラインで動作する。
Web 版(GitHub Pages の PWA)とは独立したビルド構成で、[05-deployment.md](05-deployment.md) のデプロイには影響しない。

## 構成

| 要素 | 値 |
|---|---|
| appId | `io.github.lichten.fourmahjong` |
| appName | 四人打ちリーチ麻雀 |
| webDir | `dist-app/`(git 管理外) |
| targetSdk / minSdk | 36 / 24(`android/variables.gradle`) |
| 画面 | portrait 固定(AndroidManifest)、エッジツーエッジ + `env(safe-area-inset-*)` |

### アプリ専用ビルド(第 2 Vite 構成)

Web 版は base `/mahjong-mini-games/` + VitePWA だが、Capacitor はルート配信のため別構成にしている。

- `index.app.html` — アプリ用エントリ HTML(title 固定、favicon は data URI で抑止)
- `src/main.app.tsx` — ルーター・Home・UpdateToast(SW)を含めず四人打ち麻雀を直接マウント。
  ネイティブ環境ではハード戻るボタンを `minimizeApp()` に割り当て(対局の誤爆終了防止)、
  ステータスバー色設定とスプラッシュ非表示も行う
- `vite.config.app.ts` — base `/`、`publicDir: false`(牌 SVG は src/assets からバンドルされるため
  public/ の PWA 資産は同梱しない)、出力 `dist-app/`。エントリ名を `index.html` にリネームする
  プラグイン入り
- `src/components/useWakeLock.ts` — Android WebView は Screen Wake Lock API 非対応のため、
  ネイティブ環境では `@capacitor-community/keep-awake`(FLAG_KEEP_SCREEN_ON)に分岐

### npm scripts

```sh
npm run dev:app     # アプリ構成の開発サーバー(ブラウザ確認用)
npm run build:app   # 型チェック + dist-app へビルド
npm run cap:sync    # build:app + Web 資産を android/ へコピー
npm run cap:open    # Android Studio で開く
npm run cap:run     # cap:sync + エミュレータ/実機で起動
```

### git 管理方針

- `android/` は**コミットする**(Manifest・Gradle・アイコン res がソースのため)。
  生成物(`android/app/src/main/assets/public/` 等)は `android/.gitignore` が除外する
- `dist-app/`、keystore(`*.jks`)、`android/keystore.properties` は git 管理外

## 開発環境(Windows)

1. **JDK**: Android Studio 同梱の JBR(JDK 21)を使う。CLI からは
   `JAVA_HOME="C:/Program Files/Android/Android Studio/jbr"` を指定して gradlew を実行する。
   単体で入れる場合は `scoop bucket add java && scoop install temurin21-jdk`
2. **Android Studio + SDK**: SDK Platform 36、Build-Tools、Platform-Tools、Emulator を
   SDK Manager で導入。`android/local.properties` の `sdk.dir` が SDK を指すこと(git 管理外)
3. 確認: `npx cap doctor`

## アイコン・スプラッシュ

`public/icon.svg` を単一ソースとし、`scripts/app-assets.mjs` が `assets/` に変換出力する:

- `icon-only.png` / `icon-foreground.png`(セーフゾーン用 0.72 倍)/ `icon-background.png`(緑グラデ)
- `splash.png` / `splash-dark.png`(2732×2732、フェルト緑 + 牌)

再生成手順(アイコン変更時):

```sh
node scripts/app-assets.mjs
npx capacitor-assets generate --android
```

Android 12+ のシステムスプラッシュ背景は `android/app/src/main/res/values/styles.xml` の
`windowSplashScreenBackground`(= colorPrimary #1a6b3c)で指定している。

## 署名とリリースビルド(AAB)

1. **upload key の生成**(初回のみ。keystore はリポジトリ外に保管し、絶対に紛失しないこと):
   ```sh
   keytool -genkeypair -v -keystore C:/work/keys/upload-keystore.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000
   ```
2. **`android/keystore.properties`**(git 管理外)を作成:
   ```properties
   storeFile=C:/work/keys/upload-keystore.jks
   storePassword=...
   keyAlias=upload
   keyPassword=...
   ```
   このファイルが存在しない場合、release ビルドは未署名で成功する(CI 等で壊れない)。
3. **AAB のビルド**:
   ```sh
   npm run cap:sync
   cd android && ./gradlew bundleRelease
   # → android/app/build/outputs/bundle/release/app-release.aab
   ```
4. **バージョン**: `android/app/build.gradle` の `versionCode`(リリースごとに +1)と
   `versionName`(package.json の version と同期)を更新してからビルドする。
5. Play App Signing を使う(初回アップロード時に有効化。アプリ署名鍵は Google 管理、
   手元の鍵はアップロード鍵として登録される)。

## Google Play 公開チェックリスト

- [ ] Play Console デベロッパー登録($25)。**個人アカウントは 12 人以上のテスター × 14 日間の
      クローズドテストを経ないと本番公開できない**(リードタイムに注意)
- [ ] ストア掲載情報: アプリ名「四人打ちリーチ麻雀」、説明文(vite.config.ts の manifest
      description が下書きに使える)、アイコン 512×512(`public/pwa-512x512.png` 流用可)
- [ ] スクリーンショット: `public/screenshots/`(390×844)が要件(縦 320px 以上、16:9〜9:16)を
      満たすため流用可。実機解像度での撮り直し推奨
- [ ] **フィーチャーグラフィック 1024×500 PNG(新規作成が必要)**
- [ ] プライバシーポリシー URL: `https://lichten.github.io/mahjong-mini-games/privacy.html`
      (`public/privacy.html`。データ収集なし・全データ端末内保存)
- [ ] データセーフティフォーム: 「データ収集なし・共有なし」で申告(解析・広告 SDK なし)
- [ ] コンテンツレーティング(IARC): 「シミュレートされたギャンブル」の設問で麻雀が該当と
      判定され 12+ になる可能性がある。正直に回答する
- [ ] 著作権欄に牌素材の出典([FluffyStuff/riichi-mahjong-tiles](https://github.com/FluffyStuff/riichi-mahjong-tiles)、CC0)を記載

## 検証チェックリスト

- [ ] `npm test` / `npm run lint` / `npm run build` / `npm run smoke` — Web 版が無傷であること
- [ ] `npm run build:app` → `vite preview --config vite.config.app.ts` で開始画面が直接出る・
      ホーム導線がない・SW が登録されないこと
- [ ] エミュレータ or 実機(`npm run cap:run`):
    - スプラッシュ(フェルト緑)→ 開始画面直行
    - 対局中に画面が自動消灯しない(keep-awake)
    - 戻るボタンで終了せず最小化、復帰で対局継続
    - アプリ再起動で戦績・速度設定(localStorage)が残る
    - portrait 固定、ステータスバー配色、カットアウト付き端末でセーフエリア表示
    - 機内モードで全機能動作(完全オフライン)

## 既知の注意点

- 古い Android System WebView は CSS `dvh` 単位(index.css で使用)に未対応の可能性がある。
  minSdk は 24 のままとし、動作が崩れる場合は WebView の更新を案内する
- Web 版バンドルにも `@capacitor/core` 等が数 KB 乗る(`isNativePlatform()` が false を返すだけで無害)
