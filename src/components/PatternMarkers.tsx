import { useEffect, useRef, useCallback } from 'react';
import { IChartApi, ISeriesApi, Time } from 'lightweight-charts';
import { PatternSignal } from '@/stores/patternStore';

interface PatternMarkersProps {
  chart: IChartApi | null;
  series: ISeriesApi<any> | null;
  patterns: PatternSignal[];
  selectedPatternId?: string | null;
  onPatternClick?: (pattern: PatternSignal) => void;
}

export const PatternMarkers = ({
  chart,
  series,
  patterns,
  selectedPatternId,
  onPatternClick,
}: PatternMarkersProps) => {
  const markersRef = useRef<HTMLDivElement[]>([]);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Create marker element
  const createMarkerElement = useCallback((pattern: PatternSignal) => {
    const marker = document.createElement('div');
    marker.className = 'pattern-marker';
    marker.style.cssText = `
      position: absolute;
      cursor: pointer;
      transition: transform 0.15s ease, opacity 0.15s ease;
      z-index: 10;
      pointer-events: auto;
    `;

    const isBullish = pattern.patternType === 'bullish';
    const isBearish = pattern.patternType === 'bearish';
    const isSelected = pattern.id === selectedPatternId;
    
    // Size based on confidence
    const size = 8 + Math.floor(pattern.confidence * 12);
    
    // Arrow SVG
    const arrowColor = isBullish ? '#22c55e' : isBearish ? '#ef4444' : '#eab308';
    const arrowDirection = isBullish ? 'up' : isBearish ? 'down' : 'diamond';
    
    let svgContent = '';
    if (arrowDirection === 'up') {
      svgContent = `
        <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none">
          <path d="M12 4L4 16H20L12 4Z" fill="${arrowColor}" stroke="${isSelected ? '#fff' : 'none'}" stroke-width="2"/>
        </svg>
      `;
    } else if (arrowDirection === 'down') {
      svgContent = `
        <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none">
          <path d="M12 20L4 8H20L12 20Z" fill="${arrowColor}" stroke="${isSelected ? '#fff' : 'none'}" stroke-width="2"/>
        </svg>
      `;
    } else {
      svgContent = `
        <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none">
          <path d="M12 2L22 12L12 22L2 12L12 2Z" fill="${arrowColor}" stroke="${isSelected ? '#fff' : 'none'}" stroke-width="2"/>
        </svg>
      `;
    }

    marker.innerHTML = `
      <div style="position: relative; display: flex; flex-direction: column; align-items: center;">
        ${svgContent}
        ${isSelected ? `
          <div style="
            position: absolute;
            bottom: 100%;
            left: 50%;
            transform: translateX(-50%);
            margin-bottom: 4px;
            background: rgba(0,0,0,0.9);
            border: 1px solid ${arrowColor};
            border-radius: 6px;
            padding: 6px 10px;
            white-space: nowrap;
            font-size: 11px;
            color: #fff;
            z-index: 100;
            pointer-events: none;
          ">
            <div style="font-weight: 600; color: ${arrowColor}; text-transform: uppercase;">
              ${pattern.patternName.replace(/_/g, ' ')}
            </div>
            <div style="color: #9ca3af; margin-top: 2px;">
              Confidence: ${(pattern.confidence * 100).toFixed(0)}%
            </div>
          </div>
        ` : ''}
      </div>
    `;

    marker.addEventListener('click', (e) => {
      e.stopPropagation();
      onPatternClick?.(pattern);
    });

    marker.addEventListener('mouseenter', () => {
      marker.style.transform = 'scale(1.2)';
    });

    marker.addEventListener('mouseleave', () => {
      marker.style.transform = 'scale(1)';
    });

    return marker;
  }, [selectedPatternId, onPatternClick]);

  // Update marker positions
  const updateMarkerPositions = useCallback(() => {
    if (!chart || !series || !containerRef.current) return;

    const timeScale = chart.timeScale();
    const chartElement = chart.chartElement();
    
    if (!chartElement) return;

    markersRef.current.forEach((marker, index) => {
      const pattern = patterns[index];
      if (!pattern) return;

      const x = timeScale.timeToCoordinate(pattern.timestamp as Time);
      const yPrice = pattern.patternType === 'bullish' 
        ? pattern.low 
        : pattern.patternType === 'bearish' 
          ? pattern.high 
          : pattern.price;
      const y = series.priceToCoordinate(yPrice);

      if (x === null || y === null) {
        marker.style.display = 'none';
        return;
      }

      marker.style.display = 'block';
      
      // Offset based on pattern type
      const offset = pattern.patternType === 'bullish' ? 15 : pattern.patternType === 'bearish' ? -15 : 0;
      
      marker.style.left = `${x}px`;
      marker.style.top = `${y + offset}px`;
      marker.style.transform = 'translate(-50%, -50%)';
    });
  }, [chart, series, patterns]);

  // Setup markers
  useEffect(() => {
    if (!chart || !series) return;

    const chartElement = chart.chartElement();
    if (!chartElement) return;

    // Create container for markers
    if (!containerRef.current) {
      containerRef.current = document.createElement('div');
      containerRef.current.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        overflow: hidden;
      `;
      chartElement.appendChild(containerRef.current);
    }

    // Clear existing markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // Create new markers
    patterns.forEach((pattern) => {
      const marker = createMarkerElement(pattern);
      containerRef.current?.appendChild(marker);
      markersRef.current.push(marker);
    });

    updateMarkerPositions();

    // Subscribe to chart updates
    const handleResize = () => updateMarkerPositions();
    const unsubscribeTimeScale = chart.timeScale().subscribeVisibleTimeRangeChange(updateMarkerPositions);
    const unsubscribeCrosshair = chart.subscribeCrosshairMove(updateMarkerPositions);

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      unsubscribeTimeScale();
      unsubscribeCrosshair();
    };
  }, [chart, series, patterns, createMarkerElement, updateMarkerPositions]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (containerRef.current) {
        containerRef.current.remove();
        containerRef.current = null;
      }
      markersRef.current = [];
    };
  }, []);

  return null;
};
