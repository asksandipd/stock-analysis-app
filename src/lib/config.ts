export const config = {
  apiBaseUrl: 'https://finnhub.io/api/v1',
  defaultTimeRange: '1D' as const,
  refreshInterval: 60000, // 1 minute
  maxRetries: 2,
  endpoints: {
    topGainers: 'stock/symbol',  // FinnHub endpoint for stock symbols
    quote: 'quote',              // FinnHub endpoint for real-time quotes
    candle: 'stock/candle',      // FinnHub endpoint for historical data
  },
  timeRangeIntervals: {
    '1D': '5',
    '5D': '15',
    '10D': '30',
    '1W': '30',
    '1M': '60',
    '6M': 'D',
  } as const,
};

export type Config = typeof config;

export function getApiKey(): string {
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_FINNHUB_API_KEY || '';
  }
  return process.env.NEXT_PUBLIC_FINNHUB_API_KEY || localStorage.getItem('FINNHUB_API_KEY') || '';
}

export function validateApiKey(apiKey: string): boolean {
  return apiKey.length > 0;
}

export function getApiBaseUrl(): string {
  return config.apiBaseUrl;
}