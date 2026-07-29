mod db;
mod models;
mod repository;

use std::env;

use db::Database;
use models::{NewScheduleItem, NewTrip, ScheduleItem, TripSummary};
use topcoat::{
    Result,
    context::{Cx, app_context},
    router::{
        Json, Router, RouterBuilderDiscoverExt, RouterErrorExt, Slot, bad_request,
        internal_server_error, layout, page, path_param, route,
    },
    view::view,
};
use uuid::Uuid;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "tabilog=info,topcoat=info".into()),
        )
        .init();

    let database_url = env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://tabilog:tabilog@localhost:5432/tabilog".into());
    let database = Database::connect(&database_url).await?;
    let router = Router::builder().discover().app_context(database).build();

    topcoat::start(router).await?;
    Ok(())
}

#[layout("/")]
async fn app_layout(slot: Slot<'_>) -> Result {
    view! {
        <!DOCTYPE html>
        <html lang="ja">
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <title>"Tabilog | 宮崎旅行プランナー"</title>
                <style>(include_str!("rust.css"))</style>
            </head>
            <body>
                <header class="site-header">
                    <a class="brand" href="/">"Tabilog"</a>
                    <nav aria-label="メインナビゲーション">
                        <a href="/trips">"旅行一覧"</a>
                    </nav>
                </header>
                (slot.await?)
                <script>(include_str!("rust.js"))</script>
            </body>
        </html>
    }
}

#[page("/")]
async fn home() -> Result {
    view! {
        <main class="hero-shell">
            <section class="hero">
                <span class="eyebrow">"RUST × TOPCOAT × POSTGRESQL"</span>
                <h1>"旅の予定を、ひとつの場所に。"</h1>
                <p>"日程・精算・持ち物・予約情報を、旅行メンバーと分かりやすく共有できます。"</p>
                <a class="primary-button" href="/trips">"旅行を開く"</a>
            </section>
        </main>
    }
}

#[page("/trips")]
async fn trips(cx: &Cx) -> Result {
    let database = app_context::<Database>(cx);
    let trips = repository::list_trips(database.pool())
        .await
        .map_err(internal_server_error)?;

    view! {
        <main class="page-shell">
            <div class="page-heading">
                <div>
                    <span class="eyebrow">"MY TRIPS"</span>
                    <h1>"旅行一覧"</h1>
                </div>
                <span class="badge">(format!("{} 件", trips.len()))</span>
            </div>
            <details class="panel create-panel">
                <summary>"新しい旅行を作る"</summary>
                <form data-api-form="/api/trips" data-redirect="/trips">
                    <label>"旅行名" <input name="name" required="required"></label>
                    <label>"目的地" <input name="destination_name"></label>
                    <label>"開始日" <input name="start_date" type="date"></label>
                    <label>"終了日" <input name="end_date" type="date"></label>
                    <button type="submit">"旅行を作成"</button>
                    <p class="form-message" aria-live="polite"></p>
                </form>
            </details>
            if trips.is_empty() {
                <section class="empty-state">
                    <h2>"旅行はまだありません"</h2>
                    <p>"データベースへの接続は正常です。次に旅行作成フォームを追加します。"</p>
                </section>
            } else {
                <div class="trip-grid">
                    for trip in trips {
                        <a class="trip-card" href=(format!("/trips/{}", trip.id))>
                            <span class="status">(trip.status)</span>
                            <h2>(trip.name)</h2>
                            <p class="destination">(if trip.destination_name.is_empty() { "目的地未設定".to_string() } else { trip.destination_name })</p>
                            <p class="date">(date_range(trip.start_date, trip.end_date))</p>
                        </a>
                    }
                </div>
            }
        </main>
    }
}

#[path_param(error = not_found)]
struct TripId(Uuid);

#[page("/trips/{trip_id}")]
async fn trip_detail(cx: &Cx) -> Result {
    let trip_id = *path_param::<TripId>(cx)?;
    let database = app_context::<Database>(cx);
    let trip = repository::find_trip(database.pool(), trip_id)
        .await
        .map_err(internal_server_error)?
        .ok_or_not_found()?;
    let schedule = repository::list_schedule(database.pool(), trip_id)
        .await
        .map_err(internal_server_error)?;

    view! {
        <main class="page-shell">
            <a class="back-link" href="/trips">"← 旅行一覧"</a>
            <section class="trip-hero">
                <span class="eyebrow">(trip.status)</span>
                <h1>(trip.name)</h1>
                <p>(date_range(trip.start_date, trip.end_date)) " · " (trip.destination_name)</p>
            </section>
            <section class="panel">
                <h2>"スケジュール"</h2>
                <details class="create-panel">
                    <summary>"予定を追加"</summary>
                    <form data-api-form=(format!("/api/trips/{}/schedule", trip_id)) data-redirect=(format!("/trips/{}", trip_id))>
                        <label>"日付" <input name="day" type="date" required="required"></label>
                        <label>"時刻" <input name="starts_at" type="time"></label>
                        <label>"予定" <input name="title" required="required"></label>
                        <label>"場所" <input name="location_name"></label>
                        <label>"メモ" <textarea name="memo"></textarea></label>
                        <button type="submit">"予定を追加"</button>
                        <p class="form-message" aria-live="polite"></p>
                    </form>
                </details>
                if schedule.is_empty() {
                    <p class="muted">"予定はまだ登録されていません。"</p>
                } else {
                    <ol class="timeline">
                        for item in schedule {
                            <li>
                                <time>(format!("{} {}", item.day, item.starts_at.map(|t| t.format("%H:%M").to_string()).unwrap_or_else(|| "--:--".into())))</time>
                                <div>
                                    <h3>(item.title)</h3>
                                    if !item.location_name.is_empty() { <p>(item.location_name)</p> }
                                    if !item.memo.is_empty() { <p class="muted">(item.memo)</p> }
                                    <small class="item-id">(item.id.to_string())</small>
                                </div>
                            </li>
                        }
                    </ol>
                }
            </section>
        </main>
    }
}

#[route(POST "/api/trips")]
async fn create_trip(cx: &Cx, Json(input): Json<NewTrip>) -> Result<Json<TripSummary>> {
    if input.name.trim().is_empty() {
        return Err(bad_request("旅行名を入力してください").into());
    }
    if input
        .start_date
        .zip(input.end_date)
        .is_some_and(|(start, end)| start > end)
    {
        return Err(bad_request("終了日は開始日以降にしてください").into());
    }

    let database = app_context::<Database>(cx);
    let trip = repository::create_trip(database.pool(), input)
        .await
        .map_err(internal_server_error)?;
    Ok(Json(trip))
}

#[route(POST "/api/trips/{trip_id}/schedule")]
async fn create_schedule_item(
    cx: &Cx,
    Json(input): Json<NewScheduleItem>,
) -> Result<Json<ScheduleItem>> {
    let trip_id = *path_param::<TripId>(cx)?;
    if input.title.trim().is_empty() {
        return Err(bad_request("予定名を入力してください").into());
    }

    let database = app_context::<Database>(cx);
    repository::find_trip(database.pool(), trip_id)
        .await
        .map_err(internal_server_error)?
        .ok_or_not_found()?;
    let item = repository::create_schedule_item(database.pool(), trip_id, input)
        .await
        .map_err(internal_server_error)?;
    Ok(Json(item))
}

#[route(GET "/health")]
async fn health(cx: &Cx) -> Result<&'static str> {
    let database = app_context::<Database>(cx);
    sqlx::query_scalar::<_, i32>("SELECT 1")
        .fetch_one(database.pool())
        .await
        .map_err(internal_server_error)?;
    Ok("ok")
}

#[cfg(test)]
mod tests {
    use chrono::NaiveDate;

    use super::date_range;

    #[test]
    fn formats_a_complete_date_range() {
        let start = NaiveDate::from_ymd_opt(2026, 8, 10);
        let end = NaiveDate::from_ymd_opt(2026, 8, 12);

        assert_eq!(date_range(start, end), "2026/08/10 – 2026/08/12");
    }

    #[test]
    fn formats_an_unset_date_range() {
        assert_eq!(date_range(None, None), "日程未設定");
    }
}

fn date_range(start: Option<chrono::NaiveDate>, end: Option<chrono::NaiveDate>) -> String {
    match (start, end) {
        (Some(start), Some(end)) => {
            format!("{} – {}", start.format("%Y/%m/%d"), end.format("%Y/%m/%d"))
        }
        (Some(start), None) => start.format("%Y/%m/%d").to_string(),
        _ => "日程未設定".into(),
    }
}
