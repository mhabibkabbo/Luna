import React, { useState, useEffect } from 'react';
import { formatLunarCoordinates } from '../../utils/coordinates.js';
import { pointerStore } from '../../utils/pointerStore.js';
import { Copy, Check } from 'lucide-react';
import { notifySuccess } from '../../utils/feedbackStore.js';

/**
 * Minimal bottom-left coordinate readout pill.
 */
export default function TelemetryStatusBar({ selectedFeature }) {
  const [copied, setCopied] = useState(false);
  const [pointer, setPointer] = useState(pointerStore.get());

  useEffect(() => {
    return pointerStore.subscribe(setPointer);
  }, []);

  const targetLon = selectedFeature ? selectedFeature.longitude : pointer.lon;
  const targetLat = selectedFeature ? selectedFeature.latitude : pointer.lat;
  const { latStr, lonStr } = formatLunarCoordinates(targetLon, targetLat, 2);

  const handleCopy = (e) => {
    e.stopPropagation();
    const text = `${targetLat.toFixed(4)}°, ${targetLon.toFixed(4)}°`;
    if (navigator.clipboard) {
      navigator.clipboard
        .writeText(text)
        .then(() => {
          setCopied(true);
          notifySuccess('Copied', `${latStr}, ${lonStr}`);
          setTimeout(() => setCopied(false), 2000);
        })
        .catch(() => {});
    }
  };

  return (
    <div
      id="telemetry-status-bar"
      className="fixed bottom-2 left-3 z-20 px-2.5 py-1 rounded-full bg-[#060B13]/85 backdrop-blur-md border border-[#16283C] flex items-center gap-2 text-[10px] font-mono text-[#94A3B8] select-none pointer-events-auto"
    >
      <span>
        {latStr} · {lonStr}
      </span>
      <button
        type="button"
        onClick={handleCopy}
        className="hover:text-white transition-colors"
        title="Copy coordinates"
      >
        {copied ? <Check className="w-3 h-3 text-[#34D399]" /> : <Copy className="w-3 h-3" />}
      </button>
    </div>
  );
}
