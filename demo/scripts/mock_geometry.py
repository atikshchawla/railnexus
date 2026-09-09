import json
import math
import os

stations = [
  {'code': 'AJJ', 'lat': 13.0846, 'lon': 79.6705},
  {'code': 'SHU', 'lat': 13.0141, 'lon': 79.4863},
  {'code': 'WJR', 'lat': 12.9707, 'lon': 79.3605},
  {'code': 'MCN', 'lat': 12.9510, 'lon': 79.3175},
  {'code': 'KPD', 'lat': 12.9690, 'lon': 79.1400},
  {'code': 'GYM', 'lat': 12.9463, 'lon': 78.8723},
  {'code': 'AB', 'lat': 12.7916, 'lon': 78.7162},
  {'code': 'VN', 'lat': 12.6816, 'lon': 78.6204},
  {'code': 'JTJ', 'lat': 12.5707, 'lon': 78.5736}
]

def generate_curve(st1, st2, num_points=30, curve_amount=0.03):
    path = []
    mx = (st1['lat'] + st2['lat']) / 2.0
    my = (st1['lon'] + st2['lon']) / 2.0
    
    dx = st2['lat'] - st1['lat']
    dy = st2['lon'] - st1['lon']
    
    cx = mx - dy * curve_amount
    cy = my + dx * curve_amount
    
    for i in range(num_points):
        t = i / float(num_points - 1)
        lat = (1-t)**2 * st1['lat'] + 2*(1-t)*t*cx + t**2 * st2['lat']
        lon = (1-t)**2 * st1['lon'] + 2*(1-t)*t*cy + t**2 * st2['lon']
        path.append([lat, lon])
    return path

def offset_path(path, offset_meters=15):
    up_path = []
    down_path = []
    for i in range(len(path)):
        lat, lon = path[i]
        if i < len(path) - 1:
            next_lat, next_lon = path[i+1]
            dx = (next_lon - lon) * 108000
            dy = (next_lat - lat) * 111000
        elif i > 0:
            prev_lat, prev_lon = path[i-1]
            dx = (lon - prev_lon) * 108000
            dy = (lat - prev_lat) * 111000
        else:
            dx, dy = 1, 0
            
        length = math.sqrt(dx*dx + dy*dy)
        if length == 0:
            up_path.append([lat, lon])
            down_path.append([lat, lon])
            continue
            
        px = -dy / length
        py = dx / length
        
        d_lat = (py * offset_meters) / 111000
        d_lon = (px * offset_meters) / 108000
        
        up_path.append([lat + d_lat, lon + d_lon])
        down_path.append([lat - d_lat, lon - d_lon])
        
    return up_path, down_path

results = {}
for i in range(len(stations) - 1):
    st1 = stations[i]
    st2 = stations[i+1]
    
    curve_amount = 0.05 if i % 2 == 0 else -0.05
    path_coords = generate_curve(st1, st2, num_points=20, curve_amount=curve_amount)
    
    up, down = offset_path(path_coords)
    results[f"{st1['code']}-{st2['code']}"] = {
        'center': path_coords,
        'up': up,
        'down': down
    }

out_file = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'frontend', 'src', 'assets', 'track_geometry.json'))
with open(out_file, 'w') as f:
    json.dump(results, f)
print('Mock geometry saved to ' + out_file)
