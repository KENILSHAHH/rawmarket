use serde::{Deserialize, Serialize};
use std::collections::HashMap;

const MARKET_HISTORY_JSON: &str = include_str!("../data/market-history.json");

#[derive(Clone, Deserialize)]
struct HistoryDocument {
    series: HashMap<String, HistoricalSeries>,
}

#[derive(Clone, Deserialize)]
struct HistoricalSeries {
    frequency: String,
    source: String,
    source_url: String,
    observations: Vec<Observation>,
}

#[derive(Clone, Deserialize)]
struct Observation {
    date: String,
    value: f64,
}

#[derive(Clone, Serialize)]
pub struct Candle {
    pub time: String,
    pub open: f64,
    pub high: f64,
    pub low: f64,
    pub close: f64,
    pub volume: f64,
    pub source: String,
}

#[derive(Serialize)]
pub struct CandleResponse {
    pub interval: String,
    pub frequency: String,
    pub source_status: String,
    pub coverage: String,
    pub source_url: Option<String>,
    pub as_of: Option<String>,
    pub candles: Vec<Candle>,
}

#[derive(Clone)]
pub struct HistoryStore {
    document: HistoryDocument,
}

impl HistoryStore {
    pub fn embedded() -> Result<Self, serde_json::Error> {
        serde_json::from_str(MARKET_HISTORY_JSON).map(|document| Self { document })
    }

    pub fn candles(&self, symbol: &str, range: &str) -> CandleResponse {
        let Some(series) = self.document.series.get(&symbol.to_ascii_uppercase()) else {
            return CandleResponse {
                interval: range.into(),
                frequency: "unavailable".into(),
                source_status: "source unavailable".into(),
                coverage: "No compatible benchmark history is loaded for this market.".into(),
                source_url: None,
                as_of: None,
                candles: vec![],
            };
        };

        let requested = match range.to_ascii_uppercase().as_str() {
            "1D" | "1W" => 2,
            "1M" => 2,
            "3M" => 4,
            "1Y" => 13,
            "5Y" => 61,
            "25Y" => 301,
            _ => 61,
        };
        let start = series.observations.len().saturating_sub(requested);
        let selected = &series.observations[start..];
        let candles = selected
            .iter()
            .enumerate()
            .map(|(index, observation)| {
                let previous = if index == 0 {
                    observation.value
                } else {
                    selected[index - 1].value
                };
                Candle {
                    time: observation.date.clone(),
                    open: previous,
                    high: previous.max(observation.value),
                    low: previous.min(observation.value),
                    close: observation.value,
                    volume: 0.0,
                    source: series.source.clone(),
                }
            })
            .collect::<Vec<_>>();
        let first = selected
            .first()
            .map(|item| item.date.as_str())
            .unwrap_or("—");
        let last = selected
            .last()
            .map(|item| item.date.as_str())
            .unwrap_or("—");

        CandleResponse {
            interval: range.into(),
            frequency: series.frequency.clone(),
            source_status: "verified official history".into(),
            coverage: format!("{first} through {last} · {} observations", selected.len()),
            source_url: Some(series.source_url.clone()),
            as_of: selected.last().map(|item| item.date.clone()),
            candles,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn loads_more_than_twenty_five_years_of_milk_history() {
        let store = HistoryStore::embedded().unwrap();
        let response = store.candles("MILK", "25Y");
        assert_eq!(response.candles.len(), 301);
        assert_eq!(response.candles.last().unwrap().close, 16.64);
        assert_eq!(response.frequency, "monthly");
    }

    #[test]
    fn range_filters_do_not_invent_daily_observations() {
        let store = HistoryStore::embedded().unwrap();
        let response = store.candles("MILK", "1Y");
        assert_eq!(response.candles.len(), 13);
        assert!(response.candles.iter().all(|item| item.volume == 0.0));
    }
}
