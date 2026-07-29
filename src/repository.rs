use sqlx::PgPool;
use uuid::Uuid;

use crate::models::{NewScheduleItem, NewTrip, ScheduleItem, TripSummary, UpdateScheduleItem};

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
