const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TwelveDataQuote {
  symbol: string;
  name: string;
  exchange: string;
  datetime: string;
  timestamp: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  previous_close: string;
  change: string;
  percent_change: string;
}

interface TwelveDataTimeSeries {
  meta: {
    symbol: string;
    interval: string;
    currency: string;
    exchange_timezone: string;
    exchange: string;
    type: string;
  };
  values: Array<{
    datetime: string;
    open: string;
    high: string;
    low: string;
    close: string;
    volume?: string;
  }>;
  status: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('TWELVEDATA_API_KEY');
    if (!apiKey) {
      console.error('TWELVEDATA_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Twelvedata API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action, symbol, interval, outputsize } = await req.json();
    console.log(`Market data request: action=${action}, symbol=${symbol}, interval=${interval}`);

    const baseUrl = 'https://api.twelvedata.com';

    if (action === 'quote') {
      // Get real-time quote
      const response = await fetch(
        `${baseUrl}/quote?symbol=${encodeURIComponent(symbol)}&apikey=${apiKey}`
      );
      const data = await response.json();

      if (data.status === 'error') {
        console.error('Twelvedata quote error:', data);
        return new Response(
          JSON.stringify({ success: false, error: data.message || 'Failed to fetch quote' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Quote fetched for ${symbol}`);
      return new Response(
        JSON.stringify({ success: true, data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'time_series') {
      // Get historical OHLCV data
      const size = outputsize || 100;
      const timeInterval = interval || '1day';

      const response = await fetch(
        `${baseUrl}/time_series?symbol=${encodeURIComponent(symbol)}&interval=${timeInterval}&outputsize=${size}&apikey=${apiKey}`
      );
      const data: TwelveDataTimeSeries = await response.json();

      if (data.status === 'error') {
        console.error('Twelvedata time_series error:', data);
        return new Response(
          JSON.stringify({ success: false, error: (data as any).message || 'Failed to fetch time series' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Transform data to our format
      const candleData = data.values?.map((v) => ({
        time: v.datetime.split(' ')[0], // Get date part only
        open: parseFloat(v.open),
        high: parseFloat(v.high),
        low: parseFloat(v.low),
        close: parseFloat(v.close),
        volume: v.volume ? parseFloat(v.volume) : 0,
      })).reverse(); // Reverse to get chronological order

      console.log(`Time series fetched for ${symbol}: ${candleData?.length || 0} candles`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          data: candleData,
          meta: data.meta
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'batch_quote') {
      // Get quotes for multiple symbols
      const symbols = Array.isArray(symbol) ? symbol.join(',') : symbol;
      
      const response = await fetch(
        `${baseUrl}/quote?symbol=${encodeURIComponent(symbols)}&apikey=${apiKey}`
      );
      const data = await response.json();

      console.log(`Batch quote fetched for ${symbols}`);
      return new Response(
        JSON.stringify({ success: true, data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Invalid action. Use: quote, time_series, or batch_quote' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Market data error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch market data';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
