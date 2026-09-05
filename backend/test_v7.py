import sys
sys.path.insert(0, '.')
from backend.services.map_analyzer import analyzer

data = analyzer.analyze_image('backend/static/map.jpg')
print(f"\nFinal counts:")
print(f"  Houses: {len(data['houses'])}")
print(f"  Trees:  {len(data['trees'])}")  
print(f"  Cars:   {len(data['cars'])}")
