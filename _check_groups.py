import json

with open("C:/Users/CaioSouza/Desktop/saida_auvo/saida_auvo/customers.json", encoding="utf-8") as f:
    data = json.load(f)

with open("C:/Users/CaioSouza/Desktop/saida_auvo/saida_auvo/equipments.json", encoding="utf-8") as f:
    equipments = json.load(f)

# Build customer id -> groups mapping
cust_groups = {}
for c in data:
    for gid in c.get("groupsId", []):
        cust_groups.setdefault(gid, set()).add(c["id"])

print("Equipments per Auvo group:")
for gid in sorted(cust_groups.keys()):
    cust_ids = cust_groups[gid]
    eqs = [e for e in equipments if e.get("associatedCustomerId") in cust_ids]
    if eqs:
        names = sorted(set(c.get("description","") for c in data if gid in c.get("groupsId", [])))
        print(f"\n  Group {gid}: {len(eqs)} equipments")
        for n in names:
            print(f"    -> {n}")

# Already imported groups
imported = [122529, 125014, 125011, 125012]
print("\n\nAlready imported groups:")
for gid in imported:
    cust_ids = cust_groups.get(gid, set())
    eqs = [e for e in equipments if e.get("associatedCustomerId") in cust_ids]
    print(f"  Group {gid}: {len(eqs)} eq, {len(cust_ids)} custs")

# Remaining groups WITH equipment
remaining = sorted(set(cust_groups.keys()) - set(imported))
print(f"\n\nGroups not yet imported: {len(remaining)}")
total_eq = 0
for gid in remaining:
    cust_ids = cust_groups[gid]
    eqs = [e for e in equipments if e.get("associatedCustomerId") in cust_ids]
    total_eq += len(eqs)
    if eqs:
        names = sorted(set(c.get("description","") for c in data if gid in c.get("groupsId", [])))
        print(f"  Group {gid}: {len(eqs)} eq, {len(cust_ids)} custs -> {names}")
    elif len(cust_ids) > 0:
        names = sorted(set(c.get("description","") for c in data if gid in c.get("groupsId", [])))
        print(f"  Group {gid}: 0 eq, {len(cust_ids)} custs -> {names}")

print(f"\nTotal remaining equipments: {total_eq}")
print(f"Total equipments overall: {len(equipments)}")
print(f"Already imported: 6 (Santa Branca)")
print(f"Still to import: {len(equipments) - 6}")

# Check: which equipments are we MISSING?
all_cust_ids_in_groups = set()
for ids in cust_groups.values():
    all_cust_ids_in_groups |= ids
eq_cust_ids = set(e.get("associatedCustomerId") for e in equipments)
missing = eq_cust_ids - all_cust_ids_in_groups
print(f"\nEquipment customer IDs NOT in any group: {len(missing)}")
if missing:
    for c in data:
        if c["id"] in missing:
            print(f"  Customer {c['id']}: desc='{c.get('description','')[:60]}' groups={c.get('groupsId')}")
            break

# Also: customers that have equipment but their group was already counted
print("\nEquipments for customers NOT in group mapping:")
unmapped_eq = [e for e in equipments if e.get("associatedCustomerId") not in all_cust_ids_in_groups]
print(f"  Count: {len(unmapped_eq)}")
for e in unmapped_eq[:5]:
    c = next((c for c in data if c["id"] == e.get("associatedCustomerId")), None)
    if c:
        print(f"  Equipment {e['id']} '{e.get('name','')}' -> Customer {c['id']} '{c.get('description','')[:60]}' groups={c.get('groupsId')}")
    else:
        print(f"  Equipment {e['id']} '{e.get('name','')}' -> Customer {e.get('associatedCustomerId')} (NOT FOUND)")

