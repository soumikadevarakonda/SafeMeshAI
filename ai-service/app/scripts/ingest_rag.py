import os
from app.rag import LocalRAGEngine

def main():
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
    docs_dir = os.path.join(base_dir, "datasets", "rag-documents")
    save_dir = os.path.join(base_dir, "ai-service", "models")
    
    print("Ingesting RAG documents pipeline starting...")
    rag = LocalRAGEngine()
    rag.ingest_directory(docs_dir, save_dir)
    print("RAG document ingestion completed successfully!")

if __name__ == "__main__":
    main()
