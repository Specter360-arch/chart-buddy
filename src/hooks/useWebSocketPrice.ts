import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface LivePrice {
  symbol: string;
  price: number;
  timestamp: number;
  open?: number;
  high?: number;
  low?: number;
  change?: number;
  changePercent?: number;
  bid?: number;
  ask?: number;
}

interface UseWebSocketPriceResult {
  livePrice: LivePrice | null;
  isConnected: boolean;
  error: string | null;
  reconnect: () => void;
}

export const useWebSocketPrice = (
  symbol: string,
  enabled: boolean = true
): UseWebSocketPriceResult => {
  const [livePrice, setLivePrice] = useState<LivePrice | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);

  const connect = useCallback(() => {
    if (!enabled || !symbol) return;

    // Clean up existing connection
    if (wsRef.current) {
      wsRef.current.close();
    }

    try {
      const wsUrl = `wss://mdwulnqptzyzbuwwtcnr.supabase.co/functions/v1/market-data-ws?symbol=${encodeURIComponent(symbol)}`;
      console.log('Connecting to WebSocket:', wsUrl);
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected for', symbol);
        setIsConnected(true);
        setError(null);
        reconnectAttemptsRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'price') {
            setLivePrice({
              symbol: data.symbol,
              price: data.price,
              timestamp: data.timestamp || Date.now(),
              open: data.open,
              high: data.high,
              low: data.low,
              change: data.change,
              changePercent: data.changePercent,
              bid: data.bid,
              ask: data.ask,
            });
          } else if (data.type === 'error') {
            console.error('WebSocket error message:', data.message);
            setError(data.message);
          }
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e);
        }
      };

      ws.onerror = (event) => {
        console.error('WebSocket error:', event);
        setError('WebSocket connection error');
      };

      ws.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
        setIsConnected(false);
        wsRef.current = null;

        // Attempt reconnection with exponential backoff
        if (enabled && reconnectAttemptsRef.current < 5) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
          console.log(`Reconnecting in ${delay}ms...`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current++;
            connect();
          }, delay);
        }
      };
    } catch (e) {
      console.error('Failed to create WebSocket:', e);
      setError('Failed to connect');
    }
  }, [symbol, enabled]);

  const reconnect = useCallback(() => {
    reconnectAttemptsRef.current = 0;
    connect();
  }, [connect]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  // Reset when symbol changes
  useEffect(() => {
    setLivePrice(null);
    reconnectAttemptsRef.current = 0;
  }, [symbol]);

  return {
    livePrice,
    isConnected,
    error,
    reconnect,
  };
};
