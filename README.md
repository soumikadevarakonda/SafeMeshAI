# SafeMesh AI
> **Industrial Safety Intelligence Platform for Zero-Harm Operations**

SafeMesh AI is a locally installable industrial safety platform that demonstrates how fusing disconnected real-time data streams—sensors, maintenance schedules, worker exposure logs, and safety permits—can detect dangerous compound hazardous states and predict incident warning lead-times significantly earlier than standard single-sensor baseline thresholds.

---

## Core Innovation
Instead of triggering an alarm only when a single toxic or combustible gas sensor crosses a critical threshold limit (e.g. 40% LEL), SafeMesh AI combines low-severity signals (combustible gas rising to 19.5% LEL + ventilation flow drop to 58% + active hot work permit + workers entering the zone) to calculate a joint probability of incident risk. This compound warning is triggered **26 minutes earlier** on typical test datasets, giving safety personnel critical lead-time to intervene and evacuate the sector.

---

## Monorepo Folder Structure

```
safemesh-ai/
  ├── frontend/             # React (Vite + TypeScript + Tailwind CSS)
  ├── backend/              # Node.js Express service (Prisma + SQLite + Socket.IO)
  ├── ai-service/           # Pure-Python ML and local RAG retrieval scripts
  │     ├── app/
  │     │    ├── scripts/   # Dataset generation, validation, training, and evaluation
  │     │    └── models.py  # Logistic Regression & anomaly detection models
  │     └── models/         # Serialized RAG indexes and model parameters JSON
  ├── datasets/             # Local CSV databases and RAG safety documents
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

1. **Sign In**: Navigate to `http://localhost:3000`, click the `officer@safemesh.ai` helper shortcut, and sign in.
2. **Dashboard**: Observe the Plant Safety Score starts at a healthy **92.5%** with 0 active critical risks.
3. **Trigger Simulation**: In the top header bar, click **Start Demo** to launch the **Coke Oven Gas Ignition** scenario.
4. **Observe Escalation**:
   - At **T+10 mins**, combustible gas begins to rise (12.5% LEL). Notice this remains below the critical warning limit of 20% LEL (no baseline alarm triggers).
   - At **T+30 mins**, the extractor fan efficiency drops to 62%, and a ventilation warning is generated.
   - At **T+40 mins**, a Hot Work (welding) permit is authorized and becomes active in the Coke Oven sector.
   - At **T+50 mins**, workers enter the battery.
   - At **T+60 mins**, the hybrid model detects a **HIGH** risk (risk index spikes, zone turns Orange).
   - At **T+80 mins**, gas exceeds warning levels (24.5% LEL). The model triggers a **CRITICAL** risk (zone turns Red). Note that the single-sensor baseline alarm has still not fired (as it requires gas to hit 40% LEL).
5. **Investigate**: Click **Risk Intelligence** -> **Investigate** on the active Coke Oven Battery risk. 
6. **Ground Evidence**: In the Investigation panel, review the contributing factors weights bar-chart and inspect the RAG-grounded safety references (SOP sections regarding SIMOPS constraints).
7. **Consult Copilot**: Click **Safety Copilot** and click the suggested question: *"Why is this zone critical and what should we do first?"* Read the grounded advice.
8. **Execute Intervention**: Return to the Investigation panel and click **Execute Intervention**.
9. **Mitigation**: Observe the evacuation logs update, the hot work permit get suspended, and the risk index safely decrease: `88 -> 72 -> 55 -> 38 -> 24`.
10. **Evaluation Lab**: Click **Evaluation Lab** to view the performance logs. Show that the compound model triggers alerts **26 minutes earlier** than the baseline threshold, with **100% recall** on test scenarios.
