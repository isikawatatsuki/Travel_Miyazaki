mod db;
mod models;
mod repository;

use std::env;

use base64::{Engine as _, engine::general_purpose::STANDARD};
use db::Database;
use models::{NewScheduleItem, NewTrip, ScheduleItem, TripSummary};
use topcoat::{
    Result,
    context::{Cx, app_context},
    router::{
        Json, Router, RouterBuilderDiscoverExt, RouterErrorExt, Slot, bad_request,
        internal_server_error, layout, page, path_param, redirect, route,
    },
    view::{Unescaped, component, view},
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
                <meta name="theme-color" content="#e8735f">
                <link rel="preconnect" href="https://fonts.googleapis.com">
                <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous">
                <link href="https://fonts.googleapis.com/css2?family=Kiwi+Maru:wght@400;500&family=Noto+Sans+JP:wght@400;500;700;900&display=swap" rel="stylesheet">
                <link rel="icon" href="/icons/favicon-32.png" type="image/png">
                <title>"旅のチケット | Tabilog"</title>
                <style>(Unescaped::new_unchecked(include_str!("styles.css")))</style>
                <style>".dialog-layer[hidden] { display: none; }"</style>
            </head>
            <body>
                <a class="skip-link" href="#main-content">"本文へ移動"</a>
                (slot.await?)
                <script>(Unescaped::new_unchecked(include_str!("rust.js")))</script>
            </body>
        </html>
    }
}

#[page("/")]
async fn home() -> Result {
    Err(redirect("/trips").into())
}

#[page("/trips")]
async fn trips(cx: &Cx) -> Result {
    let database = app_context::<Database>(cx);
    let trips = repository::list_trips(database.pool())
        .await
        .map_err(internal_server_error)?;

    view! {
        <div class="app-shell is-tickets">
            <div class="sky" aria-hidden="true">
                for index in 1..=7 { <span class=(format!("cloud cloud-{}", index))></span> }
            </div>
            <header class="app-header">
                <a class="brand brand-logo" href="/trips" aria-label="Tabilog ホーム">
                    <img src=(logo_data_url()) alt="" width="32" height="32">
                    <strong>"Tabilog"</strong>
                </a>
            </header>
            <main id="main-content" class="main-content" tabindex="-1">
                <div class="page tickets-page">
                    <section class="section-block" aria-labelledby="ticket-list-title">
                        <h1 id="ticket-list-title" class="visually-hidden">"チケット一覧"</h1>
                        <nav class="tickets-actions" aria-label="チケットの操作">
                            <button class="button button-primary" type="button" data-open-ticket-dialog="true">
                                plus_icon() "チケットを発行"
                            </button>
                        </nav>
                        if trips.is_empty() {
                            <section class="panel tickets-empty">
                                ticket_icon()
                                <strong>"チケットはまだありません"</strong>
                                <p class="empty-state">"上の「チケットを発行」から旅を始めましょう。"</p>
                            </section>
                        } else {
                            <ul class="ticket-list">
                                for trip in trips {
                                    <li>
                                        <article class=(format!("ticket is-{}", trip.status)) style=(format!("--ticket: {}", trip.theme_color))>
                                            <a class="ticket-open" href=(format!("/trips/{}", trip.id))>
                                                <span class="ticket-inner">
                                                    <span class="ticket-stub">
                                                        <span class="ticket-stub-status">status_icon() (status_label(&trip.status))</span>
                                                    </span>
                                                    <span class="ticket-face">
                                                        <span class="ticket-route">
                                                            <span class="ticket-place"><small>"FROM"</small><strong>(place_or_unset(&trip.origin_name, "出発地未設定"))</strong></span>
                                                            <span class="ticket-arrow" aria-hidden="true"></span>
                                                            <span class="ticket-place"><small>"TO"</small><strong>(place_or_unset(&trip.destination_name, "目的地未設定"))</strong></span>
                                                        </span>
                                                        <span class="ticket-name">(trip.name)</span>
                                                        <span class="ticket-data">
                                                            <span class="ticket-data-cell">
                                                                <small>"DATE"</small>
                                                                <b>(short_date(trip.start_date)) <i aria-hidden="true">"–"</i> (short_date(trip.end_date))</b>
                                                                <u>(trip.start_date.map(|date| date.format("%Y").to_string()).unwrap_or_default())</u>
                                                            </span>
                                                            <span class="ticket-data-cell">
                                                                <small>"PARTY"</small>
                                                                <b>(format!("{:02}", trip.member_count)) <i aria-hidden="true">"名"</i></b>
                                                                <u>"メンバー"</u>
                                                            </span>
                                                            <span class="ticket-data-cell is-wide">
                                                                <small>"STATUS"</small>
                                                                <b class="ticket-countdown">(status_label(&trip.status))</b>
                                                            </span>
                                                        </span>
                                                    </span>
                                                </span>
                                            </a>
                                        </article>
                                    </li>
                                }
                            </ul>
                        }
                    </section>
                </div>
            </main>
        </div>
        new_ticket_dialog()
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
        <div class="app-shell is-ticket-detail" style=(format!("--ticket-theme: {}", trip.theme_color))>
            <header class="app-header">
                <a class="brand brand-back" href="/trips" aria-label="チケット一覧へ戻る">
                    back_icon()
                    <span><small>"チケット一覧"</small><strong>(trip.name.clone())</strong></span>
                </a>
            </header>
            <main id="main-content" class="main-content" tabindex="-1">
                <div class="page plan-page">
                    <section class="hero-section" aria-labelledby="hero-title">
                        <p class="eyebrow">(date_range(trip.start_date, trip.end_date))</p>
                        <h1 id="hero-title">(trip.name)</h1>
                        <p class="hero-destination">(place_or_unset(&trip.destination_name, "目的地未設定"))</p>
                    </section>
                    <section class="section-block">
                        <div class="section-heading">
                            <div><p class="eyebrow">"ITINERARY"</p><h2>"旅の予定"</h2></div>
                        </div>
                        <details class="panel page-help">
                            <summary>"予定を編集"</summary>
                            <form class="schedule-editor" data-api-form=(format!("/api/trips/{}/schedule", trip_id)) data-redirect=(format!("/trips/{}", trip_id))>
                                <div class="field-grid two">
                                    <label><span>"日付"</span><input name="day" type="date" required="required"></label>
                                    <label><span>"時間"</span><input name="starts_at" type="time"></label>
                                </div>
                                <label><span>"予定"</span><input name="title" required="required"></label>
                                <label><span>"場所"</span><input name="location_name"></label>
                                <label><span>"メモ"</span><textarea name="memo"></textarea></label>
                                <button class="button button-primary" type="submit">plus_icon() "予定を追加"</button>
                                <p class="form-message" aria-live="polite"></p>
                            </form>
                        </details>
                        <section class="panel plan-timeline" aria-label="旅の予定">
                            if schedule.is_empty() {
                                <div class="plan-empty"><p class="empty-state">"予定はまだありません。"</p></div>
                            } else {
                                for item in schedule {
                                    <article class="plan-timeline-row">
                                        <div class="plan-time">
                                            (item.starts_at.map(|time| time.format("%H:%M").to_string()).unwrap_or_else(|| "未定".into()))
                                            <i aria-hidden="true"></i>
                                        </div>
                                        <div class="plan-event">
                                            <small>(item.day.format("%m/%d").to_string())</small>
                                            <strong>(item.title)</strong>
                                            if !item.location_name.is_empty() { <p class="plan-location-name">(item.location_name)</p> }
                                            if !item.memo.is_empty() { <p>(item.memo)</p> }
                                        </div>
                                    </article>
                                }
                            }
                        </section>
                    </section>
                </div>
            </main>
            <nav class="bottom-nav" aria-label="メインメニュー">
                <a class="is-active" href=(format!("/trips/{}", trip_id)) aria-current="page">home_icon()<span>"ホーム"</span></a>
                <a href=(format!("/trips/{}", trip_id))>calendar_icon()<span>"予定"</span></a>
                <a href=(format!("/trips/{}", trip_id))>money_icon()<span>"お金"</span></a>
                <a href=(format!("/trips/{}", trip_id))>bag_icon()<span>"持ち物"</span></a>
                <a href=(format!("/trips/{}", trip_id))>users_icon()<span>"共有"</span></a>
            </nav>
        </div>
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
        return Err(bad_request("帰宅日は出発日以降にしてください").into());
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

#[component]
async fn new_ticket_dialog() -> Result {
    view! {
        <div class="dialog-layer" data-ticket-dialog="true" hidden="hidden">
            <button class="dialog-scrim" type="button" aria-label="閉じる" data-close-ticket-dialog="true"></button>
            <section class="dialog" role="dialog" aria-modal="true" aria-labelledby="new-ticket-title">
                <header>
                    <div><p class="eyebrow">"NEW TICKET"</p><h2 id="new-ticket-title">"チケットを発行する"</h2></div>
                    <button class="icon-button" type="button" aria-label="閉じる" data-close-ticket-dialog="true">"×"</button>
                </header>
                <form data-api-form="/api/trips" data-redirect="/trips">
                    <label><span>"旅行名"</span><input name="name" maxlength="40" placeholder="例：宮崎旅行" required="required"></label>
                    <div class="field-grid two">
                        <label><span>"出発日"</span><input name="start_date" type="date"></label>
                        <label><span>"帰宅日"</span><input name="end_date" type="date"></label>
                    </div>
                    <fieldset class="color-picker">
                        <legend>"テーマカラー"</legend>
                        for (index, color) in ["#e8735f", "#2f9e8f", "#4a78b8", "#d69a2d", "#9b6bb0"].iter().enumerate() {
                            <label class="color-swatch" style=(format!("--swatch: {}", color))>
                                <input type="radio" name="theme_color" value=(*color) checked=(index == 0)>
                                <span aria-hidden="true"></span><span class="visually-hidden">(format!("カラー {}", color))</span>
                            </label>
                        }
                    </fieldset>
                    <div class="dialog-places">
                        <p class="dialog-places-lead">"どこからどこへ行きますか"</p>
                        <label><span>"出発地"</span><input name="origin_name"></label>
                        <label><span>"目的地"</span><input name="destination_name"></label>
                    </div>
                    <div class="dialog-actions">
                        <button class="button button-quiet" type="button" data-close-ticket-dialog="true">"やめる"</button>
                        <button class="button button-primary" type="submit">plus_icon() "チケットを発行"</button>
                    </div>
                    <p class="form-message" aria-live="polite"></p>
                </form>
            </section>
        </div>
    }
}

#[component]
async fn icon(path: &'static str) -> Result {
    view! { <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d=(path)></path></svg> }
}
#[component]
async fn plus_icon() -> Result {
    view! { icon(path: "M12 5v14M5 12h14") }
}
#[component]
async fn ticket_icon() -> Result {
    view! { icon(path: "M2 9a3 3 0 0 0 0 6v4h20v-4a3 3 0 0 0 0-6V5H2v4z") }
}
#[component]
async fn status_icon() -> Result {
    view! { icon(path: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2z") }
}
#[component]
async fn back_icon() -> Result {
    view! { icon(path: "M19 12H5M12 19l-7-7 7-7") }
}
#[component]
async fn home_icon() -> Result {
    view! { icon(path: "M3 11l9-8 9 8v10h-6v-6H9v6H3z") }
}
#[component]
async fn calendar_icon() -> Result {
    view! { status_icon() }
}
#[component]
async fn money_icon() -> Result {
    view! { icon(path: "M12 2v20M17 6.5a4 4 0 0 0-4-2h-2a4 4 0 0 0 0 8h2a4 4 0 0 1 0 8H9a4 4 0 0 1-4-2") }
}
#[component]
async fn bag_icon() -> Result {
    view! { icon(path: "M6 8V6a6 6 0 0 1 12 0v2M4 8h16l-1 13H5z") }
}
#[component]
async fn users_icon() -> Result {
    view! { icon(path: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8M22 21v-2a4 4 0 0 0-3-3.87") }
}

fn place_or_unset(value: &str, fallback: &str) -> String {
    if value.is_empty() {
        fallback.into()
    } else {
        value.into()
    }
}
fn logo_data_url() -> String {
    format!(
        "data:image/png;base64,{}",
        STANDARD.encode(include_bytes!("../public/icons/icon-192.png"))
    )
}
fn status_label(status: &str) -> &'static str {
    match status {
        "traveling" => "旅行中",
        "done" => "旅行済み",
        "archived" => "アーカイブ",
        _ => "計画中",
    }
}
fn short_date(date: Option<chrono::NaiveDate>) -> String {
    date.map(|date| date.format("%m.%d").to_string())
        .unwrap_or_else(|| "--.--".into())
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

#[cfg(test)]
mod tests {
    use super::date_range;
    use chrono::NaiveDate;

    #[test]
    fn formats_a_complete_date_range() {
        assert_eq!(
            date_range(
                NaiveDate::from_ymd_opt(2026, 8, 10),
                NaiveDate::from_ymd_opt(2026, 8, 12)
            ),
            "2026/08/10 – 2026/08/12"
        );
    }

    #[test]
    fn formats_an_unset_date_range() {
        assert_eq!(date_range(None, None), "日程未設定");
    }
}
