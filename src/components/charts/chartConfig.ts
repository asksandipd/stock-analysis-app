import { DeepPartial, ChartOptions } from 'lightweight-charts';

export const defaultChartOptions: DeepPartial<ChartOptions> = {
  layout: {
    background: { color: 'white' },
    textColor: '#333333',
    fontSize: 12,
    fontFamily: 'Inter, system-ui, sans-serif',
  },
  grid: {
    vertLines: { color: '#f0f0f0' },
    horzLines: { color: '#f0f0f0' },
  },
  crosshair: {
    mode: 1,
    vertLine: {
      width: 1,
      color: '#2962FF',
      style: 2,
      labelBackgroundColor: '#2962FF',
    },
    horzLine: {
      width: 1,
      color: '#2962FF',
      style: 2,
      labelBackgroundColor: '#2962FF',
    },
  },
  timeScale: {
    borderColor: '#f0f0f0',
    timeVisible: true,
    secondsVisible: false,
    rightOffset: 12,
    barSpacing: 12,
    minBarSpacing: 8,
    fixLeftEdge: true,
    lockVisibleTimeRangeOnResize: true,
  },
  rightPriceScale: {
    borderColor: '#f0f0f0',
    scaleMargins: {
      top: 0.1,
      bottom: 0.1,
    },
  },
  handleScroll: {
    mouseWheel: true,
    pressedMouseMove: true,
    horzTouchDrag: true,
    vertTouchDrag: true,
  },
  handleScale: {
    axisPressedMouseMove: {
      time: true,
      price: true,
    },
    mouseWheel: true,
    pinch: true,
  },
};