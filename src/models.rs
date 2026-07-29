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
    pub destination_name: String,
    pub status: String,
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
    pub destination_name: String,
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
