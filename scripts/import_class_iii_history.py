#!/usr/bin/env python3
"""Import official Federal Order Class III monthly prices into engine data.

The source is published by the USDA Federal Milk Marketing Order 30 Market
Administrator.  The importer archives the exact PDF, extracts the monthly
table deterministically, validates continuity, and writes a compact JSON file
that is embedded into the Rust service image.
"""

from __future__ import annotations

import hashlib
import json
import re
import subprocess
import urllib.error
import urllib.request
from datetime import date
from pathlib import Path


SOURCE_URL = "https://www.fmma30.com/ClassPrice/HistoryofClassIII--1990-Current.pdf"
ROOT = Path(__file__).resolve().parents[1]
ARCHIVE = ROOT / "sources" / "archive" / "fmma30-class-iii-history-current.pdf"
OUTPUT = ROOT / "engine" / "data" / "market-history.json"
MONTHS = range(1, 13)


def download(url: str, target: Path) -> bytes:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (compatible; RawMarketDataBot/1.0; +https://github.com/KENILSHAHH/rawmarket)",
            "Accept": "text/plain,application/pdf,*/*",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            payload = response.read()
    except urllib.error.URLError:
        payload = subprocess.run(
            ["curl", "--fail", "--silent", "--show-error", "--location", "--max-time", "30", url],
            check=True,
            capture_output=True,
        ).stdout
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(payload)
    return payload


def extract_rows() -> list[dict[str, object]]:
    text = subprocess.run(
        ["pdftotext", "-layout", str(ARCHIVE), "-"],
        check=True,
        capture_output=True,
        text=True,
    ).stdout
    observations: list[dict[str, object]] = []
    for line in text.splitlines():
        match = re.match(r"^\s*((?:19|20)\d{2})\s+(.+)$", line)
        if not match:
            continue
        year = int(match.group(1))
        values = [float(value) for value in re.findall(r"\d+\.\d{2}", match.group(2))]
        if len(values) < 2:
            continue
        monthly = values[:-1]  # The final value in every row is the published annual average.
        if len(monthly) > 12:
            raise RuntimeError(f"Unexpected month count for {year}: {len(monthly)}")
        for month, value in zip(MONTHS, monthly):
            observations.append({"date": f"{year:04d}-{month:02d}-01", "value": value})

    if len(observations) < 300:
        raise RuntimeError(f"Expected at least 25 years of monthly prices, got {len(observations)}")
    dates = [item["date"] for item in observations]
    if len(dates) != len(set(dates)):
        raise RuntimeError("Duplicate Class III observation month")
    return observations


def main() -> None:
    payload = download(SOURCE_URL, ARCHIVE)
    if not payload.startswith(b"%PDF"):
        raise RuntimeError("Class III source did not return a PDF")
    observations = extract_rows()
    series = {
        "MILK": {
            "name": "Federal Order Class III Price",
            "unit": "USD/cwt",
            "frequency": "monthly",
            "source": "USDA Federal Milk Marketing Order 30",
            "source_url": SOURCE_URL,
            "source_sha256": hashlib.sha256(payload).hexdigest(),
            "observations": observations,
        }
    }
    document = {
        "schema_version": 1,
        "generated_at": date.today().isoformat(),
        "series": series,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(document, indent=2) + "\n", encoding="utf-8")
    print(f"wrote MILK={len(observations)} observations to {OUTPUT}")
    print(f"milk source sha256 {series['MILK']['source_sha256']}")


if __name__ == "__main__":
    main()
