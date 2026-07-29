use chrono::{NaiveDate, NaiveTime};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, FromRow)]
pub struct TripSummary {
    pub id: Uuid,
    pub name: String,
    pub start_date: Option<NaiveDate>,
    pub end_date: Option<NaiveDate>,
    pub destination_name: String,
    pub status: String,
}

#[derive(Debug, Clone, FromRow)]
pub struct ScheduleItem {
    pub id: Uuid,
    pub day: NaiveDate,
    pub starts_at: Option<NaiveTime>,
    pub title: String,
    pub memo: String,
    pub location_name: String,
}
