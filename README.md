# 旅のしおり

React + TypeScriptで作った、グループ旅行向けのPWAです。予定、地図、予算、立替精算、持ち物、共有メモを一つにまとめます。

## ローカル起動

```bash
npm install
npm run dev
```

本番ビルドは `npm run build`、出力先は `dist` です。

## 地図（PMTiles）

地図はMapLibre GL JSとPMTilesを使い、Google Mapsには依存しません。既定では `public/maps/travel-miyazaki.pmtiles` を読み込みます。このアーカイブには大阪市内、関西空港、鹿児島空港〜都城の範囲（最大ズーム14）を収録しています。

別のPMTiles v3アーカイブを使う場合は、`.env.example` を参考に `VITE_PMTILES_URL` を設定してください。外部ストレージに置く場合はHTTP Range RequestとCORSの設定が必要です。

地域アーカイブを更新するには、[go-pmtiles](https://github.com/protomaps/go-pmtiles/releases) のCLIを用意し、ProtomapsのビルドURLを指定します。

```powershell
.\scripts\update-pmtiles.ps1 -SourceUrl "https://build.protomaps.com/YYYYMMDD.pmtiles" -PmtilesExecutable "C:\path\to\pmtiles.exe"
```

地図データはProtomaps BasemapおよびOpenStreetMapに由来し、地図内に帰属表示を行っています。

地図検索は、登録済み地点を優先し、見つからない場合のみ検索ボタンを押したタイミングでNominatim Search APIを呼び出します。結果は収録済みの地図範囲に限定されます。検索先を変更する場合は `VITE_GEOCODER_URL` を設定してください。公開運用では、[Nominatimの利用ポリシー](https://operations.osmfoundation.org/policies/nominatim/)に従い、利用規模に応じて自前プロキシまたは互換プロバイダーを利用してください。

## Cloudflare Pages

- フレームワーク プリセット: `Vite`
- ビルド コマンド: `npm run build`
- ビルド出力ディレクトリ: `dist`
- ルートディレクトリ: `/`

グループ共有にはPagesプロジェクトのD1バインディング `DB` が必要です。初回だけ `schema.sql` をD1へ実行してください。APIは `functions/api/groups/[[path]].ts` です。

## 主な構成

- `src/` - React画面、状態管理、型定義
- `functions/` - Cloudflare Pages Functions
- `public/` - PWAマニフェスト、Service Worker、アイコン
- `docs/product-roadmap.md` - 機能棚卸しと次の開発候補
