# 旅のしおり Web版

都城へ行く2泊3日の予定を、スマホでさくっと見られるWebしおりにしたものです。

## 入っているもの

- `index.html` - ページ本体
- `styles.css` - デザイン
- `app.js` - 地図、現在地、費用計算、持ち物チェック

## GitHub Pagesで公開する流れ

1. GitHubでリポジトリを作る
2. このフォルダの3ファイルをリポジトリ直下に置く
3. GitHubの `Settings` -> `Pages` を開く
4. `Deploy from a branch` を選ぶ
5. `main` ブランチ / `/root` を選んで保存する

少し待つと `https://ユーザー名.github.io/リポジトリ名/` で見られます。

## メモ

- 現在地表示はブラウザの許可が必要です。
- GitHub PagesはHTTPSなので、スマホでも現在地機能が使えます。
- 地図は Leaflet と OpenStreetMap のタイルを使っています。
