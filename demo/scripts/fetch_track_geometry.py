import urllib.request
import json
import math
import heapq
import os

stations = [
  {"code": "AJJ", "lat": 13.0846, "lon": 79.6705},
  {"code": "SHU", "lat": 13.0141, "lon": 79.4863},
  {"code": "WJR", "lat": 12.9707, "lon": 79.3605},
  {"code": "MCN", "lat": 12.9510, "lon": 79.3175},
  {"code": "KPD", "lat": 12.9690, "lon": 79.1400},
  {"code": "GYM", "lat": 12.9463, "lon": 78.8723},
  {"code": "AB", "lat": 12.7916, "lon": 78.7162},
  {"code": "VN", "lat": 12.6816, "lon": 78.6204},
  {"code": "JTJ", "lat": 12.5707, "lon": 78.5736}
]

def haversine(lat1, lon1, lat2, lon2):
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

def fetch_railway_data(st1, st2):
    min_lat = min(st1['lat'], st2['lat']) - 0.03
    max_lat = max(st1['lat'], st2['lat']) + 0.03
    min_lon = min(st1['lon'], st2['lon']) - 0.03
    max_lon = max(st1['lon'], st2['lon']) + 0.03

    query = f"""
    [out:json];
    (
      way["railway"="rail"]({min_lat},{min_lon},{max_lat},{max_lon});
    );
    (._;>;);
    out body;
    """
    
    url = "https://overpass-api.de/api/interpreter"
    req = urllib.request.Request(url, data=query.encode('utf-8'), headers={'User-Agent': 'Mozilla/5.0'})
    
    with urllib.request.urlopen(req) as response:
        return json.loads(response.read().decode('utf-8'))

def build_graph(data):
    nodes = {}
    graph = {}
    
    for el in data['elements']:
        if el['type'] == 'node':
            nodes[el['id']] = (el['lat'], el['lon'])
            graph[el['id']] = {}
            
    for el in data['elements']:
        if el['type'] == 'way':
            if 'nodes' in el:
                way_nodes = el['nodes']
                for i in range(len(way_nodes) - 1):
                    n1 = way_nodes[i]
                    n2 = way_nodes[i+1]
                    if n1 in nodes and n2 in nodes:
                        dist = haversine(nodes[n1][0], nodes[n1][1], nodes[n2][0], nodes[n2][1])
                        graph[n1][n2] = dist
                        graph[n2][n1] = dist # undirected
                        
    return nodes, graph

def find_nearest_nodes(lat, lon, nodes, k=5):
    distances = []
    for node_id, (n_lat, n_lon) in nodes.items():
        d = haversine(lat, lon, n_lat, n_lon)
        distances.append((d, node_id))
    distances.sort(key=lambda x: x[0])
    return [node_id for d, node_id in distances[:k]]

def shortest_path(graph, start_nodes, end_nodes):
    # Multi-source multi-destination Dijkstra
    queue = []
    visited = set()
    
    for start in start_nodes:
        heapq.heappush(queue, (0, start, []))
        
    end_nodes_set = set(end_nodes)
    
    while queue:
        (cost, node, path) = heapq.heappop(queue)
        
        if node in visited:
            continue
            
        visited.add(node)
        path = path + [node]
        
        if node in end_nodes_set:
            return path
            
        for neighbor, weight in graph.get(node, {}).items():
            if neighbor not in visited:
                heapq.heappush(queue, (cost + weight, neighbor, path))
                
    return None

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

def main():
    import time
    results = {}
    
    for i in range(len(stations) - 1):
        st1 = stations[i]
        st2 = stations[i+1]
        
        print(f"Fetching data for {st1['code']} to {st2['code']}...")
        try:
            data = fetch_railway_data(st1, st2)
            nodes, graph = build_graph(data)
        except Exception as e:
            print("Failed to fetch or build graph for segment:", e)
            nodes, graph = {}, {}
            
        n1_list = find_nearest_nodes(st1['lat'], st1['lon'], nodes) if nodes else []
        n2_list = find_nearest_nodes(st2['lat'], st2['lon'], nodes) if nodes else []
        
        print(f"Finding path for {st1['code']} to {st2['code']}...")
        path_nodes = shortest_path(graph, n1_list, n2_list) if n1_list and n2_list else None
        
        if path_nodes:
            path_coords = [[nodes[n][0], nodes[n][1]] for n in path_nodes]
            path_coords.insert(0, [st1['lat'], st1['lon']])
            path_coords.append([st2['lat'], st2['lon']])
        else:
            print(f"Warning: No path found for {st1['code']} to {st2['code']}")
            # Interpolate a few points so the offset angle works properly
            path_coords = []
            for j in range(10):
                f = j / 9.0
                path_coords.append([
                    st1['lat'] + (st2['lat'] - st1['lat']) * f,
                    st1['lon'] + (st2['lon'] - st1['lon']) * f
                ])
                
        up, down = offset_path(path_coords)
        results[f"{st1['code']}-{st2['code']}"] = {
            "center": path_coords,
            "up": up,
            "down": down
        }
        time.sleep(10) # Prevent rate limiting by Overpass API
            
    out_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'frontend', 'src', 'assets'))
    os.makedirs(out_dir, exist_ok=True)
    out_file = os.path.join(out_dir, 'track_geometry.json')
    
    with open(out_file, 'w') as f:
        json.dump(results, f)
        
    print(f"Saved track geometry to {out_file}")

if __name__ == '__main__':
    main()
