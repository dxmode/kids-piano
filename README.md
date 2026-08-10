# 🎹 ピアノ（iPad mini 2 向け 子ども用ピアノ PWA）

Phase 1（最小ピアノ）+ Phase 2（PWA化）+ 実機フィードバックを反映した改善版です。
静的ファイルのみで構成されているため、GitHub Pages でそのまま公開できます。

## ファイル構成

```
kids-piano/
├── index.html
├── style.css
├── app.js
├── manifest.json
├── service-worker.js
├── icons/
│   ├── icon-120.png
│   ├── icon-152.png
│   ├── icon-167.png
│   ├── icon-180.png
│   ├── icon-192.png
│   └── icon-512.png
└── samples/
    ├── C3.mp3 / Ds3.mp3 / Fs3.mp3 / A3.mp3
    ├── C4.mp3 / Ds4.mp3 / Fs4.mp3 / A4.mp3
    ├── C5.mp3 / Ds5.mp3 / Fs5.mp3 / A5.mp3
    └── C6.mp3
```

## 実装済みの機能

- 白鍵・黒鍵、C3〜C6（3オクターブ）
- タップで発音。**実際に録音されたグランドピアノの音**（Salamander Grand Piano）を、13音のサンプル+ピッチシフトで全音域に対応（読み込みに失敗した場合のみ、Web Audio APIによる合成音にフォールバック）
- マルチタッチ対応（複数鍵盤の同時押下）
- 指を押したまま横に滑らせると、なぞった鍵盤へ発音が移る（グライド）
- 「－ / 100% / ＋」ボタンで鍵盤の大きさを変更（状態は`localStorage`に保存され、次回起動時も維持）
- 拡大して画面に収まらないときは◀▶ボタンで表示位置を左右にずらせる
- 「おとのなまえ」表示ON/OFFボタン（状態も保存、ひらがなの「ど・れ・み・ふぁ・そ・ら・し」で表示）
- 「タップしてはじめる」画面で音の準備（AudioContextの起動＋ピアノ音の読み込み）を済ませてから鍵盤を表示するので、最初の1音目から遅延が出にくい
- Web App Manifest（`display: standalone`、`orientation: landscape`）
- Service Worker によるオフラインキャッシュ。コード（HTML/CSS/JS）と素材（アイコン・音声サンプル）でキャッシュを分けており、コードだけ更新してもピアノ音を再ダウンロードしない
- 横向き前提。縦向きで開いた場合は回転を促す画面を表示（Androidはホーム画面から起動時に自動で横固定、iPadは仕様上ロックできないため案内表示のみ）

## 音源について

`samples/` フォルダの音声は **Salamander Grand Piano**（Alexander Holm氏制作、[CC-BY 3.0](https://creativecommons.org/licenses/by/3.0/)）の一部（13音）を間引いて同梱しています。改変・再配布はライセンス上問題ありませんが、クレジット表記は残すようにしてください。

## GitHub へのアップロード

このフォルダの中身をそのまま `dxmode/kids-piano` リポジトリの `main` ブランチ直下に置いてください。`samples/` フォルダも忘れずに含めてください。

### Web上でアップロードする場合（Gitコマンド不要）

1. https://github.com/dxmode/kids-piano を開く
2. 「Add file」→「Upload files」
3. この `kids-piano` フォルダの中身（`index.html` や `icons/`、`samples/` フォルダなど）をまとめてドラッグ&ドロップ
4. 「Commit changes」

### コマンドラインを使う場合（Windows / Mac 共通）

```bash
git clone https://github.com/dxmode/kids-piano.git
# クローンしたフォルダの中に、このフォルダの中身をコピー
cd kids-piano
git add .
git commit -m "音源をサンプル方式に変更、UI改善"
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
2. 「タップしてはじめる」をタップし、「よみこみちゅう…」の読み込みが終わって鍵盤が表示されるまで待つ（音声サンプルを取得するので、ここだけはネット接続が必要）
3. 正常に音が鳴ることを確認
4. 画面下部の共有ボタン（□に↑のアイコン）をタップ
5. 「ホーム画面に追加」を選択
6. 名前が「ピアノ」になっていることを確認して「追加」
7. ホーム画面の「🎹 ピアノ」アイコンをタップして起動
8. Safariのアドレスバー・ツールバーが表示されず、そのままピアノが起動することを確認
9. 一度Wi-Fiを切った状態でも起動〜演奏できることを確認（オフライン動作の確認。「タップしてはじめる」の読み込みも、一度ネットありで成功していればオフラインでキャッシュから読み込まれます）

## 実機での確認ポイント（仕様書 17章に対応）

- `display: standalone` で起動するか
- Service Worker のオフラインキャッシュが効いているか（コード更新時に音声を再ダウンロードしないことも含めて）
- 音の遅延・複数音同時発音時の負荷
- マルチタッチ・グライド操作の反応
- 横画面表示、SafariのUIが出ないこと
- 長時間使用時の安定性

問題があれば、`app.js` の `AudioEngine` 部分（音の生成・サンプル読み込み）や `style.css` の鍵盤サイズ周りを中心に調整してください。

## 更新するとき

`service-worker.js` の先頭にある

```js
var CORE_CACHE = "kids-piano-core-v6";
var ASSET_CACHE = "kids-piano-assets-v1";
```

のうち、

- `index.html` / `style.css` / `app.js` / `manifest.json` を変更したとき → **`CORE_CACHE`** の数字を上げる（例: `v6` → `v7`）
- `icons/` や `samples/` の中身を変更・追加したとき → **`ASSET_CACHE`** の数字を上げる

普段のコード修正では `CORE_CACHE` だけ上げればOKです（`ASSET_CACHE` を毎回上げると、せっかくキャッシュ済みのピアノ音を無駄に再ダウンロードしてしまいます）。

## 今後の拡張（仕様書 14章・Phase 3以降）

- オクターブ切り替え・音域スクロール
- 録音・再生
- 練習モード（次に押す鍵盤を光らせる）
