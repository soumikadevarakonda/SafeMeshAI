# SafeMesh AI
> **Industrial Safety Intelligence Platform for Zero-Harm Operations**

SafeMesh AI is a locally installable industrial safety platform that demonstrates how fusing disconnected real-time data streams—sensors, maintenance schedules, worker exposure logs, and safety permits—can detect dangerous compound hazardous states and predict incident warning lead-times significantly earlier than standard single-sensor baseline thresholds.

---

## Core Innovation
Instead of triggering an alarm only when a single toxic or combustible gas sensor crosses a critical threshold limit (e.g. 40% LEL), SafeMesh AI combines low-severity signals (combustible gas rising to 19.5% LEL + ventilation flow drop to 58% + active hot work permit + workers entering the zone) to calculate a joint probability of incident risk. This compound warning is triggered **26 minutes earlier** on typical test datasets, giving safety personnel critical lead-time to intervene and evacuate the sector.

---

## AI Safety Officer Decision Layer
SafeMesh AI features a modular **AI Safety Officer Decision Layer** (`app/safety_officer.py`) that acts as an experienced industrial safety officer:
1. **Sensor Intelligence**: Analyzes 30-minute sensor slopes and levels (gas, ventilation, vibration, pressure) to detect rising hazard trends.
2. **Operational Intelligence**: Intercepts active permits, worker count, exposure times, and detects SIMOPS (simultaneous operations) conflicts.
3. **Maintenance Intelligence**: Tracks asset health degradation and flags overdue safety maintenance schedules.
4. **Historical Intelligence**: Matches current zone profiles against historical precedent cases (e.g., the Visakhapatnam 2025 blast).
5. **Regulatory Intelligence**: Instantiates a local RAG engine (TF-IDF vector search) to fetch compliance rules, auditing current status against `SOP-COB-01` (welding rules) and `REG-CSF-12` (confined space rules).
6. **Decision Intelligence**: Fuses all assessments into a unified **Decision Object** (Incident Summary, Observations, Reasoning, SOP compliance audits, similar incidents, and prioritized mitigations).

---

## Monorepo Folder Structure

```
safemesh-ai/
  ├── frontend/             # React (Vite + TypeScript + Tailwind CSS)
  │     └── src/App.tsx     # CommandCenter dashboard, Live SVG Map, RAG Copilot, and Safety Officer Audit view
  ├── backend/              # Node.js Express service (Prisma + SQLite + Socket.IO)
  │     ├── prisma/         # Schema defining RiskEvent, Sensor, Worker, Permit tables
  │     └── src/services/   # Simulation loop and data synchronization pipelines
  ├── ai-service/           # Pure-Python ML and local RAG retrieval scripts
  │     ├── app/
  │     │    ├── scripts/   # Dataset generation, validation, training, and evaluation
  │     │    ├── safety_officer.py # Modular Decision Layer (Sensor, Operational, Maintenance, RAG check)
  │     │    └── models.py  # Logistic Regression & anomaly detection models
  │     └── models/         # Serialized RAG indexes and model parameters JSON
  ├── datasets/             # Local CSV databases and RAG safety documents (SOPs, regulations)
  ├── tests/                # Playwright E2E and unit test configurations
  └── README.md             # Standard operation manual
```

---

## Prerequisites
- **Node.js**: v20+ and npm
- **Python**: v3.11+
- **Git**

*Note: Due to the unavailability of active local Docker daemons or Visual Studio C++ compilers on standard Windows machines, the database has been designed to use SQLite (relative file `dev.db`), and all ML/RAG algorithms are written in dependency-free pure Python. This eliminates compiled binary dependencies (`pandas`, `numpy`, `scikit-learn`, `pydantic-core`) and guarantees instant execution out of the box.*

---

## Quick Start Installation & Bootstrap

Run these commands in PowerShell from the project root:

### 1. Initialize Database & Seed Entities
```powershell
cd backend
npm install
npx prisma db push
npx ts-node prisma/seed.ts
cd ..
```

### 2. Generate Synthetic Datasets & Run ML Training
```powershell
# 1. Generate correlated historical CSVs (110k+ rows)
python ai-service/app/scripts/generate_data.py

# 2. Run schema checks, split data, and audit leakage
python ai-service/app/scripts/validate_data.py

# 3. Fit Logistic Regression weights and z-score outlier params
python ai-service/train.py

# 4. Compile safety guidelines and index RAG vector search
python ai-service/ingest_rag.py

# 5. Populate SQLite tables with test split evaluation metrics
cd backend
npx ts-node src/scripts/seed-evaluation.ts
cd ..
```

### 3. Install Frontend Packages & Compile
```powershell
cd frontend
npm install
npm run build
cd ..
```

---

## How to Start Services

Open two separate terminal windows to run the servers:

### Terminal 1: Backend Express Service (Port 5000)
```powershell
cd backend
npm run dev
```

### Terminal 2: Frontend React Web Client (Port 3000)
```powershell
cd frontend
npm run dev
```

Open your browser to: **`http://localhost:3000`**

---

## Demonstration Credentials
- **Safety Officer:** `officer@safemesh.ai`
- **Control Room Operator:** `operator@safemesh.ai`
- **Password:** `password123`

---

## 5-7 Minute Demonstration Guide

Follow these steps to demonstrate the SafeMesh AI platform to a reviewer:

1. **Sign In**: Navigate to `http://localhost:3000` (or `http://localhost:3001`), click the `officer@safemesh.ai` helper shortcut, and sign in.
2. **Dashboard**: Observe the Plant Safety Score starts at a healthy **92.5%** with 0 active critical risks. Check the **AI Safety Officer Decision Cycle Stepper** showing `"SYSTEM STATUS: SECURE MONITORING"` and inspect the **Fused Ingestion Channels** widget displaying the 8 active data feeds integrated into the AI reasoning loop (plus CCTV marked as "Coming Soon").
3. **Trigger Simulation**: In the top header bar, click **Start Demo** to launch the **Coke Oven Gas Ignition** scenario.
4. **Observe Escalation**:
   - At **T+10 mins**, combustible gas begins to rise (12.5% LEL). Step 2 (Detect) of the Decision Cycle stepper lights up.
   - At **T+30 mins**, the extractor fan efficiency drops to 62%, and a ventilation warning is generated.
   - At **T+40 mins**, a Hot Work (welding) permit is authorized and becomes active in the Coke Oven sector.
   - At **T+50 mins**, workers enter the battery.
   - At **T+60 mins**, the hybrid model detects a **HIGH** risk (risk index spikes, zone turns Orange). The stepper advances to highlight Step 3 (Reason) and Step 4 (Recommend).
   - At **T+80 mins**, gas exceeds warning levels (24.5% LEL). The model triggers a **CRITICAL** risk (zone turns Red). Note that the single-sensor baseline alarm has still not fired (as it requires gas to hit 40% LEL).
5. **Investigate**: Click **Risk Intelligence** -> **Investigate** on the active Coke Oven Battery risk. 
6. **Ground Evidence**: In the Investigation panel, review the **AI Safety Officer Active Audit Dossier Card** (Officer ID `SO-992-AGY`). Read the generated Safety Officer Assessment (Observed Conditions and Reasoning & Risk Justification logs), audit the **SOP & Regulatory Compliance Audit** checklist (violations are highlighted in red), and view the **Historical Precedent Cases** matched by the model.
7. **Consult Copilot**: Click **Safety Copilot** and click the suggested question: *"Why is this zone critical and what should we do first?"* Read the grounded advice.
8. **Execute Intervention**: Return to the Investigation panel and click **Execute Intervention**.
9. **Mitigation**: Observe the evacuation logs update, the hot work permit get suspended, and the risk index safely decrease: `88 -> 72 -> 55 -> 38 -> 24`.
10. **Evaluation Lab**: Click **Evaluation Lab** to view the performance logs. Show that the compound model triggers alerts **26 minutes earlier** than the baseline threshold, with **100% recall** on test scenarios.
