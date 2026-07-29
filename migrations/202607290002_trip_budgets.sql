-- TS版の AdjustState のうち、項目リストにならないスカラー値を保持する。
-- 既定値は src/data.ts の defaultAdjust と一致させる。
CREATE TABLE trip_budgets (
    trip_id UUID PRIMARY KEY REFERENCES trips(id) ON DELETE CASCADE,
    transport_cost BIGINT NOT NULL DEFAULT 36200 CHECK (transport_cost >= 0),
    access_cost BIGINT NOT NULL DEFAULT 2360 CHECK (access_cost >= 0),
    breakfast BOOLEAN NOT NULL DEFAULT false,
    hotel_without_breakfast BIGINT NOT NULL DEFAULT 6500 CHECK (hotel_without_breakfast >= 0),
    hotel_with_breakfast BIGINT NOT NULL DEFAULT 9100 CHECK (hotel_with_breakfast >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 追加項目とお土産は budget_items を category で分ける。
CREATE INDEX budget_items_trip_category_idx ON budget_items(trip_id, category, sort_order);
CREATE INDEX expenses_trip_idx ON expenses(trip_id, created_at);

-- TS版は割り勘対象を配列で持ち、端数の1円は先頭から順に配る。
-- 順序を捨てると誰が1円多く負担するかが変わるので、並び順も保存する。
ALTER TABLE expense_participants ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
