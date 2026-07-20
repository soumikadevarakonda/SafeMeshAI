import os
import json
import urllib.request
import urllib.error
from abc import ABC, abstractmethod
from typing import List, Dict, Any
from app.camera_config import get_camera_for_zone

class VisionProvider(ABC):
    """Abstract base class for vision inference providers."""
    
    @abstractmethod
    def analyze_frame(self, zone_code: str, image_input: str = None) -> List[Dict[str, Any]]:
        """
        Analyzes a camera frame or image input.
        Returns a clean list of structured observation objects:
        [
            {
                "type": "Smoke" | "No Helmet" | "Fire" | "Chemical Hazard" | "Water Leak",
                "confidence": 0.92,
                "camera": "CAM-COB-01",
                "location": "Battery Top Operations Deck"
            }
        ]
        """
        pass

class MockVisionProvider(VisionProvider):
    """
    Deterministic offline fallback provider.
    Guarantees 100% demo reliability if network or API keys are unavailable.
    """
    
    def analyze_frame(self, zone_code: str, image_input: str = None) -> List[Dict[str, Any]]:
        camera = get_camera_for_zone(zone_code)
        
        # Deterministic mock visual observations based on scenario zones
        if zone_code == "ZONE-COB":
            return [
                {
                    "type": "Smoke",
                    "confidence": 0.92,
                    "camera": camera["cameraId"],
                    "cameraName": camera["cameraName"],
                    "location": camera["location"],
                    "bbox": [180, 120, 240, 160]
                },
                {
                    "type": "No Helmet",
                    "confidence": 0.89,
                    "camera": camera["cameraId"],
                    "cameraName": camera["cameraName"],
                    "location": camera["location"],
                    "bbox": [310, 220, 60, 60]
                }
            ]
        elif zone_code == "ZONE-GS":
            return [
                {
                    "type": "Chemical Hazard",
                    "confidence": 0.85,
                    "camera": camera["cameraId"],
                    "cameraName": camera["cameraName"],
                    "location": camera["location"],
                    "bbox": [100, 200, 150, 100]
                }
            ]
        
        return []

class RoboflowVisionProvider(VisionProvider):
    """
    Hosted Roboflow Inference API Provider.
    Queries Universe Roboflow project: industrialhazards/1
    """
    
    def __init__(self, api_key: str = None):
        self.api_key = api_key or os.environ.get("ROBOFLOW_API_KEY")
        self.fallback = MockVisionProvider()
        
    def analyze_frame(self, zone_code: str, image_input: str = None) -> List[Dict[str, Any]]:
        # If API key is missing or no valid online credentials, fallback seamlessly
        if not self.api_key:
            return self.fallback.analyze_frame(zone_code, image_input)
            
        camera = get_camera_for_zone(zone_code)
        endpoint = f"https://detect.roboflow.com/{camera['modelEndpoint']}?api_key={self.api_key}"
        
        try:
            # If image_input is base64 or URL, post to Roboflow hosted API
            if image_input:
                req = urllib.request.Request(
                    endpoint,
                    data=image_input.encode('utf-8'),
                    headers={'Content-Type': 'application/x-www-form-urlencoded'}
                )
                with urllib.request.urlopen(req, timeout=3) as response:
                    res_data = json.loads(response.read().decode('utf-8'))
                    predictions = res_data.get("predictions", [])
                    
                    parsed_obs = []
                    for p in predictions:
                        parsed_obs.append({
                            "type": p.get("class"),
                            "confidence": round(float(p.get("confidence", 0.0)), 2),
                            "camera": camera["cameraId"],
                            "cameraName": camera["cameraName"],
                            "location": camera["location"],
                            "bbox": [p.get("x"), p.get("y"), p.get("width"), p.get("height")]
                        })
                    return parsed_obs
            else:
                # If no image string provided in CLI mode, return fallback
                return self.fallback.analyze_frame(zone_code, image_input)
        except Exception as e:
            # On any network/API error or timeout, switch safely to fallback
            print(f"[VisionProvider Warning] Roboflow API call failed ({e}). Switching to mock fallback.")
            return self.fallback.analyze_frame(zone_code, image_input)

class VisionIntelligence:
    """
    Vision Intelligence Module.
    Encapsulates vision provider access and presents clean observation objects.
    Contains no business logic or safety decision rules.
    """
    
    def __init__(self, provider: VisionProvider = None):
        self.provider = provider or RoboflowVisionProvider()
        
    def analyze(self, zone_code: str, image_input: str = None) -> List[Dict[str, Any]]:
        """Returns structured vision observations for the given zone."""
        return self.provider.analyze_frame(zone_code, image_input)
