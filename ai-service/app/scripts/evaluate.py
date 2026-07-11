import os
from app.evaluation import run_evaluation_pipeline

def main():
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
    test_path = os.path.join(base_dir, "datasets", "splits", "compound_risk_test.csv")
    models_dir = os.path.join(base_dir, "ai-service", "models")
    output_dir = os.path.join(base_dir, "ai-service", "models")
    
    print("Running model evaluation pipeline...")
    metrics = run_evaluation_pipeline(test_path, models_dir, output_dir)
    print("Evaluation pipeline completed successfully!")

if __name__ == "__main__":
    main()
