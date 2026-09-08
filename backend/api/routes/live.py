import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from backend.api.routes.blocks import broadcaster

router = APIRouter()

@router.websocket("/live")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    q = asyncio.Queue()
    broadcaster.add_queue(q)
    try:
        while True:
            # Send periodic pings to keep connection alive or send ticks
            try:
                message = await asyncio.wait_for(q.get(), timeout=30.0)
                await websocket.send_json(message)
            except asyncio.TimeoutError:
                await websocket.send_json({"type": "TICK"})
    except WebSocketDisconnect:
        broadcaster.remove_queue(q)
    except Exception:
        broadcaster.remove_queue(q)
