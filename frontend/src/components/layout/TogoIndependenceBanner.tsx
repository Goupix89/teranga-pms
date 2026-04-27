'use client';

import { useState, useEffect } from 'react';
import { X, Star } from 'lucide-react';

const TOGO_GREEN  = '#006A4E';
const TOGO_YELLOW = '#FFCE00';
const TOGO_RED    = '#D21034';

const DISMISS_KEY = 'togo_independence_dismissed_2026';

function isTodayApril27(): boolean {
  const now = new Date();
  return now.getMonth() === 3 && now.getDate() === 27; // 0-indexed month
}

export function TogoIndependenceBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isTodayApril27()) return;
    const dismissed = sessionStorage.getItem(DISMISS_KEY);
    if (!dismissed) setVisible(true);
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, '1');
    setVisible(false);
  };

  return (
    <div
      className="relative overflow-hidden"
      style={{ background: `linear-gradient(135deg, ${TOGO_GREEN} 0%, ${TOGO_GREEN} 33%, ${TOGO_YELLOW} 33%, ${TOGO_YELLOW} 66%, ${TOGO_RED} 66%)` }}
    >
      {/* Subtle shimmer overlay */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 20px, rgba(255,255,255,0.15) 20px, rgba(255,255,255,0.15) 40px)',
        }}
      />

      <div className="relative flex items-center justify-between gap-4 px-6 py-3">
        {/* Left stars decoration */}
        <div className="flex shrink-0 items-center gap-1 text-white opacity-80">
          {[0, 1, 2].map((i) => (
            <Star key={i} className="h-3 w-3 fill-white" style={{ opacity: 0.6 + i * 0.2 }} />
          ))}
        </div>

        {/* Main message */}
        <div className="flex flex-1 flex-wrap items-center justify-center gap-2 text-center">
          {/* Flag stripe badge */}
          <span className="shrink-0 overflow-hidden rounded text-xl leading-none" title="Drapeau togolais">🇹🇬</span>

          <span className="font-bold text-white drop-shadow" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.4)', fontSize: '1rem' }}>
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

        {/* Right stars decoration */}
        <div className="flex shrink-0 items-center gap-1 text-white opacity-80">
          {[2, 1, 0].map((i) => (
            <Star key={i} className="h-3 w-3 fill-white" style={{ opacity: 0.6 + i * 0.2 }} />
          ))}
        </div>

        {/* Dismiss */}
        <button
          onClick={dismiss}
          className="ml-2 shrink-0 rounded-full p-1 text-white opacity-70 transition hover:opacity-100 hover:bg-white/20"
          aria-label="Fermer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
