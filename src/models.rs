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
    pub map_url: String,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub include_in_route: bool,
    pub is_stay: bool,
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
    #[serde(default)]
    pub map_url: String,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    #[serde(default = "default_true")]
    pub include_in_route: bool,
    #[serde(default)]
    pub is_stay: bool,
}

#[derive(Debug, Deserialize)]
pub struct UpdateScheduleItem {
    pub starts_at: Option<NaiveTime>,
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub memo: String,
    #[serde(default)]
    pub location_name: String,
    #[serde(default)]
    pub map_url: String,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    #[serde(default = "default_true")]
    pub include_in_route: bool,
}

fn default_true() -> bool {
    true
}

#[derive(Debug, Clone, FromRow, Serialize)]
pub struct ChecklistItem {
    pub id: Uuid,
    pub label: String,
    pub checked: bool,
}
#[derive(Debug, Clone, FromRow, Serialize)]
pub struct Note {
    pub id: Uuid,
    pub body: String,
}
#[derive(Debug, Clone, FromRow, Serialize)]
pub struct PersonRecord {
    pub id: Uuid,
    pub name: String,
    pub role: String,
    pub memo: String,
}

#[derive(Debug, Deserialize)]
pub struct NewLabel {
    pub label: String,
}
#[derive(Debug, Deserialize)]
pub struct ChecklistUpdate {
    pub checked: bool,
}
#[derive(Debug, Deserialize)]
pub struct NewNote {
    pub body: String,
}
#[derive(Debug, Deserialize)]
pub struct PersonInput {
    pub name: String,
    #[serde(default = "default_member_role")]
    pub role: String,
    #[serde(default)]
    pub memo: String,
}
fn default_member_role() -> String {
    "メンバー".into()
}
