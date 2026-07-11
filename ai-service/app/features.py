import math
from datetime import datetime, timedelta

def calculate_slope(values):
    n = len(values)
    if n < 2:
        return 0.0
    x = list(range(n))
    mean_x = sum(x) / n
    mean_y = sum(values) / n
    
    num = sum((x[i] - mean_x) * (values[i] - mean_y) for i in range(n))
    den = sum((x[i] - mean_x) ** 2 for i in range(n))
    
    if abs(den) < 1e-8:
        return 0.0
    return float(num / den)

def parse_iso_datetime(ts_str):
    # Support 'YYYY-MM-DDTHH:MM:SS' or 'YYYY-MM-DDTHH:MM:SS.ffffff'
    try:
        if '.' in ts_str:
            base, frac = ts_str.split('.')
            # take first 6 chars of fractional part to handle variable microseconds length
            frac = frac[:6]
            ts_str = f"{base}.{frac}"
            return datetime.strptime(ts_str, "%Y-%m-%dT%H:%M:%S.%f")
        else:
            return datetime.strptime(ts_str, "%Y-%m-%dT%H:%M:%S")
    except Exception:
        # Fallback to current time
        return datetime.now()

def extract_features_from_state(zone_id, timestamp, db_readings, db_permits, db_workers, db_maintenance, db_near_misses, db_sensors):
    """
    Real-time feature extraction for a single zone at a specific timestamp.
    Uses pure Python to compute stats and slopes.
    """
    ts = parse_iso_datetime(timestamp)
    
    # 1. Sensor Features
    # Filter sensors for this zone
    zone_sens = [s for s in db_sensors if s["zoneId"] == zone_id or s.get("zone_id") == zone_id]
    sens_ids = [s["id"] for s in zone_sens]
    
    # Filter readings for these sensors in the last 30 minutes
    window_start = ts - timedelta(minutes=30)
    recent_readings = []
    for r in db_readings:
        r_sensor_id = r["sensorId"] if "sensorId" in r else r.get("sensor_id")
        r_ts_str = r["timestamp"]
        r_ts = parse_iso_datetime(r_ts_str)
        if r_sensor_id in sens_ids and r_ts >= window_start:
            recent_readings.append(r)
            
    sensor_features = {}
    
    # We will compute features for key sensor types
    types = ["combustible_gas", "toxic_gas", "oxygen", "ventilation", "pressure", "vibration", "temperature"]
    for t in types:
        t_sensors = [s for s in zone_sens if s["type"] == t]
        t_sens_ids = [s["id"] for s in t_sensors]
        
        t_readings = []
        for r in recent_readings:
            r_sens_id = r["sensorId"] if "sensorId" in r else r.get("sensor_id")
            if r_sens_id in t_sens_ids:
                t_readings.append(r)
                
        # Sort chronologically by timestamp
        t_readings = sorted(t_readings, key=lambda x: parse_iso_datetime(x["timestamp"]))
        
        if not t_readings:
            # Default normal values
            val = 20.9 if t == "oxygen" else (95.0 if t == "ventilation" else 0.0)
            avg = val
            std = 0.0
            slope = 0.0
            dist_to_crit = 100.0
        else:
            vals = [r["value"] for r in t_readings]
            val = vals[-1]
            avg = sum(vals) / len(vals)
            
            # Std deviation
            if len(vals) > 1:
                variance = sum((x - avg) ** 2 for x in vals) / len(vals)
                std = math.sqrt(variance)
            else:
                std = 0.0
                
            slope = calculate_slope(vals)
            
            # Distance to critical threshold
            crit_threshold = t_sensors[0]["thresholdCritical"] if "thresholdCritical" in t_sensors[0] else t_sensors[0].get("threshold_critical", 50.0)
            if t in ["oxygen", "ventilation"]:
                # Lower is worse
                dist_to_crit = val - crit_threshold
            else:
                # Higher is worse
                dist_to_crit = crit_threshold - val
        
        sensor_features[f"{t}_val"] = val
        sensor_features[f"{t}_avg_30m"] = avg
        sensor_features[f"{t}_std_30m"] = std
        sensor_features[f"{t}_slope_30m"] = slope
        sensor_features[f"{t}_dist_to_crit"] = dist_to_crit

    # 2. Permit Features
    active_permits_count = 0
    has_hot_work = 0
    has_confined = 0
    has_isolation = 0
    
    for p in db_permits:
        p_zone_id = p["zoneId"] if "zoneId" in p else p.get("zone_id")
        p_status = p["status"]
        if p_zone_id == zone_id and p_status in ["ACTIVE", "APPROVED"]:
            p_start = parse_iso_datetime(p["startTime"] if "startTime" in p else p.get("start_time"))
            p_end = parse_iso_datetime(p["endTime"] if "endTime" in p else p.get("end_time"))
            if p_start <= ts <= p_end:
                active_permits_count += 1
                p_type = p["type"]
                if p_type == "HOT_WORK":
                    has_hot_work = 1
                elif p_type == "CONFINED_SPACE":
                    has_confined = 1
                elif p_type == "ELECTRICAL_ISOLATION":
                    has_isolation = 1
    
    # SIMOPS conflict
    simops_conflict = 0
    if active_permits_count >= 2 and has_hot_work == 1:
        simops_conflict = 1

    # 3. Worker Features
    zone_workers = []
    for w in db_workers:
        w_zone_id = w["currentZoneId"] if "currentZoneId" in w else w.get("current_zone_id")
        if w_zone_id == zone_id:
            zone_workers.append(w)
            
    worker_count = len(zone_workers)
    
    # Calculate exposure duration (time since entry for workers in zone)
    worker_exposure_duration = 0.0
    for w in zone_workers:
        w_chk_str = w.get("checkInTime") or w.get("check_in_time")
        if w_chk_str:
            w_chk = parse_iso_datetime(w_chk_str)
            duration = (ts - w_chk).total_seconds() / 60.0
            worker_exposure_duration += max(0.0, duration)

    # 4. Maintenance & Equipment Features
    overdue_count = 0
    health_scores = []
    for eq in db_maintenance:
        eq_zone = eq["zoneId"] if "zoneId" in eq else eq.get("zone_id")
        if eq_zone == zone_id:
            eq_status = eq.get("maintenance_status") or eq.get("status")
            if eq_status == "OVERDUE":
                overdue_count += 1
            health_scores.append(eq.get("health_score") or eq.get("healthScore", 100.0))
            
    equipment_health_avg = sum(health_scores) / len(health_scores) if health_scores else 100.0

    # 5. Near Misses & Shift Context
    recent_near_misses = 0
    for nm in db_near_misses:
        nm_zone = nm["zoneId"] if "zoneId" in nm else nm.get("zone_id")
        if nm_zone == zone_id:
            nm_date = parse_iso_datetime(nm["date"])
            if (ts - nm_date).total_seconds() <= 86400: # last 24h
                recent_near_misses += 1

    # Shift change indicator (every 8 hours, at 00:00, 08:00, 16:00)
    hour = ts.hour
    minute = ts.minute
    total_minutes = hour * 60 + minute
    shift_times = [0, 480, 960, 1440]
    shift_change = 0
    for st in shift_times:
        if abs(total_minutes - st) <= 30 or abs(total_minutes - st + 1440) <= 30:
            shift_change = 1
            break

    # Build final feature dict
    features = {
        "zone_id": zone_id,
        "timestamp": ts.isoformat(),
        "active_permits": active_permits_count,
        "permit_overlap_count": max(0, active_permits_count - 1),
        "has_hot_work": has_hot_work,
        "has_confined_space": has_confined,
        "has_electrical_isolation": has_isolation,
        "simops_conflict": simops_conflict,
        "worker_count": worker_count,
        "worker_exposure_duration": worker_exposure_duration,
        "maintenance_overdue": overdue_count,
        "equipment_health_avg": equipment_health_avg,
        "recent_near_miss_count": recent_near_misses,
        "shift_change": shift_change,
        **sensor_features
    }
    
    return features
