use std::collections::HashMap;

use chrono::{Datelike, Duration, NaiveDate};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ScheduleDay {
    pub id: String,
    pub label: String,
    pub short_label: String,
}

pub fn schedule_days(start: Option<NaiveDate>, end: Option<NaiveDate>) -> Vec<ScheduleDay> {
    let (Some(mut cursor), Some(end)) = (start, end) else {
        return fallback_schedule_days();
    };
    if end < cursor {
        return fallback_schedule_days();
    }
    let weekdays = ["月", "火", "水", "木", "金", "土", "日"];
    let mut days = Vec::new();
    while cursor <= end && days.len() < 14 {
        days.push(ScheduleDay {
            id: cursor.format("%Y-%m-%d").to_string(),
            label: format!(
                "{}月{}日（{}）",
                cursor.month(),
                cursor.day(),
                weekdays[cursor.weekday().num_days_from_monday() as usize]
            ),
            short_label: format!("{}/{}", cursor.month(), cursor.day()),
        });
        cursor += Duration::days(1);
    }
    if days.is_empty() {
        fallback_schedule_days()
    } else {
        days
    }
}

fn fallback_schedule_days() -> Vec<ScheduleDay> {
    schedule_days(
        NaiveDate::from_ymd_opt(2026, 9, 21),
        NaiveDate::from_ymd_opt(2026, 9, 23),
    )
}

pub const TICKET_COLORS: [&str; 6] = [
    "#e8735f", "#2f9e8f", "#6d83c9", "#d9853b", "#b5679a", "#4f8f5b",
];

pub fn default_theme_color(seed: i64) -> &'static str {
    TICKET_COLORS[seed.unsigned_abs() as usize % TICKET_COLORS.len()]
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TicketStatus {
    Planning,
    Traveling,
    Done,
    Archived,
}

pub fn ticket_status(
    archived: bool,
    completed_at: Option<&str>,
    start_date: &str,
    end_date: &str,
    now: &str,
) -> TicketStatus {
    if archived {
        return TicketStatus::Archived;
    }
    if completed_at.is_some() {
        return TicketStatus::Done;
    }
    if start_date.is_empty() || end_date.is_empty() {
        return TicketStatus::Planning;
    }
    if now > end_date {
        return TicketStatus::Done;
    }
    if now >= start_date {
        return TicketStatus::Traveling;
    }
    TicketStatus::Planning
}

pub fn days_until_start(start_date: &str, now: &str) -> Option<i64> {
    if start_date.is_empty() {
        return None;
    }
    let from = NaiveDate::parse_from_str(now, "%Y-%m-%d").ok()?;
    let to = NaiveDate::parse_from_str(start_date, "%Y-%m-%d").ok()?;
    Some((to - from).num_days())
}

pub type Coordinates = [f64; 2];

pub fn is_valid_coordinate(lat: f64, lng: f64) -> bool {
    lat.is_finite()
        && lng.is_finite()
        && lat.abs() <= 90.0
        && lng.abs() <= 180.0
        && !(lat == 0.0 && lng == 0.0)
}

pub fn curve_between(
    origin: Coordinates,
    destination: Coordinates,
    steps: usize,
) -> Vec<Coordinates> {
    let [start_lng, start_lat] = origin;
    let [end_lng, end_lat] = destination;
    let dx = end_lng - start_lng;
    let dy = end_lat - start_lat;
    let control = [
        (start_lng + end_lng) / 2.0 - dy * 0.16,
        (start_lat + end_lat) / 2.0 + dx * 0.1,
    ];

    (0..=steps)
        .map(|index| {
            let t = index as f64 / steps as f64;
            let inverse = 1.0 - t;
            [
                inverse * inverse * start_lng + 2.0 * inverse * t * control[0] + t * t * end_lng,
                inverse * inverse * start_lat + 2.0 * inverse * t * control[1] + t * t * end_lat,
            ]
        })
        .collect()
}

pub fn route_line(points: &[(f64, f64)]) -> Vec<Coordinates> {
    points
        .windows(2)
        .flat_map(|pair| curve_between([pair[0].1, pair[0].0], [pair[1].1, pair[1].0], 24))
        .collect()
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CostItem {
    pub amount: i64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SouvenirItem {
    pub quantity: i64,
    pub price: i64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BudgetInput {
    pub transport_cost: i64,
    pub access_cost: i64,
    pub breakfast: bool,
    pub hotel_without_breakfast: i64,
    pub hotel_with_breakfast: i64,
    pub custom_items: Vec<CostItem>,
    pub souvenirs: Vec<SouvenirItem>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BudgetSummary {
    pub hotel: i64,
    pub souvenirs: i64,
    pub custom: i64,
    pub per_person: i64,
    pub trip_total: i64,
    pub people_count: usize,
}

pub fn budget_summary(input: &BudgetInput, people_count: usize) -> BudgetSummary {
    let count = people_count.max(1);
    let hotel = non_negative(if input.breakfast {
        input.hotel_with_breakfast
    } else {
        input.hotel_without_breakfast
    });
    let souvenirs = input
        .souvenirs
        .iter()
        .map(|item| non_negative(item.quantity) * non_negative(item.price))
        .sum();
    let custom = input
        .custom_items
        .iter()
        .map(|item| non_negative(item.amount))
        .sum();
    let per_person = non_negative(input.transport_cost)
        + non_negative(input.access_cost)
        + hotel
        + souvenirs
        + custom;

    BudgetSummary {
        hotel,
        souvenirs,
        custom,
        per_person,
        trip_total: per_person * count as i64,
        people_count: count,
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Person {
    pub id: String,
    pub name: String,
    pub role: String,
    pub memo: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Payment {
    pub payer_id: String,
    pub amount: i64,
    pub participant_ids: Option<Vec<String>>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SettlementInput {
    pub people: Vec<Person>,
    pub payments: Vec<Payment>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Balance {
    pub person: Person,
    pub paid: i64,
    pub share: i64,
    pub balance: i64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Transfer {
    pub from: String,
    pub to: String,
    pub amount: i64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SettlementSummary {
    pub paid_total: i64,
    pub base_share: i64,
    pub remainder: i64,
    pub balances: Vec<Balance>,
    pub transfers: Vec<Transfer>,
}

pub fn settlement_summary(input: &SettlementInput) -> SettlementSummary {
    let people_count = input.people.len().max(1);
    let paid_total: i64 = input
        .payments
        .iter()
        .map(|payment| non_negative(payment.amount))
        .sum();
    let mut shares: HashMap<&str, i64> = input
        .people
        .iter()
        .map(|person| (person.id.as_str(), 0))
        .collect();

    for payment in &input.payments {
        let selected: Vec<&str> = payment
            .participant_ids
            .as_ref()
            .map(|ids| {
                ids.iter()
                    .map(String::as_str)
                    .filter(|id| shares.contains_key(id))
                    .collect()
            })
            .unwrap_or_default();
        let participants: Vec<&str> = if selected.is_empty() {
            input
                .people
                .iter()
                .map(|person| person.id.as_str())
                .collect()
        } else {
            selected
        };
        if participants.is_empty() {
            continue;
        }

        let amount = non_negative(payment.amount);
        let per_person = amount / participants.len() as i64;
        let remainder = amount % participants.len() as i64;
        for (index, id) in participants.into_iter().enumerate() {
            if let Some(share) = shares.get_mut(id) {
                *share += per_person + i64::from((index as i64) < remainder);
            }
        }
    }

    let balances: Vec<Balance> = input
        .people
        .iter()
        .map(|person| {
            let paid = input
                .payments
                .iter()
                .filter(|payment| payment.payer_id == person.id)
                .map(|payment| non_negative(payment.amount))
                .sum();
            let share = shares.get(person.id.as_str()).copied().unwrap_or_default();
            Balance {
                person: person.clone(),
                paid,
                share,
                balance: paid - share,
            }
        })
        .collect();

    let mut debtors: Vec<(String, i64)> = balances
        .iter()
        .filter(|balance| balance.balance < 0)
        .map(|balance| (balance.person.name.clone(), -balance.balance))
        .collect();
    let mut creditors: Vec<(String, i64)> = balances
        .iter()
        .filter(|balance| balance.balance > 0)
        .map(|balance| (balance.person.name.clone(), balance.balance))
        .collect();
    let mut transfers = Vec::new();
    let (mut debtor_index, mut creditor_index) = (0, 0);

    while debtor_index < debtors.len() && creditor_index < creditors.len() {
        let amount = debtors[debtor_index].1.min(creditors[creditor_index].1);
        if amount > 0 {
            transfers.push(Transfer {
                from: debtors[debtor_index].0.clone(),
                to: creditors[creditor_index].0.clone(),
                amount,
            });
        }
        debtors[debtor_index].1 -= amount;
        creditors[creditor_index].1 -= amount;
        if debtors[debtor_index].1 == 0 {
            debtor_index += 1;
        }
        if creditors[creditor_index].1 == 0 {
            creditor_index += 1;
        }
    }

    SettlementSummary {
        paid_total,
        base_share: paid_total / people_count as i64,
        remainder: paid_total % people_count as i64,
        balances,
        transfers,
    }
}

fn non_negative(value: i64) -> i64 {
    value.max(0)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn person(id: &str, name: &str) -> Person {
        Person {
            id: id.into(),
            name: name.into(),
            role: "メンバー".into(),
            memo: String::new(),
        }
    }

    #[test]
    fn budget_matches_typescript_breakfast_and_people_rules() {
        let input = BudgetInput {
            transport_cost: 36_200,
            access_cost: 2_360,
            breakfast: true,
            hotel_without_breakfast: 6_500,
            hotel_with_breakfast: 9_100,
            custom_items: vec![CostItem { amount: 1_200 }, CostItem { amount: -50 }],
            souvenirs: vec![SouvenirItem {
                quantity: 2,
                price: 800,
            }],
        };

        assert_eq!(
            budget_summary(&input, 0),
            BudgetSummary {
                hotel: 9_100,
                souvenirs: 1_600,
                custom: 1_200,
                per_person: 50_460,
                trip_total: 50_460,
                people_count: 1,
            }
        );
    }

    #[test]
    fn ticket_helpers_match_typescript_boundary_rules() {
        assert_eq!(default_theme_color(-1), TICKET_COLORS[1]);
        assert_eq!(
            ticket_status(true, None, "2026-08-01", "2026-08-02", "2026-07-29"),
            TicketStatus::Archived
        );
        assert_eq!(
            ticket_status(false, Some(""), "", "", "2026-07-29"),
            TicketStatus::Done
        );
        assert_eq!(
            ticket_status(false, None, "2026-07-29", "2026-07-30", "2026-07-29"),
            TicketStatus::Traveling
        );
        assert_eq!(
            ticket_status(false, None, "2026-07-30", "2026-07-30", "2026-07-29"),
            TicketStatus::Planning
        );
        assert_eq!(
            ticket_status(false, None, "2026-07-28", "2026-07-28", "2026-07-29"),
            TicketStatus::Done
        );
        assert_eq!(days_until_start("2026-08-01", "2026-07-29"), Some(3));
        assert_eq!(days_until_start("", "2026-07-29"), None);
    }

    #[test]
    fn schedule_days_match_typescript_limit_labels_and_fallback() {
        let days = schedule_days(
            NaiveDate::from_ymd_opt(2026, 9, 21),
            NaiveDate::from_ymd_opt(2026, 10, 30),
        );
        assert_eq!(days.len(), 14);
        assert_eq!(
            days[0],
            ScheduleDay {
                id: "2026-09-21".into(),
                label: "9月21日（月）".into(),
                short_label: "9/21".into()
            }
        );
        assert_eq!(schedule_days(None, None).len(), 3);
    }

    #[test]
    fn route_math_matches_typescript_equations_and_duplicate_junctions() {
        assert!(is_valid_coordinate(31.9111, 131.4239));
        assert!(!is_valid_coordinate(0.0, 0.0));
        assert!(!is_valid_coordinate(91.0, 131.0));

        let curve = curve_between([131.0, 31.0], [132.0, 32.0], 2);
        assert_eq!(curve.len(), 3);
        assert_eq!(curve[0], [131.0, 31.0]);
        assert_eq!(curve[2], [132.0, 32.0]);

        let line = route_line(&[(31.0, 131.0), (32.0, 132.0), (33.0, 133.0)]);
        assert_eq!(line.len(), 50);
        assert_eq!(line[24], line[25]);
    }

    #[test]
    fn settlement_matches_typescript_participant_and_remainder_order() {
        let input = SettlementInput {
            people: vec![person("a", "葵"), person("b", "海"), person("c", "空")],
            payments: vec![
                Payment {
                    payer_id: "a".into(),
                    amount: 10_001,
                    participant_ids: None,
                },
                Payment {
                    payer_id: "b".into(),
                    amount: 3_000,
                    participant_ids: Some(vec!["b".into(), "c".into()]),
                },
            ],
        };

        let summary = settlement_summary(&input);
        assert_eq!(summary.paid_total, 13_001);
        assert_eq!(summary.base_share, 4_333);
        assert_eq!(summary.remainder, 2);
        assert_eq!(
            summary.balances.iter().map(|b| b.share).collect::<Vec<_>>(),
            vec![3_334, 4_834, 4_833]
        );
        assert_eq!(
            summary.transfers,
            vec![
                Transfer {
                    from: "海".into(),
                    to: "葵".into(),
                    amount: 1_834
                },
                Transfer {
                    from: "空".into(),
                    to: "葵".into(),
                    amount: 4_833
                },
            ]
        );
    }
}
