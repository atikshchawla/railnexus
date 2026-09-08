"use client";

import { useEffect, useState, useRef } from "react";

const WS_URL = "ws://localhost:8000/api/live";

export function useLiveSync(onMessage?: (type: string, payload: any) => void) {
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [status, setStatus] = useState<"connected" | "reconnecting" | "disconnected">("disconnected");
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const connect = () => {
      setStatus("reconnecting");
      const ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        setStatus("connected");
        setLastSynced(new Date());
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setLastSynced(new Date());
          if (data.type !== "TICK" && onMessage) {
            onMessage(data.type, data.payload);
          }
        } catch (e) {
          console.error("Failed to parse websocket message", e);
        }
      };

      ws.onclose = () => {
        setStatus("disconnected");
        // Reconnect after 3 seconds
        timeoutId = setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };

      wsRef.current = ws;
    };

    connect();

    return () => {
      clearTimeout(timeoutId);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [onMessage]);

  return { lastSynced, status };
}
