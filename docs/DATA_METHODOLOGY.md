# Benchmark data methodology

RawMarket distinguishes official publications from RawMarket-calculated indices and from exchange prices. The market maker, CLOB midpoint and last fill are never eligible benchmark substitutes.

## Evidence archive

The exact evidence captured for the hackathon is indexed in [`sources/manifest.json`](../sources/manifest.json). Archived files include:

- USDA Class and Component Prices, report dated 2026-09-02;
- Federal Order Class III historical price table, 1990 through August 2026;
- USDA National Potato and Onion Report, dated 2026-09-11;
- USDA Tomato Fax Report, dated 2026-09-11;
- USDA National FOB Review, dated 2026-09-11;
- Hedera prize-page snapshot; and
- ATS and ATS SDK documentation pinned at commit `be4f860e408ec5b1a24d12feb6f872aabff69319`.

The manifest records source URLs and SHA-256 hashes. CME Class III Milk specifications were accessed, but the manifest explicitly marks the page archive as pending.

## MILK

| Field | Specification |
| --- | --- |
| Benchmark | USDA announced Class III milk price for the named contract month |
| Quote | USD per hundredweight |
| Reference exposure | 2,000 cwt / 200,000 pounds |
| Official source | USDA Class and Component Prices |
| Historical coverage | 440 monthly observations, January 1990 through August 2026 |

Class I, Class II, Class IV, retail milk and a previous month’s price are never substitutes for the named month. Continuous trading does not imply a continuous official benchmark series. The chart therefore renders fixing-change candles: the open is the previous published monthly Class III fixing, the close is the current fixing, and high/low are the two endpoints. Volume remains zero because the official fixing table contains no traded volume. This transformation is deterministic and does not manufacture intramonth prices.

## RawMarket US Russet Potato Index v1

Eligible records must match Russet Norkotah, U.S. One, 70-count, 50-pound cartons and a compatible US shipping-point/FOB price basis. Onion observations in the combined potato-and-onion report are excluded.

For each eligible observation:

1. use the midpoint of the “mostly” range when present;
2. otherwise use the midpoint of the ordinary range;
3. accept a single price as a point observation;
4. reject missing prices, shipment quantities and non-price text; and
5. retain no more than one representative value per reporting area.

The daily RawMarket composite is the median of reporting-area values. It is not an official USDA national average and is not a VWAP.

## RawMarket US Round Tomato Index v1

Eligible records must match round mature-green tomatoes, 85% U.S. One or Better, 5x6 size and 25-pound cartons loose on a compatible price basis. Roma, cherry, grape, vine-ripe and incompatible size/grade/package observations are excluded.

Area deduplication and daily-median calculation follow the same rules as the potato index.

## Grain and pulse candidates

WHEAT, CORN, RICE, SOYBEAN and DRY_BEAN are product candidates sharing the same CLOB and UI. Their screens are intentionally labelled `historical/demo`. No source methodology has been promoted to live status and no financial fixing should use their current reference values.

Each candidate requires a named USDA publication, exact grade/class/package or unit, domestic/import policy, deterministic adapter and 90-day audit before promotion.

## Promotion gate

Before POTATO, TOMATO or any grain/pulse candidate can be listed as source-approved, RawMarket must publish and pass:

- at least 90 days of available observations;
- eligible-area and constituent coverage;
- stale-record and duplicate detection;
- revision behavior;
- seasonality and missing-day analysis;
- domestic/import inclusion policy;
- minimum daily coverage;
- publication cutoff and holiday calendar;
- expiry averaging window;
- correction/dispute window; and
- bounded fallback/finalization procedure.

If automated access or compatible coverage is inadequate, the market remains historical/demo. A live specification must never be silently broadened.
