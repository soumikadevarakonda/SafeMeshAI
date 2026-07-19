import os
import csv
import json
import random
import math
import uuid
from datetime import datetime, timedelta

def compute_slope(vals):
    n = len(vals)
    if n < 2:
        return 0.0
    x = [i * 5 for i in range(n)]
    sum_x = sum(x)
    sum_y = sum(vals)
    sum_xx = sum(xi**2 for xi in x)
    sum_xy = sum(x[i] * vals[i] for i in range(n))
    denom = n * sum_xx - sum_x**2
    if abs(denom) < 1e-6:
        return 0.0
    return (n * sum_xy - sum_x * sum_y) / denom

def generate_all_data(seed=42):
    random.seed(seed)
    print(f"Starting advanced synthetic dataset generation with seed={seed}...")

    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
    source_dir = os.path.join(base_dir, "datasets", "source")
    rag_dir = os.path.join(base_dir, "datasets", "rag-documents")
    os.makedirs(source_dir, exist_ok=True)
    os.makedirs(rag_dir, exist_ok=True)

    # 1. Define Plants & Zones
    zones = [
        {"zone_id": f"Z-{i+1}", "name": name, "code": f"ZONE-{code}", "coordinates": coords}
        for i, (name, code, coords) in enumerate([
            ('Coke Oven Battery', 'COB', '100,100 250,100 250,220 100,220'),
            ('Blast Furnace', 'BF', '260,100 410,100 410,220 260,220'),
            ('Gas Storage Facility', 'GS', '420,100 570,100 570,220 420,220'),
            ('Boiler House', 'BH', '580,100 730,100 730,220 580,220'),
            ('Maintenance Workshop', 'MW', '100,230 250,230 250,350 100,350'),
            ('Compressor Station', 'CS', '260,230 410,230 410,350 260,350'),
            ('Raw Material Handling', 'RMH', '420,230 570,230 570,350 420,350'),
            ('Warehouse Logistics', 'WH', '580,230 730,230 730,350 580,350'),
            ('Utilities Area', 'UA', '100,360 410,360 410,480 100,480'),
            ('Control Room Hub', 'CR', '420,360 730,360 730,480 420,480'),
        ])
    ]

    with open(os.path.join(source_dir, "zones.csv"), "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["zone_id", "name", "code", "coordinates"])
        writer.writeheader()
        writer.writerows(zones)

    # 2. Equipment (~60 assets)
    equipment = []
    eq_types = ["Extractor Fan", "Compressor", "Preheater", "Steam Boiler", "Storage Tank", "Conveyor Belt", "Valve Block", "Turbine Generator"]
    for zone in zones:
        num_assets = random.randint(5, 7)
        for j in range(num_assets):
            eq_id = f"EQ-{zone['code'].split('-')[1]}-{j+1}"
            equipment.append({
                "equipment_id": eq_id,
                "name": f"{zone['name']} {random.choice(eq_types)} {j+1}",
                "code": eq_id,
                "type": random.choice(eq_types),
                "zone_id": zone["zone_id"],
                "health_score": round(random.uniform(90.0, 100.0), 2),
                "status": "OPERATIONAL"
            })

    with open(os.path.join(source_dir, "equipment.csv"), "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["equipment_id", "name", "code", "type", "zone_id", "health_score", "status"])
        writer.writeheader()
        writer.writerows(equipment)

    # 3. Sensors
    sensors = []
    sensor_types = [
        ("combustible_gas", "LEL%", 0.0, 100.0, 20.0, 40.0),
        ("toxic_gas", "ppm", 0.0, 200.0, 35.0, 100.0),
        ("oxygen", "%", 0.0, 25.0, 19.5, 18.0), 
        ("temperature", "°C", 0.0, 1000.0, 800.0, 950.0),
        ("pressure", "bar", 0.0, 100.0, 70.0, 90.0),
        ("vibration", "mm/s", 0.0, 20.0, 5.0, 10.0),
        ("ventilation", "%", 0.0, 100.0, 70.0, 50.0) 
    ]

    for eq in equipment:
        num_sensors = random.randint(2, 4)
        chosen_types = random.sample(sensor_types, num_sensors)
        for k, (stype, unit, min_val, max_val, warn, crit) in enumerate(chosen_types):
            sens_id = f"SEN-{eq['equipment_id']}-{k+1}"
            sensors.append({
                "sensor_id": sens_id,
                "name": f"{eq['name']} {stype.replace('_', ' ').capitalize()} Sensor",
                "code": sens_id,
                "type": stype,
                "unit": unit,
                "equipment_id": eq["equipment_id"],
                "zone_id": eq["zone_id"],
                "min_value": min_val,
                "max_value": max_val,
                "threshold_warning": warn,
                "threshold_critical": crit
            })

    with open(os.path.join(source_dir, "sensors.csv"), "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["sensor_id", "name", "code", "type", "unit", "equipment_id", "zone_id", "min_value", "max_value", "threshold_warning", "threshold_critical"])
        writer.writeheader()
        writer.writerows(sensors)

    # 4. Workers
    worker_roles = ["Mechanical Technician", "Electrical Technician", "Operations Operator", "Safety Inspector", "Ventilation Tech", "Welder", "Rigger"]
    workers = []
    for i in range(250):
        worker_id = f"W-{i+1}"
        first_names = ["James", "John", "Robert", "Michael", "William", "David", "Richard", "Joseph", "Thomas", "Charles", "Patricia", "Jennifer", "Linda", "Elizabeth", "Barbara", "Susan", "Jessica", "Sarah", "Karen", "Nancy"]
        last_names = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin"]
        workers.append({
            "worker_id": worker_id,
            "name": f"{random.choice(first_names)} {random.choice(last_names)}",
            "badge_number": f"WD-{1000 + i}",
            "role": random.choice(worker_roles),
            "status": "OFF_DUTY"
        })

    with open(os.path.join(source_dir, "workers.csv"), "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["worker_id", "name", "badge_number", "role", "status"])
        writer.writeheader()
        writer.writerows(workers)

    start_date = datetime.now() - timedelta(days=10)
    steps = 10 * 24 * 12 # 2,880 steps
    prediction_horizon_steps = 12  # 60 minutes at 5-minute intervals

    # Define scheduled positive incident scenarios
    incidents_schedule = [
        {"scenario_id":"INC-001","start": 100, "end": 180, "zone_id": "Z-1", "type": "combustible_ignition"}, # Train
        {"scenario_id":"SCN-400","start": 400, "end": 460, "zone_id": "Z-3", "type": "confined_space_asphyxia"}, # Train
        {"scenario_id":"SCN-700","start": 700, "end": 760, "zone_id": "Z-2", "type": "blast_furnace_rupture"}, # Train
        {"scenario_id":"SCN-1000","start": 1000, "end": 1080, "zone_id": "Z-1", "type": "combustible_ignition"}, # Train (Demo Coke Oven)
        {"scenario_id":"SCN-1300","start": 1300, "end": 1360, "zone_id": "Z-4", "type": "boiler_overheat"}, # Train
        {"scenario_id":"SCN-1600","start": 1600, "end": 1660, "zone_id": "Z-6", "type": "compressor_vibration"}, # Train
        {"scenario_id":"SCN-1900","start": 1900, "end": 1960, "zone_id": "Z-3", "type": "confined_space_asphyxia"}, # Val
        {"scenario_id":"SCN-2200","start": 2200, "end": 2265, "zone_id": "Z-1", "type": "combustible_ignition"}, # Val
        {"scenario_id":"SCN-2500","start": 2500, "end": 2560, "zone_id": "Z-2", "type": "blast_furnace_rupture"}, # Test
        {"scenario_id":"SCN-2700","start": 2700, "end": 2760, "zone_id": "Z-6", "type": "compressor_vibration"}  # Test
    ]

    # Define challenging negative cases
    negatives_schedule = [
        {"scenario_id":"SCN-250","start": 250, "end": 300, "zone_id": "Z-1", "type": "benign_gas_spike"},
        {"scenario_id":"SCN-500","start": 500, "end": 550, "zone_id": "Z-4", "type": "benign_temp_spike"},
        {"scenario_id":"SCN-800","start": 800, "end": 850, "zone_id": "Z-6", "type": "benign_vib_spike"},
        {"scenario_id":"SCN-1400","start": 1400, "end": 1450, "zone_id": "Z-1", "type": "safe_permit_active"},
        {"scenario_id":"SCN-1750","start": 1750, "end": 1800, "zone_id": "Z-3", "type": "safe_permit_active"},
        {"scenario_id":"SCN-2350","start": 2350, "end": 2400, "zone_id": "Z-2", "type": "benign_vent_drop"},
        {"scenario_id":"SCN-2600","start": 2600, "end": 2650, "zone_id": "Z-1", "type": "slow_gas_drift"}
    ]

    # 5. Permits generation (2200+)
    permits = []
    permit_types = ["HOT_WORK", "CONFINED_SPACE", "ELECTRICAL_ISOLATION", "HEIGHTS", "EXCAVATION"]
    for i in range(2200):
        p_id = f"PRM-{i+1}"
        p_zone = random.choice(zones)
        p_type = random.choice(permit_types)
        p_start_step = random.randint(0, steps - 24)
        p_duration_steps = random.randint(6, 24)
        p_start_time = start_date + timedelta(minutes=p_start_step * 5)
        p_end_time = p_start_time + timedelta(minutes=p_duration_steps * 5)
        p_worker = random.choice(workers)
        
        permits.append({
            "permit_id": p_id,
            "permit_number": f"P-{20000 + i}",
            "type": p_type,
            "zone_id": p_zone["zone_id"],
            "equipment_id": random.choice([eq["equipment_id"] for eq in equipment if eq["zone_id"] == p_zone["zone_id"]]),
            "worker_id": p_worker["worker_id"],
            "status": "COMPLETED" if p_start_step + p_duration_steps < steps else "ACTIVE",
            "start_time": p_start_time.isoformat(),
            "end_time": p_end_time.isoformat(),
            "hazards": "Gas ignition, toxic gas exposure, mechanical hazards",
            "controls": "Continuous testing, extraction bypass, fire watch"
        })

    # Force permits to match scheduled positive incidents
    for idx, inc in enumerate(incidents_schedule):
        p_start_time = start_date + timedelta(minutes=(inc["start"] - prediction_horizon_steps) * 5)
        p_end_time = start_date + timedelta(minutes=inc["end"] * 5)
        p_type = "HOT_WORK" if inc["type"] in ["combustible_ignition", "blast_furnace_rupture"] else "CONFINED_SPACE"
        
        p_idx = idx * 10
        permits[p_idx]["zone_id"] = inc["zone_id"]
        permits[p_idx]["type"] = p_type
        permits[p_idx]["start_time"] = p_start_time.isoformat()
        permits[p_idx]["end_time"] = p_end_time.isoformat()
        permits[p_idx]["status"] = "ACTIVE"

    # Force permits to match safe negatives
    for idx, neg in enumerate(negatives_schedule):
        if neg["type"] == "safe_permit_active":
            p_start_time = start_date + timedelta(minutes=neg["start"] * 5)
            p_end_time = start_date + timedelta(minutes=neg["end"] * 5)
            p_type = "HOT_WORK" if neg["zone_id"] == "Z-1" else "CONFINED_SPACE"
            
            p_idx = 500 + idx * 10
            permits[p_idx]["zone_id"] = neg["zone_id"]
            permits[p_idx]["type"] = p_type
            permits[p_idx]["start_time"] = p_start_time.isoformat()
            permits[p_idx]["end_time"] = p_end_time.isoformat()
            permits[p_idx]["status"] = "ACTIVE"

    with open(os.path.join(source_dir, "permits.csv"), "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["permit_id", "permit_number", "type", "zone_id", "equipment_id", "worker_id", "status", "start_time", "end_time", "hazards", "controls"])
        writer.writeheader()
        writer.writerows(permits)

    # Pre-parse and index active permits by step and zone for fast retrieval
    print("Pre-indexing active permits by step...")
    permits_by_step = {step: {z["zone_id"]: [] for z in zones} for step in range(steps)}
    for p in permits:
        p_zone = p["zone_id"]
        p_start_dt = datetime.fromisoformat(p["start_time"])
        p_end_dt = datetime.fromisoformat(p["end_time"])
        start_step = max(0, int((p_start_dt - start_date).total_seconds() / 300))
        end_step = min(steps - 1, int((p_end_dt - start_date).total_seconds() / 300))
        for step in range(start_step, end_step + 1):
            permits_by_step[step][p_zone].append(p)

    # 6. Maintenance records (5100+)
    maintenance = []
    for i in range(5100):
        m_id = f"MNT-{i+1}"
        m_eq = random.choice(equipment)
        m_worker = random.choice(workers)
        m_start_step = random.randint(0, steps - 12)
        m_scheduled = start_date + timedelta(minutes=m_start_step * 5)
        m_status = random.choice(["COMPLETED", "OVERDUE", "SCHEDULED"])
        m_completed = m_scheduled + timedelta(hours=random.randint(1, 4)) if m_status == "COMPLETED" else None

        maintenance.append({
            "maintenance_id": m_id,
            "equipment_id": m_eq["equipment_id"],
            "worker_id": m_worker["worker_id"],
            "type": random.choice(["PREVENTIVE", "CORRECTIVE", "EMERGENCY"]),
            "description": f"Standard checks on {m_eq['name']}.",
            "status": m_status,
            "scheduled_date": m_scheduled.isoformat(),
            "completed_date": m_completed.isoformat() if m_completed else ""
        })

    with open(os.path.join(source_dir, "maintenance_records.csv"), "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["maintenance_id", "equipment_id", "worker_id", "type", "description", "status", "scheduled_date", "completed_date"])
        writer.writeheader()
        writer.writerows(maintenance)

    # Pre-calculate static maintenance overdue and equipment health counts by zone
    print("Pre-calculating static zone stats...")
    maintenance_overdue_by_zone = {}
    equipment_health_avg_by_zone = {}
    for z in zones:
        zone_id = z["zone_id"]
        zone_eqs = [eq for eq in equipment if eq["zone_id"] == zone_id]
        zone_eq_ids = set(eq["equipment_id"] for eq in zone_eqs)
        
        maintenance_overdue_by_zone[zone_id] = sum(
            1 for m in maintenance
            if m["equipment_id"] in zone_eq_ids and m["status"] == "OVERDUE"
        )
        
        if zone_eqs:
            equipment_health_avg_by_zone[zone_id] = sum(eq["health_score"] for eq in zone_eqs) / len(zone_eqs)
        else:
            equipment_health_avg_by_zone[zone_id] = 100.0

    # 7. Shift logs (2000+)
    shift_logs = []
    for step in range(0, steps, 12):
        timestamp = start_date + timedelta(minutes=step * 5)
        for zone in zones:
            shift_logs.append({
                "shift_id": f"SHIFT-{step//12+1}",
                "zone_id": zone["zone_id"],
                "log_text": f"Zone {zone['name']} inspected. Parameters nominal.",
                "handover_quality": "GOOD" if random.random() > 0.1 else "FAIR",
                "timestamp": timestamp.isoformat()
            })

    with open(os.path.join(source_dir, "shift_logs.csv"), "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["shift_id", "zone_id", "log_text", "handover_quality", "timestamp"])
        writer.writeheader()
        writer.writerows(shift_logs)

    # 8. Worker location events
    worker_locations = []
    for w in workers:
        w["status"] = "OFF_DUTY"

    # Simulate workers movement
    for step in range(steps):
        timestamp = start_date + timedelta(minutes=step * 5)
        
        # Put workers in incident zones during incident periods
        for inc in incidents_schedule:
            if inc["start"] <= step <= inc["end"]:
                z_id = inc["zone_id"]
                workers[0]["status"] = z_id
                workers[1]["status"] = z_id

        if step % 5 == 0:
            for _ in range(random.randint(5, 12)):
                w = random.choice(workers)
                old_zone = w["status"]
                new_zone = random.choice(zones)["zone_id"]
                if old_zone != new_zone:
                    worker_locations.append({
                        "timestamp": timestamp.isoformat(),
                        "worker_id": w["worker_id"],
                        "zone_id": new_zone,
                        "event_type": "ENTRY"
                    })
                    w["status"] = new_zone

    with open(os.path.join(source_dir, "worker_locations.csv"), "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["timestamp", "worker_id", "zone_id", "event_type"])
        writer.writeheader()
        writer.writerows(worker_locations)

    # 9. Time Series Sensor values & Labeled Risk Windows
    sensor_readings = []
    risk_windows = []

    # Map zones to sensors
    zone_sensors = {z["zone_id"]: [] for z in zones}
    for s in sensors:
        zone_sensors[s["zone_id"]].append(s)

    sensor_current_val = {}
    for s in sensors:
        if s["type"] == "oxygen":
            sensor_current_val[s["sensor_id"]] = 20.9
        elif s["type"] == "ventilation":
            sensor_current_val[s["sensor_id"]] = 95.0
        elif s["type"] == "vibration":
            sensor_current_val[s["sensor_id"]] = 1.2
        elif s["type"] == "combustible_gas":
            sensor_current_val[s["sensor_id"]] = 0.0
        elif s["type"] == "toxic_gas":
            sensor_current_val[s["sensor_id"]] = 0.0
        elif s["type"] == "pressure":
            sensor_current_val[s["sensor_id"]] = 10.0 if s["unit"] == "bar" else 100.0
        elif s["type"] == "temperature":
            sensor_current_val[s["sensor_id"]] = 25.0

    # Initialize sliding history cache for feature engine
    sensor_history = {z["zone_id"]: {t: [] for t in ["combustible_gas", "toxic_gas", "oxygen", "ventilation", "pressure", "vibration", "temperature"]} for z in zones}

    print("Executing simulated multi-scenario timeline loops and in-place feature extraction...")
    for step in range(steps):
        timestamp = start_date + timedelta(minutes=step * 5)
        
        # Check active incident
        active_inc = None
        for inc in incidents_schedule:
            if inc["start"] - prediction_horizon_steps <= step <= inc["end"]:
                active_inc = inc
                break

        # Check active negatives
        active_neg = None
        for neg in negatives_schedule:
            if neg["start"] <= step <= neg["end"]:
                active_neg = neg
                break

        for zone in zones:
            zone_id = zone["zone_id"]
            
            # Scenario checks
            inc_here = active_inc and active_inc["zone_id"] == zone_id
            preincident_here = bool(inc_here and step < active_inc["start"])
            post_event_here = bool(inc_here and step >= active_inc["start"])
            neg_here = active_neg and active_neg["zone_id"] == zone_id

            zone_vals = {}
            for s in zone_sensors[zone_id]:
                s_id = s["sensor_id"]
                s_type = s["type"]

                # Base normal fluctuations
                if s_type == "oxygen":
                    val = sensor_current_val[s_id] + random.uniform(-0.02, 0.02)
                    val = max(20.0, min(21.2, val))
                elif s_type == "ventilation":
                    val = sensor_current_val[s_id] + random.uniform(-0.2, 0.2)
                    val = max(90.0, min(99.0, val))
                elif s_type == "vibration":
                    val = sensor_current_val[s_id] + random.uniform(-0.05, 0.05)
                    val = max(0.5, min(1.8, val))
                elif s_type == "combustible_gas":
                    val = sensor_current_val[s_id] + random.uniform(-0.02, 0.02)
                    val = max(0.0, min(2.0, val))
                elif s_type == "toxic_gas":
                    val = sensor_current_val[s_id] + random.uniform(-0.02, 0.02)
                    val = max(0.0, min(1.5, val))
                else:
                    val = sensor_current_val[s_id] * random.uniform(0.99, 1.01)
                    val = max(s["min_value"], min(s["max_value"], val))

                # Inject predictive buildup before the event and stronger dynamics after it.
                if inc_here:
                    if preincident_here:
                        pre_progress = max(0.0, min(1.0, (step - (active_inc["start"] - prediction_horizon_steps) + 1) / prediction_horizon_steps))
                        prog = 0.0
                    else:
                        prog = max(0.0, min(1.0, (step - active_inc["start"]) / max(1, active_inc["end"] - active_inc["start"])))
                    
                    if active_inc["type"] == "combustible_ignition":
                        if preincident_here and s_type == "combustible_gas": val = max(val, 2.0 + pre_progress * 12.0 + random.uniform(-2, 2))
                        elif preincident_here and s_type == "ventilation": val = min(val, 95.0 - pre_progress * 18.0 + random.uniform(-2, 2))
                        elif s_type == "combustible_gas":
                            val = max(val, prog * 32.0)
                        elif s_type == "ventilation":
                            val = min(val, 95.0 - prog * 50.0)
                            
                    elif active_inc["type"] == "confined_space_asphyxia":
                        if preincident_here and s_type == "toxic_gas": val = max(val, 3.0 + pre_progress * 25.0 + random.uniform(-3, 3))
                        elif preincident_here and s_type == "oxygen": val = min(val, 20.9 - pre_progress * 1.1 + random.uniform(-0.1, 0.1))
                        elif s_type == "toxic_gas":
                            val = max(val, prog * 85.0)
                        elif s_type == "oxygen":
                            val = min(val, 20.9 - prog * 3.4)
                            
                    elif active_inc["type"] == "blast_furnace_rupture":
                        if preincident_here and s_type == "temperature": val = max(val, 25.0 + pre_progress * 500.0 + random.uniform(-30, 30))
                        elif preincident_here and s_type == "pressure": val = max(val, 10.0 + pre_progress * 45.0 + random.uniform(-4, 4))
                        elif s_type == "temperature":
                            val = max(val, 25.0 + prog * 930.0)
                        elif s_type == "pressure":
                            val = max(val, 10.0 + prog * 85.0)

                    elif active_inc["type"] == "compressor_vibration":
                        if preincident_here and s_type == "vibration": val = max(val, 1.2 + pre_progress * 5.5 + random.uniform(-0.6, 0.6))
                        elif s_type == "vibration":
                            val = max(val, 1.2 + prog * 9.5)

                    elif active_inc["type"] == "boiler_overheat":
                        if preincident_here and s_type == "temperature": val = max(val, 25.0 + pre_progress * 520.0 + random.uniform(-35, 35))
                        elif preincident_here and s_type == "pressure": val = max(val, 10.0 + pre_progress * 35.0 + random.uniform(-4, 4))
                        elif s_type == "temperature": val = max(val, 25.0 + prog * 900.0)
                        elif s_type == "pressure": val = max(val, 10.0 + prog * 75.0)

                # Inject benign negative spikes
                if neg_here:
                    prog = (step - active_neg["start"]) / (active_neg["end"] - active_neg["start"])
                    
                    if active_neg["type"] == "benign_gas_spike" and s_type == "combustible_gas":
                        val = 25.0 * (1.0 - abs(2.0 * prog - 1.0))
                    elif active_neg["type"] == "benign_temp_spike" and s_type == "temperature":
                        val = 25.0 + (810.0 * (1.0 - abs(2.0 * prog - 1.0)))
                    elif active_neg["type"] == "benign_vib_spike" and s_type == "vibration":
                        val = 1.2 + (6.0 * (1.0 - abs(2.0 * prog - 1.0)))
                    elif active_neg["type"] == "benign_vent_drop" and s_type == "ventilation":
                        val = 95.0 - (40.0 * (1.0 - abs(2.0 * prog - 1.0)))
                    elif active_neg["type"] == "slow_gas_drift" and s_type == "combustible_gas":
                        val = 12.0 * prog

                sensor_current_val[s_id] = val
                zone_vals[s_type] = val

                # Keep logs
                if random.random() < 0.22 or inc_here or neg_here:
                    sensor_readings.append({
                        "timestamp": timestamp.isoformat(),
                        "sensor_id": s_id,
                        "value": round(val, 3)
                    })

            # Update sliding history caches & compile features
            sensor_features = {}
            for t in ["combustible_gas", "toxic_gas", "oxygen", "ventilation", "pressure", "vibration", "temperature"]:
                val = zone_vals.get(t, 20.9 if t == "oxygen" else (95.0 if t == "ventilation" else 0.0))
                hist = sensor_history[zone_id][t]
                hist.append(val)
                if len(hist) > 6:
                    hist.pop(0)
                
                avg = sum(hist) / len(hist)
                std = math.sqrt(sum((x - avg)**2 for x in hist) / len(hist)) if len(hist) > 1 else 0.0
                slope = compute_slope(hist)

                sensor_features[f"{t}_val"] = val
                sensor_features[f"{t}_avg_30m"] = avg
                sensor_features[f"{t}_std_30m"] = std
                sensor_features[f"{t}_slope_30m"] = slope

            # Evaluate labels & risk score
            is_incident_imminent = 0
            risk_score = random.uniform(5.0, 12.0)
            
            if inc_here:
                if preincident_here:
                    is_incident_imminent = 1
                    progress = max(0.0, min(1.0, (step - (active_inc["start"] - prediction_horizon_steps) + 1) / prediction_horizon_steps))
                    risk_score = 12.0 + progress * 48.0 + random.uniform(-4.0, 4.0)
                else:
                    is_incident_imminent = 0
                    progress = max(0.0, min(1.0, (step - active_inc["start"]) / max(1, active_inc["end"] - active_inc["start"])))
                    risk_score = 55.0 + progress * 35.0 + random.uniform(-4.0, 4.0)
            elif neg_here:
                progress = (step - active_neg["start"]) / (active_neg["end"] - active_neg["start"])
                risk_score = 10.0 + (18.0 * (1.0 - abs(2.0 * progress - 1.0)))

            # Pre-indexed active permits count (extremely fast!)
            active_permits_list = permits_by_step[step][zone_id]
            active_permits_count = len(active_permits_list)
            
            zone_workers = sum(1 for w in workers if w["status"] == zone_id)

            if random.random() < 0.35 or is_incident_imminent or neg_here:
                row_dict = {
                     "timestamp": timestamp.isoformat(),
                    "scenario_id": (active_inc["scenario_id"] if inc_here else (active_neg["scenario_id"] if neg_here else f"NORMAL-{step//48:04d}")),
                    "scenario_type": (active_inc["type"] if inc_here else (active_neg["type"] if neg_here else "normal_operation")),
                    "zone_id": zone_id,
                    "sensor_anomaly_score": round(random.uniform(0.0, 0.3) if not (inc_here or neg_here) else random.uniform(0.4, 0.8), 3),
                    
                    # Permits
                    "active_permits": active_permits_count,
                    "permit_overlap_count": max(0, active_permits_count - 1),
                    "has_hot_work": 1 if any(p["type"] == "HOT_WORK" for p in active_permits_list) else 0,
                    "has_confined_space": 1 if any(p["type"] == "CONFINED_SPACE" for p in active_permits_list) else 0,
                    "has_electrical_isolation": 1 if any(p["type"] == "ELECTRICAL_ISOLATION" for p in active_permits_list) else 0,
                    "simops_conflict": 1 if active_permits_count >= 2 else 0,
                    
                    # Workers
                    "worker_count": zone_workers,
                    "worker_exposure_duration": random.randint(10, 90) if zone_workers > 0 else 0,
                    
                    # Maintenance & Health (pre-calculated dictionaries - extremely fast!)
                    "maintenance_overdue": maintenance_overdue_by_zone[zone_id],
                    "equipment_health_avg": round(equipment_health_avg_by_zone[zone_id], 2),
                    
                    "recent_near_miss_count": 1 if random.random() < 0.08 else 0,
                    "shift_change": 1 if step % 96 == 0 else 0,
                    
                    "risk_score": round(risk_score, 2),
                    "is_incident_imminent": is_incident_imminent,
                    "incident_event_time": (start_date + timedelta(minutes=active_inc["start"] * 5)).isoformat() if inc_here else "",
                    "minutes_to_incident": ((active_inc["start"] - step) * 5 if preincident_here else (0 if inc_here else "")),
                    "event_occurred": 1 if post_event_here else 0
                }
                
                # Merge sensor features
                for k, v in sensor_features.items():
                    row_dict[k] = round(v, 3)
                    
                risk_windows.append(row_dict)

    with open(os.path.join(source_dir, "sensor_readings.csv"), "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["timestamp", "sensor_id", "value"])
        writer.writeheader()
        writer.writerows(sensor_readings)

    # Compile fieldnames dynamically
    window_fields = ["timestamp", "scenario_id", "scenario_type", "zone_id", "sensor_anomaly_score", "active_permits", "permit_overlap_count", 
                     "has_hot_work", "has_confined_space", "has_electrical_isolation", "simops_conflict", 
                     "worker_count", "worker_exposure_duration", "maintenance_overdue", "equipment_health_avg", 
                     "recent_near_miss_count", "shift_change", "risk_score", "is_incident_imminent", "incident_event_time", "minutes_to_incident", "event_occurred"]
    for t in ["combustible_gas", "toxic_gas", "oxygen", "ventilation", "pressure", "vibration", "temperature"]:
        window_fields += [f"{t}_val", f"{t}_avg_30m", f"{t}_std_30m", f"{t}_slope_30m"]

    with open(os.path.join(source_dir, "compound_risk_windows.csv"), "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=window_fields)
        writer.writeheader()
        writer.writerows(risk_windows)

    # 10. Historical incidents
    incident_causes = ["Equipment failure", "Human error", "SOP deviation", "Ventilation degradation", "Isolation failure", "Gas leak", "Inadequate PPE"]
    incident_types = ["Gas Leak", "Fire", "Electrical Flash", "Worker Fall", "Chemical Exposure", "Mechanical Impact"]
    incidents = []
    for i in range(520):
        inc_date = start_date - timedelta(days=random.randint(15, 365))
        inc_zone = random.choice(zones)
        inc_type = random.choice(incident_types)
        incidents.append({
            "incident_id": f"INC-{i+1}",
            "title": f"Historical {inc_type} at {inc_zone['name']}",
            "description": f"Operational failure during work scheduled at {inc_zone['name']}. Cause identified as {random.choice(incident_causes).lower()}.",
            "date": inc_date.isoformat(),
            "zone_id": inc_zone["zone_id"],
            "severity": random.choice(["MINOR", "MAJOR", "CATASTROPHIC"]),
            "root_cause": random.choice(incident_causes),
            "corrective_actions": "Repaired extractor fan systems, updated permit protocols."
        })

    with open(os.path.join(source_dir, "incidents.csv"), "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["incident_id", "title", "description", "date", "zone_id", "severity", "root_cause", "corrective_actions"])
        writer.writeheader()
        writer.writerows(incidents)

    # 11. Risk rules CSV
    risk_rules = [
        {"rule_id": "RULE-1", "name": "Combustible Gas + Hot Work + Low Ventilation", "description": "Detects high ignition risk when combustible gas levels rise above 15% LEL while a active HOT WORK permit is running in the same zone with ventilation efficiency below 75%."},
        {"rule_id": "RULE-2", "name": "Confined Space Entry + Oxygen Deficiency", "description": "Triggers alert if workers enter a zone with an active CONFINED SPACE permit while local oxygen content falls below 19.5%."},
        {"rule_id": "RULE-3", "name": "High Vibration + High Pressure + Overdue Maintenance", "description": "Flags potential mechanical burst if compressor vibration exceeds 4.0 mm/s, pressure exceeds 150 psi, and maintenance schedule is overdue."}
    ]

    with open(os.path.join(source_dir, "risk_rules.csv"), "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["rule_id", "name", "description"])
        writer.writeheader()
        writer.writerows(risk_rules)

    print("Advanced synthetic dataset generation completed successfully!")

if __name__ == "__main__":
    generate_all_data()
