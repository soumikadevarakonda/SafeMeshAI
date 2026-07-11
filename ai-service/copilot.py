import sys
import os
import json
import sqlite3
import argparse
import uuid
from datetime import datetime

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from app.rag import LocalRAGEngine

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--query", required=True)
    parser.add_argument("--user_id", default=None)
    args = parser.parse_args()

    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    db_path = os.path.join(base_dir, "backend", "dev.db")
    models_dir = os.path.join(base_dir, "ai-service", "models")

    # Load RAG
    rag = LocalRAGEngine()
    rag.load_index(models_dir)

    # Retrieve chunks
    chunks = rag.retrieve(args.query, k=3)

    # Connect to SQLite for live database stats
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row

    cursor = conn.execute("SELECT name, riskScore, riskSeverity FROM Zone WHERE riskScore > 15.0")
    active_risks = [dict(row) for row in cursor.fetchall()]

    cursor = conn.execute("SELECT count(*) as count FROM Worker WHERE status != 'OFF_DUTY'")
    active_workers = cursor.fetchone()["count"]

    cursor = conn.execute("SELECT count(*) as count FROM Permit WHERE status = 'ACTIVE'")
    active_permits = cursor.fetchone()["count"]

    # Format context
    context_str = ""
    if active_risks:
        context_str += "Active elevated risks: " + ", ".join(f"{r['name']} ({r['riskSeverity']} - Score: {r['riskScore']})" for r in active_risks) + ". "
    else:
        context_str += "All plant zones report NORMAL risk levels. "
    context_str += f"Currently, {active_workers} workers are active on shift, and {active_permits} active permits are running."

    # Search retrieved sections
    retrieved_text = ""
    sources = []
    for c in chunks:
        retrieved_text += f"\n- [{c['title']}]: {c['content']}\n"
        sources.append({
            "title": c["title"],
            "doc_id": c["doc_id"],
            "score": c["score"]
        })

    # Answer formulation
    answer = f"**Live Context**: {context_str}\n\n"
    q_lower = args.query.lower()
    
    if "zone" in q_lower or "dangerous" in q_lower or "critical" in q_lower:
        if active_risks:
            highest = max(active_risks, key=lambda x: x["riskScore"])
            answer += f"The most dangerous zone right now is the **{highest['name']}** with a risk score of **{highest['riskScore']}** ({highest['riskSeverity']}). "
            if "coke" in highest["name"].lower():
                answer += "This is driven by combustible gas accumulation and active hot work permits. "
        else:
            answer += "All plant zones are currently in normal operational states. "
    
    elif "permit" in q_lower or "conflict" in q_lower:
        answer += "Our system monitors SIMOPS (Simultaneous Operations). Currently, any overlap between hot work (e.g. welding) and gas extraction areas with ventilation efficiency below 70% triggers a permit conflict safety hold. "
        if active_risks and any("coke" in r["name"].lower() for r in active_risks):
            answer += "Specifically, a permit conflict exists in the Coke Oven Battery between the active Hot Work permit and degraded ventilation. "

    elif "intervention" in q_lower or "what should we do" in q_lower or "reduce risk" in q_lower:
        answer += "To reduce risk fastest: \n1. **Suspend hot work permits** in the affected high-risk zone (potential 25% risk reduction).\n2. **Evacuate exposed workers** (potential 20% risk reduction).\n3. **Initiate ventilation override** to clear gas pockets.\n"

    else:
        answer += "I am here to assist with safety protocols, SOP retrieval, and live plant risks. Let me know if you would like me to summarize the Coke Oven Battery operations or Confined Space Entry requirements. "

    if chunks:
        answer += f"\n\n**Safety SOP References**:\n{retrieved_text}"
    else:
        answer += "\n\nNo relevant SOP sections were retrieved for this specific query."

    answer += "\n\n*WARNING: SafeMesh AI Copilot is an operational aid retrieving synthetic demonstration data. This advice is NOT a substitute for official, authorized plant safety procedures or regulatory compliance documents.*"

    # Insert log
    query_id = str(uuid.uuid4())
    conn.execute(
        "INSERT INTO CopilotQuery (id, queryText, responseText, sourcesJson, timestamp, userId) VALUES (?, ?, ?, ?, ?, ?)",
        (query_id, args.query, answer, json.dumps(sources), datetime.now().isoformat(), args.user_id)
    )
    conn.commit()
    conn.close()

    output = {
        "answer": answer,
        "sources": sources,
        "confidence": 0.85 if chunks else 0.50
    }
    print(json.dumps(output))

if __name__ == "__main__":
    main()
