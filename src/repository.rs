use sqlx::PgPool;
use uuid::Uuid;

use crate::models::{
    BudgetItem, BudgetItemInput, ChecklistItem, ExpenseInput, ExpenseRecord, NewLabel, NewNote,
    NewScheduleItem, NewTrip, Note, PersonInput, PersonRecord, ScheduleItem, TripBudget,
    TripSummary, UpdateScheduleItem,
};

pub const CUSTOM_CATEGORY: &str = "custom";
pub const SOUVENIR_CATEGORY: &str = "souvenir";

pub async fn list_trips(pool: &PgPool) -> sqlx::Result<Vec<TripSummary>> {
    sqlx::query_as::<_, TripSummary>(
        r#"SELECT t.id, t.name, t.start_date, t.end_date, t.origin_name,
                  t.destination_name, t.theme_color, t.status,
                  (SELECT COUNT(*) FROM trip_members tm WHERE tm.trip_id = t.id) AS member_count
           FROM trips t
           ORDER BY start_date NULLS LAST, created_at DESC"#,
    )
    .fetch_all(pool)
    .await
}

pub async fn find_trip(pool: &PgPool, id: Uuid) -> sqlx::Result<Option<TripSummary>> {
    sqlx::query_as::<_, TripSummary>(
        r#"SELECT t.id, t.name, t.start_date, t.end_date, t.origin_name,
                  t.destination_name, t.theme_color, t.status,
                  (SELECT COUNT(*) FROM trip_members tm WHERE tm.trip_id = t.id) AS member_count
           FROM trips t WHERE t.id = $1"#,
    )
    .bind(id)
    .fetch_optional(pool)
    .await
}

pub async fn list_schedule(pool: &PgPool, trip_id: Uuid) -> sqlx::Result<Vec<ScheduleItem>> {
    sqlx::query_as::<_, ScheduleItem>(
        r#"SELECT id, day, starts_at, title, memo, location_name, map_url,
                  latitude, longitude, include_in_route, is_stay
           FROM schedule_items
           WHERE trip_id = $1
           ORDER BY day, starts_at NULLS LAST, sort_order"#,
    )
    .bind(trip_id)
    .fetch_all(pool)
    .await
}

pub async fn create_trip(pool: &PgPool, input: NewTrip) -> sqlx::Result<TripSummary> {
    sqlx::query_as::<_, TripSummary>(
        r#"INSERT INTO trips
           (name, start_date, end_date, origin_name, destination_name, theme_color)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id, name, start_date, end_date, origin_name, destination_name,
                     theme_color, status, 0::bigint AS member_count"#,
    )
    .bind(input.name)
    .bind(input.start_date)
    .bind(input.end_date)
    .bind(input.origin_name)
    .bind(input.destination_name)
    .bind(input.theme_color)
    .fetch_one(pool)
    .await
}

pub async fn create_schedule_item(
    pool: &PgPool,
    trip_id: Uuid,
    input: NewScheduleItem,
) -> sqlx::Result<ScheduleItem> {
    sqlx::query_as::<_, ScheduleItem>(
        r#"INSERT INTO schedule_items
           (trip_id, day, starts_at, title, memo, location_name, map_url,
            latitude, longitude, include_in_route, is_stay)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           RETURNING id, day, starts_at, title, memo, location_name, map_url,
                     latitude, longitude, include_in_route, is_stay"#,
    )
    .bind(trip_id)
    .bind(input.day)
    .bind(input.starts_at)
    .bind(input.title)
    .bind(input.memo)
    .bind(input.location_name)
    .bind(input.map_url)
    .bind(input.latitude)
    .bind(input.longitude)
    .bind(input.include_in_route)
    .bind(input.is_stay)
    .fetch_one(pool)
    .await
}

pub async fn update_schedule_item(
    pool: &PgPool,
    trip_id: Uuid,
    id: Uuid,
    input: UpdateScheduleItem,
) -> sqlx::Result<Option<ScheduleItem>> {
    sqlx::query_as::<_, ScheduleItem>(
        r#"UPDATE schedule_items SET starts_at=$3, title=$4, memo=$5, location_name=$6,
                  map_url=$7, latitude=$8, longitude=$9, include_in_route=$10, updated_at=now()
           WHERE trip_id=$1 AND id=$2
           RETURNING id, day, starts_at, title, memo, location_name, map_url,
                     latitude, longitude, include_in_route, is_stay"#,
    )
    .bind(trip_id)
    .bind(id)
    .bind(input.starts_at)
    .bind(input.title)
    .bind(input.memo)
    .bind(input.location_name)
    .bind(input.map_url)
    .bind(input.latitude)
    .bind(input.longitude)
    .bind(input.include_in_route)
    .fetch_optional(pool)
    .await
}

pub async fn delete_schedule_item(pool: &PgPool, trip_id: Uuid, id: Uuid) -> sqlx::Result<bool> {
    Ok(
        sqlx::query("DELETE FROM schedule_items WHERE trip_id=$1 AND id=$2")
            .bind(trip_id)
            .bind(id)
            .execute(pool)
            .await?
            .rows_affected()
            > 0,
    )
}

pub async fn list_checklist(pool: &PgPool, trip_id: Uuid) -> sqlx::Result<Vec<ChecklistItem>> {
    sqlx::query_as("SELECT id,label,checked FROM checklist_items WHERE trip_id=$1 ORDER BY sort_order,updated_at").bind(trip_id).fetch_all(pool).await
}
pub async fn create_checklist_item(
    pool: &PgPool,
    trip_id: Uuid,
    input: NewLabel,
) -> sqlx::Result<ChecklistItem> {
    sqlx::query_as(
        "INSERT INTO checklist_items (trip_id,label) VALUES ($1,$2) RETURNING id,label,checked",
    )
    .bind(trip_id)
    .bind(input.label)
    .fetch_one(pool)
    .await
}
pub async fn update_checklist_item(
    pool: &PgPool,
    trip_id: Uuid,
    id: Uuid,
    checked: bool,
) -> sqlx::Result<Option<ChecklistItem>> {
    sqlx::query_as("UPDATE checklist_items SET checked=$3,updated_at=now() WHERE trip_id=$1 AND id=$2 RETURNING id,label,checked").bind(trip_id).bind(id).bind(checked).fetch_optional(pool).await
}
pub async fn delete_checklist_item(pool: &PgPool, trip_id: Uuid, id: Uuid) -> sqlx::Result<bool> {
    Ok(
        sqlx::query("DELETE FROM checklist_items WHERE trip_id=$1 AND id=$2")
            .bind(trip_id)
            .bind(id)
            .execute(pool)
            .await?
            .rows_affected()
            > 0,
    )
}
pub async fn list_notes(pool: &PgPool, trip_id: Uuid) -> sqlx::Result<Vec<Note>> {
    sqlx::query_as("SELECT id,body FROM notes WHERE trip_id=$1 ORDER BY created_at")
        .bind(trip_id)
        .fetch_all(pool)
        .await
}
pub async fn create_note(pool: &PgPool, trip_id: Uuid, input: NewNote) -> sqlx::Result<Note> {
    sqlx::query_as("INSERT INTO notes (trip_id,body) VALUES ($1,$2) RETURNING id,body")
        .bind(trip_id)
        .bind(input.body)
        .fetch_one(pool)
        .await
}
pub async fn delete_note(pool: &PgPool, trip_id: Uuid, id: Uuid) -> sqlx::Result<bool> {
    Ok(sqlx::query("DELETE FROM notes WHERE trip_id=$1 AND id=$2")
        .bind(trip_id)
        .bind(id)
        .execute(pool)
        .await?
        .rows_affected()
        > 0)
}
pub async fn list_people(pool: &PgPool, trip_id: Uuid) -> sqlx::Result<Vec<PersonRecord>> {
    sqlx::query_as("SELECT id,name,role,memo FROM people WHERE trip_id=$1 ORDER BY sort_order,id")
        .bind(trip_id)
        .fetch_all(pool)
        .await
}
pub async fn create_person(
    pool: &PgPool,
    trip_id: Uuid,
    input: PersonInput,
) -> sqlx::Result<PersonRecord> {
    sqlx::query_as("INSERT INTO people (trip_id,name,role,memo) VALUES ($1,$2,$3,$4) RETURNING id,name,role,memo").bind(trip_id).bind(input.name).bind(input.role).bind(input.memo).fetch_one(pool).await
}
pub async fn update_person(
    pool: &PgPool,
    trip_id: Uuid,
    id: Uuid,
    input: PersonInput,
) -> sqlx::Result<Option<PersonRecord>> {
    sqlx::query_as("UPDATE people SET name=$3,role=$4,memo=$5 WHERE trip_id=$1 AND id=$2 RETURNING id,name,role,memo").bind(trip_id).bind(id).bind(input.name).bind(input.role).bind(input.memo).fetch_optional(pool).await
}
pub async fn delete_person(pool: &PgPool, trip_id: Uuid, id: Uuid) -> sqlx::Result<bool> {
    Ok(sqlx::query("DELETE FROM people WHERE trip_id=$1 AND id=$2")
        .bind(trip_id)
        .bind(id)
        .execute(pool)
        .await?
        .rows_affected()
        > 0)
}

/// 予算行が無い旅は既定値で作る。TS版は端末に既定値を書き込むので、
/// ここで作らないと「保存前は既定値、保存後だけ表示」というズレが出る。
pub async fn load_budget(pool: &PgPool, trip_id: Uuid) -> sqlx::Result<TripBudget> {
    sqlx::query_as::<_, TripBudget>(
        r#"INSERT INTO trip_budgets (trip_id) VALUES ($1)
           ON CONFLICT (trip_id) DO UPDATE SET trip_id = EXCLUDED.trip_id
           RETURNING transport_cost, access_cost, breakfast,
                     hotel_without_breakfast, hotel_with_breakfast"#,
    )
    .bind(trip_id)
    .fetch_one(pool)
    .await
}

pub async fn save_budget(
    pool: &PgPool,
    trip_id: Uuid,
    input: TripBudget,
) -> sqlx::Result<TripBudget> {
    sqlx::query_as::<_, TripBudget>(
        r#"INSERT INTO trip_budgets
           (trip_id, transport_cost, access_cost, breakfast,
            hotel_without_breakfast, hotel_with_breakfast)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (trip_id) DO UPDATE SET
             transport_cost = EXCLUDED.transport_cost,
             access_cost = EXCLUDED.access_cost,
             breakfast = EXCLUDED.breakfast,
             hotel_without_breakfast = EXCLUDED.hotel_without_breakfast,
             hotel_with_breakfast = EXCLUDED.hotel_with_breakfast,
             updated_at = now()
           RETURNING transport_cost, access_cost, breakfast,
                     hotel_without_breakfast, hotel_with_breakfast"#,
    )
    .bind(trip_id)
    .bind(input.transport_cost.max(0))
    .bind(input.access_cost.max(0))
    .bind(input.breakfast)
    .bind(input.hotel_without_breakfast.max(0))
    .bind(input.hotel_with_breakfast.max(0))
    .fetch_one(pool)
    .await
}

pub async fn list_budget_items(
    pool: &PgPool,
    trip_id: Uuid,
    category: &str,
) -> sqlx::Result<Vec<BudgetItem>> {
    sqlx::query_as::<_, BudgetItem>(
        r#"SELECT id, name, quantity, unit_amount FROM budget_items
           WHERE trip_id=$1 AND category=$2 ORDER BY sort_order, id"#,
    )
    .bind(trip_id)
    .bind(category)
    .fetch_all(pool)
    .await
}

pub async fn create_budget_item(
    pool: &PgPool,
    trip_id: Uuid,
    category: &str,
    input: BudgetItemInput,
) -> sqlx::Result<BudgetItem> {
    sqlx::query_as::<_, BudgetItem>(
        r#"INSERT INTO budget_items (trip_id, category, name, quantity, unit_amount, sort_order)
           VALUES ($1, $2, $3, $4, $5,
                   COALESCE((SELECT MAX(sort_order) + 1 FROM budget_items
                             WHERE trip_id=$1 AND category=$2), 0))
           RETURNING id, name, quantity, unit_amount"#,
    )
    .bind(trip_id)
    .bind(category)
    .bind(input.name)
    .bind(input.quantity.max(0))
    .bind(input.unit_amount.max(0))
    .fetch_one(pool)
    .await
}

pub async fn update_budget_item(
    pool: &PgPool,
    trip_id: Uuid,
    id: Uuid,
    input: BudgetItemInput,
) -> sqlx::Result<Option<BudgetItem>> {
    sqlx::query_as::<_, BudgetItem>(
        r#"UPDATE budget_items SET name=$3, quantity=$4, unit_amount=$5
           WHERE trip_id=$1 AND id=$2
           RETURNING id, name, quantity, unit_amount"#,
    )
    .bind(trip_id)
    .bind(id)
    .bind(input.name)
    .bind(input.quantity.max(0))
    .bind(input.unit_amount.max(0))
    .fetch_optional(pool)
    .await
}

pub async fn delete_budget_item(pool: &PgPool, trip_id: Uuid, id: Uuid) -> sqlx::Result<bool> {
    Ok(
        sqlx::query("DELETE FROM budget_items WHERE trip_id=$1 AND id=$2")
            .bind(trip_id)
            .bind(id)
            .execute(pool)
            .await?
            .rows_affected()
            > 0,
    )
}

pub async fn list_expenses(pool: &PgPool, trip_id: Uuid) -> sqlx::Result<Vec<ExpenseRecord>> {
    let rows: Vec<(Uuid, String, Option<Uuid>, i64, Vec<Uuid>)> = sqlx::query_as(
        r#"SELECT e.id, e.title, e.payer_id, e.amount,
                  ARRAY(SELECT ep.person_id FROM expense_participants ep
                        WHERE ep.expense_id = e.id
                        ORDER BY ep.sort_order) AS participant_ids
           FROM expenses e WHERE e.trip_id=$1 ORDER BY e.created_at, e.id"#,
    )
    .bind(trip_id)
    .fetch_all(pool)
    .await?;

    Ok(rows
        .into_iter()
        .map(
            |(id, title, payer_id, amount, participant_ids)| ExpenseRecord {
                id,
                title,
                payer_id,
                amount,
                participant_ids,
            },
        )
        .collect())
}

pub async fn create_expense(
    pool: &PgPool,
    trip_id: Uuid,
    input: ExpenseInput,
) -> sqlx::Result<ExpenseRecord> {
    let mut tx = pool.begin().await?;
    let id: Uuid = sqlx::query_scalar(
        r#"INSERT INTO expenses (trip_id, payer_id, title, amount)
           VALUES ($1, $2, $3, $4) RETURNING id"#,
    )
    .bind(trip_id)
    .bind(input.payer_id)
    .bind(&input.title)
    .bind(input.amount.max(0))
    .fetch_one(&mut *tx)
    .await?;

    let participants = replace_participants(&mut tx, trip_id, id, &input.participant_ids).await?;
    tx.commit().await?;

    Ok(ExpenseRecord {
        id,
        title: input.title,
        payer_id: input.payer_id,
        amount: input.amount.max(0),
        participant_ids: participants,
    })
}

/// 割り勘対象を入れ替える。TS版の participantIds は配列で、端数の1円は先頭から
/// 順に配られるため、受け取った並び順をそのまま sort_order に写す。
/// 旅に属さない人物IDは弾く。他の旅のメンバーで割り勘されるのを防ぐ。
async fn replace_participants(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    trip_id: Uuid,
    expense_id: Uuid,
    requested: &[Uuid],
) -> sqlx::Result<Vec<Uuid>> {
    let mut wanted: Vec<Uuid> = Vec::with_capacity(requested.len());
    for id in requested {
        if !wanted.contains(id) {
            wanted.push(*id);
        }
    }
    let positions: Vec<i32> = (0..wanted.len() as i32).collect();

    sqlx::query("DELETE FROM expense_participants WHERE expense_id=$1")
        .bind(expense_id)
        .execute(&mut **tx)
        .await?;
    sqlx::query(
        r#"INSERT INTO expense_participants (expense_id, person_id, sort_order)
           SELECT $1, given.person_id, given.sort_order
           FROM UNNEST($3::uuid[], $4::int[]) AS given(person_id, sort_order)
           JOIN people p ON p.id = given.person_id AND p.trip_id = $2"#,
    )
    .bind(expense_id)
    .bind(trip_id)
    .bind(&wanted)
    .bind(&positions)
    .execute(&mut **tx)
    .await?;

    sqlx::query_scalar(
        "SELECT person_id FROM expense_participants WHERE expense_id=$1 ORDER BY sort_order",
    )
    .bind(expense_id)
    .fetch_all(&mut **tx)
    .await
}

pub async fn update_expense(
    pool: &PgPool,
    trip_id: Uuid,
    id: Uuid,
    input: ExpenseInput,
) -> sqlx::Result<Option<ExpenseRecord>> {
    let mut tx = pool.begin().await?;
    let updated = sqlx::query(
        r#"UPDATE expenses SET payer_id=$3, title=$4, amount=$5 WHERE trip_id=$1 AND id=$2"#,
    )
    .bind(trip_id)
    .bind(id)
    .bind(input.payer_id)
    .bind(&input.title)
    .bind(input.amount.max(0))
    .execute(&mut *tx)
    .await?
    .rows_affected()
        > 0;
    if !updated {
        tx.rollback().await?;
        return Ok(None);
    }

    let participants = replace_participants(&mut tx, trip_id, id, &input.participant_ids).await?;
    tx.commit().await?;

    Ok(Some(ExpenseRecord {
        id,
        title: input.title,
        payer_id: input.payer_id,
        amount: input.amount.max(0),
        participant_ids: participants,
    }))
}

pub async fn delete_expense(pool: &PgPool, trip_id: Uuid, id: Uuid) -> sqlx::Result<bool> {
    Ok(sqlx::query("DELETE FROM expenses WHERE trip_id=$1 AND id=$2")
        .bind(trip_id)
        .bind(id)
        .execute(pool)
        .await?
        .rows_affected()
        > 0)
}
