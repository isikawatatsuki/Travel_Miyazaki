use sqlx::PgPool;
use uuid::Uuid;

use crate::models::{NewScheduleItem, NewTrip, ScheduleItem, TripSummary};

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

pub async fn create_trip(pool: &PgPool, input: NewTrip) -> sqlx::Result<TripSummary> {
    sqlx::query_as::<_, TripSummary>(
        r#"INSERT INTO trips (name, start_date, end_date, destination_name)
           VALUES ($1, $2, $3, $4)
           RETURNING id, name, start_date, end_date, destination_name, status"#,
    )
    .bind(input.name)
    .bind(input.start_date)
    .bind(input.end_date)
    .bind(input.destination_name)
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
           (trip_id, day, starts_at, title, memo, location_name)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id, day, starts_at, title, memo, location_name"#,
    )
    .bind(trip_id)
    .bind(input.day)
    .bind(input.starts_at)
    .bind(input.title)
    .bind(input.memo)
    .bind(input.location_name)
    .fetch_one(pool)
    .await
}
