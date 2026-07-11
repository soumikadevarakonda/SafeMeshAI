# SafeMesh AI - Model Card

## 1. Model Details
- **Developer**: SafeMesh AI Engineering Team
- **Model Type**: Hybrid Classifier (Logistic Regression Classifier + Z-Score Anomaly Detector + Rule Engine)
- **Version**: v1.0.0
- **Trained At**: July 11, 2026

---

## 2. Intended Use
- **Primary Application**: Predict high-risk industrial safety conditions and imminent incident windows before single-sensor thresholds are crossed.
- **Target Audience**: Safety Officers, Control Room Operators, and Plant Managers.
- **Known Scope Constraints**: This is a prototype trained on correlated synthetic datasets. It is not certified for production deployment or direct safety-critical operations without exhaustive real-world validation.

---

## 3. Model Inputs & Features
The model consumes 36 engineered features across five main categories:
1. **Permits**: Active permits count, SIMOPS conflicts, hot work and confined space flags.
2. **Workers**: Total worker count, cumulative shift exposure minutes.
3. **Maintenance**: Overdue maintenance events, average equipment health index.
4. **Atmospheric Readings**: Current values, 30-min rolling averages, 30-min standard deviations, and linear slopes of Combustible Gas, Toxic Gas (H2S), Oxygen, ventilation efficiency, pressure, vibration, and temperature.
5. **Near Misses**: Safety report incident tallies in the last 24 hours.

---

## 4. Single-Sensor Baseline Definition
The comparison baseline is a standard threshold check:
- **Combustible Gas**: LEL% >= 40.0
- **Toxic Gas**: H2S >= 100.0 ppm
- **Oxygen**: <= 18.0%
- **Ventilation**: <= 50.0% efficiency
- **Pressure**: >= 90.0 bar
- **Vibration**: >= 10.0 mm/s
- **Temperature**: >= 950.0 °C

---

## 5. Metrics & Validation Results
Evaluated on an untouched chronological test split containing 1,527 time-series windows:

- **Accuracy**: 100.0%
- **Precision**: 100.0%
- **Recall**: 100.0%
- **Specificity**: 100.0%
- **F1 Score**: 100.0%
- **Average Compound Alert Warning Lead Time**: **38.5 minutes**
- **Average Baseline Alert Warning Lead Time**: **12.5 minutes**
- **Average Warning Lead Time Improvement**: **+26.0 minutes**

### Analysis:
By evaluating multiple low-severity anomalies collectively (e.g. gas rising to 19.5% LEL + ventilation dropping to 58% + active hot work permit + workers present), the SafeMesh AI model successfully triggers a CRITICAL compound risk warning **26 minutes earlier** than the baseline threshold alarm.
