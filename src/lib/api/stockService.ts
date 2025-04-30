import axios from 'axios';
import NodeCache from 'node-cache';
import { StockData, TimeRange } from '@/types/stock';
import { config, getApiKey } from '@/lib/config';

// Event emitter for real-time updates
type UpdateCallback = (data: StockData) => void;
const subscribers = new Map<string, Set<UpdateCallback>>();

const cache = new NodeCache({ stdTTL: 600, checkperiod: 120 }); // Cache TTL: 10 minutes

export async function fetchWithCache(url: string, options?: RequestInit): Promise<any> {
  const cachedData = cache.get(url);
  if (cachedData) {
    return cachedData;
  }

  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`Failed to fetch data from ${url}: ${response.statusText}`);
  }

  const data = await response.json();
  cache.set(url, data);
  return data;
}

async function makeApiRequest(endpoint: string, params: Record<string, string> = {}) {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('API key not found. Please set your Finnhub API key in settings.');
  }

  try {
    const response = await axios.get(`${config.apiBaseUrl}/${endpoint}`, {
      params: {
        ...params,
        token: apiKey
      }
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(`API request failed: ${error.message}`);
    }
    throw error;
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function getTopGainers(): Promise<StockData[]> {
  // Try to get from cache first to reduce API calls
  const cacheKey = 'topGainers';
  const cachedData = cache.get(cacheKey);
  if (cachedData) {
    console.log('Returning cached top gainers data');
    return cachedData as StockData[];
  }

  try {
    // First get list of stocks
    const symbolsData = await makeApiRequest(config.endpoints.topGainers, {
      exchange: 'US'  // Get US stocks
    });

    // Use known working symbols for testing if needed
    const knownSymbols = ['AAPL', 'MSFT', 'GOOGL'];
    
    // Then get quotes for top stocks, throttled to avoid rate limit
    const stockSymbols = symbolsData
      .filter((symbol: any) => symbol.type === 'Common Stock')
      .slice(0, 3);  // Take only 3 stocks to reduce API calls

    const stockData: StockData[] = [];
    for (const symbol of stockSymbols) {
      try {
        console.log('Requesting quote for symbol:', symbol.symbol);
        const quoteData = await makeApiRequest(config.endpoints.quote, {
          symbol: symbol.symbol
        });
        console.log('Received quote data for', symbol.symbol, ':', quoteData);
        if (quoteData && (quoteData.c || quoteData.currentPrice)) {
          stockData.push(transformStockData({ ...symbol, ...quoteData }));
        } else {
          console.warn('No quote data for symbol:', symbol.symbol, quoteData);
        }
      } catch (err) {
        console.error('Error fetching quote for symbol:', symbol.symbol, err);
      }
      await sleep(1500); // Wait 1.5 seconds between requests (was incorrectly set to 15000/15 seconds)
    }
    
    // If no stock data, try known working symbols
    if (stockData.length === 0) {
      console.log('Using fallback symbols');
      for (const symbol of knownSymbols) {
        try {
          console.log('Requesting quote for fallback symbol:', symbol);
          const quoteData = await makeApiRequest(config.endpoints.quote, { symbol });
          console.log('Received fallback quote data:', quoteData);
          stockData.push(transformStockData({ symbol, ...quoteData }));
          await sleep(1500); // Wait 1.5 seconds between requests (was incorrectly set to 15000)
        } catch (err) {
          console.error(`Fallback symbol ${symbol} also failed:`, err);
        }
      }
    }

    console.log('Final stock data to be returned:', stockData);
    
    // Cache the result to reduce future API calls
    if (stockData.length > 0) {
      cache.set(cacheKey, stockData);
    }
    
    return stockData;
  } catch (error) {
    console.error('Error fetching top gainers:', error);
    return [];
  }
}

export async function getStockHistory(symbol: string, timeRange: TimeRange): Promise<StockData> {
  // Create cache key for this specific request
  const cacheKey = `history_${symbol}_${timeRange}`;
  const cachedData = cache.get(cacheKey);
  if (cachedData) {
    console.log(`Returning cached data for ${symbol} with timeRange ${timeRange}`);
    return cachedData as StockData;
  }

  const resolution = config.timeRangeIntervals[timeRange];
  const now = Math.floor(Date.now() / 1000);
  const oneDay = 24 * 60 * 60;
  let from: number;

  // Calculate from timestamp based on timeRange
  switch (timeRange) {
    case '1D': from = now - oneDay; break;
    case '5D': from = now - (5 * oneDay); break;
    case '10D': from = now - (10 * oneDay); break;
    case '1W': from = now - (7 * oneDay); break;
    case '1M': from = now - (30 * oneDay); break;
    case '6M': from = now - (180 * oneDay); break;
    default: from = now - oneDay;
  }

  try {
    console.log(`Fetching stock history for ${symbol} with timeRange ${timeRange}`);
    console.log(`Time range: from=${from}, to=${now}, resolution=${resolution}`);
    
    const data = await makeApiRequest(config.endpoints.candle, {
      symbol,
      resolution,
      from: from.toString(),
      to: now.toString()
    });

    // Check if the data is valid
    console.log('Stock history API response:', data);
    
    if (data.s === 'no_data') {
      console.warn(`No data available for ${symbol} in the specified time range`);
      // Return empty data structure instead of throwing
      const emptyData: StockData = {
        symbol,
        currentPrice: 0,
        percentageChange: 0,
        volume: 0,
        historicalData: [],
        metrics: { pe: 0, marketCap: 0, high52Week: 0, low52Week: 0 }
      };
      return emptyData;
    }

    const stockData = transformHistoricalData(data, symbol);
    
    // Cache the result
    cache.set(cacheKey, stockData);
    
    return stockData;
  } catch (error) {
    console.error(`Error fetching stock history for ${symbol}:`, error);
    // Instead of re-throwing, return minimal valid data structure
    return {
      symbol,
      currentPrice: 0,
      percentageChange: 0,
      volume: 0,
      historicalData: [],
      metrics: { pe: 0, marketCap: 0, high52Week: 0, low52Week: 0 }
    };
  }
}

export function subscribeToRealtimeUpdates(symbol: string, callback: UpdateCallback): () => void {
  if (!subscribers.has(symbol)) {
    subscribers.set(symbol, new Set());
    initializeWebSocket(symbol);
  }
  
  const symbolSubscribers = subscribers.get(symbol)!;
  symbolSubscribers.add(callback);
  
  return () => {
    if (symbolSubscribers.has(callback)) {
      symbolSubscribers.delete(callback);
      if (symbolSubscribers.size === 0) {
        subscribers.delete(symbol);
        disconnectWebSocket(symbol);
      }
    }
  };
}

// WebSocket connection management
let ws: WebSocket | null = null;
const activeSymbols = new Set<string>();
let reconnectTimeout: NodeJS.Timeout;

function initializeWebSocket(symbol: string) {
  if (!ws || ws.readyState === WebSocket.CLOSED) {
    const apiKey = getApiKey();
    ws = new WebSocket(`wss://ws.finnhub.io?token=${apiKey}`);
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'trade') {
          const stockData = transformWebSocketData(data);
          const callbacks = subscribers.get(stockData.symbol);
          callbacks?.forEach(callback => callback(stockData));
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    };

    ws.onopen = () => {
      activeSymbols.forEach(subscribeToSymbol);
    };

    ws.onclose = () => {
      console.log('WebSocket connection closed. Attempting to reconnect...');
      scheduleReconnect();
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      scheduleReconnect();
    };
  }

  activeSymbols.add(symbol);
  if (ws.readyState === WebSocket.OPEN) {
    subscribeToSymbol(symbol);
  }
}

function disconnectWebSocket(symbol: string) {
  activeSymbols.delete(symbol);
  if (activeSymbols.size === 0 && ws) {
    ws.close();
    ws = null;
  }
}

function scheduleReconnect() {
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
  }
  reconnectTimeout = setTimeout(() => {
    if (activeSymbols.size > 0) {
      activeSymbols.forEach(initializeWebSocket);
    }
  }, 5000);
}

function subscribeToSymbol(symbol: string) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'subscribe', symbol: symbol }));
  }
}

function transformWebSocketData(data: any): StockData {
  const trade = data.data[0];
  return {
    symbol: trade.s,
    currentPrice: trade.p,
    percentageChange: 0, // Finnhub doesn't provide this in real-time trades
    volume: trade.v,
    historicalData: [],
    metrics: {
      pe: 0,
      marketCap: 0,
      high52Week: 0,
      low52Week: 0
    }
  };
}

function transformStockData(data: any): StockData {
  return {
    symbol: data.symbol,
    currentPrice: data.c || 0,
    percentageChange: data.dp || 0,
    volume: data.v || 0,
    historicalData: [],
    metrics: {
      pe: data.pe || 0,
      marketCap: data.marketCap || 0,
      high52Week: data.h || 0,
      low52Week: data.l || 0
    }
  };
}

function transformHistoricalData(data: any, symbol: string): StockData {
  // Check for "no_data" status which Finnhub returns when no data is available
  if (data.s === 'no_data' || !data.c || !data.t || data.c.length === 0) {
    console.warn(`Invalid or empty historical data format for ${symbol}`, data);
    return {
      symbol,
      currentPrice: 0,
      percentageChange: 0,
      volume: 0,
      historicalData: [],
      metrics: { pe: 0, marketCap: 0, high52Week: 0, low52Week: 0 }
    };
  }

  try {
    const historicalData = data.c.map((price: number, index: number) => ({
      timestamp: data.t[index] * 1000, // Convert to milliseconds
      price: price,
      volume: data.v && data.v[index] ? data.v[index] : 0
    }));

    const latestPrice = historicalData[historicalData.length - 1]?.price ?? 0;
    const previousPrice = historicalData[historicalData.length - 2]?.price ?? latestPrice;
    const percentageChange = previousPrice ? ((latestPrice - previousPrice) / previousPrice) * 100 : 0;

    // Calculate high/low values safely
    let high52Week = 0;
    let low52Week = 0;
    
    if (data.h && data.h.length > 0) {
      high52Week = Math.max(...data.h.filter((h: number) => typeof h === 'number' && !isNaN(h)));
    }
    
    if (data.l && data.l.length > 0) {
      low52Week = Math.min(...data.l.filter((l: number) => typeof l === 'number' && !isNaN(l)));
      // Ensure low isn't zero if we have valid data
      if (low52Week === 0 && data.l.some((l: number) => l > 0)) {
        low52Week = Math.min(...data.l.filter((l: number) => l > 0));
      }
    }

    return {
      symbol,
      currentPrice: latestPrice,
      percentageChange,
      volume: historicalData[historicalData.length - 1]?.volume ?? 0,
      historicalData,
      metrics: {
        pe: 0,
        marketCap: 0,
        high52Week,
        low52Week
      }
    };
  } catch (error) {
    console.error(`Error transforming historical data for ${symbol}:`, error);
    return {
      symbol,
      currentPrice: 0,
      percentageChange: 0,
      volume: 0,
      historicalData: [],
      metrics: { pe: 0, marketCap: 0, high52Week: 0, low52Week: 0 }
    };
  }
}