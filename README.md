# 🎹 ピアノ（iPad mini 2 向け 子ども用ピアノ PWA）

Phase 1（最小ピアノ）+ Phase 2（PWA化）の実装です。
静的ファイルのみで構成されているため、GitHub Pages でそのまま公開できます。

## ファイル構成

```
kids-piano/
├── index.html
├── style.css
├── app.js
├── manifest.json
├── service-worker.js
└── icons/
    ├── icon-120.png
    ├── icon-152.png
    ├── icon-167.png
    ├── icon-180.png
    ├── icon-192.png
    └── icon-512.png
```

## 実装済みの機能

- 白鍵・黒鍵、C3〜C6（3オクターブ）
- タップで発音（Web Audio API によるピアノ風の合成音、外部音源ファイルなし）
- マルチタッチ対応（複数鍵盤の同時押下）
- 指を押したまま横に滑らせると、なぞった鍵盤へ発音が移る（グライド）
- 2本指ピンチで鍵盤の大きさを変更（ピンチアウトで拡大、ピンチインで縮小）
- 鍵盤サイズは `localStorage` に保存され、次回起動時も維持
- 「おとのなまえ」表示ON/OFFボタン（状態も保存）
- 「おおきさをもどす」ボタンで鍵盤サイズを100%にリセット
- Web App Manifest（`display: standalone`、`orientation: landscape`）
- Service Worker によるオフラインキャッシュ（一度読み込めば電波なしでも起動）
- 横向き前提。縦向きで開いた場合は回転を促す画面を表示

## GitHub へのアップロード

このフォルダの中身をそのまま `dxmode/kids-piano` リポジトリの `main` ブランチ直下に置いてください。

### Web上でアップロードする場合（Gitコマンド不要）

1. https://github.com/dxmode/kids-piano を開く
2. 「Add file」→「Upload files」
3. この `kids-piano` フォルダの中身（`index.html` や `icons/` フォルダなど）をまとめてドラッグ&ドロップ
4. 「Commit changes」

### コマンドラインを使う場合（Windows / Mac 共通）

```bash
git clone https://github.com/dxmode/kids-piano.git
# クローンしたフォルダの中に、このフォルダの中身をコピー
cd kids-piano
git add .
git commit -m "Phase1+2: 最小ピアノ + PWA化"
git push origin main
```

## GitHub Pages の設定

1. GitHubのリポジトリページで「Settings」を開く
2. 左メニューの「Pages」を開く
3. 「Build and deployment」→「Source」を **Deploy from a branch** にする
4. 「Branch」を `main` / `/ (root)` にして「Save」
5. しばらく待つと、下記URLで公開されます

```
https://dxmode.github.io/kids-piano/
```

## iPad mini 2（iOS 12.5.8）でホーム画面に追加

1. iPadのSafariで `https://dxmode.github.io/kids-piano/` を開く
2. 一度ピアノが表示され、正常に音が鳴ることを確認（オフラインキャッシュのため）
3. 画面下部の共有ボタン（□に↑のアイコン）をタップ
4. 「ホーム画面に追加」を選択
5. 名前が「ピアノ」になっていることを確認して「追加」
6. ホーム画面の「🎹 ピアノ」アイコンをタップして起動
7. Safariのアドレスバー・ツールバーが表示されず、そのままピアノが起動することを確認
8. 一度Wi-Fiを切った状態でも起動できることを確認（オフライン動作の確認）

## 実機での確認ポイント（仕様書 17章に対応）

- `display: standalone` で起動するか
- Service Worker のオフラインキャッシュが効いているか
- Web Audio API の遅延・複数音同時発音時の負荷
- マルチタッチ・ピンチ操作の反応
- 横画面表示、SafariのUIが出ないこと
- 長時間使用時の安定性

問題があれば、`app.js` の `AudioEngine` 部分（音の生成）や `style.css` の鍵盤サイズ周りを中心に調整してください。

## 更新するとき

`service-worker.js` の先頭にある

```js
var CACHE_NAME = "kids-piano-v1";
```

の数字部分（`v1` → `v2` など）を、ファイルを更新するたびに変更してください。
これを忘れると、iPad側の古いキャッシュが優先されて更新が反映されないことがあります。

## 今後の拡張（仕様書 14章・Phase 3以降）

- 音色変更・より本物に近いピアノ音
- オクターブ切り替え・音域スクロール
- 録音・再生
- 練習モード（次に押す鍵盤を光らせる）
- 「ド レ ミ」表記への切り替え
