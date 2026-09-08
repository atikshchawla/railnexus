import datetime

def parse_iso_to_ms(iso_str: str) -> float:
    dt = datetime.datetime.fromisoformat(iso_str.replace("Z", "+00:00"))
    return dt.timestamp() * 1000

def liang_barsky(x1: float, y1: float, x2: float, y2: float, xMin: float, xMax: float, yMin: float, yMax: float):
    """
    Port of liangBarsky from chart-engine.ts
    """
    dx = x2 - x1
    dy = y2 - y1
    p = [-dx, dx, -dy, dy]
    q = [x1 - xMin, xMax - x1, y1 - yMin, yMax - y1]
    
    t0 = 0.0
    t1 = 1.0

    for i in range(4):
        if p[i] == 0:
            if q[i] < 0:
                return None
        else:
            r = q[i] / p[i]
            if p[i] < 0:
                if r > t1: return None
                if r > t0: t0 = r
            else:
                if r < t0: return None
                if r < t1: t1 = r

    if t0 <= t1:
        return {
            "time": x1 + t0 * dx,
            "km": y1 + t0 * dy
        }
    return None

def rect_intersection(a: dict, b: dict):
    """
    Port of rectIntersection from chart-engine.ts
    Expects dicts with xMin, xMax, yMin, yMax
    """
    xOverlap = max(0, min(a["xMax"], b["xMax"]) - max(a["xMin"], b["xMin"]))
    yOverlap = max(0, min(a["yMax"], b["yMax"]) - max(a["yMin"], b["yMin"]))
    if xOverlap > 0 and yOverlap > 0:
        return {
            "overlapMinutes": round(xOverlap / 60000),
            "km": max(a["yMin"], b["yMin"]),
            "time": max(a["xMin"], b["xMin"])
        }
    return None

def detect_conflicts(blocks: list[dict], trains: list[dict]) -> list[dict]:
    """
    Detects conflicts between blocks and trains, and between different blocks.
    Returns a list of ConflictRecord dicts.
    """
    conflicts = []
    conflict_idx = 1
    
    # Block vs Train
    for block in blocks:
        if block.get("status") not in ("Approved", "Active", "Under review", "Draft"):
            continue
            
        b_loc = block.get("location", {})
        b_win = block.get("scheduledWindow", {})
        
        if not b_loc or not b_win:
            continue
            
        try:
            xMin = parse_iso_to_ms(b_win["start"])
            xMax = parse_iso_to_ms(b_win["end"])
            yMin = min(b_loc["kmStart"], b_loc["kmEnd"])
            yMax = max(b_loc["kmStart"], b_loc["kmEnd"])
        except Exception:
            continue
            
        # Treat point block as 1km span for intersection
        if yMin == yMax:
            yMax += 0.5
            yMin -= 0.5

        for train in trains:
            stops = train.get("stops", [])
            for i in range(len(stops) - 1):
                s1 = stops[i]
                s2 = stops[i+1]
                
                hit = liang_barsky(s1["time"], s1["km"], s2["time"], s2["km"], xMin, xMax, yMin, yMax)
                if hit:
                    # check duplicate
                    exists = any(c.get("blockAId") == block["id"] and c.get("blockBId") is None and c.get("trainId") == train["id"] for c in conflicts)
                    if not exists:
                        conflicts.append({
                            "id": f"CONF-{str(conflict_idx).zfill(3)}",
                            "blockAId": block["id"],
                            "blockBId": None,
                            "trainId": train["id"],
                            "overlapDescription": f"Conflicts with {train['type']} train {train['name']}",
                            "status": "Unresolved",
                            "windowStart": b_win["start"]
                        })
                        conflict_idx += 1
                        
    # Block vs Block
    for i in range(len(blocks)):
        for j in range(i + 1, len(blocks)):
            a = blocks[i]
            b = blocks[j]
            
            if a.get("status") not in ("Approved", "Active", "Under review", "Draft"): continue
            if b.get("status") not in ("Approved", "Active", "Under review", "Draft"): continue
            if a.get("department") == b.get("department"): continue
            
            a_loc = a.get("location", {})
            a_win = a.get("scheduledWindow", {})
            b_loc = b.get("location", {})
            b_win = b.get("scheduledWindow", {})
            
            if not a_loc or not a_win or not b_loc or not b_win: continue
            
            try:
                rect_a = {
                    "xMin": parse_iso_to_ms(a_win["start"]),
                    "xMax": parse_iso_to_ms(a_win["end"]),
                    "yMin": min(a_loc["kmStart"], a_loc["kmEnd"]),
                    "yMax": max(a_loc["kmStart"], a_loc["kmEnd"])
                }
                rect_b = {
                    "xMin": parse_iso_to_ms(b_win["start"]),
                    "xMax": parse_iso_to_ms(b_win["end"]),
                    "yMin": min(b_loc["kmStart"], b_loc["kmEnd"]),
                    "yMax": max(b_loc["kmStart"], b_loc["kmEnd"])
                }
            except Exception:
                continue
                
            hit = rect_intersection(rect_a, rect_b)
            if hit:
                conflicts.append({
                    "id": f"CONF-{str(conflict_idx).zfill(3)}",
                    "blockAId": a["id"],
                    "blockBId": b["id"],
                    "overlapDescription": f"{a['department']} {a.get('category')} vs {b['department']} {b.get('category')}",
                    "status": "Unresolved",
                    "windowStart": max(a_win["start"], b_win["start"])
                })
                conflict_idx += 1
                
    return conflicts
