export interface StockData {
  symbol: string;
  currentPrice: number;
  percentageChange: number;
  volume: number;
  historicalData: HistoricalData[];
  metrics: StockMetrics;
}

export interface HistoricalData {
  timestamp: number;
  price: number;
  volume: number;
}

export interface StockMetrics {
  pe: number;
  marketCap: number;
  high52Week: number;
  low52Week: number;
}

export type TimeRange = '1D' | '5D' | '10D' | '1W' | '1M' | '6M';