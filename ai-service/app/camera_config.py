"""
Centralized Zone-to-Camera Mapping Configuration.
Avoids scattering hardcoded camera strings across the codebase.
"""

ZONE_CAMERA_MAPPING = {
    "ZONE-COB": {
        "cameraId": "CAM-COB-01",
        "cameraName": "Coke Oven East Inspection Camera",
        "location": "Battery Top Operations Deck",
        "modelEndpoint": "industrialhazards/1"
    },
    "ZONE-BF": {
        "cameraId": "CAM-BF-02",
        "cameraName": "Blast Furnace Stockhouse Camera",
        "location": "Skip Hoist Deck",
        "modelEndpoint": "industrialhazards/1"
    },
    "ZONE-GS": {
        "cameraId": "CAM-GS-01",
        "cameraName": "Gas Storage Tank Yard Camera",
        "location": "Tank 3 Perimeter",
        "modelEndpoint": "industrialhazards/1"
    },
    "ZONE-BH": {
        "cameraId": "CAM-BH-01",
        "cameraName": "Boiler House Control Deck Camera",
        "location": "High Pressure Steam Header",
        "modelEndpoint": "industrialhazards/1"
    }
}

DEFAULT_CAMERA = {
    "cameraId": "CAM-GENERIC-01",
    "cameraName": "Generic Industrial Facility Camera",
    "location": "Sector Perimeter Deck",
    "modelEndpoint": "industrialhazards/1"
}

def get_camera_for_zone(zone_code: str) -> dict:
    """Returns the central camera metadata dict for a given zone code."""
    return ZONE_CAMERA_MAPPING.get(zone_code, DEFAULT_CAMERA)
