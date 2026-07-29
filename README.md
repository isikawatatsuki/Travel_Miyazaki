# Tabilog — 旅のしおり

旅行の日程、精算、持ち物、予約、写真、共有メモを一か所で管理するグループ旅行アプリです。
この `rust-rewrite` ブランチでは、アプリケーションを **Rust / Topcoat / PostgreSQL** へ移行しています。

[English](#english) · [旧版デモ](https://travel-miyazaki.pages.dev/)

## 現在の構成

| レイヤー | 技術 |
| --- | --- |
| Web サーバー / UI | Rust 1.97、Topcoat 0.4 |
| 非同期ランタイム | Tokio |
| データベース | PostgreSQL 17 |
| DB アクセス / マイグレーション | SQLx |
| ローカル環境 | Docker Compose |

## 実装状況

- [x] Rust / Topcoat サーバーと共通レイアウト
- [x] PostgreSQL 接続、ヘルスチェック、自動マイグレーション
- [x] 旅行一覧・旅行詳細・スケジュール表示
- [x] 旅行、メンバー、招待、日程、精算、予算、持ち物、メモ、予約、写真のDBスキーマ
- [ ] 各機能の作成・編集・削除画面
- [ ] Google OAuth、セッション、グループ共有
- [ ] 地図・住所検索
- [ ] PostgreSQL 対応の本番デプロイ

## ローカル起動

### Docker Compose（推奨）

```bash
docker compose up --build
```

ブラウザで <http://localhost:3000> を開きます。PostgreSQL の準備後、SQLx がマイグレーションを自動実行します。

### Rust サーバーを直接起動

Rust 1.88 以上と Docker が必要です。

```bash
cp .env.example .env
docker compose up -d postgres
cargo run
```

疎通確認:

```bash
curl http://localhost:3000/health
```

正常時は `ok` が返ります。

## 環境変数

| 変数 | 説明 | 既定値 |
| --- | --- | --- |
| `HOST` | Topcoat の待受アドレス | `127.0.0.1` |
| `PORT` | Topcoat の待受ポート | `3000` |
| `DATABASE_URL` | PostgreSQL 接続 URL | ローカル Compose DB |
| `RUST_LOG` | ログフィルター | `tabilog=info,topcoat=info` |
| `GOOGLE_CLIENT_ID` | Google OAuth クライアント ID | 未設定 |
| `GOOGLE_CLIENT_SECRET` | Google OAuth シークレット | 未設定 |
| `SESSION_SECRET` | セッション署名用シークレット | 未設定 |

## ディレクトリ

```text
src/
├── main.rs          # Topcoat のルート、画面、起動処理
├── db.rs            # PostgreSQL 接続とマイグレーション
├── models.rs        # DBから取得するRustモデル
├── repository.rs    # SQLクエリ
└── rust.css         # Rust版UI
migrations/          # PostgreSQLスキーマ
compose.yaml         # アプリ + PostgreSQL
Dockerfile           # Rustアプリの本番ビルド
```

## インフラ構成図

現在の `main` ブランチ（Cloudflare 版）の構成図です。Rust 版の本番基盤が決まり次第、PostgreSQL を含む図へ更新します。

[![Travel Miyazaki インフラ構成図](docs/infrastructure.png)](docs/infrastructure.svg)

---

<a id="english"></a>

## English

Tabilog is a group travel planner for itineraries, shared expenses, packing lists, reservations, photos, and notes. The `rust-rewrite` branch is migrating the application to **Rust, Topcoat, and PostgreSQL**.

### Stack

- Rust 1.97 and Topcoat 0.4
- Tokio async runtime
- PostgreSQL 17 and SQLx
- Docker Compose for local development

### Run locally

```bash
docker compose up --build
```

Open <http://localhost:3000>. The server runs PostgreSQL migrations at startup. Use `GET /health` to verify both the application and database connection.

### Migration status

The Rust server, database schema, trip list, trip details, and itinerary display are implemented. CRUD screens, authentication, group sharing, maps, and production deployment are the next migration stages. The existing React/Cloudflare source remains temporarily in this branch as a behavior reference and will be removed after feature parity is reached.
