# アカウント登録とチュートリアル 仕様

作成日: 2026-07-25
対象: `functions/api/`, `src/useTripState.ts`, `src/pages/SharePage.tsx`, `schema.sql`

---

## 0. この仕様が解く2つの課題

**課題は別物なので、分けて設計する。**

| # | 課題 | 症状 | 解 |
|---|------|------|-----|
| A | 端末が消えるとデータが消える | データの持ち主が「localStorage の editToken」＝端末。ブラウザデータ削除・機種変更で復旧不能 | Googleアカウント連携 |
| B | 機能が多くて把握できない | 14系統の機能が下部ナビ5枠＋設定ドロワーに圧縮されている | 各ページの折りたたみヘルプ |

**アカウント登録は課題Bを解かない。** 「ログインしたら機能が分かるようになる」ことはないので、Aの成果をBの根拠にしない。

---

## A. アカウント登録（Google OAuth）

### A-1. 設計原則

1. **ログインは任意。参加には絶対に必須にしない。**
   このアプリの価値は「6桁コードを送るだけで友達が参加できる」低摩擦さにある。参加にログインを要求した時点で、そこが最大の離脱点になる。ログインは *オーナーの保険* であって、参加者の関門ではない。
2. **既存のデバイストークンは殺さない。** 180日TTLの `group_tokens` はそのまま動かし続ける。ログインは認可経路の *追加* であって置き換えではない。
3. **突合キーは Google の `sub`。メールアドレスは表示専用。** メールは変更されうるし、使い回されうる。`sub` だけが安定した識別子。

### A-2. スキーマ追加

```sql
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,                -- usr_<hex24>
  provider TEXT NOT NULL,             -- 'google'
  provider_sub TEXT NOT NULL,         -- Google の sub。突合はこれだけで行う
  email TEXT,                         -- 表示用のみ。突合に使わない
  display_name TEXT,
  created_at INTEGER NOT NULL,
  UNIQUE (provider, provider_sub)
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,        -- SHA-256(セッショントークン)
  user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS group_members (
  group_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,                 -- 'owner' | 'editor' | 'viewer'
  joined_at INTEGER NOT NULL,
  PRIMARY KEY (group_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id);
```

既存4テーブルは**一切変更しない**。`ensureSecurityTables()` に上記を足すだけで移行完了（既に同じ手口を使っているので追加コスト実質ゼロ）。

`role` は3値持たせるが、初期実装で分岐させるのは `owner`/`editor` のみ。`viewer` はロードマップの「共有権限」項目が来たときの受け皿として列だけ用意する。列を後から足すよりは安い。

### A-3. 認証フロー

npm依存の追加は不要。`fetch` と `crypto.subtle` だけで完結する。

```
GET /api/auth/google
  → code_verifier(PKCE) と state をランダム生成
  → HttpOnly Cookie に両方セット（Max-Age 600秒）
  → 302 accounts.google.com/o/oauth2/v2/auth
     ?client_id=...&redirect_uri=...&response_type=code
     &scope=openid%20email%20profile&state=...
     &code_challenge=...&code_challenge_method=S256

GET /api/auth/callback?code=...&state=...
  → Cookie の state と照合（不一致なら 400 で終了 = CSRF対策）
  → POST oauth2.googleapis.com/token
     (code, client_id, client_secret, code_verifier, redirect_uri, grant_type)
  → 返ってきた id_token のペイロードを Base64URL デコード
  → aud === client_id, iss ∈ {accounts.google.com, https://accounts.google.com}, exp > now を検証
  → users を (provider, provider_sub) で UPSERT
  → セッショントークン発行、SHA-256 を sessions へ INSERT
  → Set-Cookie: session=<token>; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=7776000 (90日)
  → 302 /#share

GET  /api/auth/me      → { user: { id, displayName, email } } / 401
POST /api/auth/logout  → sessions から DELETE、Cookie を Max-Age=0 で上書き
```

**id_token の署名検証（JWKS）は不要。** トークンを Google のトークンエンドポイントから TLS 経由で直接受け取っているため、Google 自身が発行元であることは経路で保証されている。署名検証が要るのはクライアント経由でトークンを受け取る場合だけ。この判断のおかげで JWT/JWKS/CBOR ライブラリが一切要らない。

**Cookie を使う理由**: 現在の `editToken` は localStorage にあり、XSS で読み出せる。HttpOnly Cookie なら JS から読めない。同一オリジン（Pages）なので CORS 設定も不要。

**CSRF**: `SameSite=Lax` がクロスサイトの POST/PUT を遮断し、API が `content-type: application/json` を要求するため HTML フォームからは送れない。この2枚で十分。トークン方式は追加しない。

クライアント側は `fetch(..., { credentials: "same-origin" })` を付けるだけ。

### A-4. 認可の統合点

`verifyToken()` を `resolveAccess()` に置き換える。**呼び出し元は `readGroup` と `updateGroup` の2つだけ**なので、ここ1箇所を直せば全経路が揃う。

```
resolveAccess(env, request, group, required /* 'read' | 'edit' */):
  1. session Cookie あり
       → sessions で user_id 解決（expires_at 検証）
       → group_members(group_id, user_id) の role で判定
       → 一致すれば true
  2. Authorization: Bearer あり
       → 現行の verifyToken ロジックをそのまま実行（legacy 移行込み）
  3. どちらも無ければ false
```

順序が重要。ログイン済みでもデバイストークンしか持たないグループ（未 claim）があるため、1が失敗しても2を必ず試す。

### A-5. 既存データの引き継ぎ（claim）

**ここが移行の要。** 既存ユーザーは端末に editToken しか持っていない。ログインを追加しただけでは、そのデータは永久にアカウントに紐付かない。

```
POST /api/groups/:id/claim
  ヘッダ: Cookie(session) + Authorization: Bearer <デバイスの editToken>
  → 両方を検証。どちらか欠けたら 401
  → そのグループに owner がまだ居なければ role='owner' で INSERT
     既に owner が居れば role='editor' で INSERT
  → { ok: true, role }
```

クライアント側: ログイン成功直後、`groups`（localStorage）の全件に対して claim を順に投げる。失敗しても無視してよい（デバイストークンで動き続けるため、実害なし）。

以降 `createGroup` は、セッションがあれば作成と同時に `group_members` へ owner を INSERT する。

### A-6. 復旧フロー

```
新しい端末 → Googleでログイン → GET /api/groups
  → group_members から所属グループ一覧を返す
  → 選ぶと state を取得して復元
```

`GET /api/groups`（一覧）はセッション必須の新規エンドポイント。

### A-7. アカウントで復旧「されない」もの（重要）

以下は仕様上サーバーに存在しないため、**アカウントがあっても新しい端末には戻らない**。

- 予約番号（`reservation.reference`）
- 予約の添付ファイル（`attachmentName` / `attachmentData`）

`useTripState.ts:74-79` の `remoteSharedState` がクライアント側で空にし、さらに `sanitizeState()` がサーバー側でも空にしている。二重に消しているので意図的な設計。

**UIで明示すること。** 「ログインすれば全部戻る」と誤解させると、予約番号を失った時点で信頼を失う。予約情報の入力欄付近に「予約番号と添付ファイルはこの端末にのみ保存されます」と常設表示する。

（この方針自体を変えるなら別議論。変えるなら暗号化して保存する話になり、鍵管理という新しい問題を抱えることになるので、現状維持を推奨。）

### A-8. 必要な設定

```toml
# wrangler.toml
[vars]
GOOGLE_CLIENT_ID = "...apps.googleusercontent.com"
# GOOGLE_CLIENT_SECRET は wrangler secret put で登録（vars に置かない）
```

Google Cloud Console で承認済みリダイレクトURIに `https://<本番ドメイン>/api/auth/callback` を登録。ローカル開発用に `http://localhost:5173/api/auth/callback` も追加。

### A-9. やらないこと

- メール/パスワード認証（パスワードリセット、ハッシュ運用、漏洩対応を抱え込む）
- 複数プロバイダ（`users` に provider 列は用意済み。2つ目が実際に必要になってから足す）
- アカウント間のグループ譲渡UI（owner が2人になっても壊れない設計にはしてある）
- 退会・アカウント削除UI（必要になったら `DELETE /api/auth/me` を足す。列は揃っている）

---

## B. チュートリアル（折りたたみヘルプ）

### B-1. 方式

各ページ最上部に `<details>` のヘルプを1つ置く。既存の `archived-trips` / `coordinate-settings` と同じパターンなので、CSS も実装も既存に乗る。

```tsx
<details className="page-help" open={helpOpen}>
  <summary>このページの使い方</summary>
  <p>…</p>
</details>
```

オーバーレイツアーを採用しない理由: 位置計算・レスポンシブ対応・スキップ処理を全部自前で持つことになり、しかも一度閉じたら二度と見られない。「あとで確認したい」に応えられない形式は、機能把握の問題を解かない。

### B-2. 対象ページと文言（6箇所）

| ページ | 伝えること |
|--------|-----------|
| ホーム | ここは確認専用。編集は下のタブから。人数と1人あたりの金額は共有ページのメンバーが基準 |
| 予定 | 日ごとにタブが分かれる。時刻未定でも登録できる。地図リンクで経路が開く |
| お金 | 予算は見込み、立替精算は実際に払った記録。2つは別物 |
| 持ち物 | グループ全員で共有される1つのリスト |
| 共有 | メンバー登録がすべての人数計算の基準。6桁コードで他の端末が参加できる |
| 設定（アプリタブ） | 旅行の切り替えとアーカイブ、ホーム画面への追加 |

各3行以内。長い説明は読まれない。

### B-3. 表示状態の管理

```
localStorage: tripShioriHelpOpen (boolean)
```

**`SharedState` には入れない。** ヘルプの開閉は個人の慣れの問題であって、グループで共有すべき状態ではない。共有すると、慣れた人がヘルプを閉じた瞬間に初心者の画面からもヘルプが消える。

同期対象外＝サーバー側の変更もゼロ。

### B-4. 新規グループ作成時の選択

`SharePage.tsx` の「新しく作る」フォームにチェックボックスを1つ追加する。

```
[x] 使い方の説明を表示する
```

- 既定 ON
- 送信時に `tripShioriHelpOpen` を設定する
- グループ作成のリクエストボディには**含めない**（サーバーに送る意味がない）

グループを作る人＝そのグループで最初にアプリを触る人なので、ここが最も自然な分岐点。

### B-5. あとから見直す導線

設定ドロワーの「アプリ」タブに1行:

```
[ ] 使い方の説明を表示する
```

チュートリアルを一度断った人が戻れる経路がないと、「機能が把握できない」が固定化する。ここは省略しない。

### B-6. やらないこと

- ステップ進捗の記録（「3/7 完了」）
- 新機能バッジ
- 動画・GIF
- ページ内の要素単位ツールチップ

---

## 実装順序

1. `schema.sql` + `ensureSecurityTables()` に3テーブル追加（無停止・後方互換）
2. `/api/auth/*` 4エンドポイント
3. `verifyToken` → `resolveAccess`（呼び出し元2箇所）
4. `POST /api/groups/:id/claim` とログイン後の自動 claim
5. `GET /api/groups` 一覧と復旧UI
6. 予約情報の「この端末にのみ保存」表記（A-7）
7. `<details>` ヘルプ6箇所 + `tripShioriHelpOpen`
8. グループ作成フォームのチェックボックス + 設定ドロワーの再表示トグル

1〜5と7〜8は独立している。Bを先に出しても構わない（むしろ課題Bの方が今のユーザーに効く）。

## 検証

`functions/api/auth/auth.test.js` 相当を1本。フレームワーク不要、`node --test` で足りる。

- `state` 不一致の callback が 400 を返す
- 期限切れセッションで `resolveAccess` が false
- セッション無し + 有効な Bearer で `resolveAccess` が true（後方互換の核心）
- owner 既存グループの claim が `editor` を返す

4本目まで通れば移行が壊れていないことが言える。
