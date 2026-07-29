use chrono::{NaiveDate, NaiveTime};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, FromRow, Serialize)]
pub struct TripSummary {
    pub id: Uuid,
    pub name: String,
    pub start_date: Option<NaiveDate>,
    pub end_date: Option<NaiveDate>,
    pub origin_name: String,
    pub destination_name: String,
    pub theme_color: String,
    pub status: String,
    pub member_count: i64,
}

#[derive(Debug, Clone, FromRow, Serialize)]
pub struct ScheduleItem {
    pub id: Uuid,
    pub day: NaiveDate,
    pub starts_at: Option<NaiveTime>,
    pub title: String,
    pub memo: String,
    pub location_name: String,
}

#[derive(Debug, Deserialize)]
pub struct NewTrip {
    pub name: String,
    pub start_date: Option<NaiveDate>,
    pub end_date: Option<NaiveDate>,
    #[serde(default)]
    pub origin_name: String,
    #[serde(default)]
    pub destination_name: String,
    #[serde(default = "default_theme_color")]
    pub theme_color: String,
}

fn default_theme_color() -> String {
    "#e8735f".into()
}

#[derive(Debug, Deserialize)]
pub struct NewScheduleItem {
    pub day: NaiveDate,
    pub starts_at: Option<NaiveTime>,
    pub title: String,
    #[serde(default)]
    pub memo: String,
    #[serde(default)]
    pub location_name: String,
}
