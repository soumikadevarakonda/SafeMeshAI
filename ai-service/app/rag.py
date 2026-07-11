import os
import json
import math

class LocalRAGEngine:
    def __init__(self):
        self.chunks = []
        self.idf = {}
        # Stopwords
        self.stopwords = {
            'the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'to', 'of', 'in', 'at', 
            'on', 'for', 'with', 'by', 'about', 'as', 'into', 'through', 'during', 'under', 'over', 'of', 'this', 'that'
        }

    def tokenize(self, text):
        # simple alphabetic tokenization
        words = []
        word = []
        for char in text.lower():
            if char.isalnum():
                word.append(char)
            else:
                if word:
                    words.append("".join(word))
                    word = []
        if word:
            words.append("".join(word))
        return [w for w in words if w not in self.stopwords]

    def ingest_directory(self, docs_dir, save_dir):
        """
        Ingests SOP markdown documents from directory, chunks them, and builds TF-IDF index.
        """
        os.makedirs(save_dir, exist_ok=True)
        chunks_collected = []

        if os.path.exists(docs_dir):
            for filename in os.listdir(docs_dir):
                if filename.endswith(".md") or filename.endswith(".txt"):
                    filepath = os.path.join(docs_dir, filename)
                    title = filename.replace(".md", "").replace(".txt", "").replace("_", " ").title()
                    
                    with open(filepath, "r", encoding="utf-8") as f:
                        content = f.read()
                    
                    # Split into paragraphs
                    paragraphs = [p.strip() for p in content.split("\n\n") if len(p.strip()) > 30]
                    for idx, para in enumerate(paragraphs):
                        chunks_collected.append({
                            "doc_id": filename,
                            "title": title,
                            "content": para,
                            "chunk_index": idx
                        })
                        
        if not chunks_collected:
            # Fallback seed chunk
            chunks_collected.append({
                "doc_id": "fallback.md",
                "title": "Default Plant Regulations",
                "content": "All operations in hazardous zones require active personal protective equipment (PPE). Atmospheric gas levels must be monitored continuously.",
                "chunk_index": 0
            })

        self.chunks = chunks_collected
        n_docs = len(self.chunks)

        # 1. Compute DF (Document Frequency)
        df_counts = {}
        chunk_tfs = []

        for chunk in self.chunks:
            tokens = self.tokenize(chunk["content"])
            tf_dict = {}
            if tokens:
                for t in tokens:
                    tf_dict[t] = tf_dict.get(t, 0.0) + 1.0
                # normalize TF by document length
                tot = len(tokens)
                for t in tf_dict:
                    tf_dict[t] = tf_dict[t] / tot
            
            chunk_tfs.append(tf_dict)
            
            # unique terms in this chunk
            for t in set(tokens):
                df_counts[t] = df_counts.get(t, 0.0) + 1.0

        # 2. Compute IDF
        self.idf = {}
        for term, df in df_counts.items():
            # Standard smooth IDF formula
            self.idf[term] = math.log(1.0 + (n_docs / (1.0 + df)))

        # 3. Compute TF-IDF and normalize vectors to unit length
        self.tfidf_vectors = []
        for tf_dict in chunk_tfs:
            tfidf_vec = {}
            vector_len_sq = 0.0
            
            for term, tf in tf_dict.items():
                val = tf * self.idf[term]
                tfidf_vec[term] = val
                vector_len_sq += val ** 2
                
            vector_len = math.sqrt(vector_len_sq)
            if vector_len > 1e-6:
                for term in tfidf_vec:
                    tfidf_vec[term] /= vector_len
                    
            self.tfidf_vectors.append(tfidf_vec)

        # Save to JSON index file
        index_data = {
            "chunks": self.chunks,
            "idf": self.idf,
            "tfidf_vectors": self.tfidf_vectors
        }
        with open(os.path.join(save_dir, "rag_index.json"), "w", encoding="utf-8") as f:
            json.dump(index_data, f, indent=2)
            
        print(f"Pure-Python: Indexed {len(self.chunks)} safety chunks.")

    def load_index(self, save_dir):
        path = os.path.join(save_dir, "rag_index.json")
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                index_data = json.load(f)
            self.chunks = index_data["chunks"]
            self.idf = index_data["idf"]
            self.tfidf_vectors = index_data["tfidf_vectors"]
            return True
        return False

    def retrieve(self, query, k=3):
        """
        Retrieves top K chunks matching the query text.
        """
        if not self.chunks or not self.idf:
            return []

        query_tokens = self.tokenize(query)
        if not query_tokens:
            return []

        # Vectorize query
        q_tf = {}
        for t in query_tokens:
            q_tf[t] = q_tf.get(t, 0.0) + 1.0
            
        tot = len(query_tokens)
        q_tfidf = {}
        q_len_sq = 0.0
        
        for term, count in q_tf.items():
            if term in self.idf:
                val = (count / tot) * self.idf[term]
                q_tfidf[term] = val
                q_len_sq += val ** 2
                
        q_len = math.sqrt(q_len_sq)
        if q_len > 1e-6:
            for term in q_tfidf:
                q_tfidf[term] /= q_len

        # Compute cosine similarities (dot product since both are unit normalized)
        results = []
        for idx, doc_vector in enumerate(self.tfidf_vectors):
            similarity = 0.0
            for term, val in q_tfidf.items():
                if term in doc_vector:
                    similarity += val * doc_vector[term]
            
            if similarity > 0.02:
                chunk = self.chunks[idx].copy()
                chunk["score"] = round(similarity, 3)
                results.append(chunk)

        # Sort descending by score
        results = sorted(results, key=lambda x: x["score"], reverse=True)
        return results[:k]
