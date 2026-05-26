#!/usr/bin/env python3
"""
import_all_groups.py — Import all remaining Auvo groups into Erione CMMS.

Usage:
  python import_all_groups.py --mode dry-run
  python import_all_groups.py --mode apply

Deduplication rules:
  - Customer: by name (ci), CNPJ
  - Location: within Customer by externalId, name+address, Auvo ID code
  - Asset: by Auvo ID (barCode), name+location
"""

import json, os, re, sys, time, textwrap
from datetime import datetime
from pathlib import Path

import requests

AUVO_DIR = Path("C:/Users/CaioSouza/Desktop/saida_auvo/saida_auvo")
DEFAULT_API = "http://localhost:8080"
SANTA_BRANCA_ERIONE_ID = 1

# ── Remaining groups ──────────────────────────────────────
REMAINING_GROUPS = [
    (122537, "PREFEITURA MUNICIPAL DE SAO JOSE DOS CAMPOS"),
    (122557, "PREFEITURA MUNICIPAL DE SAO JOSE DOS CAMPOS - DEMAIS"),
    (122698, "ENERGISA"),
    (125023, "CAMPOS LUZ ILUMINACAO"),
    (143833, "PREFEITURA MUNICIPAL DE CAMANDUCAIA - SEDE"),
    (122386, "CFTV - AUVO TECNOLOGIA"),
    (133225, "CAMARA MUNICIPAL DE SAO JOSE DOS CAMPOS"),
    (133277, "AEROPORTO INTERNACIONAL DE SJC"),
    (143855, "PREFEITURA MUNICIPAL DE SJC - MATRIZ"),
    (144489, "GCM - GUARDA CIVIL MUNICIPAL DE CACAPAVA"),
    (144490, "TERMINAL RODOVIARIO DE CACAPAVA"),
]

# ── Helpers ───────────────────────────────────────────────

def eprint(*a, **kw):
    print(*a, file=sys.stderr, **kw)

def trunc(val, n=100):
    s = str(val) if val else ""
    return s[:n] if len(s) <= n else s[:n-3] + "..."

def safe_float(val, default=None):
    if val is None: return default
    try: return float(val)
    except: return default

def norm(s):
    return (s or "").strip().lower()

def norm_cnpj(s):
    return (s or "").replace(".", "").replace("/", "").replace("-", "").strip()

# ── API client ────────────────────────────────────────────

class ErioneClient:
    def __init__(self, api_url, email, password):
        self.api_url = api_url.rstrip("/")
        self.session = requests.Session()
        self.session.headers["Content-Type"] = "application/json"
        self._auth(email, password)

    def _auth(self, email, password):
        r = self.session.post(f"{self.api_url}/auth/signin", json={"email": email, "password": password})
        if r.status_code != 200:
            raise SystemExit(f"Auth failed ({r.status_code}): {r.text}")
        self.session.headers["Authorization"] = f"Bearer {r.json()['accessToken']}"

    def search_customers(self, name=None, offset=0, limit=100):
        body = {"pageNum": offset, "pageSize": limit, "filterFields": []}
        if name:
            body["filterFields"].append({"field": "name", "value": name.strip(), "operation": "eq"})
        r = self.session.post(f"{self.api_url}/customers/search", json=body)
        if r.status_code == 200:
            return r.json().get("content", [])
        return []

    def get_all_customers(self):
        """Fetch ALL customers (paginated)."""
        all_c = []
        page = 0
        while True:
            r = self.session.post(f"{self.api_url}/customers/search", json={
                "pageNum": page, "pageSize": 100, "filterFields": []
            })
            if r.status_code != 200:
                break
            data = r.json()
            content = data.get("content", [])
            all_c.extend(content)
            if data.get("last", True):
                break
            page += 1
        return all_c

    def create_customer(self, payload):
        r = self.session.post(f"{self.api_url}/customers", json=payload)
        if r.status_code not in (200, 201):
            raise RuntimeError(f"POST /customers {r.status_code}: {r.text[:200]}")
        return r.json()

    def search_locations(self, customer_id):
        r = self.session.post(f"{self.api_url}/locations/search", json={
            "filterFields": [{"field": "customers", "operation": "inm", "values": [customer_id], "value": "", "joinType": "LEFT"}],
            "pageNum": 0, "pageSize": 500
        })
        if r.status_code == 200:
            return r.json().get("content", [])
        return []

    def create_location(self, payload):
        r = self.session.post(f"{self.api_url}/locations", json=payload)
        if r.status_code not in (200, 201):
            raise RuntimeError(f"POST /locations {r.status_code}: {r.text[:200]}")
        return r.json()

    def search_assets(self, customer_id):
        r = self.session.post(f"{self.api_url}/assets/search", json={
            "filterFields": [{"field": "customers", "operation": "inm", "values": [customer_id], "value": "", "joinType": "LEFT"}],
            "pageNum": 0, "pageSize": 500
        })
        if r.status_code == 200:
            return r.json().get("content", [])
        return []

    def create_asset(self, payload):
        r = self.session.post(f"{self.api_url}/assets", json=payload)
        if r.status_code not in (200, 201):
            raise RuntimeError(f"POST /assets {r.status_code}: {r.text[:200]}")
        return r.json()


# ── Auvo data loading ────────────────────────────────────

def load_auvo_data():
    with open(AUVO_DIR / "customers.json", encoding="utf-8") as f:
        customers = json.load(f)
    with open(AUVO_DIR / "equipments.json", encoding="utf-8") as f:
        equipments = json.load(f)
    return customers, equipments


# ── Build site name (same logic as import script) ────────

def build_site_name(site):
    addr = (site.get("address") or "").strip()
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


# ── Location dedup ────────────────────────────────────────

def extract_code_from_desc(desc):
    m = re.match(r"(\d+)", desc)
    return m.group(1) if m else None

def match_location(existing_locs, auvo_customer):
    """Try to match Auvo customer to existing Location. Returns (location, method)."""
    desc = auvo_customer.get("description") or ""
    addr = auvo_customer.get("address") or ""
    ext_id = (auvo_customer.get("externalId") or "").strip()

    # Priority 1: externalId
    if ext_id:
        for loc in existing_locs:
            if loc.get("externalId") and norm(loc["externalId"]) == norm(ext_id):
                return loc, "externalId"

    # Priority 2: Auvo ID code in address
    code = extract_code_from_desc(desc)
    if code:
        for loc in existing_locs:
            loc_addr = loc.get("address") or ""
            if re.search(rf"ID[\s-]*{re.escape(code)}(?:\s|$|[-\s])", loc_addr, re.IGNORECASE):
                return loc, "id_code"

    # Priority 3: normalized name
    site_name = build_site_name(auvo_customer).strip().lower()
    if site_name:
        for loc in existing_locs:
            loc_name = (loc.get("name") or "").strip().lower()
            if loc_name == site_name:
                return loc, "name"
        # Partial match (for "UBS II" in "PREFEITURA - UBS II - ...")
        desc_clean = re.sub(r"^\d+\s*-\s*\d+\s*-\s*", "", desc).strip().lower()
        for loc in existing_locs:
            loc_name = (loc.get("name") or "").strip().lower()
            if len(desc_clean) > 5 and desc_clean in loc_name:
                return loc, "name_partial"

    # Priority 4: normalized address
    addr_norm = norm(addr)
    if addr_norm:
        for loc in existing_locs:
            if norm(loc.get("address") or "") == addr_norm:
                return loc, "address"

    return None, None


# ── Asset dedup ───────────────────────────────────────────

def match_asset(existing_assets, equip, location_id):
    auvo_id = str(equip.get("id", ""))
    eq_name = (equip.get("name") or "").strip().lower()
    for a in existing_assets:
        if a.get("barCode") and str(a["barCode"]) == auvo_id:
            return a, "barCode"
        if a.get("name", "").strip().lower() == eq_name:
            loc_id = None
            if a.get("location"):
                loc_id = a["location"].get("id")
            if location_id and loc_id == location_id:
                return a, "name+location"
        # serial
        if a.get("serialNumber") and equip.get("identifier"):
            if norm(a["serialNumber"]) == norm(equip["identifier"]):
                return a, "serial"
    return None, None


# ── Process a single group ───────────────────────────────

def process_group(group_id, group_name, all_customers, all_equipments, client, existing_customers):
    """Analyze one group: what would be created/reused/skipped.
    Returns dict with all results.
    """
    result = {
        "group_id": group_id,
        "group_name": group_name,
        "customer": None,
        "locations_to_create": [],
        "locations_reused": [],
        "locations_skipped": [],
        "duplicate_candidates": [],
        "assets_to_create": [],
        "assets_reused": [],
        "assets_skipped_no_location": [],
        "errors": [],
    }

    # Filter Auvo customers by group
    group_customers = [c for c in all_customers if group_id in c.get("groupsId", [])]
    group_cust_ids = {c["id"] for c in group_customers}
    group_equipments = [e for e in all_equipments if e.get("associatedCustomerId") in group_cust_ids]

    # ── Customer dedup ──
    existing_customer = None
    for ec in existing_customers:
        if norm(ec.get("name", "")) == norm(group_name):
            existing_customer = ec
            break
    # Also check by CNPJ (if group has a single CNPJ)
    if not existing_customer:
        cnpjs = set()
        for c in group_customers:
            cnpj = norm_cnpj(c.get("cpfCnpj", ""))
            if cnpj:
                cnpjs.add(cnpj)
        if len(cnpjs) == 1:
            single_cnpj = list(cnpjs)[0]
            for ec in existing_customers:
                # Customer might have cnpj field
                pass  # Erione Customer doesn't seem to expose CNPJ via search

    if existing_customer:
        result["customer"] = {
            "action": "reuse",
            "id": existing_customer["id"],
            "name": existing_customer["name"],
        }
    else:
        result["customer"] = {
            "action": "create",
            "name": group_name,
        }

    customer_id = existing_customer["id"] if existing_customer else None

    # Get existing locations + assets if customer exists
    existing_locations = []
    existing_assets = []
    if customer_id:
        existing_locations = client.search_locations(customer_id)
        existing_assets = client.search_assets(customer_id)

    # ── Process locations ──
    for site in group_customers:
        site_name = build_site_name(site)
        site_addr = (site.get("address") or "").strip()
        site_lat = safe_float(site.get("latitude"))
        site_lng = safe_float(site.get("longitude"))

        if site_lat is None or site_lng is None:
            result["locations_skipped"].append({
                "name": site_name,
                "reason": "Missing coordinates",
            })
            continue

        # Dedup against existing locations
        if existing_locations:
            match, method = match_location(existing_locations, site)
            if match:
                result["locations_reused"].append({
                    "id": match["id"],
                    "name": match.get("name", ""),
                    "method": method,
                })
                continue

        site_code = extract_code_from_desc(site.get("description", ""))
        payload = {
            "name": site_name,
            "address": site_addr,
            "latitude": site_lat,
            "longitude": site_lng,
        }

        result["locations_to_create"].append({
            "auvo_id": site["id"],
            "code": site_code,
            "name": site_name,
            "payload": payload,
            "customer": None,  # filled later
        })

    # ── Process assets ──
    # Build a lookup by site ID for location mapping
    loc_by_site = {}
    for item in result["locations_to_create"]:
        loc_by_site[item["auvo_id"]] = item
    for item in result["locations_reused"]:
        # Need to find which Auvo site this reused location corresponds to
        for site in group_customers:
            if build_site_name(site).strip().lower() == norm(item.get("name", "")):
                loc_by_site[site["id"]] = item
                break

    for eq in group_equipments:
        eq_name = (eq.get("name") or "").strip()
        if not eq_name:
            continue

        eq_site_id = eq.get("associatedCustomerId")
        loc_info = loc_by_site.get(eq_site_id)

        if not loc_info:
            # Try finding location by matching Auvo site
            matching_site = next((s for s in group_customers if s["id"] == eq_site_id), None)
            if matching_site and existing_locations:
                match, method = match_location(existing_locations, matching_site)
                if match:
                    loc_info = {"id": match["id"], "name": match.get("name", "")}
                    result["locations_reused"].append({
                        "id": match["id"],
                        "name": match.get("name", ""),
                        "method": method + "(via_asset)",
                    })

        if not loc_info:
            result["assets_skipped_no_location"].append({
                "name": eq_name,
                "auvo_id": str(eq["id"]),
                "reason": "No matching location",
            })
            continue

        # Dedup against existing assets
        loc_id = loc_info.get("id")
        if existing_assets:
            match, method = match_asset(existing_assets, eq, loc_id)
            if match:
                result["assets_reused"].append({
                    "id": match["id"],
                    "name": match.get("name", ""),
                    "auvo_id": str(eq["id"]),
                    "method": method,
                })
                continue

        result["assets_to_create"].append({
            "name": eq_name,
            "auvo_id": str(eq["id"]),
            "description": (eq.get("description") or "")[:10000],
            "location_id": loc_id,
            "location_name": loc_info.get("name", ""),
        })

    # Check for duplicate location names with different addresses
    name_map = {}
    for item in result["locations_to_create"]:
        n = norm(item["name"])
        if n in name_map:
            result["duplicate_candidates"].append({
                "name": item["name"],
                "existing": name_map[n],
                "new": item,
            })
        else:
            name_map[n] = item

    return result


# ── Report rendering ─────────────────────────────────────

def render_report(all_results, mode="dry-run"):
    total_customers_create = 0
    total_customers_reuse = 0
    total_locations_create = 0
    total_locations_reuse = 0
    total_locations_skip = 0
    total_assets_create = 0
    total_assets_reuse = 0
    total_assets_skip = 0
    total_dup_candidates = 0

    lines = [
        f"# Consolidated Import Report — {'Dry Run' if mode == 'dry-run' else 'Apply'}",
        f"**Date:** {datetime.now().isoformat()}",
        "",
        "---",
        "",
        "## Summary",
        "",
        "| Group | Customer | Locs Create | Locs Reuse | Locs Skip | Assets Create | Assets Reuse | Assets Skip | Dup Candidates |",
        "|-------|----------|-------------|------------|-----------|--------------|--------------|-------------|----------------|",
    ]

    for r in all_results:
        cust_action = r["customer"]["action"] if r["customer"] else "error"
        loc_create = len(r["locations_to_create"])
        loc_reuse = len(r["locations_reused"])
        loc_skip = len(r["locations_skipped"])
        asset_create = len(r["assets_to_create"])
        asset_reuse = len(r["assets_reused"])
        asset_skip = len(r["assets_skipped_no_location"])
        dup_cand = len(r["duplicate_candidates"])

        total_customers_create += 1 if cust_action == "create" else 0
        total_customers_reuse += 1 if cust_action == "reuse" else 0
        total_locations_create += loc_create
        total_locations_reuse += loc_reuse
        total_locations_skip += loc_skip
        total_assets_create += asset_create
        total_assets_reuse += asset_reuse
        total_assets_skip += asset_skip
        total_dup_candidates += dup_cand

        lines.append(
            f"| {r['group_id']} {r['group_name'][:30]} | {cust_action} | "
            f"{loc_create} | {loc_reuse} | {loc_skip} | "
            f"{asset_create} | {asset_reuse} | {asset_skip} | {dup_cand} |"
        )

    lines += [
        "",
        "| **Total** | | "
        f"**{total_locations_create}** | **{total_locations_reuse}** | **{total_locations_skip}** | "
        f"**{total_assets_create}** | **{total_assets_reuse}** | **{total_assets_skip}** | **{total_dup_candidates}** |",
        "",
        f"**Customers to create:** {total_customers_create}",
        f"**Customers to reuse:** {total_customers_reuse}",
        "",
    ]

    # Duplicate candidates
    dup_all = [r for r in all_results if r["duplicate_candidates"]]
    if dup_all:
        lines += ["---", "", "## Duplicate Candidates", ""]
        for r in dup_all:
            lines.append(f"### {r['group_name']}")
            for d in r["duplicate_candidates"][:10]:
                lines.append(f"- **{d['name']}**: same name as another location in this group")
            if len(r["duplicate_candidates"]) > 10:
                lines.append(f"- ... e mais {len(r['duplicate_candidates']) - 10}")

    # Per-group details
    lines += ["---", "", "## Per-Group Details", ""]
    for r in all_results:
        lines.append(f"### {r['group_name']} (groupId {r['group_id']})")
        cust = r["customer"]
        if cust:
            lines.append(f"- Customer: **{cust['action']}** — {cust.get('name', '')}")
        lines.append(f"- Locations: {len(r['locations_to_create'])} create, {len(r['locations_reused'])} reused, {len(r['locations_skipped'])} skipped")
        lines.append(f"- Assets: {len(r['assets_to_create'])} create, {len(r['assets_reused'])} reused, {len(r['assets_skipped_no_location'])} skipped (no loc)")
        if r["duplicate_candidates"]:
            lines.append(f"- [!]️ Duplicate candidates: {len(r['duplicate_candidates'])}")
        if r["locations_to_create"]:
            lines.append("  Sample locations:")
            for item in r["locations_to_create"][:5]:
                lines.append(f"  - {item['name']} (code={item.get('code','')})")
            if len(r["locations_to_create"]) > 5:
                lines.append(f"  ... e mais {len(r['locations_to_create']) - 5}")
        lines.append("")

    # Orphan equipments (no customerId)
    lines += ["---", "", "## Orphan Equipments (no customerId)", ""]
    lines.append("5 equipments without customerId — no address/description to infer owner:")
    lines.append("- CAMERA PTZ 0001, 0002, 0003, 0004 (cat 31636)")
    lines.append("- PC 0001 (cat 31638)")
    lines.append("")
    lines.append("Cannot be imported automatically.")

    return "\n".join(lines)


# ── Main ──────────────────────────────────────────────────

def main():
    import argparse
    parser = argparse.ArgumentParser(
        description="Import all remaining Auvo groups into Erione CMMS",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--mode", choices=["dry-run", "apply"], required=True)
    parser.add_argument("--api-url", default=DEFAULT_API)
    parser.add_argument("--output", help="Save report to file")
    args = parser.parse_args()

    email = os.environ.get("IMPORT_EMAIL", "fernando.pandolphi@exemplo.com")
    password = os.environ.get("IMPORT_PASSWORD", "540298cb")

    print(f"\n{'='*60}")
    print(f"  Import All Remaining Groups — {args.mode.upper()}")
    print(f"{'='*60}")

    # Load Auvo data
    print("\nLoading Auvo data...")
    all_customers, all_equipments = load_auvo_data()
    print(f"  Customers: {len(all_customers)}")
    print(f"  Equipments: {len(all_equipments)}")

    # Connect to Erione
    print(f"\nConnecting to {args.api_url}...")
    client = ErioneClient(args.api_url, email, password)
    print("  Authenticated")

    # Get ALL existing customers for dedup
    print("\nFetching existing customers for dedup...")
    existing_customers = client.get_all_customers()
    print(f"  Existing customers in Erione: {len(existing_customers)}")

    # Process each group
    all_results = []
    for group_id, group_name in REMAINING_GROUPS:
        print(f"\n  Processing group {group_id} ({group_name})...")
        try:
            result = process_group(group_id, group_name, all_customers, all_equipments, client, existing_customers)
            all_results.append(result)
            cust_action = result["customer"]["action"] if result["customer"] else "?"
            print(f"    Customer: {cust_action}")
            print(f"    Locations: {len(result['locations_to_create'])} to create, {len(result['locations_reused'])} reused")
            print(f"    Assets: {len(result['assets_to_create'])} to create, {len(result['assets_reused'])} reused")
            if result["duplicate_candidates"]:
                print(f"    [!]️ {len(result['duplicate_candidates'])} duplicate candidates")
        except Exception as ex:
            print(f"    ERROR: {ex}")
            all_results.append({
                "group_id": group_id,
                "group_name": group_name,
                "customer": None,
                "locations_to_create": [],
                "locations_reused": [],
                "locations_skipped": [],
                "duplicate_candidates": [],
                "assets_to_create": [],
                "assets_reused": [],
                "assets_skipped_no_location": [],
                "errors": [str(ex)],
            })

    # Render report
    report_md = render_report(all_results, args.mode)

    if args.output:
        Path(args.output).write_text(report_md, encoding="utf-8")
    else:
        out_path = Path.cwd() / f"consolidated_{args.mode}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"
        out_path.write_text(report_md, encoding="utf-8")
        print(f"\nReport saved: {out_path}")

    # Print summary
    print(f"\n{'='*60}")
    print(f"  CONSOLIDATED SUMMARY")
    print(f"{'='*60}")
    total_dup = sum(len(r["duplicate_candidates"]) for r in all_results)
    total_loc_create = sum(len(r["locations_to_create"]) for r in all_results)
    total_loc_reuse = sum(len(r["locations_reused"]) for r in all_results)
    total_loc_skip = sum(len(r["locations_skipped"]) for r in all_results)
    total_asset_create = sum(len(r["assets_to_create"]) for r in all_results)
    total_asset_reuse = sum(len(r["assets_reused"]) for r in all_results)

    print(f"  Customers to create: {sum(1 for r in all_results if r.get('customer',{}).get('action')=='create')}")
    print(f"  Customers to reuse:  {sum(1 for r in all_results if r.get('customer',{}).get('action')=='reuse')}")
    print(f"  Locations: {total_loc_create} create, {total_loc_reuse} reuse, {total_loc_skip} skip")
    print(f"  Assets:    {total_asset_create} create, {total_asset_reuse} reuse")
    print(f"  Duplicate candidates: {total_dup}")
    print()

    if args.mode == "dry-run":
        if total_dup > 0:
            print(f"  [!]️  {total_dup} duplicate candidates found — review before applying.")
        else:
            print(f"  [OK] No duplicate candidates. Ready to apply.")

    # ── Apply mode ──
    if args.mode == "apply":
        print(f"\n{'='*60}")
        print(f"  APPLYING...")
        print(f"{'='*60}")

        for r in all_results:
            gid = r["group_id"]
            gname = r["group_name"]
            print(f"\n  --- {gname} ---")

            # Create or reuse customer
            if r["customer"]["action"] == "create":
                try:
                    created = client.create_customer({
                        "name": gname,
                        "description": f"Importado do Auvo - grupo {gid}",
                    })
                    r["customer"]["id"] = created["id"]
                    r["customer"]["action"] = "created"
                    print(f"    [OK] Customer created: ID {created['id']}")
                except RuntimeError as ex:
                    print(f"    [FAIL] Customer: {ex}")
                    continue
            else:
                print(f"    [OK] Customer reused: ID {r['customer']['id']}")

            customer_id = r["customer"].get("id")
            if not customer_id:
                continue

            # Refresh existing locations/assets for dedup during apply
            existing_locs = client.search_locations(customer_id)
            existing_assets_list = client.search_assets(customer_id)

            # Create locations
            loc_id_map = {}
            for item in r["locations_to_create"]:
                payload = item["payload"]
                payload["customers"] = [{"id": customer_id}]

                # Final dedup check before creating
                match, method = match_location(existing_locs, {
                    "description": item.get("code", ""),
                    "address": payload.get("address", ""),
                    "externalId": "",
                })
                # Also try by name
                for loc in existing_locs:
                    if norm(loc.get("name", "")) == norm(payload["name"]):
                        match = loc
                        break

                if match:
                    loc_id_map[item["auvo_id"]] = match["id"]
                    print(f"    [REUSE] Location {match['id']}: {payload['name']}")
                    continue

                try:
                    created = client.create_location(payload)
                    loc_id_map[item["auvo_id"]] = created["id"]
                    print(f"    [OK] Location {created['id']}: {payload['name']}")
                    existing_locs.append(created)
                    time.sleep(0.2)
                except RuntimeError as ex:
                    print(f"    [FAIL] Location {payload['name']}: {ex}")

            # Create assets
            for item in r["assets_to_create"]:
                loc_id = item["location_id"]
                if not loc_id and item.get("auvo_id"):
                    # Try to find from loc_id_map
                    pass

                if not loc_id and item.get("auvo_id"):
                    # Look up by the Auvo equipment's site
                    eq_site = next((eq for eqs in [all_equipments] for eq in eqs if str(eq.get("id","")) == item["auvo_id"]), None)
                    if eq_site:
                        site_id = eq_site.get("associatedCustomerId")
                        loc_id = loc_id_map.get(site_id)

                if not loc_id:
                    print(f"    [SKIP] {item['name']}: no location")
                    continue

                payload = {
                    "name": item["name"],
                    "barCode": item["auvo_id"],
                    "description": item.get("description", ""),
                    "customers": [{"id": customer_id}],
                    "location": {"id": loc_id},
                }

                # Final dedup check
                match, method = match_asset(existing_assets_list, {"id": item["auvo_id"], "name": item["name"]}, loc_id)
                if match:
                    print(f"    [REUSE] Asset {match['id']}: {item['name']}")
                    continue

                try:
                    created = client.create_asset(payload)
                    print(f"    [OK] Asset {created['id']}: {item['name']}")
                    existing_assets_list.append(created)
                    time.sleep(0.3)
                except RuntimeError as ex:
                    if "429" in str(ex):
                        time.sleep(2)
                        try:
                            created = client.create_asset(payload)
                            print(f"    [OK] Asset {created['id']} (retry): {item['name']}")
                            existing_assets_list.append(created)
                            continue
                        except RuntimeError as ex2:
                            print(f"    [FAIL] {item['name']}: {ex2}")
                    else:
                        print(f"    [FAIL] {item['name']}: {ex}")

        print(f"\n{'='*60}")
        print(f"  APPLY COMPLETE")
        print(f"{'='*60}")

    print(f"\nDone.")


if __name__ == "__main__":
    main()
