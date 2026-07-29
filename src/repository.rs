use sqlx::PgPool;
use uuid::Uuid;

use crate::models::{ScheduleItem, TripSummary};

pub async fn list_trips(pool: &PgPool) -> sqlx::Result<Vec<TripSummary>> {
    sqlx::query_as::<_, TripSummary>(
        r#"SELECT id, name, start_date, end_date, destination_name, status
           FROM trips
           ORDER BY start_date NULLS LAST, created_at DESC"#,
    )
    .fetch_all(pool)
    .await
}

pub async fn find_trip(pool: &PgPool, id: Uuid) -> sqlx::Result<Option<TripSummary>> {
    sqlx::query_as::<_, TripSummary>(
        r#"SELECT id, name, start_date, end_date, destination_name, status
           FROM trips WHERE id = $1"#,
    )
    .bind(id)
    .fetch_optional(pool)
    .await
}

pub async fn list_schedule(pool: &PgPool, trip_id: Uuid) -> sqlx::Result<Vec<ScheduleItem>> {
    sqlx::query_as::<_, ScheduleItem>(
        r#"SELECT id, day, starts_at, title, memo, location_name
           FROM schedule_items
           WHERE trip_id = $1
           ORDER BY day, starts_at NULLS LAST, sort_order"#,
    )
    .bind(trip_id)
    .fetch_all(pool)
    .await
}
