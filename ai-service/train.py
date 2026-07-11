import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from app.models import SafetyModels

def main():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    train_path = os.path.join(base_dir, "datasets", "splits", "compound_risk_train.csv")
    val_path = os.path.join(base_dir, "datasets", "splits", "compound_risk_validation.csv")
    save_dir = os.path.join(base_dir, "ai-service", "models")
    
    print("Training models pure-Python pipeline starting...")
    models = SafetyModels()
    models.train(train_path, val_path, save_dir)
    print("Training pure-Python models finished successfully!")

if __name__ == "__main__":
    main()
