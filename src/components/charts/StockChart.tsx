import { createChart, IChartApi, Time, SeriesDefinition, ColorType } from 'lightweight-charts';
import { useEffect, useRef, useState } from 'react';
import type { StockData, TimeRange } from '@/types/stock';
import { defaultChartOptions } from './chartConfig';
import { subscribeToRealtimeUpdates } from '@/lib/api/stockService';

interface StockChartProps {
  data: StockData;
  timeRange: TimeRange;
}

const lineSeriesDefinition: SeriesDefinition<'Line'> = {
  type: 'Line',
  isBuiltIn: true,
  defaultOptions: {
    color: '#2962FF',
    lineWidth: 2,
    lineStyle: 0,
    lineType: 0,
    lineVisible: true,
    pointMarkersVisible: false,
    crosshairMarkerVisible: true,
    crosshairMarkerRadius: 4,
    crosshairMarkerBorderColor: '#2962FF',
    crosshairMarkerBackgroundColor: '#ffffff',
    crosshairMarkerBorderWidth: 2,
    lastPriceAnimation: 1, // Enable price animation for real-time updates
  },
};

const volumeSeriesDefinition: SeriesDefinition<'Line'> = {
  type: 'Line',
  isBuiltIn: true,
  defaultOptions: {
    color: '#26a69a',
    lineWidth: 1,
    lineStyle: 0,
    lineType: 0,
    lineVisible: true,
    pointMarkersVisible: false,
    crosshairMarkerVisible: false,
    crosshairMarkerRadius: 4,
    crosshairMarkerBorderColor: '#26a69a',
    crosshairMarkerBackgroundColor: '#ffffff',
    crosshairMarkerBorderWidth: 2,
    lastPriceAnimation: 0,
  },
};

export function StockChart({ data, timeRange }: StockChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<any>(null);
  const volumeSeriesRef = useRef<any>(null);
  const [hoveredData, setHoveredData] = useState<{ price: string; volume: string } | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const [noData, setNoData] = useState<boolean>(false);

  // Create or update chart when container is available
  useEffect(() => {
    if (!chartContainerRef.current) return;
    
    // Check if we have any data to display
    if (!data || !data.historicalData || data.historicalData.length === 0) {
      setNoData(true);
      return;
    }
    
    setNoData(false);
    console.log('Chart data available:', data.symbol, data.historicalData.length, 'points');
    
    // Create chart if it doesn't exist
    if (!chartRef.current) {
      const chart = createChart(chartContainerRef.current, {
        ...defaultChartOptions,
        width: chartContainerRef.current.clientWidth,
        height: 400,
        layout: {
          ...defaultChartOptions.layout,
          background: { type: ColorType.Solid, color: 'white' },
        },
      });
      
      const priceSeries = chart.addSeries(lineSeriesDefinition);
      const volumeSeries = chart.addSeries(volumeSeriesDefinition);
      
      seriesRef.current = priceSeries;
      volumeSeriesRef.current = volumeSeries;
      chartRef.current = chart;

      // Set price scale options
      chart.applyOptions({
        rightPriceScale: {
          scaleMargins: {
            top: 0.1,
            bottom: 0.2,
          },
          visible: true,
        },
      });
      
      chart.subscribeCrosshairMove(param => {
        if (!param.point) {
          setHoveredData(null);
          return;
        }
        
        const priceData = param.seriesData.get(priceSeries);
        const volumeData = param.seriesData.get(volumeSeries);

        if (priceData && 'value' in priceData && volumeData && 'value' in volumeData) {
          setHoveredData({
            price: `$${priceData.value.toFixed(2)}`,
            volume: volumeData.value.toLocaleString(),
          });
        } else {
          setHoveredData(null);
        }
      });

      // Handle responsive resizing with a debounce
      let resizeTimeout: NodeJS.Timeout;
      resizeObserverRef.current = new ResizeObserver(entries => {
        if (entries[0]) {
          if (resizeTimeout) clearTimeout(resizeTimeout);
          resizeTimeout = setTimeout(() => {
            const { width } = entries[0].contentRect;
            chart.applyOptions({ width });
            chart.timeScale().fitContent();
          }, 100);
        }
      });

      resizeObserverRef.current.observe(chartContainerRef.current);
    }
    
    // Always update the data (whether chart is new or existing)
    updateChartData(data);

    // Cleanup function
    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
    };
  }, [data?.symbol]); // Only recreate chart when symbol changes

  // Function to update chart data
  const updateChartData = (stockData: StockData) => {
    if (!seriesRef.current || !volumeSeriesRef.current || !stockData.historicalData.length) return;
    
    try {
      const mappedData = stockData.historicalData.map(item => ({
        time: (item.timestamp / 1000) as Time, 
        value: item.price,
      }));

      const volumeData = stockData.historicalData.map(item => ({
        time: (item.timestamp / 1000) as Time,
        value: item.volume,
      }));
      
      console.log(`Updating chart with ${mappedData.length} data points for ${stockData.symbol}`);
      seriesRef.current.setData(mappedData);
      volumeSeriesRef.current.setData(volumeData);
      
      if (chartRef.current) {
        chartRef.current.timeScale().fitContent();
      }
    } catch (err) {
      console.error("Error updating chart data:", err);
    }
  };

  // Update data without recreating chart when historical data changes
  useEffect(() => {
    if (data?.historicalData?.length) {
      updateChartData(data);
      setNoData(false);
    } else {
      setNoData(true);
    }
  }, [data?.historicalData, timeRange]);
  
  // Subscribe to real-time updates
  useEffect(() => {
    if (!data?.symbol) return;
    
    const unsubscribe = subscribeToRealtimeUpdates(data.symbol, (updatedData) => {
      if (seriesRef.current) {
        seriesRef.current.update({
          time: (Date.now() / 1000) as Time,
          value: updatedData.currentPrice,
        });
      }
    });
    
    return () => unsubscribe();
  }, [data?.symbol]);
  
  // Clean up chart when component unmounts
  useEffect(() => {
    return () => {
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
        seriesRef.current = null;
        volumeSeriesRef.current = null;
      }
    };
  }, []);

  return (
    <div className="relative w-full h-[400px]">
      <div className="w-full h-full bg-white rounded-lg shadow-md" ref={chartContainerRef}>
        {noData && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80">
            <div className="text-center">
              <p className="text-gray-500 mb-2">No historical data available for {data?.symbol}</p>
              <p className="text-sm text-gray-400">Try another time range</p>
            </div>
          </div>
        )}
      </div>
      {hoveredData && (
        <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-lg shadow-md border border-gray-200">
          <p className="text-sm font-medium">Price: {hoveredData.price}</p>
          <p className="text-sm text-gray-600">Volume: {hoveredData.volume}</p>
        </div>
      )}
    </div>
  );
}