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
- 地図はGoogle Mapsの埋め込みを使っています。

## Cloudflareでグループ共有を使う流れ

1. Cloudflare Pagesにこのリポジトリを接続する
2. D1で `travel_miyazaki` データベースを作る
3. `schema.sql` をD1に適用する
4. Pagesの設定でD1 bindingを追加する
   - Binding name: `DB`
   - Database: `travel_miyazaki`
5. デプロイ後、しおりの「旅グループ」からグループを作成する

GitHub Pages上ではCloudflare APIがないため、従来どおり端末内保存とURL共有が使えます。
Wranglerで直接デプロイする場合は、`wrangler.example.toml` を `wrangler.toml` にコピーして `database_id` を実際のD1 IDに差し替えてください。
