'use client';

import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';

const TOGO_GREEN  = '#006A4E';
const TOGO_YELLOW = '#FFCE00';
const TOGO_RED    = '#D21034';

function isTodayApril27(): boolean {
  const now = new Date();
  return now.getMonth() === 3 && now.getDate() === 27;
}

export function TogoIndependenceBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    setShow(isTodayApril27());
  }, []);

  if (!show) return null;

  return (
    <div
      className="relative overflow-hidden"
      style={{ background: `linear-gradient(90deg, ${TOGO_GREEN} 0%, ${TOGO_GREEN} 33%, ${TOGO_YELLOW} 33%, ${TOGO_YELLOW} 66%, ${TOGO_RED} 66%)` }}
    >
      {/* Shimmer overlay */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 20px, rgba(255,255,255,0.15) 20px, rgba(255,255,255,0.15) 40px)',
        }}
      />

      <div className="relative flex items-center justify-center gap-4 px-6 py-3">
        {/* Left stars */}
        <div className="flex shrink-0 items-center gap-1">
          {[0, 1, 2].map((i) => (
            <Star key={i} className="h-3 w-3 fill-white text-white" style={{ opacity: 0.6 + i * 0.2 }} />
          ))}
        </div>

        {/* Message */}
        <div className="flex flex-wrap items-center justify-center gap-2 text-center">
          <span className="text-xl leading-none">🇹🇬</span>

          <span className="font-bold text-white" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.4)', fontSize: '1rem' }}>
            Bonne fête de l&apos;Indépendance du Togo !
          </span>

          <span
            className="rounded-full px-3 py-0.5 text-sm font-semibold"
            style={{ background: 'rgba(255,255,255,0.25)', color: '#fff', backdropFilter: 'blur(4px)' }}
          >
            27 Avril 1960 · 66 ans
          </span>

          <span className="text-sm text-white opacity-80">
            🕊️ Liberté, Travail, Solidarité
          </span>
        </div>

        {/* Right stars */}
        <div className="flex shrink-0 items-center gap-1">
          {[2, 1, 0].map((i) => (
            <Star key={i} className="h-3 w-3 fill-white text-white" style={{ opacity: 0.6 + i * 0.2 }} />
          ))}
        </div>
      </div>
    </div>
  );
}
