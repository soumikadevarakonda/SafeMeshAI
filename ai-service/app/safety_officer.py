import os
import json
import sqlite3
from datetime import datetime
from app.rag import LocalRAGEngine

class SensorIntelligence:
    """
    Analyzes real-time and historical sensor trends (slopes, deviations, critical threshold proximity).
    """
    def analyze(self, features):
        observations = []
        evidence = []
        is_risky = False
        
        # Flammable gas check
        gas_val = features.get("combustible_gas_val", 0.0)
        gas_slope = features.get("combustible_gas_slope_30m", 0.0)
        if gas_val > 5.0:
            status = "rising" if gas_slope > 0.01 else "steady"
            observations.append(f"Combustible gas is detected at {gas_val:.1f}% LEL and is {status} (slope: {gas_slope:.3f}).")
            evidence.append(f"Combustible gas reading: {gas_val:.1f}% LEL (trend: {status}).")
            if gas_val >= 15.0:
                is_risky = True

        # Ventilation check
        vent_val = features.get("ventilation_val", 100.0)
        vent_slope = features.get("ventilation_slope_30m", 0.0)
        if vent_val < 90.0:
            status = "deteriorating" if vent_slope < -0.01 else "degraded"
            observations.append(f"Ventilation flow efficiency has dropped to {vent_val:.1f}% and is {status} (slope: {vent_slope:.3f}).")
            evidence.append(f"Ventilation extraction efficiency: {vent_val:.1f}%.")
            if vent_val <= 70.0:
                is_risky = True

        # Oxygen levels
        oxy_val = features.get("oxygen_val", 20.9)
        if oxy_val < 19.5:
            observations.append(f"Oxygen concentration is deficient at {oxy_val:.1f}% (normal: 20.9%).")
            evidence.append(f"Oxygen reading: {oxy_val:.1f}%.")
            is_risky = True

        # Vibration & Pressure check
        vib_val = features.get("vibration_val", 0.0)
        press_val = features.get("pressure_val", 0.0)
        if vib_val >= 3.0 or press_val >= 120.0:
            observations.append(f"High mechanical stress detected: vibration is {vib_val:.1f} mm/s, pressure is {press_val:.1f} psi.")
            evidence.append(f"Mechanical stress: {vib_val:.1f} mm/s vibration, {press_val:.1f} psi pressure.")
            if vib_val >= 4.0 or press_val >= 150.0:
                is_risky = True

        return {
            "observations": observations,
            "evidence": evidence,
            "is_risky": is_risky
        }


class OperationalIntelligence:
    """
    Evaluates active permits, SIMOPS (Simultaneous Operations), and worker counts.
    """
    def analyze(self, features):
        observations = []
        evidence = []
        is_risky = False
        
        active_permits = int(features.get("active_permits", 0))
        has_hot_work = int(features.get("has_hot_work", 0))
        has_confined = int(features.get("has_confined_space", 0))
        worker_count = int(features.get("worker_count", 0))
        exposure_time = features.get("worker_exposure_duration", 0.0)
        
        if active_permits > 0:
            permit_types = []
            if has_hot_work: permit_types.append("HOT_WORK (Welding/Cutting)")
            if has_confined: permit_types.append("CONFINED_SPACE_ENTRY")
            observations.append(f"There are {active_permits} active safety permits in the zone: {', '.join(permit_types)}.")
            evidence.append(f"Active permits: {active_permits} ({', '.join(permit_types)}).")

        if worker_count > 0:
            observations.append(f"{worker_count} worker(s) are present in the zone with cumulative exposure duration of {exposure_time:.1f} minutes.")
            evidence.append(f"Worker count: {worker_count} (exposure: {exposure_time:.1f}m).")
            if worker_count >= 2:
                is_risky = True

        simops_conflict = int(features.get("simops_conflict", 0))
        if simops_conflict == 1:
            observations.append("Simultaneous Operations (SIMOPS) conflict identified: High-risk permits overlap in the same work zone.")
            evidence.append("SIMOPS permit overlap conflict detected.")
            is_risky = True

        return {
            "observations": observations,
            "evidence": evidence,
            "is_risky": is_risky,
            "has_hot_work": bool(has_hot_work),
            "has_confined": bool(has_confined),
            "worker_count": worker_count
        }


class MaintenanceIntelligence:
    """
    Analyzes equipment health indices and overdue schedules.
    """
    def analyze(self, features):
        observations = []
        evidence = []
        is_risky = False
        
        maint_overdue = int(features.get("maintenance_overdue", 0))
        health_avg = features.get("equipment_health_avg", 100.0)
        
        if maint_overdue > 0:
            observations.append(f"Alert: There are {maint_overdue} critical assets in the zone with overdue preventive maintenance.")
            evidence.append(f"Overdue maintenance assets: {maint_overdue}.")
            is_risky = True
            
        if health_avg < 80.0:
            observations.append(f"Average equipment mechanical health index is degraded at {health_avg:.1f}%.")
            evidence.append(f"Average asset health: {health_avg:.1f}%.")
            if health_avg < 70.0:
                is_risky = True

        return {
            "observations": observations,
            "evidence": evidence,
            "is_risky": is_risky
        }


class HistoricalIncidentIntelligence:
    """
    Correlates current conditions with historical incident and near-miss profiles.
    """
    def analyze(self, zone_id, features):
        similar_incidents = []
        observations = []
        
        gas_val = features.get("combustible_gas_val", 0.0)
        vent_val = features.get("ventilation_val", 100.0)
        has_hot_work = int(features.get("has_hot_work", 0))
        has_confined = int(features.get("has_confined_space", 0))
        maint_overdue = int(features.get("maintenance_overdue", 0))
        
        # Coke Oven Ignition Signature Match
        if "COB" in zone_id or "coke" in zone_id.lower():
            if gas_val > 10.0 or vent_val < 70.0:
                similar_incidents.append({
                    "title": "Visakhapatnam Coke Oven Battery Blast (2025)",
                    "date": "2025-01-12",
                    "cause": "Extractor fan failure led to gas pocket accumulation, which ignited during welding/hot work. 8 fatalities. Lessons: Prohibit SIMOPS welding during ventilation degradation."
                })
                similar_incidents.append({
                    "title": "Coke Oven Gas Flash Fire (2024)",
                    "date": "2024-04-12",
                    "cause": "Welding spark ignited pocket of CO gas. Exhaust fan extraction was degraded."
                })
                observations.append("Current gas and ventilation degradation matches signatures of the Visakhapatnam Coke Oven blast (2025).")
        
        # Confined Space Entry Signature Match
        if has_confined and features.get("oxygen_val", 20.9) < 19.5:
            similar_incidents.append({
                "title": "Confined Space Asphyxiation Incident (2023)",
                "date": "2023-08-22",
                "cause": "Worker entered nitrogen-purged boiler drum without adequate ventilation or oxygen check. Watcher failed to monitor. 2 fatalities."
            })
            observations.append("Oxygen deficiency with active confined space permit matches historical asphyxiation profiles.")

        # Mechanical line rupture signature
        if features.get("pressure_val", 0.0) > 130.0 or features.get("vibration_val", 0.0) > 4.0:
            similar_incidents.append({
                "title": "Compressor Blowout & Pipe Rupture (2024)",
                "date": "2024-11-05",
                "cause": "High discharge pressure coupled with overdue valve calibration. 1 injury, major plant downtime."
            })
            observations.append("High vibration and pressure values correlate with historical compressor blowout incidents.")

        return {
            "similarIncidents": similar_incidents,
            "observations": observations
        }


class RegulatoryIntelligence:
    """
    Retrieves plant SOPs/regulations via RAG and checks for compliance violations.
    """
    def __init__(self, models_dir):
        self.models_dir = models_dir
        self.rag = LocalRAGEngine()
        # Load the RAG index if available
        self.rag.load_index(models_dir)

    def analyze(self, features):
        regulatory_refs = []
        observations = []
        is_violated = False

        gas_val = features.get("combustible_gas_val", 0.0)
        vent_val = features.get("ventilation_val", 100.0)
        oxy_val = features.get("oxygen_val", 20.9)
        has_hot_work = int(features.get("has_hot_work", 0))
        has_confined = int(features.get("has_confined_space", 0))
        
        # Query RAG index for regulations
        search_query = "coke oven battery ventilation combustible gas hot work confined space oxygen entry"
        chunks = self.rag.retrieve(search_query, k=5)
        
        # Process regulatory constraints
        # 1. Indian Standards: OISD-STD-137 & Factories Act 1948 (Section 37 & 41A)
        if has_hot_work:
            violation_found = False
            clause = "OISD-STD-137 (Section 4.2) & Factories Act 1948 (Section 37): Hot Work (welding, cutting) is strictly prohibited in hazardous plant zones if ventilation extraction drops below 70% OR combustible gas exceeds 15% LEL."
            
            if vent_val < 70.0:
                is_violated = True
                violation_found = True
                observations.append(f"Statutory Violation [OISD-STD-137 / Factories Act 1948]: Hot work active while ventilation flow efficiency is {vent_val:.1f}% (< 70% mandatory limit).")
            
            if gas_val > 15.0:
                is_violated = True
                violation_found = True
                observations.append(f"Statutory Violation [OISD-STD-137 / Factories Act 1948]: Hot work active while combustible gas concentration is {gas_val:.1f}% LEL (> 15% LEL limit).")

            regulatory_refs.append({
                "doc_id": "OISD-STD-137 / Factories Act 1948",
                "section": "Section 37 (Explosive Gas Precautions) & OISD-STD-137 (Section 4.2)",
                "clause": clause,
                "status": "NON_COMPLIANT" if violation_found else "COMPLIANT"
            })
        else:
            regulatory_refs.append({
                "doc_id": "OISD-STD-137 / Factories Act 1948",
                "section": "Section 37: Explosive & Flammable Fume Regulations",
                "clause": "Ventilation systems must maintain continuous positive extraction to prevent gas pocket formation.",
                "status": "COMPLIANT"
            })

        # 2. DGMS (Tech) Circular No. 04 & Confined Space Entry
        if has_confined:
            oxy_violation = False
            clause = "DGMS Circular No. 04 / Factories Act Sec 36: Confined Space Entry prohibited if atmospheric oxygen drops below 19.5% Vol or toxic gas exceeds 25 PPM."
            
            if oxy_val < 19.5:
                is_violated = True
                oxy_violation = True
                observations.append(f"Statutory Violation [DGMS Circular No.04]: Confined space active under oxygen deficiency ({oxy_val:.1f}% Vol < 19.5% min).")

            regulatory_refs.append({
                "doc_id": "DGMS (Tech) Circular No. 04 / Factories Act Sec 36",
                "section": "Atmospheric Entry Standards in High-Hazard Units",
                "clause": clause,
                "status": "NON_COMPLIANT" if oxy_violation else "COMPLIANT"
            })

        # Augment with any relevant parsed RAG chunks
        for c in chunks[:2]:
            regulatory_refs.append({
                "doc_id": c.get("doc_id", "SOP-REF"),
                "section": c.get("title", "Standard Guidelines"),
                "clause": c.get("content", "")[:160] + "...",
                "status": "REFERENCE"
            })

        return {
            "regulatoryReferences": regulatory_refs,
            "observations": observations,
            "is_violated": is_violated
        }


from app.vision_provider import VisionIntelligence

class DecisionIntelligence:
    """
    Synthesizes reports from all modules and shapes the final Decision Object.
    """
    def synthesize(self, zone_id, sensor_report, op_report, maint_report, hist_report, reg_report, vision_report, risk_score, severity, confidence, lead_time, predicted_incident):
        # 1. Incident Summary
        if severity in ["HIGH", "CRITICAL"]:
            summary = f"Critical safety risk identified in {zone_id}: {predicted_incident} threat with active regulatory violations."
        elif severity == "MEDIUM":
            summary = f"Elevated safety alert in {zone_id}: parameters require operator inspection."
        else:
            summary = f"Operations in {zone_id} are within normal safety envelopes."

        # 2. Observations Compilation
        all_obs = []
        all_obs.extend(sensor_report["observations"])
        all_obs.extend(op_report["observations"])
        all_obs.extend(maint_report["observations"])
        all_obs.extend(hist_report["observations"])
        all_obs.extend(reg_report["observations"])
        
        # Add Vision Observations
        cctv_camera_id = None
        if vision_report:
            vision_summary_items = []
            for obs in vision_report:
                cctv_camera_id = obs.get("camera", "CAM-COB-01")
                vision_summary_items.append(f"{obs.get('type')} (Conf: {int(obs.get('confidence', 0)*100)}%)")
            if vision_summary_items:
                all_obs.append(f"Visual Evidence ({cctv_camera_id}): Detected {', '.join(vision_summary_items)}.")

        observations_str = " ".join(all_obs) if all_obs else "All sector parameters operating within stable, nominal baselines."

        # 3. Reasoning trail
        reasoning_steps = []
        if sensor_report["is_risky"]:
            reasoning_steps.append("1. Sensor feeds indicate critical threshold proximity or dangerous trends (e.g. rising gas, drop in extraction airflow).")
        if op_report["is_risky"]:
            reasoning_steps.append("2. High risk is compounded by operational factors: workers are exposed inside the danger zone under active hazard permits.")
        if maint_report["is_risky"]:
            reasoning_steps.append("3. Mechanical buffer is reduced due to degraded asset health scores or overdue maintenance routines.")
        if reg_report["is_violated"]:
            reasoning_steps.append("4. Immediate action is mandated due to direct violations of documented plant Safety SOPs.")
        if vision_report:
            reasoning_steps.append(f"5. Vision Intelligence ({cctv_camera_id or 'CCTV'}): Optical hazard detection confirms visual evidence of sector threat.")
        
        if reasoning_steps:
            reasoning_trail = (
                f"Risk state is calculated as {severity} ({risk_score:.1f}%) based on the following evidence chain:\n"
                + "\n".join(reasoning_steps) +
                f"\n\nLogical Conclusion: Immediate intervention is required to avoid a compound incident. Prediction lead-time is {lead_time} minutes."
            )
        else:
            reasoning_trail = f"Stable operational parameters verified. ML model reports nominal classification probability with confidence index of {confidence:.2f}."

        # 4. Action Recommendations
        recommendations = []
        if severity in ["HIGH", "CRITICAL"]:
            if op_report["has_hot_work"]:
                recommendations.append({
                    "title": "Suspend Hot Work Permit",
                    "priority": "HIGH",
                    "action": "Revoke active welding permit and clear ignition sources immediately.",
                    "mitigationImpact": "Eliminates immediate thermal ignition risk in gas-elevated area."
                })
            if sensor_report["is_risky"]:
                recommendations.append({
                    "title": "Override Auxiliary Extraction Fans",
                    "priority": "CRITICAL",
                    "action": "Increase Coke Oven Battery extractor fan speed to 100% manual override.",
                    "mitigationImpact": "Disperses combustible gas concentrations and restores safe airflow."
                })
            if op_report["worker_count"] > 0:
                recommendations.append({
                    "title": "Dispatch Sector Evacuation",
                    "priority": "CRITICAL",
                    "action": "Sound sector horn and order immediate evacuation of exposed personnel.",
                    "mitigationImpact": "Prevents worker exposure to flash fire or toxic inhalation hazards."
                })
        else:
            recommendations.append({
                "title": "Routine Checks",
                "action": "Maintain scheduled plant patrols and verify SCADA connection stability.",
                "priority": "LOW"
            })

        # 5. Formulate final decision object
        decision = {
            "incidentSummary": summary,
            "observations": observations_str,
            "reasoning": reasoning_trail,
            "recommendations": recommendations,
            "regulatoryReferences": reg_report["regulatoryReferences"],
            "similarIncidents": hist_report["similarIncidents"],
            "visionObservations": vision_report,
            "cctvCameraId": cctv_camera_id
        }
        return decision


class AISafetyOfficer:
    """
    Orchestrates the safety intelligence modules and integrates with predict.py.
    """
    def __init__(self, models_dir):
        self.models_dir = models_dir
        self.sensor_intel = SensorIntelligence()
        self.op_intel = OperationalIntelligence()
        self.maint_intel = MaintenanceIntelligence()
        self.hist_intel = HistoricalIncidentIntelligence()
        self.reg_intel = RegulatoryIntelligence(models_dir)
        self.vision_intel = VisionIntelligence()
        self.decision_intel = DecisionIntelligence()

    def observe_and_decide(self, zone_id, features, prediction_results, image_input=None):
        """
        Executes reasoning modules and fuses results with prediction engine values.
        """
        # Unpack prediction results
        risk_score = prediction_results["riskScore"]
        severity = prediction_results["severity"]
        confidence = prediction_results["confidence"]
        lead_time = prediction_results["leadTime"]
        predicted_incident = prediction_results["predictedIncident"]

        # Run modules
        sensor_report = self.sensor_intel.analyze(features)
        op_report = self.op_intel.analyze(features)
        maint_report = self.maint_intel.analyze(features)
        hist_report = self.hist_intel.analyze(zone_id, features)
        reg_report = self.reg_intel.analyze(features)
        vision_report = self.vision_intel.analyze(zone_id, image_input)

        # Synthesize final decision
        decision = self.decision_intel.synthesize(
            zone_id=zone_id,
            sensor_report=sensor_report,
            op_report=op_report,
            maint_report=maint_report,
            hist_report=hist_report,
            reg_report=reg_report,
            vision_report=vision_report,
            risk_score=risk_score,
            severity=severity,
            confidence=confidence,
            lead_time=lead_time,
            predicted_incident=predicted_incident
        )
        
        # Merge with prediction results to build complete extended contract
        decision_object = {**prediction_results, **decision}
        return decision_object
