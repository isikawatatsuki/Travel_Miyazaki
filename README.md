# 旅のしおり

React + TypeScriptで作った、グループ旅行向けのPWAです。予定、地図、予算、立替精算、持ち物、共有メモを一つにまとめます。

## ローカル起動

```bash
npm install
npm run dev
```

本番ビルドは `npm run build`、出力先は `dist` です。

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
