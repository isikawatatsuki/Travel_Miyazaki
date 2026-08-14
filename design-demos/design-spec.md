# Travel Miyazaki — three-direction design brief

## Consultant restatement

今回の本質は、既に動いている旅行管理アプリへ装飾を足すことではなく、「複数の旅行をチケット単位で保管し、開いた旅行の予定・費用・持ち物・共有情報へ迷わず入れる」という構造を、見た瞬間に理解できる視覚言語へ組み直すことである。主な利用者は、旅行前の細かな準備と旅行中の確認をスマートフォンで行う個人または少人数グループ。出発前は編集量が多く、当日は片手で素早く時刻や移動先を読みたい。そのため、かわいさだけに寄せず、情報の順序、日付と場所の視認性、戻る導線、押せる場所の明快さを優先する。既存の「紙のしおり」「切符」「旅程線」という固有の記憶は残す一方、カードを重ねるだけの一般的なアプリ表現にはしない。今回の初稿ではチケット一覧と、そこから開く旅行ホームの二画面相当を一枚のレスポンシブなHTML内で表現し、方向ごとの構造差が比較できるようにする。基于这个理解，我直接做 3 个不同方向的真实版本给你看。

## Shared product and audience

This is the React/TypeScript application 「旅のしおり」. It stores several trips as tickets and opens each trip into five destinations: ホーム, 予定, お金, 持ち物, 共有. The core audience is a Japanese consumer planning a trip alone or with one companion, mostly on a phone at 10–40 cm viewing distance. Desktop remains important for planning, but the direction study is mobile-first.

## Required real content

- Product labels: 「旅のチケット」 / `TRAVEL TICKETS`
- Primary action: 「チケットを発行」
- Ticket: 「旅のしおり」, 鹿児島空港 → 都城グリーンホテル, 09.21–09.23, 2名, 計画中 / あと38日
- Trip home: 「大阪から都城へ」, 「都城旅行」, 2026.09.21–09.23
- Important facts: MM193 08:30 関西発, MM198 16:30 鹿児島発, 都城グリーンホテル
- Next itinerary rows: 05:40 市岡元町を出る, 05:50 弁天町駅, 07:00 関西空港駅
- Navigation labels: ホーム, 予定, お金, 持ち物, 共有
- Device-save state: 「端末保存」

## Output and dimensions

- Produce exactly one complete standalone HTML per direction under `design-demos/`.
- Each HTML must render a responsive direction board at 1440×900 and remain usable at 375×812.
- Show both the ticket-list concept and the opened-trip/home concept together, without relying on external JavaScript libraries or network assets.
- Interactive controls may switch between the two concepts; visible focus, hover, and pressed states are required.
- Minimum body text 14px; core body copy aims for 16px. Touch controls must be at least 44px.

## Constraints

- This is a visual direction study, not production code. Do not edit `src/` yet.
- Preserve all product meaning and Japanese labels. No new feature, statistic, quote, or destination photo.
- Use the existing favicon SVG only if a mark is needed. It is a multi-file project, so the relative asset path is acceptable.
- Colors must be sampled from the existing brand spec and reduced to 2–3 chromatic colors plus neutrals.
- No generic purple SaaS gradient, emoji navigation, decorative icon next to every heading, or rounded-card-plus-left-accent repetition.
- Respect `prefers-reduced-motion`. Avoid horizontal overflow at 375px.

## Image checkpoint

Images are not content-essential. The product is a planning utility; removing decorative travel photography does not remove meaning. Use typography, rules, route lines, ticket perforations, dates, and actual itinerary content as the visual material. The one named product is this local app, and its checked-in official mark is available at `../public/icons/favicon.svg`.

## Form derivation — five questions

1. Narrative role: the page is an entrance and orientation surface, moving from a collection of trips into one active trip.
2. Viewing distance: 10 cm phone first, 1 m laptop second; dates and next actions must scan instantly.
3. Visual temperature: warm and anticipatory, with enough restraint to remain useful during travel stress.
4. Capacity: one primary ticket, one secondary/archived state hint, three itinerary facts, and five navigation targets must fit without compressing body text below 14px.
5. Content-specific motif: a physical travel ticket whose perforation becomes an itinerary line. The same line should organize route, date, and sequence—evidence that the form grows from travel planning rather than a generic dashboard template.

## Three independent anchors

- Direction A / roulette: style 17, Functional Brutalism. Fine rules, dense utility, system typography, explicit blue/green interaction cues. Translate the ticket perforation into a strict information grid.
- Direction B / real-world reference: a calm transit/pass and travel-wallet system—structured, scannable, soft but not card-heavy. Validate the selected real reference before claiming it.
- Direction C / best-fit designer: Kenya Hara–influenced Japanese information design. White space is active composition; paper, stamps, route notation, and quiet typography carry the identity without becoming nostalgic decoration.

