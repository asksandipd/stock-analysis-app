'use client';

import { useState, useEffect, useCallback, useRef, KeyboardEvent } from 'react';
import { StockChart } from '@/components/charts/StockChart';
import { getTopGainers, getStockHistory, subscribeToRealtimeUpdates } from '@/lib/api/stockService';
import { config } from '@/lib/config';
import type { StockData, TimeRange } from '@/types/stock';
import { LoadingScreen } from '@/components/LoadingScreen';

export default function Dashboard() {
  const [topGainers, setTopGainers] = useState<StockData[]>([]);
  const [selectedStock, setSelectedStock] = useState<StockData | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>(config.defaultTimeRange);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const selectedIndexRef = useRef(0);

  const loadTopGainers = useCallback(async () => {
    setIsUpdating(true);
    try {
      const data = await getTopGainers();
      setTopGainers(data);
      if (data.length > 0 && !selectedStock) {
        setSelectedStock(data[0]);
      }
      setError(null);
      setLastUpdate(new Date());
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load data');
    } finally {
      setIsUpdating(false);
    }
  }, [selectedStock]);

  const loadStockHistory = useCallback(async () => {
    if (!selectedStock) return;
    try {
      const data = await getStockHistory(selectedStock.symbol, timeRange);
      setSelectedStock(prev => prev ? { ...prev, historicalData: data.historicalData } : data);
      setError(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load stock history');
    }
  }, [selectedStock?.symbol, timeRange]);

  const handleKeyPress = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if (!topGainers.length) return;

    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault();
        selectedIndexRef.current = Math.min(
          selectedIndexRef.current + 1,
          topGainers.length - 1
        );
        setSelectedStock(topGainers[selectedIndexRef.current]);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault();
        selectedIndexRef.current = Math.max(selectedIndexRef.current - 1, 0);
        setSelectedStock(topGainers[selectedIndexRef.current]);
        break;
      case 'r':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          loadTopGainers();
        }
        break;
    }
  }, [topGainers, loadTopGainers]);

  // Initialize data loading
  useEffect(() => {
    const initialize = async () => {
      try {
        setLoading(true);
        // Load top gainers first
        const gainers = await getTopGainers();
        setTopGainers(gainers);
        
        // If we have stocks, select the first one
        if (gainers.length > 0) {
          setSelectedStock(gainers[0]);
          // Immediately load its historical data
          const historyData = await getStockHistory(gainers[0].symbol, timeRange);
          // Merge the quote data with historical data
          setSelectedStock(prev => ({
            ...prev!,
            historicalData: historyData.historicalData
          }));
        }
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };
    
    initialize();
  }, []); // Run once on component mount

  // Auto-refresh interval
  useEffect(() => {
    const intervalId = setInterval(loadTopGainers, config.refreshInterval);
    return () => clearInterval(intervalId);
  }, [loadTopGainers]);

  // Real-time updates subscription
  useEffect(() => {
    const unsubscribes = topGainers.map(stock => 
      subscribeToRealtimeUpdates(stock.symbol, (updatedData) => {
        setTopGainers(current => 
          current.map(s => 
            s.symbol === updatedData.symbol 
              ? { ...s, 
                  currentPrice: updatedData.currentPrice,
                  percentageChange: updatedData.percentageChange,
                  volume: updatedData.volume 
                }
              : s
          )
        );
        
        if (selectedStock?.symbol === updatedData.symbol) {
          setSelectedStock(current => 
            current ? { ...current, 
              currentPrice: updatedData.currentPrice,
              percentageChange: updatedData.percentageChange,
              volume: updatedData.volume 
            } : null
          );
        }
        setLastUpdate(new Date());
      })
    );

    return () => {
      unsubscribes.forEach(unsubscribe => unsubscribe());
    };
  }, [topGainers.map(s => s.symbol).join(','), selectedStock?.symbol]);

  // Load historical data when stock or timeRange changes
  useEffect(() => {
    if (selectedStock) {
      setLoading(true); // Show loading state while fetching historical data
      loadStockHistory().finally(() => {
        setLoading(false); // Hide loading when complete (success or error)
      });
    }
  }, [selectedStock?.symbol, timeRange, loadStockHistory]);

  // Update selected index when stock changes
  useEffect(() => {
    if (selectedStock) {
      selectedIndexRef.current = topGainers.findIndex(
        stock => stock.symbol === selectedStock.symbol
      );
    }
  }, [selectedStock, topGainers]);

  if (loading) {
    return <LoadingScreen />;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => loadTopGainers()}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="container mx-auto px-4 py-8 focus-visible:outline-none"
      tabIndex={0}
      onKeyDown={handleKeyPress}
      role="application"
      aria-label="Stock Dashboard"
    >
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Top Stock Gainers</h1>
        <div className="flex items-center gap-4">
          {isUpdating && (
            <div className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-blue-500"></div>
              <span className="text-sm text-gray-600">Updating...</span>
            </div>
          )}
          {lastUpdate && (
            <p className="text-sm text-gray-600">
              Last updated: {lastUpdate.toLocaleTimeString()}
            </p>
          )}
          <button
            onClick={loadTopGainers}
            disabled={isUpdating}
            className="text-sm text-gray-600 hover:text-blue-500 disabled:opacity-50"
            title="Refresh data (Ctrl+R)"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-8" role="list">
        {topGainers.map((stock, index) => (
          <div
            key={stock.symbol}
            onClick={() => {
              setSelectedStock(stock);
              selectedIndexRef.current = index;
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setSelectedStock(stock);
                selectedIndexRef.current = index;
              }
            }}
            className={`stock-card p-4 rounded-lg cursor-pointer focus-visible:outline-none ${
              selectedStock?.symbol === stock.symbol
                ? 'selected bg-blue-500 text-white shadow-lg'
                : 'bg-white hover:bg-blue-50'
            }`}
            tabIndex={0}
            role="listitem"
            aria-selected={selectedStock?.symbol === stock.symbol}
          >
            <h3 className="font-bold">{stock.symbol}</h3>
            <p className={`text-lg price-change ${
              stock.currentPrice > (stock.historicalData[1]?.price ?? stock.currentPrice)
                ? 'price-change-up'
                : stock.currentPrice < (stock.historicalData[1]?.price ?? stock.currentPrice)
                ? 'price-change-down'
                : ''
            }`}>
              ${stock.currentPrice.toFixed(2)}
            </p>
            <p className={`price-change ${
              stock.percentageChange >= 0 
                ? 'text-green-500' 
                : 'text-red-500'
            } ${
              selectedStock?.symbol === stock.symbol 
                ? 'text-opacity-90' 
                : ''
            }`}>
              {stock.percentageChange > 0 ? '+' : ''}{stock.percentageChange.toFixed(2)}%
            </p>
            <p className={`text-sm mt-1 ${
              selectedStock?.symbol === stock.symbol 
                ? 'text-white/80' 
                : 'text-gray-600'
            }`}>
              Vol: {stock.volume.toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 mb-4" role="toolbar" aria-label="Time Range Controls">
        {Object.keys(config.timeRangeIntervals).map((range) => (
          <button
            key={range}
            onClick={() => setTimeRange(range as TimeRange)}
            className={`px-4 py-2 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
              timeRange === range
                ? 'bg-blue-500 text-white shadow'
                : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
            }`}
            aria-pressed={timeRange === range}
          >
            {range}
          </button>
        ))}
      </div>

      {selectedStock && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold" id="selected-stock-heading">
                {selectedStock.symbol}
              </h2>
              <p className="text-sm text-gray-600">
                Volume: {selectedStock.volume.toLocaleString()}
              </p>
            </div>
            <div className="text-right">
              <p className={`text-xl price-change ${
                selectedStock.currentPrice > (selectedStock.historicalData[1]?.price ?? selectedStock.currentPrice)
                  ? 'price-change-up'
                  : selectedStock.currentPrice < (selectedStock.historicalData[1]?.price ?? selectedStock.currentPrice)
                  ? 'price-change-down'
                  : ''
              }`}>
                ${selectedStock.currentPrice.toFixed(2)}
              </p>
              <p className={`price-change ${
                selectedStock.percentageChange >= 0 ? 'text-green-500' : 'text-red-500'
              }`}>
                {selectedStock.percentageChange > 0 ? '+' : ''}{selectedStock.percentageChange.toFixed(2)}%
              </p>
            </div>
          </div>
          <div aria-labelledby="selected-stock-heading">
            <StockChart data={selectedStock} timeRange={timeRange} />
          </div>
        </div>
      )}

      <div 
        className="fixed bottom-4 right-4 p-4 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200"
        role="complementary"
        aria-label="Keyboard Shortcuts"
      >
        <p className="text-sm text-gray-600 mb-2">Keyboard shortcuts:</p>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>← → Navigate stocks</li>
          <li>Enter or Space to select</li>
          <li>Ctrl+R Refresh data</li>
        </ul>
      </div>
    </div>
  );
}