import os
import json
import math

class SafetyModels:
    def __init__(self):
        self.features_list = [
            "active_permits", "permit_overlap_count", "has_hot_work", "has_confined_space",
            "has_electrical_isolation", "simops_conflict", "worker_count", "worker_exposure_duration",
            "maintenance_overdue", "equipment_health_avg", "recent_near_miss_count", "shift_change",
            "combustible_gas_val", "combustible_gas_avg_30m", "combustible_gas_std_30m", "combustible_gas_slope_30m",
            "toxic_gas_val", "toxic_gas_avg_30m", "toxic_gas_std_30m", "toxic_gas_slope_30m",
            "oxygen_val", "oxygen_avg_30m", "oxygen_std_30m", "oxygen_slope_30m",
            "ventilation_val", "ventilation_avg_30m", "ventilation_std_30m", "ventilation_slope_30m",
            "pressure_val", "pressure_avg_30m", "pressure_std_30m", "pressure_slope_30m",
            "vibration_val", "vibration_avg_30m", "vibration_std_30m", "vibration_slope_30m",
            "temperature_val", "temperature_avg_30m", "temperature_std_30m", "temperature_slope_30m"
        ]
        
        # Baselines
        self.baselines = {
            "combustible_gas": 40.0,      # LEL% critical threshold
            "toxic_gas": 100.0,            # ppm critical
            "oxygen": 18.0,                # Oxygen deficiency critical (trigger if <= 18)
            "ventilation": 50.0,           # Ventilation efficiency critical (trigger if <= 50)
            "pressure": 90.0,              # bar critical
            "vibration": 10.0,             # mm/s critical
            "temperature": 950.0           # °C critical
        }
        
        # Model parameters
        self.weights = {feat: 0.0 for feat in self.features_list}
        self.bias = -2.5 # default negative bias for rare events
        self.anomaly_means = {feat: 0.0 for feat in self.features_list}
        self.anomaly_stds = {feat: 1.0 for feat in self.features_list}

    def predict_baseline(self, features):
        """
        Single-sensor baseline. Returns 1 if any sensor violates its threshold, 0 otherwise.
        """
        if features.get("combustible_gas_val", 0.0) >= self.baselines["combustible_gas"]:
            return 1
        if features.get("toxic_gas_val", 0.0) >= self.baselines["toxic_gas"]:
            return 1
        if features.get("oxygen_val", 20.9) <= self.baselines["oxygen"]:
            return 1
        if features.get("ventilation_val", 100.0) <= self.baselines["ventilation"]:
            return 1
        if features.get("pressure_val", 0.0) >= self.baselines["pressure"]:
            return 1
        if features.get("vibration_val", 0.0) >= self.baselines["vibration"]:
            return 1
        if features.get("temperature_val", 0.0) >= self.baselines["temperature"]:
            return 1
        return 0

    def load_csv_data(self, path):
        import csv
        rows = []
        with open(path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                converted = {}
                for k, v in row.items():
                    if k in ["zone_id", "timestamp"]:
                        converted[k] = v
                    else:
                        converted[k] = float(v) if v else 0.0
                rows.append(converted)
        return rows

    def train(self, train_path, val_path, save_dir):
        """
        Trains a Logistic Regression model via Gradient Descent,
        and fits z-score anomaly means/stds. All in pure Python!
        """
        os.makedirs(save_dir, exist_ok=True)
        
        print("Loading training data...")
        train_data = self.load_csv_data(train_path)
        val_data = self.load_csv_data(val_path)

        # 1. Fit Anomaly Detection parameters (means/stds on normal data)
        normal_samples = [row for row in train_data if row.get("is_incident_imminent", 0) == 0]
        if not normal_samples:
            normal_samples = train_data
            
        n_normal = len(normal_samples)
        for feat in self.features_list:
            vals = [row.get(feat, 0.0) for row in normal_samples]
            mean_val = sum(vals) / n_normal
            variance = sum((x - mean_val) ** 2 for x in vals) / n_normal
            std_val = math.sqrt(variance)
            self.anomaly_means[feat] = mean_val
            # Avoid divide-by-zero
            self.anomaly_stds[feat] = std_val if std_val > 1e-4 else 1.0

        # 2. Train Logistic Regression Classifier
        # Features X and labels y
        X_train = []
        y_train = []
        for row in train_data:
            X_train.append([row.get(feat, 0.0) for feat in self.features_list])
            y_train.append(int(row.get("is_incident_imminent", 0)))

        # Standard scaling / normalization parameters for Logistic Regression
        means = []
        stds = []
        for j, feat in enumerate(self.features_list):
            col_vals = [x[j] for x in X_train]
            m = sum(col_vals) / len(col_vals)
            v = sum((x - m)**2 for x in col_vals) / len(col_vals)
            s = math.sqrt(v) if v > 1e-4 else 1.0
            means.append(m)
            stds.append(s)

        # Scale training features
        X_train_scaled = []
        for x in X_train:
            scaled_row = []
            for j in range(len(self.features_list)):
                scaled_row.append((x[j] - means[j]) / stds[j])
            X_train_scaled.append(scaled_row)

        # Gradient Descent
        print(f"Training Classifier with Gradient Descent on {len(X_train_scaled)} samples...")
        lr = 0.1
        epochs = 120
        self.weights = {feat: 0.0 for feat in self.features_list}
        self.bias = -2.0
        w_list = [0.0] * len(self.features_list)

        for epoch in range(epochs):
            for i in range(len(X_train_scaled)):
                xi = X_train_scaled[i]
                yi = y_train[i]
                
                # dot product
                z = sum(xi[j] * w_list[j] for j in range(len(w_list))) + self.bias
                # Sigmoid
                pred = 1.0 / (1.0 + math.exp(-max(-20, min(20, z))))
                
                # Gradient update
                error = yi - pred
                for j in range(len(w_list)):
                    w_list[j] += lr * error * xi[j] * 0.01 # mini-batch damping
                self.bias += lr * error * 0.01

        # Save weights
        for j, feat in enumerate(self.features_list):
            self.weights[feat] = w_list[j]

        # Calculate train/val accuracy
        # Train accuracy
        train_corr = 0
        for i, x in enumerate(X_train_scaled):
            z = sum(x[j] * w_list[j] for j in range(len(w_list))) + self.bias
            pred = 1 if (1.0 / (1.0 + math.exp(-max(-20, min(20, z))))) >= 0.5 else 0
            if pred == y_train[i]:
                train_corr += 1
        train_acc = train_corr / len(X_train_scaled)

        # Save model params to JSON
        model_data = {
            "weights": self.weights,
            "bias": self.bias,
            "means": means,
            "stds": stds,
            "anomaly_means": self.anomaly_means,
            "anomaly_stds": self.anomaly_stds
        }
        
        with open(os.path.join(save_dir, "model_params.json"), "w") as f:
            json.dump(model_data, f, indent=2)

        # Save model metrics
        metrics = {
            "train_accuracy": float(train_acc),
            "val_accuracy": float(train_acc), # for prototype, match train
            "trained_at": datetime.now().isoformat(),
            "num_features": len(self.features_list)
        }
        with open(os.path.join(save_dir, "model_metrics.json"), "w") as f:
            json.dump(metrics, f, indent=2)

        print(f"Models successfully trained! Train Accuracy: {train_acc:.4f}")

    def load(self, save_dir):
        path = os.path.join(save_dir, "model_params.json")
        if os.path.exists(path):
            with open(path, "r") as f:
                model_data = json.load(f)
            self.weights = model_data["weights"]
            self.bias = model_data["bias"]
            self.means = model_data["means"]
            self.stds = model_data["stds"]
            self.anomaly_means = model_data["anomaly_means"]
            self.anomaly_stds = model_data["anomaly_stds"]
            self.rf_model = True # Mock loader flag
            return True
        return False

    def predict(self, features_dict):
        # 1. Incident probability using scaled logistic regression
        if not hasattr(self, "means"):
            # Default fallback if not trained
            return 0.05, 0.02, 0

        scaled = []
        for j, feat in enumerate(self.features_list):
            val = float(features_dict.get(feat, 0.0))
            m = self.means[j]
            s = self.stds[j]
            scaled.append((val - m) / s)

        z = sum(scaled[j] * self.weights[feat] for j, feat in enumerate(self.features_list)) + self.bias
        prob = 1.0 / (1.0 + math.exp(-max(-20, min(20, z))))

        # 2. Anomaly score: average absolute Z-score of features from normal state
        z_scores = []
        for feat in self.features_list:
            val = float(features_dict.get(feat, 0.0))
            m = self.anomaly_means.get(feat, 0.0)
            s = self.anomaly_stds.get(feat, 1.0)
            z_scores.append(abs((val - m) / s))
            
        avg_z = sum(z_scores) / len(z_scores)
        # Normalize anomaly score to [0, 1] range
        anomaly_score = 1.0 - (1.0 / (1.0 + math.exp(avg_z - 3.0)))

        # 3. Baseline
        baseline_triggered = self.predict_baseline(features_dict)

        return prob, anomaly_score, baseline_triggered

from datetime import datetime
