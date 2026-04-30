'use client';

import { useEffect, useState } from 'react';

function isTodayMay1(): boolean {
  const now = new Date();
  return now.getMonth() === 4 && now.getDate() === 1; // month 4 = May (0-indexed)
}

export function LabourDayBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    setShow(isTodayMay1());
  }, []);

  if (!show) return null;

  return (
    <div className="relative overflow-hidden bg-red-700">
      {/* Subtle diagonal shimmer */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage:
            'repeating-linear-gradient(135deg, transparent, transparent 18px, rgba(255,255,255,0.2) 18px, rgba(255,255,255,0.2) 36px)',
        }}
      />

      <div className="relative flex items-center justify-center gap-3 px-6 py-3">
        {/* Left decoration */}
        <span className="shrink-0 text-lg" aria-hidden>🌹</span>
        <span className="shrink-0 text-base" aria-hidden>✊</span>

        {/* Message */}
        <div className="flex flex-wrap items-center justify-center gap-2 text-center">
          <span
            className="font-bold text-white"
            style={{ textShadow: '0 1px 3px rgba(0,0,0,0.4)', fontSize: '1rem' }}
          >
            Bonne Fête du Travail !
          </span>

          <span
            className="rounded-full px-3 py-0.5 text-sm font-semibold"
            style={{
              background: 'rgba(255,255,255,0.2)',
              color: '#fff',
              backdropFilter: 'blur(4px)',
            }}
          >
            1er Mai
          </span>

          <span className="text-sm text-red-100">
            Hommage à tous les travailleurs ⚙️
          </span>
        </div>

        {/* Right decoration */}
        <span className="shrink-0 text-base" aria-hidden>✊</span>
        <span className="shrink-0 text-lg" aria-hidden>🌹</span>
      </div>
    </div>
  );
}
