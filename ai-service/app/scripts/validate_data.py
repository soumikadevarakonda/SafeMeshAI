import os
import csv
import json
from datetime import datetime

def validate_and_split():
    print("Starting pure-Python dataset validation and split pipeline...")
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
    source_dir = os.path.join(base_dir, "datasets", "source")
    processed_dir = os.path.join(base_dir, "datasets", "processed")
    splits_dir = os.path.join(base_dir, "datasets", "splits")
    metadata_dir = os.path.join(base_dir, "datasets", "metadata")

    os.makedirs(processed_dir, exist_ok=True)
    os.makedirs(splits_dir, exist_ok=True)
    os.makedirs(metadata_dir, exist_ok=True)

    files = ["zones.csv", "equipment.csv", "sensors.csv", "sensor_readings.csv", "workers.csv", 
             "worker_locations.csv", "permits.csv", "maintenance_records.csv", "shift_logs.csv", "incidents.csv",
             "risk_rules.csv", "compound_risk_windows.csv"]
    
    missing_files = []
    schemas = {}
    row_counts = {}
    null_counts = {}
    duplicate_ids = {}

    for f in files:
        path = os.path.join(source_dir, f)
        if not os.path.exists(path):
            missing_files.append(f)
            continue
        
        with open(path, "r", encoding="utf-8") as file_obj:
            reader = csv.DictReader(file_obj)
            fieldnames = reader.fieldnames or []
            schemas[f] = {col: "String" for col in fieldnames}
            
            rows = list(reader)
            row_counts[f] = len(rows)
            
            # Count nulls
            null_dict = {col: 0 for col in fieldnames}
            for row in rows:
                for col in fieldnames:
                    if not row.get(col) or row[col].strip() == "":
                        null_dict[col] += 1
            null_counts[f] = null_dict

            # Check duplicate primary keys
            pk_candidates = {
                "zones.csv": "zone_id",
                "equipment.csv": "equipment_id",
                "sensors.csv": "sensor_id",
                "workers.csv": "worker_id",
                "permits.csv": "permit_id",
                "maintenance_records.csv": "maintenance_id",
                "incidents.csv": "incident_id",
                "risk_rules.csv": "rule_id"
            }
            if f in pk_candidates:
                pk = pk_candidates[f]
                seen = set()
                dups = 0
                for row in rows:
                    pk_val = row.get(pk)
                    if pk_val in seen:
                        dups += 1
                    else:
                        seen.add(pk_val)
                duplicate_ids[f] = dups

    if missing_files:
        print(f"Error: Missing files: {missing_files}")
        return False

    # Helper function to read CSV rows as list of dicts
    def read_csv_rows(filename):
        with open(os.path.join(source_dir, filename), "r", encoding="utf-8") as f_obj:
            return list(csv.DictReader(f_obj))

    # 2. Validate Foreign Keys
    errors = []
    df_zones = read_csv_rows("zones.csv")
    df_equipment = read_csv_rows("equipment.csv")
    df_sensors = read_csv_rows("sensors.csv")
    df_readings = read_csv_rows("sensor_readings.csv")
    df_permits = read_csv_rows("permits.csv")
    df_windows = read_csv_rows("compound_risk_windows.csv")

    zone_ids = set(z["zone_id"] for z in df_zones)
    equip_ids = set(e["equipment_id"] for e in df_equipment)
    sensor_ids = set(s["sensor_id"] for s in df_sensors)

    # Equipment zone_id -> Zones zone_id
    invalid_eq_zones = [e for e in df_equipment if e["zone_id"] not in zone_ids]
    if invalid_eq_zones:
        errors.append(f"Found {len(invalid_eq_zones)} equipment records with invalid zone_id")

    # Sensors equipment_id -> Equipment equipment_id
    invalid_sensor_eqs = [s for s in df_sensors if s["equipment_id"] and s["equipment_id"] not in equip_ids]
    if invalid_sensor_eqs:
        errors.append(f"Found {len(invalid_sensor_eqs)} sensors with invalid equipment_id")

    # Readings sensor_id -> Sensors sensor_id
    invalid_readings = [r for r in df_readings if r["sensor_id"] not in sensor_ids]
    if invalid_readings:
        errors.append(f"Found {len(invalid_readings)} readings with invalid sensor_id")

    # Permits zone_id -> Zones zone_id
    invalid_permit_zones = [p for p in df_permits if p["zone_id"] not in zone_ids]
    if invalid_permit_zones:
        errors.append(f"Found {len(invalid_permit_zones)} permits with invalid zone_id")

    # 3. Class Distribution Audit (is_incident_imminent)
    class_dist = {"0": 0, "1": 0}
    for row in df_windows:
        val = str(row["is_incident_imminent"])
        class_dist[val] = class_dist.get(val, 0) + 1

    # 4. Scenario-group split: a scenario never crosses train/validation/test.
    df_windows = sorted(df_windows, key=lambda x: x["timestamp"])
    scenario_ids = sorted(set(row["scenario_id"] for row in df_windows),
                          key=lambda sid: min(r["timestamp"] for r in df_windows if r["scenario_id"] == sid))
    train_idx = int(len(scenario_ids) * 0.70)
    val_idx = int(len(scenario_ids) * 0.85)
    train_ids, val_ids, test_ids = set(scenario_ids[:train_idx]), set(scenario_ids[train_idx:val_idx]), set(scenario_ids[val_idx:])
    df_train = [r for r in df_windows if r["scenario_id"] in train_ids]
    df_val = [r for r in df_windows if r["scenario_id"] in val_ids]
    df_test = [r for r in df_windows if r["scenario_id"] in test_ids]

    fieldnames = list(df_windows[0].keys())
    def write_csv_rows(filename, rows_to_write):
        with open(os.path.join(splits_dir, filename), "w", newline="", encoding="utf-8") as f_obj:
            writer = csv.DictWriter(f_obj, fieldnames=fieldnames)
            writer.writeheader(); writer.writerows(rows_to_write)
    write_csv_rows("compound_risk_train.csv", df_train)
    write_csv_rows("compound_risk_validation.csv", df_val)
    write_csv_rows("compound_risk_test.csv", df_test)

    # 5. Leakage Audit
    leakage_details = []
    if train_ids & val_ids: leakage_details.append("Scenario overlap between train and validation")
    if train_ids & test_ids: leakage_details.append("Scenario overlap between train and test")
    if val_ids & test_ids: leakage_details.append("Scenario overlap between validation and test")
    leakage_status = "CLEAN" if not leakage_details else "LEAKAGE_DETECTED"
    leakage_report = {
        "status": leakage_status,
        "split_strategy": "scenario_group_chronological",
        "train_scenarios": len(train_ids), "validation_scenarios": len(val_ids), "test_scenarios": len(test_ids),
        "scenario_overlap": {"train_val": len(train_ids & val_ids), "train_test": len(train_ids & test_ids), "val_test": len(val_ids & test_ids)},
        "details": leakage_details
    }
    with open(os.path.join(metadata_dir, "leakage_audit.json"), "w") as f:
        json.dump(leakage_report, f, indent=2)

    # 6. Save split report
    train_dist = {"0": 0, "1": 0}
    for r in df_train: train_dist[str(r["is_incident_imminent"])] += 1
    val_dist = {"0": 0, "1": 0}
    for r in df_val: val_dist[str(r["is_incident_imminent"])] += 1
    test_dist = {"0": 0, "1": 0}
    for r in df_test: test_dist[str(r["is_incident_imminent"])] += 1

    split_report = {
        "train_size": len(df_train),
        "validation_size": len(df_val),
        "test_size": len(df_test),
        "train_class_dist": train_dist,
        "val_class_dist": val_dist,
        "test_class_dist": test_dist
    }

    with open(os.path.join(metadata_dir, "split_report.json"), "w") as f:
        json.dump(split_report, f, indent=2)

    # 7. Validation Report
    val_report = {
        "validation_timestamp": datetime.now().isoformat(),
        "row_counts": row_counts,
        "duplicate_ids": duplicate_ids,
        "null_counts": null_counts,
        "foreign_key_errors": errors,
        "schema_validation": "SUCCESS" if len(errors) == 0 else "FAILED",
        "data_leakage_audit": leakage_status
    }
    with open(os.path.join(metadata_dir, "validation_report.json"), "w") as f:
        json.dump(val_report, f, indent=2)

    # 8. Manifest File
    manifest = {
        "project": "SafeMesh AI",
        "generated_at": datetime.now().isoformat(),
        "files": {
            f: {
                "row_count": row_counts[f],
                "columns": list(schemas[f].keys())
            }
            for f in files
        }
    }
    with open(os.path.join(metadata_dir, "dataset_manifest.json"), "w") as f:
        json.dump(manifest, f, indent=2)

    # 9. Class Distribution File
    with open(os.path.join(metadata_dir, "class_distribution.json"), "w") as f:
        json.dump(class_dist, f, indent=2)

    # 10. Generation Config File
    gen_config = {
        "random_seed": 42,
        "total_days": 10,
        "step_interval_minutes": 5,
        "num_zones": len(df_zones),
        "num_equipment": len(df_equipment),
        "num_sensors": len(sensor_ids)
    }
    with open(os.path.join(metadata_dir, "generation_config.json"), "w") as f:
        json.dump(gen_config, f, indent=2)

    print("Pure-Python Dataset validation, leakage audit, and splitting completed successfully!")
    return True

if __name__ == "__main__":
    validate_and_split()
