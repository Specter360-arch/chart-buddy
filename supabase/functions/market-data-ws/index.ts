const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const { headers } = req;
  const upgradeHeader = headers.get('upgrade') || '';

  // Check if this is a WebSocket upgrade request
  if (upgradeHeader.toLowerCase() !== 'websocket') {
    return new Response('Expected WebSocket connection', { 
      status: 400,
      headers: corsHeaders 
    });
  }

  const url = new URL(req.url);
  const symbol = url.searchParams.get('symbol') || 'BTC/USD';
  
  console.log(`WebSocket connection requested for symbol: ${symbol}`);

  const { socket, response } = Deno.upgradeWebSocket(req);

  const apiKey = Deno.env.get('TWELVEDATA_API_KEY');
  
  if (!apiKey) {
    socket.onopen = () => {
      socket.send(JSON.stringify({ 
        type: 'error', 
        message: 'API key not configured' 
      }));
      socket.close();
    };
    return response;
  }

  let intervalId: number | null = null;
  let isOpen = false;

  socket.onopen = () => {
    console.log(`WebSocket opened for ${symbol}`);
    isOpen = true;
    
    // Send initial connection confirmation
    socket.send(JSON.stringify({ 
      type: 'connected', 
      symbol,
      timestamp: Date.now() 
    }));

    // Fetch price immediately
    fetchAndSendPrice();
    
    // Then poll every 5 seconds (Twelvedata free tier rate limit)
    intervalId = setInterval(fetchAndSendPrice, 5000);
  };

  async function fetchAndSendPrice() {
    if (!isOpen) return;
    
    try {
      // Use quote endpoint for more comprehensive real-time data
      const response = await fetch(
        `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(symbol)}&apikey=${apiKey}`
      );
      
      const data = await response.json();
      
      if (data.status === 'error') {
        console.error('Twelvedata quote error:', data);
        socket.send(JSON.stringify({ 
          type: 'error', 
          message: data.message || 'Failed to fetch price' 
        }));
        return;
      }

      const price = parseFloat(data.close);
      const open = parseFloat(data.open);
      const high = parseFloat(data.high);
      const low = parseFloat(data.low);
      const change = parseFloat(data.change);
      const changePercent = parseFloat(data.percent_change);
      
      if (!isNaN(price)) {
        socket.send(JSON.stringify({
          type: 'price',
          symbol,
          price,
          open,
          high,
          low,
          change,
          changePercent,
          timestamp: Date.now(),
        }));
        console.log(`Live quote sent for ${symbol}: ${price} (change: ${change})`);
      }
    } catch (error) {
      console.error('Error fetching price:', error);
      if (isOpen) {
        socket.send(JSON.stringify({ 
          type: 'error', 
          message: 'Failed to fetch live price' 
        }));
      }
    }
  }

  socket.onclose = () => {
    console.log(`WebSocket closed for ${symbol}`);
    isOpen = false;
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };

  socket.onerror = (error) => {
    console.error('WebSocket error:', error);
    isOpen = false;
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };

  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      console.log('Received message:', data);
      
      // Handle ping/pong for connection keepalive
      if (data.type === 'ping') {
        socket.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
      }
    } catch (e) {
      console.error('Failed to parse message:', e);
    }
  };

  return response;
});
