import os
import sys

# Include root folder in python search path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.camera_config import get_camera_for_zone
from app.vision_provider import VisionIntelligence, MockVisionProvider, RoboflowVisionProvider

def test_camera_config():
    print("Testing centralized camera configuration...")
    cob_cam = get_camera_for_zone("ZONE-COB")
    assert cob_cam["cameraId"] == "CAM-COB-01"
    assert cob_cam["cameraName"] == "Coke Oven East Inspection Camera"
    print("Camera config test passed!")

def test_vision_provider_fallback():
    print("Testing VisionIntelligence mock fallback...")
    vision = VisionIntelligence(RoboflowVisionProvider(api_key=None)) # Force fallback
    obs = vision.analyze("ZONE-COB")
    
    assert len(obs) == 2
    types = [o["type"] for o in obs]
    assert "Smoke" in types
    assert "No Helmet" in types
    assert obs[0]["camera"] == "CAM-COB-01"
    print("Vision provider fallback test passed!")

if __name__ == "__main__":
    test_camera_config()
    test_vision_provider_fallback()
    print("All Vision tests passed successfully!")
