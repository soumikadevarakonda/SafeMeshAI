# SafeMesh AI - Data Dictionary

This document defines the schema, data types, primary keys, and relationships for the operational datasets generated in SafeMesh AI.

---

## 1. Zones Table (`zones.csv`)
Stores the physical plant zones and boundaries.
- **zone_id** (String, Primary Key): Unique zone identifier (e.g. `Z-1`).
- **name** (String): Human-readable name of the facility sector.
- **code** (String): Unique system code (e.g. `ZONE-COB`).
- **coordinates** (String): SVG boundary coordinates (e.g. `100,100 250,100 250,220 100,220`).

---

## 2. Equipment Table (`equipment.csv`)
Stores industrial assets mapped to zones.
- **equipment_id** (String, Primary Key): Unique asset identifier.
- **name** (String): Asset description.
- **code** (String): System asset tag.
- **type** (String): Category (e.g. Extractor Fan, Preheater).
- **zone_id** (String, Foreign Key): References `zones.zone_id`.
- **health_score** (Float): Numeric condition metric (90.0 to 100.0).
- **status** (String): Operational state (e.g. OPERATIONAL, DEGRADED).

---

## 3. Sensors Table (`sensors.csv`)
Defines atmospheric and mechanical sensors.
- **sensor_id** (String, Primary Key): Unique sensor tag.
- **name** (String): Sensor description.
- **code** (String): System tag.
- **type** (String): Measurement class (e.g. combustible_gas, ventilation).
- **unit** (String): Unit of measure (e.g. LEL%, bar, ppm).
- **equipment_id** (String, Foreign Key): References `equipment.equipment_id` (optional).
- **zone_id** (String, Foreign Key): References `zones.zone_id`.
- **min_value** (Float): Minimum physical range.
- **max_value** (Float): Maximum physical range.
- **threshold_warning** (Float): Warning level trigger.
- **threshold_critical** (Float): Critical level trigger.

---

## 4. Sensor Readings Table (`sensor_readings.csv`)
Time-series data for atmospheric conditions.
- **timestamp** (String): ISO date string.
- **sensor_id** (String, Foreign Key): References `sensors.sensor_id`.
- **value** (Float): Recorded scalar measurement.

---

## 5. Permits Table (`permits.csv`)
Safety clearances for high-risk operations.
- **permit_id** (String, Primary Key): Unique permit ID.
- **permit_number** (String): System permit number.
- **type** (String): Classification (e.g. HOT_WORK, CONFINED_SPACE).
- **zone_id** (String, Foreign Key): References `zones.zone_id`.
- **equipment_id** (String, Foreign Key): References `equipment.equipment_id` (optional).
- **worker_id** (String, Foreign Key): Supervisor lead.
- **status** (String): State (e.g. ACTIVE, REQUESTED, SUSPENDED).
- **start_time** (String): ISO start time.
- **end_time** (String): ISO end time.
- **hazards** (String): Safety risk warnings description.
- **controls** (String): Safety precautions list.

---

## 6. Workers Table (`workers.csv`)
Ledger of shift technicians.
- **worker_id** (String, Primary Key): Unique worker ID.
- **name** (String): Anonymous name.
- **badge_number** (String): Unique employee card number.
- **role** (String): Job category.
- **status** (String): Shift presence indicator (e.g. ON_DUTY, EVACUATED).

---

## 7. Compound Risk Windows Table (`compound_risk_windows.csv`)
Aggregated training labels for prediction modeling.
- **timestamp** (String): ISO date string.
- **zone_id** (String, Foreign Key): References `zones.zone_id`.
- **sensor_anomaly_score** (Float): Outlier deviation index (0 to 1).
- **active_permits** (Integer): Permit density count.
- **permit_overlap_count** (Integer): SIMOPS overlaps count.
- **worker_count** (Integer): Personnel density index.
- **worker_exposure_duration** (Float): Cumulative exposure minutes.
- **recent_near_miss_count** (Integer): Outlier safety reports count.
- **shift_change** (Integer): Binary shift boundary indicator (0 or 1).
- **risk_score** (Float): Ground truth joint risk index (0 to 100).
- **is_incident_imminent** (Integer, Classification Label): 1 if preceding a critical failure window, 0 otherwise.
