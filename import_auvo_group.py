#!/usr/bin/env python3
"""
import_auvo_group.py — Import Auvo customer group into Erione CMMS via REST API.

Usage:
  python import_auvo_group.py --group-id 125014 --group-name "Tremembe" --mode dry-run
  python import_auvo_group.py --group-id 125014 --group-name "Tremembe" --mode apply
  python import_auvo_group.py --group-id 125011 --group-name "ARC Mobilidade" --mode dry-run

Authentication via env vars IMPORT_EMAIL / IMPORT_PASSWORD, or --email / --password.
"""

import argparse
import json
import os
import sys
import textwrap
from datetime import datetime
from pathlib import Path

import requests

# ── Paths ──────────────────────────────────────────────────
AUVO_DIR = Path("C:/Users/CaioSouza/Desktop/saida_auvo/saida_auvo")
DEFAULT_API = "http://localhost:8080"

# ── Helpers ─────────────────────────────────────────────────

def eprint(*a, **kw):
    print(*a, file=sys.stderr, **kw)


def trunc(val, n=100):
    s = str(val) if val else ""
    return s[:n] if len(s) <= n else s[: n - 3] + "..."


def safe_float(val, default=None):
    if val is None:
        return default
    try:
        return float(val)
    except (ValueError, TypeError):
        return default


# ── API client ─────────────────────────────────────────────

class ErioneClient:
    def __init__(self, api_url: str, email: str, password: str):
        self.api_url = api_url.rstrip("/")
        self.session = requests.Session()
        self.session.headers["Content-Type"] = "application/json"
        self._auth(email, password)

    def _auth(self, email: str, password: str):
        r = self.session.post(
            f"{self.api_url}/auth/signin",
            json={"email": email, "password": password},
        )
        if r.status_code != 200:
            raise SystemExit(f"Auth failed ({r.status_code}): {r.text}")
        token = r.json()["accessToken"]
        self.session.headers["Authorization"] = f"Bearer {token}"

    def get_customer_by_name(self, name: str):
        r = self.session.post(
            f"{self.api_url}/customers/search",
            json={
                "filterFields": [
                    {
                        "field": "name",
                        "value": name.strip(),
                        "operation": "eq",
                    }
                ],
                "pageNum": 0,
                "pageSize": 10,
            },
        )
        if r.status_code == 200:
            content = r.json().get("content", [])
            if content:
                return content[0]
        return None

    def create_customer(self, payload: dict):
        r = self.session.post(f"{self.api_url}/customers", json=payload)
        if r.status_code not in (200, 201):
            raise RuntimeError(f"POST /customers {r.status_code}: {r.text}")
        return r.json()

    def search_locations(self, customer_id: int):
        r = self.session.post(
            f"{self.api_url}/locations/search",
            json={
                "filterFields": [
                    {
                        "field": "customers",
                        "operation": "inm",
                        "values": [customer_id],
                        "value": "",
                        "joinType": "LEFT",
                    }
                ],
                "pageNum": 0,
                "pageSize": 500,
            },
        )
        if r.status_code == 200:
            return r.json().get("content", [])
        return []

    def create_location(self, payload: dict):
        r = self.session.post(f"{self.api_url}/locations", json=payload)
        if r.status_code not in (200, 201):
            raise RuntimeError(f"POST /locations {r.status_code}: {r.text}")
        return r.json()

    def search_assets(self, customer_id: int):
        r = self.session.post(
            f"{self.api_url}/assets/search",
            json={
                "filterFields": [
                    {
                        "field": "customers",
                        "operation": "inm",
                        "values": [customer_id],
                        "value": "",
                        "joinType": "LEFT",
                    }
                ],
                "pageNum": 0,
                "pageSize": 500,
            },
        )
        if r.status_code == 200:
            return r.json().get("content", [])
        return []

    def create_asset(self, payload: dict):
        r = self.session.post(f"{self.api_url}/assets", json=payload)
        if r.status_code not in (200, 201):
            raise RuntimeError(f"POST /assets {r.status_code}: {r.text}")
        return r.json()


# ── Auvo data loader ───────────────────────────────────────

def load_auvo_data(auvo_dir: Path, group_id: int):
    with open(auvo_dir / "customers.json", encoding="utf-8") as f:
        all_customers = json.load(f)
    with open(auvo_dir / "equipments.json", encoding="utf-8") as f:
        all_equipments = json.load(f)

    group_customers = [c for c in all_customers if group_id in c.get("groupsId", [])]
    group_cust_ids = {c["id"] for c in group_customers}
    group_equipments = [e for e in all_equipments if e.get("associatedCustomerId") in group_cust_ids]

    return group_customers, group_equipments


def build_site_name(site: dict) -> str:
    addr = (site.get("address") or "").strip()
    import re
    m = re.match(r"^ID\s*\d+\s*-\s*(.+)", addr)
    if m:
        return m.group(1).strip()[:100]
    m = re.match(r"^ID\s*\d+", addr)
    if m:
        return addr[:100]
    desc = (site.get("description") or "").strip()
    if desc:
        return (desc + " - " + addr.split(",")[0])[:100]
    return addr[:100] if addr else f"Site {site.get('id', '?')}"


def build_full_address(site: dict) -> str:
    addr = (site.get("address") or "").strip()
    comp = (site.get("adressComplement") or "").strip()
    if comp:
        return (comp + ", " + addr)[:255]
    return addr[:255]


# ── Dedup helpers ──────────────────────────────────────────

def match_location(existing_locs, site, customer_id, group_name):
    site_name_lower = build_site_name(site).strip().lower()
    addr_lower = build_full_address(site).strip().lower()
    for loc in existing_locs:
        if loc.get("name", "").strip().lower() == site_name_lower:
            return loc
        if loc.get("address", "").strip().lower() == addr_lower:
            return loc
    return None


def match_asset(existing_assets, equip, location_id):
    eq_name_lower = (equip.get("name") or "").strip().lower()
    eq_id = equip.get("id")
    for a in existing_assets:
        if a.get("barCode") and str(a["barCode"]) == str(eq_id):
            return a
        if a.get("name", "").strip().lower() == eq_name_lower:
            loc_id = None
            if a.get("location"):
                loc_id = a["location"].get("id")
            if location_id and loc_id == location_id:
                return a
    return None


# ── Report builder ─────────────────────────────────────────

class ImportReport:
    def __init__(self, group_id, group_name):
        self.group_id = group_id
        self.group_name = group_name
        self.timestamp = datetime.now().isoformat()
        self.customer = {}
        self.locations_created = []
        self.locations_reused = []
        self.locations_skipped = []
        self.assets_created = []
        self.assets_reused = []
        self.assets_skipped = []
        self.incomplete = []
        self.duplicates = []
        self.errors = []

    def markdown(self):
        lines = [
            f"# Import Report: {self.group_name} (groupId {self.group_id})",
            f"**Date:** {self.timestamp}",
            "",
            "---",
            "",
            "## Customer",
        ]
        if self.customer.get("action") == "created":
            lines.append(f"- ✅ Created: **{self.customer['name']}** (ID {self.customer['id']})")
        elif self.customer.get("action") == "reused":
            lines.append(f"- ♻️ Reused: **{self.customer['name']}** (ID {self.customer['id']})")
        else:
            lines.append(f"- ❌ Error: {self.customer.get('error', 'N/A')}")

        lines += [
            "",
            "## Locations",
            f"- **Created:** {len(self.locations_created)}",
            f"- **Reused (dedup):** {len(self.locations_reused)}",
            f"- **Skipped (incomplete):** {len(self.locations_skipped)}",
            "",
        ]
        if self.locations_created:
            lines.append("### Created")
            lines.append("| Name | Address | Lat | Lng | Erione ID |")
            lines.append("|------|---------|-----|-----|-----------|")
            for loc in self.locations_created:
                lines.append(f"| {loc['name']} | {trunc(loc['address'], 40)} | {loc['lat']} | {loc['lng']} | {loc['id']} |")
            lines.append("")
        if self.locations_reused:
            lines.append("### Reused (dedup match)")
            for loc in self.locations_reused:
                lines.append(f"- {loc['name']} (ID {loc['id']})")
            lines.append("")
        if self.locations_skipped:
            lines.append("### Skipped (incomplete data)")
            for loc in self.locations_skipped:
                lines.append(f"- {loc['name']}: {loc['reason']}")
            lines.append("")

        lines += [
            "## Assets",
            f"- **Created:** {len(self.assets_created)}",
            f"- **Reused (dedup):** {len(self.assets_reused)}",
            f"- **Skipped (incomplete):** {len(self.assets_skipped)}",
            "",
        ]
        if self.assets_created:
            lines.append("### Created")
            lines.append("| Name | Auvo ID | Location | Erione ID |")
            lines.append("|------|---------|----------|-----------|")
            for a in self.assets_created:
                lines.append(f"| {a['name']} | {a.get('auvo_id', '')} | {trunc(a.get('location_name', ''), 30)} | {a['id']} |")
            lines.append("")
        if self.assets_reused:
            lines.append("### Reused (dedup match)")
            for a in self.assets_reused:
                lines.append(f"- {a['name']} (ID {a['id']})")
            lines.append("")

        if self.incomplete:
            lines += ["## Incomplete Records", ""]
            for rec in self.incomplete:
                lines.append(f"- {rec.get('name', '?' )}: {rec.get('reason', '')}")
            lines.append("")

        if self.duplicates:
            lines += ["## Probable Duplicates", ""]
            for d in self.duplicates:
                lines.append(f"- {d.get('name', '?')}: {d.get('detail', '')}")
            lines.append("")

        if self.errors:
            lines += ["## API Errors", ""]
            for e in self.errors:
                lines.append(f"- {e.get('operation', '')} for '{e.get('name', '')}': {e.get('error', '')}")
            lines.append("")

        lines += [
            "---",
            f"**Total:** 1 customer, {len(self.locations_created)} new locations "
            f"({len(self.locations_reused)} reused), "
            f"{len(self.assets_created)} new assets "
            f"({len(self.assets_reused)} reused)",
        ]
        return "\n".join(lines)

    def print_summary(self):
        print()
        print("=" * 55)
        print(f"  {self.group_name} — Import Summary")
        print("=" * 55)
        cust = self.customer
        if cust.get("id"):
            print(f"  Customer: {cust['name']} (ID {cust['id']}) [{cust.get('action', '?')}]")
        print(f"  Locations: {len(self.locations_created)} created, "
              f"{len(self.locations_reused)} reused, {len(self.locations_skipped)} skipped")
        print(f"  Assets:    {len(self.assets_created)} created, "
              f"{len(self.assets_reused)} reused, {len(self.assets_skipped)} skipped")
        if self.errors:
            print(f"  Errors:    {len(self.errors)}")
        if self.incomplete:
            print(f"  Incomplete: {len(self.incomplete)}")
        print("=" * 55)
        print()


# ── Main logic ─────────────────────────────────────────────

def run_import(args):
    group_id = args.group_id
    group_name = args.group_name
    mode = args.mode
    api_url = args.api_url
    email = args.email or os.environ.get("IMPORT_EMAIL")
    password = args.password or os.environ.get("IMPORT_PASSWORD")

    if not email or not password:
        raise SystemExit(
            "Set IMPORT_EMAIL / IMPORT_PASSWORD env vars or pass --email / --password"
        )

    report = ImportReport(group_id, group_name)

    # ── Load Auvo data ──
    print(f"\nLoading Auvo data for group {group_id} ({group_name})...")
    try:
        group_customers, group_equipments = load_auvo_data(AUVO_DIR, group_id)
    except FileNotFoundError as e:
        raise SystemExit(f"Auvo data not found: {e}")

    print(f"  Sites (Auvo customers): {len(group_customers)}")
    print(f"  Equipment (Auvo):       {len(group_equipments)}")

    # Track locations that have no lat/lng for reporting
    incomplete_sites = [c for c in group_customers if not safe_float(c.get("latitude"))]
    for site in incomplete_sites:
        report.incomplete.append({
            "name": build_site_name(site),
            "reason": "Missing latitude/longitude — skipping",
        })

    # ── Connect (only in apply mode, or for dedup in dry-run) ──
    client = None
    existing_customer = None
    existing_locations = []
    existing_assets = []

    if mode == "apply" or args.dry_run_dedup:
        print(f"\nConnecting to {api_url}...")
        client = ErioneClient(api_url, email, password)
        print("  Authenticated")

        # Check existing customer
        existing_customer = client.get_customer_by_name(group_name)

    # ── Dry-run customer ──
    if existing_customer:
        report.customer = {
            "action": "reused",
            "id": existing_customer["id"],
            "name": existing_customer["name"],
        }
        print(f"\n  Customer already exists: {existing_customer['name']} (ID {existing_customer['id']})")
    else:
        report.customer = {
            "action": "created" if mode == "apply" else "would_create",
            "id": None,
            "name": group_name,
        }
        print(f"\n  Customer will be created: {group_name}")

    # ── Dry-run locations ──
    customer_id = existing_customer["id"] if existing_customer else None

    if mode == "apply" and not customer_id:
        # Create customer first
        print(f"  Creating customer '{group_name}'...")
        try:
            created = client.create_customer({
                "name": group_name,
                "description": f"Importado do Auvo - grupo {group_id} - {len(group_customers)} locais",
            })
            customer_id = created["id"]
            report.customer = {"action": "created", "id": customer_id, "name": group_name}
            print(f"    OK ID {customer_id}")
        except RuntimeError as e:
            report.customer["error"] = str(e)
            report.errors.append({"operation": "create_customer", "name": group_name, "error": str(e)})
            print(f"    FAILED: {e}")
            # Can't continue without customer
            report.print_summary()
            return report

    if mode == "apply" or args.dry_run_dedup:
        if customer_id:
            existing_locations = client.search_locations(customer_id)
            existing_assets = client.search_assets(customer_id)
            print(f"  Existing locations for this customer: {len(existing_locations)}")
            print(f"  Existing assets for this customer: {len(existing_assets)}")

    # ── Process locations ──
    sites_to_create = []
    for site in group_customers:
        site_name = build_site_name(site)
        site_addr = build_full_address(site)
        site_lat = safe_float(site.get("latitude"))
        site_lng = safe_float(site.get("longitude"))

        if site_lat is None or site_lng is None:
            report.locations_skipped.append({
                "name": site_name,
                "reason": "Missing coordinates",
            })
            continue

        location_payload = {
            "name": site_name,
            "address": site_addr,
            "latitude": site_lat,
            "longitude": site_lng,
        }
        if customer_id:
            location_payload["customers"] = [{"id": customer_id}]

        # Dedup
        if mode == "apply" and existing_locations:
            match = match_location(existing_locations, site, customer_id, group_name)
            if match:
                report.locations_reused.append(match)
                continue

        sites_to_create.append((site, site_name, location_payload))

    # ── Process assets (after locations are known) ──
    # Build a mapping of Auvo customer ID -> location payload for asset linking
    site_map = {}
    for site, site_name, loc_payload in sites_to_create:
        site_map[site["id"]] = loc_payload

    equipments_to_create = []
    for eq in group_equipments:
        eq_name = (eq.get("name") or "").strip()
        if not eq_name:
            report.assets_skipped.append({
                "name": f"Auvo ID {eq.get('id', '?')}",
                "reason": "Empty equipment name",
            })
            continue

        eq_site_id = eq.get("associatedCustomerId")
        loc_payload = site_map.get(eq_site_id)
        loc_name = build_site_name(
            next((c for c in group_customers if c["id"] == eq_site_id), {})
        )

        asset_payload = {
            "name": eq_name,
            "description": (eq.get("description") or "")[:10000],
            "barCode": str(eq["id"]),
        }
        if customer_id:
            asset_payload["customers"] = [{"id": customer_id}]

        # If location was reused (not in sites_to_create), find it
        if not loc_payload and eq_site_id:
            for loc in report.locations_reused:
                auvo_cust = next((c for c in group_customers if c["id"] == eq_site_id), None)
                if auvo_cust and match_location([loc], auvo_cust, customer_id, group_name):
                    loc_payload = {"id": loc["id"]}
                    break

        if loc_payload:
            loc_erione_id = loc_payload.get("id")
            if not loc_erione_id and "name" in loc_payload:
                pass  # will be set after creation

        # Dedup
        if mode == "apply" and existing_assets:
            site_loc_id = loc_payload.get("id") if loc_payload else None
            match = match_asset(existing_assets, eq, site_loc_id)
            if match:
                report.assets_reused.append(match)
                continue

        equipments_to_create.append((eq, eq_name, loc_payload, asset_payload))

    # ── Print dry-run report ──
    print(f"\n  {'='*50}")
    print(f"  {'DRY RUN' if mode == 'dry-run' else 'APPLY'} – {group_name}")
    print(f"  {'='*50}")
    print(f"  Customer:        {'EXISTS' if existing_customer else 'WILL BE CREATED'}")
    print(f"  Locations:       {len(sites_to_create)} to create, {len(report.locations_reused)} already exist")
    print(f"  Assets:          {len(equipments_to_create)} to create, {len(report.assets_reused)} already exist")
    print(f"  Incomplete:      {len(report.locations_skipped)} sites (no coords)")
    print()

    if mode == "dry-run":
        print("  First 10 locations:")
        for site, site_name, _ in sites_to_create[:10]:
            print(f"    - {site_name}")
        if len(sites_to_create) > 10:
            print(f"    ... and {len(sites_to_create) - 10} more")
        print()
        print("  Assets:")
        for _, eq_name, _, _ in equipments_to_create:
            print(f"    - {eq_name}")

        report.print_summary()
        return report

    # ══════════════════════════════════════════════════════════
    # APPLY MODE
    # ══════════════════════════════════════════════════════════
    print(f"\n  {'='*50}")
    print(f"  APPLYING...")
    print(f"  {'='*50}")

    if not customer_id:
        report.print_summary()
        return report

    # Create locations
    loc_id_map = {}  # Auvo customer ID -> Erione location ID
    for site, site_name, loc_payload in sites_to_create:
        try:
            created = client.create_location(loc_payload)
            report.locations_created.append({
                "id": created["id"],
                "name": created["name"],
                "address": created.get("address", ""),
                "lat": created.get("latitude"),
                "lng": created.get("longitude"),
            })
            loc_id_map[site["id"]] = created["id"]
            print(f"    [OK] Location {created['id']}: {created['name']}")
        except RuntimeError as e:
            report.errors.append({"operation": "create_location", "name": site_name, "error": str(e)})
            print(f"    [FAIL] {site_name}: {e}")

    # Create assets
    for eq, eq_name, loc_payload, asset_payload in equipments_to_create:
        eq_site_id = eq.get("associatedCustomerId")
        # Link to the location if it was created
        if eq_site_id and eq_site_id in loc_id_map:
            asset_payload["location"] = {"id": loc_id_map[eq_site_id]}
        elif eq_site_id:
            # Try finding location from existing (reused) ones
            loc_match = [loc for loc in report.locations_reused
                        if match_location(
                            [loc],
                            next((c for c in group_customers if c["id"] == eq_site_id), {}),
                            customer_id, group_name
                        )]
            if loc_match:
                asset_payload["location"] = {"id": loc_match[0]["id"]}

        try:
            created = client.create_asset(asset_payload)
            report.assets_created.append({
                "id": created["id"],
                "name": created["name"],
                "auvo_id": str(eq.get("id", "")),
                "location_name": created.get("location", {}).get("name", ""),
            })
            print(f"    [OK] Asset {created['id']}: {created['name']}")
        except RuntimeError as e:
            report.errors.append({"operation": "create_asset", "name": eq_name, "error": str(e)})
            print(f"    [FAIL] {eq_name}: {e}")

    report.print_summary()
    return report


# ── Orphan equipment analysis ──────────────────────────────
# Equipments whose Auvo customer has empty groupsId — not captured by
# regular group import. This module infers Santa Branca via strong evidence
# and matches them to existing Erione locations.

SANTA_BRANCA_ERIONE_ID = 1
SANTA_BRANCA_GROUP_ID = 122529


def load_all_auvo_data(auvo_dir: Path):
    """Load ALL Auvo customers and equipments."""
    with open(auvo_dir / "customers.json", encoding="utf-8") as f:
        all_customers = json.load(f)
    with open(auvo_dir / "equipments.json", encoding="utf-8") as f:
        all_equipments = json.load(f)
    return all_customers, all_equipments


def extract_site_code(description: str) -> str | None:
    """Extract numeric site code from Auvo description.
    '1016 - 1016 - Centro de Atendimento ao Cidadão/CAC' -> '1016'
    'Prefeitura Municipal de Santa Branca' -> None
    """
    import re
    m = re.match(r"(\d+)", description)
    return m.group(1) if m else None


def has_santa_branca_evidence(customer: dict) -> bool:
    """Strong evidence check: does this customer belong to Santa Branca?"""
    desc = (customer.get("description") or "").lower()
    legal = (customer.get("legalName") or "").lower()
    addr = (customer.get("address") or "").lower()

    if "santa branca" in desc or "santa branca" in legal or "santa branca" in addr:
        return True
    return False


def calc_cnpj_key(cnpj: str) -> str:
    """Normalize CNPJ for comparison."""
    return cnpj.replace(".", "").replace("/", "").replace("-", "").strip()


def match_location_by_code(code: str, sb_locations: list) -> dict | None:
    """Match by ID code in location address. Handles 'ID NNNN', 'ID-NNNN', 'ID NNNN-'."""
    import re
    for loc in sb_locations:
        addr = loc.get("address") or ""
        if re.search(rf"ID[\s-]*{re.escape(code)}(?:\s|$|[-\s])", addr, re.IGNORECASE):
            return loc
    return None


def match_location_by_name(desc_clean: str, sb_locations: list) -> dict | None:
    """Match by normalized location name."""
    desc_lower = desc_clean.strip().lower()
    for loc in sb_locations:
        loc_name = loc.get("name", "").strip().lower()
        # Exact match
        if loc_name == desc_lower:
            return loc
        # One contains the other
        if len(desc_lower) > 5 and (desc_lower in loc_name or loc_name in desc_lower):
            return loc
    return None


def match_location_by_address(addr: str, sb_locations: list) -> dict | None:
    """Match by normalized address."""
    addr_norm = addr.strip().lower()
    for loc in sb_locations:
        loc_addr = (loc.get("address") or "").strip().lower()
        if loc_addr == addr_norm:
            return loc
    return None


def find_matching_location(orphan_customer: dict, sb_locations: list) -> dict | None:
    """Try to match orphan customer to an existing Santa Branca location.
    Priority: ID code in address -> normalized name -> normalized address.
    """
    desc = orphan_customer.get("description") or ""

    # Priority 1: ID code in address
    code = extract_site_code(desc)
    if code:
        match = match_location_by_code(code, sb_locations)
        if match:
            return match

    # Also try extracting code from address field (e.g. "ID 1015 - ...")
    import re
    addr = orphan_customer.get("address") or ""
    m = re.match(r"ID\s*(\d+)", addr, re.IGNORECASE)
    if m:
        match = match_location_by_code(m.group(1), sb_locations)
        if match:
            return match

    # Priority 2: normalize description by removing code prefix
    desc_clean = re.sub(r"^\d+\s*-\s*\d+\s*-\s*", "", desc).strip()
    if desc_clean:
        match = match_location_by_name(desc_clean, sb_locations)
        if match:
            return match

    # Priority 3: address match
    if addr:
        match = match_location_by_address(addr, sb_locations)
        if match:
            return match

    return None


def check_existing_asset(equip: dict, location_id: int, existing_assets: list) -> dict | None:
    """Check if asset already exists by Auvo ID (barCode) or name+location."""
    auvo_id = str(equip.get("id", ""))
    eq_name = (equip.get("name") or "").strip().lower()
    for a in existing_assets:
        if a.get("barCode") and str(a["barCode"]) == auvo_id:
            return a
        if a.get("name", "").strip().lower() == eq_name:
            loc_id = None
            if a.get("location"):
                loc_id = a["location"].get("id")
            if location_id and loc_id == location_id:
                return a
    return None


def run_orphan_dry_run(args):
    """Analyze orphan equipments — dry-run only, no data created."""
    import re

    email = args.email or os.environ.get("IMPORT_EMAIL")
    password = args.password or os.environ.get("IMPORT_PASSWORD")
    if not email or not password:
        raise SystemExit("Set IMPORT_EMAIL / IMPORT_PASSWORD env vars or pass --email / --password")

    print("\n" + "=" * 60)
    print("  ORPHAN EQUIPMENT ANALYSIS (dry-run)")
    print("=" * 60)

    # 1. Load Auvo data
    print("\nLoading Auvo data...")
    all_customers, all_equipments = load_all_auvo_data(AUVO_DIR)
    cust_by_id = {c["id"]: c for c in all_customers}
    print(f"  Customers: {len(all_customers)}")
    print(f"  Equipments: {len(all_equipments)}")

    # 2. Find Santa Branca CNPJ for evidence check
    sb_cnpj = None
    for c in all_customers:
        if SANTA_BRANCA_GROUP_ID in c.get("groupsId", []):
            cnpj_raw = c.get("cpfCnpj") or ""
            if cnpj_raw:
                sb_cnpj = calc_cnpj_key(cnpj_raw)
                break

    # 3. Find orphans: equipments whose customer has empty groupsId
    orphans = []
    for e in all_equipments:
        cid = e.get("associatedCustomerId")
        if not cid:
            orphans.append({"equip": e, "status": "no_customer_id"})
            continue
        customer = cust_by_id.get(cid)
        if not customer:
            orphans.append({"equip": e, "status": "customer_not_found", "customer_id": cid})
            continue
        if customer.get("groupsId"):
            continue  # has a group, not orphan
        orphans.append({"equip": e, "customer": customer, "status": "orphan"})

    print(f"\n  Total orphan equipments: {len([o for o in orphans if o['status'] == 'orphan'])}")
    print(f"  No customer ID:          {len([o for o in orphans if o['status'] == 'no_customer_id'])}")
    print(f"  Customer not found:      {len([o for o in orphans if o['status'] == 'customer_not_found'])}")

    # 4. Connect to Erione and get Santa Branca data
    print(f"\nConnecting to {args.api_url}...")
    client = ErioneClient(args.api_url, email, password)
    print("  Authenticated")

    sb_locations = client.search_locations(SANTA_BRANCA_ERIONE_ID)
    print(f"  Santa Branca locations in Erione: {len(sb_locations)}")

    sb_assets = client.search_assets(SANTA_BRANCA_ERIONE_ID)
    print(f"  Santa Branca assets in Erione:     {len(sb_assets)}")

    # 5. Analyze each orphan
    results = []
    for entry in orphans:
        if entry["status"] != "orphan":
            results.append(entry)
            continue

        equip = entry["equip"]
        customer = entry["customer"]
        cnpj = calc_cnpj_key(customer.get("cpfCnpj") or "")

        # Evidence check
        evidence = has_santa_branca_evidence(customer)
        if not evidence and sb_cnpj and cnpj == sb_cnpj:
            evidence = True  # CNPJ match is also strong evidence

        if not evidence:
            results.append({
                "equip": equip,
                "customer": customer,
                "status": "not_santa_branca",
                "evidence": False,
            })
            continue

        # Try to match to existing location
        location = find_matching_location(customer, sb_locations)

        if not location:
            results.append({
                "equip": equip,
                "customer": customer,
                "status": "unresolved_location",
                "evidence": True,
                "location": None,
            })
            continue

        # Check for existing asset (dedup)
        existing_asset = check_existing_asset(equip, location["id"], sb_assets)

        if existing_asset:
            results.append({
                "equip": equip,
                "customer": customer,
                "status": "asset_exists",
                "evidence": True,
                "location": location,
                "existing_asset": existing_asset,
            })
        else:
            results.append({
                "equip": equip,
                "customer": customer,
                "status": "would_create",
                "evidence": True,
                "location": location,
                "existing_asset": None,
            })

    # 6. Aggregate and report
    resolved = [r for r in results if r["status"] == "would_create"]
    reused = [r for r in results if r["status"] == "asset_exists"]
    no_location = [r for r in results if r["status"] == "unresolved_location"]
    no_evidence = [r for r in results if r["status"] == "not_santa_branca"]
    no_cust_id = [r for r in results if r["status"] == "no_customer_id"]
    cust_not_found = [r for r in results if r["status"] == "customer_not_found"]

    orphan_only = [r for r in results if r["status"] == "orphan"]

    print("\n" + "=" * 60)
    print("  RESULTS")
    print("=" * 60)
    print(f"  Santa Branca (evidence match): {len(resolved) + len(reused) + len(no_location)}")
    print(f"    -> Would create:             {len(resolved)}")
    print(f"    -> Already exists (dedup):   {len(reused)}")
    print(f"    -> Unresolved location:      {len(no_location)}")
    print(f"  Not Santa Branca:              {len(no_evidence)}")
    print(f"  No customer ID on equipment:   {len(no_cust_id)}")
    print(f"  Customer ID not in customers.json: {len(cust_not_found)}")
    print()

    # Count unique orphan customers resolved
    cust_ids_resolved = set()
    for r in resolved:
        if r.get("customer"):
            cust_ids_resolved.add(r["customer"]["id"])
    print(f"  Unique orphan customers resolved: {len(cust_ids_resolved)}")

    # Location coverage
    loc_ids_used = set()
    for r in resolved:
        if r.get("location"):
            loc_ids_used.add(r["location"]["id"])
    print(f"  Unique Santa Branca locations used: {len(loc_ids_used)}")
    print()

    # 7. Print examples
    if resolved:
        print("  --- 10 examples: WOULD CREATE ---")
        for r in resolved[:10]:
            c = r["customer"]
            loc = r["location"]
            print(f"    Equip \"{r['equip']['name']}\" ({r['equip']['id']})")
            print(f"      Customer: {c.get('description','')[:60]}")
            print(f"      Location: {loc.get('name','')[:60]} (ID {loc['id']})")
        print()

    if no_location:
        print("  --- 10 examples: UNRESOLVED LOCATION ---")
        for r in no_location[:10]:
            c = r["customer"]
            print(f"    Equip \"{r['equip']['name']}\" ({r['equip']['id']})")
            print(f"      Customer: {c.get('description','')[:60]}")
            print(f"      Address:  {(c.get('address') or '')[:60]}")
        print()

    if reused:
        print("  --- Examples: ALREADY EXISTS (dedup) ---")
        for r in reused[:5]:
            print(f"    Equip \"{r['equip']['name']}\" matches asset ID {r['existing_asset']['id']}")
        print()

    # 8. Generate Markdown report
    lines = [
        f"# Orphan Equipment Analysis (dry-run)",
        f"**Date:** {datetime.now().isoformat()}",
        "",
        "---",
        "",
        "## Summary",
        "",
        f"| Category | Count |",
        f"|----------|-------|",
        f"| Santa Branca orphans found | {len(resolved) + len(reused) + len(no_location)} |",
        f"| → Would create new asset | {len(resolved)} |",
        f"| → Already exists (dedup) | {len(reused)} |",
        f"| → No matching location | {len(no_location)} |",
        f"| Non-Santa-Branca orphans | {len(no_evidence)} |",
        f"| Equipment with no customerId | {len(no_cust_id)} |",
        f"| Customer ID not in JSON | {len(cust_not_found)} |",
        f"| **Total orphan equipments** | **{len(orphan_only)}** |",
        "",
        f"**Unique orphan customers resolved:** {len(cust_ids_resolved)}",
        f"**Unique locations used:** {len(loc_ids_used)}",
        "",
        "---",
        "",
        "## Would Create",
        "",
        "| Asset Name | Auvo ID | Customer Description | Location Name | Location ID |",
        "|-----------|---------|---------------------|-------------|-------------|",
    ]
    for r in resolved:
        lines.append(
            f"| {r['equip']['name']} | {r['equip']['id']} | "
            f"{trunc(r['customer'].get('description',''), 50)} | "
            f"{trunc(r['location'].get('name',''), 50)} | {r['location']['id']} |"
        )

    lines += [
        "",
        "## Unresolved Location",
        "",
        "| Asset Name | Auvo ID | Customer Description | Customer Address |",
        "|-----------|---------|---------------------|-----------------|",
    ]
    for r in no_location:
        lines.append(
            f"| {r['equip']['name']} | {r['equip']['id']} | "
            f"{trunc(r['customer'].get('description',''), 50)} | "
            f"{trunc(r['customer'].get('address',''), 60)} |"
        )

    if reused:
        lines += [
            "",
            "## Already Exists (dedup)",
            "",
            "| Asset Name | Auvo ID | Existing Erione Asset ID |",
            "|-----------|---------|------------------------|",
        ]
        for r in reused:
            lines.append(
                f"| {r['equip']['name']} | {r['equip']['id']} | "
                f"{r['existing_asset']['id']} |"
            )

    lines += [
        "",
        "---",
        f"**Total orphans processed:** {len(orphan_only)}",
        f"**Resolved (would create):** {len(resolved)}",
        f"**Unresolved location:** {len(no_location)}",
        f"**Already exists:** {len(reused)}",
    ]

    report_md = "\n".join(lines)

    # Save report
    out_name = f"orphan_dry_run_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"
    out_path = Path.cwd() / out_name
    out_path.write_text(report_md, encoding="utf-8")
    print(f"\nReport saved: {out_path}")

    return report_md


def analyze_orphan_equipments(args, client=None):
    """Shared analysis: load Auvo data, find orphans, apply evidence, match locations.
    Returns (results, orphans, sb_locations, sb_assets, sb_cnpj).
    """
    import re

    email = args.email or os.environ.get("IMPORT_EMAIL")
    password = args.password or os.environ.get("IMPORT_PASSWORD")
    if not email or not password:
        raise SystemExit("Set IMPORT_EMAIL / IMPORT_PASSWORD env vars or pass --email / --password")

    all_customers, all_equipments = load_all_auvo_data(AUVO_DIR)
    cust_by_id = {c["id"]: c for c in all_customers}

    sb_cnpj = None
    for c in all_customers:
        if SANTA_BRANCA_GROUP_ID in c.get("groupsId", []):
            cnpj_raw = c.get("cpfCnpj") or ""
            if cnpj_raw:
                sb_cnpj = calc_cnpj_key(cnpj_raw)
                break

    orphans = []
    for e in all_equipments:
        cid = e.get("associatedCustomerId")
        if not cid:
            orphans.append({"equip": e, "status": "no_customer_id"})
            continue
        customer = cust_by_id.get(cid)
        if not customer:
            orphans.append({"equip": e, "status": "customer_not_found", "customer_id": cid})
            continue
        if customer.get("groupsId"):
            continue
        orphans.append({"equip": e, "customer": customer, "status": "orphan"})

    if not client:
        client = ErioneClient(args.api_url, email, password)

    sb_locations = client.search_locations(SANTA_BRANCA_ERIONE_ID)
    sb_assets = client.search_assets(SANTA_BRANCA_ERIONE_ID)

    results = []
    for entry in orphans:
        if entry["status"] != "orphan":
            results.append(entry)
            continue

        equip = entry["equip"]
        customer = entry["customer"]
        cnpj = calc_cnpj_key(customer.get("cpfCnpj") or "")

        evidence = has_santa_branca_evidence(customer)
        if not evidence and sb_cnpj and cnpj == sb_cnpj:
            evidence = True

        if not evidence:
            results.append({
                "equip": equip, "customer": customer,
                "status": "not_santa_branca", "evidence": False,
            })
            continue

        location = find_matching_location(customer, sb_locations)

        if not location:
            results.append({
                "equip": equip, "customer": customer,
                "status": "unresolved_location", "evidence": True, "location": None,
            })
            continue

        existing_asset = check_existing_asset(equip, location["id"], sb_assets)

        if existing_asset:
            results.append({
                "equip": equip, "customer": customer,
                "status": "asset_exists", "evidence": True,
                "location": location, "existing_asset": existing_asset,
            })
        else:
            results.append({
                "equip": equip, "customer": customer,
                "status": "would_create", "evidence": True,
                "location": location, "existing_asset": None,
            })

    return results, orphans, sb_locations, sb_assets, sb_cnpj


def run_orphan_apply(args):
    """Create assets for all resolved orphan equipments."""
    print("\n" + "=" * 60)
    print("  ORPHAN EQUIPMENT APPLY")
    print("=" * 60)

    print("\nLoading Auvo data and analyzing orphans...")
    client = ErioneClient(args.api_url, args.email or os.environ["IMPORT_EMAIL"],
                          args.password or os.environ["IMPORT_PASSWORD"])
    results, orphans, sb_locations, sb_assets, sb_cnpj = analyze_orphan_equipments(args, client)

    resolved = [r for r in results if r["status"] == "would_create"]
    reused = [r for r in results if r["status"] == "asset_exists"]
    no_location = [r for r in results if r["status"] == "unresolved_location"]
    no_cust_id = [r for r in results if r["status"] == "no_customer_id"]
    errors = []

    print(f"\n  Resolved (to create): {len(resolved)}")
    print(f"  Already exists:       {len(reused)}")
    print(f"  Unresolved location:  {len(no_location)}")
    print(f"  No customerId:        {len(no_cust_id)}")
    print(f"\n  {'='*50}")
    print(f"  CREATING ASSETS...")
    print(f"  {'='*50}")

    # Track per-location counts
    loc_counts = {}
    created_assets = []

    for r in resolved:
        equip = r["equip"]
        location = r["location"]
        customer = r["customer"]

        loc_id = location["id"]
        loc_name = location.get("name", "")

        asset_payload = {
            "name": (equip.get("name") or "").strip(),
            "barCode": str(equip["id"]),
            "description": (equip.get("description") or "")[:10000],
            "customers": [{"id": SANTA_BRANCA_ERIONE_ID}],
            "location": {"id": loc_id},
        }

        import time
        try:
            created = client.create_asset(asset_payload)
            created_assets.append({
                "id": created["id"],
                "name": created["name"],
                "auvo_id": str(equip["id"]),
                "location_id": loc_id,
                "location_name": loc_name,
                "customer_description": customer.get("description", "")[:60],
            })
            loc_counts[loc_name] = loc_counts.get(loc_name, 0) + 1
            print(f"    [OK] Asset {created['id']}: {created['name']} -> Loc \"{loc_name}\"")
        except RuntimeError as e:
            if "429" in str(e):
                time.sleep(1)
                try:
                    created = client.create_asset(asset_payload)
                    created_assets.append({
                        "id": created["id"],
                        "name": created["name"],
                        "auvo_id": str(equip["id"]),
                        "location_id": loc_id,
                        "location_name": loc_name,
                        "customer_description": customer.get("description", "")[:60],
                    })
                    loc_counts[loc_name] = loc_counts.get(loc_name, 0) + 1
                    print(f"    [OK] Asset {created['id']} (retry): {created['name']}")
                    continue
                except RuntimeError:
                    pass
            errors.append({
                "operation": "create_asset",
                "name": asset_payload["name"],
                "auvo_id": str(equip["id"]),
                "error": str(e),
            })
            print(f"    [FAIL] {asset_payload['name']}: {e}")
        time.sleep(0.3)

    # ── Summary ──
    print(f"\n  {'='*50}")
    print(f"  SUMMARY")
    print(f"  {'='*50}")
    print(f"  Assets created:     {len(created_assets)}")
    print(f"  Assets reused:      {len(reused)}")
    print(f"  Unresolved location: {len(no_location)}")
    print(f"  Skipped (no custId): {len(no_cust_id)}")
    print(f"  Errors:             {len(errors)}")
    print()

    if created_assets:
        print("  --- First 10 assets created ---")
        for a in created_assets[:10]:
            print(f"    ID={a['id']} \"{a['name']}\" Auvo={a['auvo_id']} Loc=\"{a['location_name']}\"")
        print()

    if loc_counts:
        print("  --- Assets per Location ---")
        for loc_name, count in sorted(loc_counts.items(), key=lambda x: -x[1]):
            print(f"    {count:3}x  {loc_name}")
        print()

    if errors:
        print("  --- Errors ---")
        for e in errors:
            print(f"    FAIL \"{e['name']}\" (Auvo {e['auvo_id']}): {e['error']}")
        print()

    # ── Markdown report ──
    lines = [
        f"# Orphan Equipment Import Report — Santa Branca",
        f"**Date:** {datetime.now().isoformat()}",
        "",
        "---",
        "",
        "## Summary",
        "",
        "| Category | Count |",
        "|----------|-------|",
        f"| Assets created | {len(created_assets)} |",
        f"| Assets reused (dedup) | {len(reused)} |",
        f"| Unresolved location (skipped) | {len(no_location)} |",
        f"| Skipped (no customerId) | {len(no_cust_id)} |",
        f"| Errors | {len(errors)} |",
        f"| **Total orphan equipments** | **{len(resolved) + len(reused) + len(no_location) + len(no_cust_id)}** |",
        "",
        "---",
        "",
        "## Assets Created",
        "",
        "| Asset Name | Auvo ID | Erione ID | Location |",
        "|-----------|---------|-----------|----------|",
    ]
    for a in created_assets:
        lines.append(f"| {a['name']} | {a['auvo_id']} | {a['id']} | {a['location_name']} |")

    lines += [
        "",
        "## Assets per Location",
        "",
        "| Location | Count |",
        "|----------|-------|",
    ]
    for loc_name, count in sorted(loc_counts.items(), key=lambda x: -x[1]):
        lines.append(f"| {loc_name} | {count} |")

    if errors:
        lines += [
            "",
            "## Errors",
            "",
            "| Asset Name | Auvo ID | Error |",
            "|-----------|---------|-------|",
        ]
        for e in errors:
            lines.append(f"| {e['name']} | {e['auvo_id']} | {e['error']} |")

    if no_cust_id:
        lines += [
            "",
            "## Skipped (no customerId)",
            "",
            "| Asset Name | Auvo ID |",
            "|-----------|---------|",
        ]
        for r in no_cust_id:
            lines.append(f"| {r['equip']['name']} | {r['equip']['id']} |")

    lines += [
        "",
        "---",
        f"**Assets created:** {len(created_assets)}",
        f"**Errors:** {len(errors)}",
    ]

    report_md = "\n".join(lines)

    out_name = f"orphan_apply_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"
    out_path = Path.cwd() / out_name
    out_path.write_text(report_md, encoding="utf-8")
    print(f"\nReport saved: {out_path}")

    return report_md


def run_orphan_dry_run(args):
    """Analyze orphan equipments — dry-run only, no data created."""
    import re

    email = args.email or os.environ.get("IMPORT_EMAIL")
    password = args.password or os.environ.get("IMPORT_PASSWORD")
    if not email or not password:
        raise SystemExit("Set IMPORT_EMAIL / IMPORT_PASSWORD env vars or pass --email / --password")

    print("\n" + "=" * 60)
    print("  ORPHAN EQUIPMENT ANALYSIS (dry-run)")
    print("=" * 60)

    # 1. Load Auvo data
    print("\nLoading Auvo data...")
    all_customers, all_equipments = load_all_auvo_data(AUVO_DIR)
    cust_by_id = {c["id"]: c for c in all_customers}
    print(f"  Customers: {len(all_customers)}")
    print(f"  Equipments: {len(all_equipments)}")

    # 2. Find Santa Branca CNPJ for evidence check
    sb_cnpj = None
    for c in all_customers:
        if SANTA_BRANCA_GROUP_ID in c.get("groupsId", []):
            cnpj_raw = c.get("cpfCnpj") or ""
            if cnpj_raw:
                sb_cnpj = calc_cnpj_key(cnpj_raw)
                break

    # 3. Find orphans: equipments whose customer has empty groupsId
    orphans = []
    for e in all_equipments:
        cid = e.get("associatedCustomerId")
        if not cid:
            orphans.append({"equip": e, "status": "no_customer_id"})
            continue
        customer = cust_by_id.get(cid)
        if not customer:
            orphans.append({"equip": e, "status": "customer_not_found", "customer_id": cid})
            continue
        if customer.get("groupsId"):
            continue  # has a group, not orphan
        orphans.append({"equip": e, "customer": customer, "status": "orphan"})

    print(f"\n  Total orphan equipments: {len([o for o in orphans if o['status'] == 'orphan'])}")
    print(f"  No customer ID:          {len([o for o in orphans if o['status'] == 'no_customer_id'])}")
    print(f"  Customer not found:      {len([o for o in orphans if o['status'] == 'customer_not_found'])}")

    # 4. Connect to Erione and get Santa Branca data
    print(f"\nConnecting to {args.api_url}...")
    client = ErioneClient(args.api_url, email, password)
    print("  Authenticated")

    sb_locations = client.search_locations(SANTA_BRANCA_ERIONE_ID)
    print(f"  Santa Branca locations in Erione: {len(sb_locations)}")

    sb_assets = client.search_assets(SANTA_BRANCA_ERIONE_ID)
    print(f"  Santa Branca assets in Erione:     {len(sb_assets)}")

    # 5. Analyze each orphan
    results = []
    for entry in orphans:
        if entry["status"] != "orphan":
            results.append(entry)
            continue

        equip = entry["equip"]
        customer = entry["customer"]
        cnpj = calc_cnpj_key(customer.get("cpfCnpj") or "")

        # Evidence check
        evidence = has_santa_branca_evidence(customer)
        if not evidence and sb_cnpj and cnpj == sb_cnpj:
            evidence = True  # CNPJ match is also strong evidence

        if not evidence:
            results.append({
                "equip": equip,
                "customer": customer,
                "status": "not_santa_branca",
                "evidence": False,
            })
            continue

        # Try to match to existing location
        location = find_matching_location(customer, sb_locations)

        if not location:
            results.append({
                "equip": equip,
                "customer": customer,
                "status": "unresolved_location",
                "evidence": True,
                "location": None,
            })
            continue

        # Check for existing asset (dedup)
        existing_asset = check_existing_asset(equip, location["id"], sb_assets)

        if existing_asset:
            results.append({
                "equip": equip,
                "customer": customer,
                "status": "asset_exists",
                "evidence": True,
                "location": location,
                "existing_asset": existing_asset,
            })
        else:
            results.append({
                "equip": equip,
                "customer": customer,
                "status": "would_create",
                "evidence": True,
                "location": location,
                "existing_asset": None,
            })

    # 6. Aggregate and report
    resolved = [r for r in results if r["status"] == "would_create"]
    reused = [r for r in results if r["status"] == "asset_exists"]
    no_location = [r for r in results if r["status"] == "unresolved_location"]
    no_evidence = [r for r in results if r["status"] == "not_santa_branca"]
    no_cust_id = [r for r in results if r["status"] == "no_customer_id"]
    cust_not_found = [r for r in results if r["status"] == "customer_not_found"]

    orphan_only = [r for r in results if r["status"] == "orphan"]

    print("\n" + "=" * 60)
    print("  RESULTS")
    print("=" * 60)
    print(f"  Santa Branca (evidence match): {len(resolved) + len(reused) + len(no_location)}")
    print(f"    -> Would create:             {len(resolved)}")
    print(f"    -> Already exists (dedup):   {len(reused)}")
    print(f"    -> Unresolved location:      {len(no_location)}")
    print(f"  Not Santa Branca:              {len(no_evidence)}")
    print(f"  No customer ID on equipment:   {len(no_cust_id)}")
    print(f"  Customer ID not in customers.json: {len(cust_not_found)}")
    print()

    # Count unique orphan customers resolved
    cust_ids_resolved = set()
    for r in resolved:
        if r.get("customer"):
            cust_ids_resolved.add(r["customer"]["id"])
    print(f"  Unique orphan customers resolved: {len(cust_ids_resolved)}")

    # Location coverage
    loc_ids_used = set()
    for r in resolved:
        if r.get("location"):
            loc_ids_used.add(r["location"]["id"])
    print(f"  Unique Santa Branca locations used: {len(loc_ids_used)}")
    print()

    # 7. Print examples
    if resolved:
        print("  --- 10 examples: WOULD CREATE ---")
        for r in resolved[:10]:
            c = r["customer"]
            loc = r["location"]
            print(f"    Equip \"{r['equip']['name']}\" ({r['equip']['id']})")
            print(f"      Customer: {c.get('description','')[:60]}")
            print(f"      Location: {loc.get('name','')[:60]} (ID {loc['id']})")
        print()

    if no_location:
        print("  --- 10 examples: UNRESOLVED LOCATION ---")
        for r in no_location[:10]:
            c = r["customer"]
            print(f"    Equip \"{r['equip']['name']}\" ({r['equip']['id']})")
            print(f"      Customer: {c.get('description','')[:60]}")
            print(f"      Address:  {(c.get('address') or '')[:60]}")
        print()

    if reused:
        print("  --- Examples: ALREADY EXISTS (dedup) ---")
        for r in reused[:5]:
            print(f"    Equip \"{r['equip']['name']}\" matches asset ID {r['existing_asset']['id']}")
        print()

    # 8. Generate Markdown report
    lines = [
        f"# Orphan Equipment Analysis (dry-run)",
        f"**Date:** {datetime.now().isoformat()}",
        "",
        "---",
        "",
        "## Summary",
        "",
        f"| Category | Count |",
        f"|----------|-------|",
        f"| Santa Branca orphans found | {len(resolved) + len(reused) + len(no_location)} |",
        f"| → Would create new asset | {len(resolved)} |",
        f"| → Already exists (dedup) | {len(reused)} |",
        f"| → No matching location | {len(no_location)} |",
        f"| Non-Santa-Branca orphans | {len(no_evidence)} |",
        f"| Equipment with no customerId | {len(no_cust_id)} |",
        f"| Customer ID not in JSON | {len(cust_not_found)} |",
        f"| **Total orphan equipments** | **{len(orphan_only)}** |",
        "",
        f"**Unique orphan customers resolved:** {len(cust_ids_resolved)}",
        f"**Unique locations used:** {len(loc_ids_used)}",
        "",
        "---",
        "",
        "## Would Create",
        "",
        "| Asset Name | Auvo ID | Customer Description | Location Name | Location ID |",
        "|-----------|---------|---------------------|-------------|-------------|",
    ]
    for r in resolved:
        lines.append(
            f"| {r['equip']['name']} | {r['equip']['id']} | "
            f"{trunc(r['customer'].get('description',''), 50)} | "
            f"{trunc(r['location'].get('name',''), 50)} | {r['location']['id']} |"
        )

    lines += [
        "",
        "## Unresolved Location",
        "",
        "| Asset Name | Auvo ID | Customer Description | Customer Address |",
        "|-----------|---------|---------------------|-----------------|",
    ]
    for r in no_location:
        lines.append(
            f"| {r['equip']['name']} | {r['equip']['id']} | "
            f"{trunc(r['customer'].get('description',''), 50)} | "
            f"{trunc(r['customer'].get('address',''), 60)} |"
        )

    if reused:
        lines += [
            "",
            "## Already Exists (dedup)",
            "",
            "| Asset Name | Auvo ID | Existing Erione Asset ID |",
            "|-----------|---------|------------------------|",
        ]
        for r in reused:
            lines.append(
                f"| {r['equip']['name']} | {r['equip']['id']} | "
                f"{r['existing_asset']['id']} |"
            )

    lines += [
        "",
        "---",
        f"**Total orphans processed:** {len(orphan_only)}",
        f"**Resolved (would create):** {len(resolved)}",
        f"**Unresolved location:** {len(no_location)}",
        f"**Already exists:** {len(reused)}",
    ]

    report_md = "\n".join(lines)

    # Save report
    out_name = f"orphan_dry_run_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"
    out_path = Path.cwd() / out_name
    out_path.write_text(report_md, encoding="utf-8")
    print(f"\nReport saved: {out_path}")

    return report_md


# ── CLI ────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Import Auvo customer group into Erione CMMS",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=textwrap.dedent("""\
            Examples:
              %(prog)s --group-id 125014 --group-name "Tremembe" --mode dry-run
              %(prog)s --group-id 125012 --group-name "Prefeitura de Camanducaia" --mode apply
              %(prog)s --mode orphan-dry-run
        """),
    )
    parser.add_argument("--group-id", type=int, help="Auvo groupsId value (not needed for orphan modes)")
    parser.add_argument("--group-name", help="Customer name in Erione (not needed for orphan modes)")
    parser.add_argument("--mode", choices=["dry-run", "apply", "orphan-dry-run", "orphan-apply"], required=True)
    parser.add_argument("--api-url", default=DEFAULT_API, help="Erione API base URL")
    parser.add_argument("--email", help="Login email (or IMPORT_EMAIL env var)")
    parser.add_argument("--password", help="Login password (or IMPORT_PASSWORD env var)")
    parser.add_argument(
        "--dry-run-dedup", action="store_true", default=True,
        help="Check existing records during dry-run (slower, needs API)",
    )
    parser.add_argument(
        "--no-dry-run-dedup", action="store_false", dest="dry_run_dedup",
        help="Skip API checks during dry-run (faster)",
    )
    parser.add_argument("--output", help="Save report Markdown to file")

    args = parser.parse_args()

    if args.mode == "orphan-dry-run":
        report_md = run_orphan_dry_run(args)
        if args.output:
            Path(args.output).write_text(report_md, encoding="utf-8")
            print(f"\nReport saved: {args.output}")
        return

    if args.mode == "orphan-apply":
        report_md = run_orphan_apply(args)
        if args.output:
            Path(args.output).write_text(report_md, encoding="utf-8")
            print(f"\nReport saved: {args.output}")
        return

    if not args.group_id or not args.group_name:
        parser.error("--group-id and --group-name are required for modes dry-run and apply")

    report = run_import(args)

    # Save report
    md = report.markdown()
    if args.output:
        Path(args.output).write_text(md, encoding="utf-8")
        print(f"\nReport saved: {args.output}")
    else:
        out_name = f"import_{args.group_id}_{args.group_name.replace(' ','_')}_{args.mode}.md"
        out_path = Path.cwd() / out_name
        out_path.write_text(md, encoding="utf-8")
        print(f"\nReport saved: {out_path}")

    # Exit with error code if any failures
    if report.errors:
        sys.exit(1)


if __name__ == "__main__":
    main()
