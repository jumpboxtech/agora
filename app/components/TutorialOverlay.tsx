'use client';

import { useEffect, useState, useCallback } from 'react';
import { TUTORIAL_STEPS, TOTAL_STEPS } from '../lib/tutorial';

interface Props {
  step: number;
  onNext: () => void;
  onSkip: () => void;
  onSwitchTab: (tab: string) => void;
}

export default function TutorialOverlay({ step, onNext, onSkip, onSwitchTab }: Props) {
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const currentStep = TUTORIAL_STEPS[step];

  const updateTargetRect = useCallback(() => {
    if (!currentStep) return;
    if (currentStep.target === 'fullscreen') {
      setTargetRect(null);
      return;
    }
    const el = document.querySelector(`[data-tutorial="${currentStep.target}"]`);
    if (el) {
      setTargetRect(el.getBoundingClientRect());
    } else {
      setTargetRect(null);
    }
  }, [currentStep]);

  useEffect(() => {
    // Switch tab if needed
    if (currentStep?.tab) {
      onSwitchTab(currentStep.tab);
    }
    // Small delay for tab switch animation
    const timer = setTimeout(updateTargetRect, 100);
    return () => clearTimeout(timer);
  }, [step, currentStep, onSwitchTab, updateTargetRect]);

  if (!currentStep || step < 0 || step >= TOTAL_STEPS) return null;

  const isFullscreen = currentStep.target === 'fullscreen';

  return (
    <div className="fixed inset-0 z-50" onClick={(e) => e.stopPropagation()}>
      {/* Dark overlay with spotlight cutout */}
      <div className="absolute inset-0 bg-black/70" />

      {/* Spotlight cutout */}
      {targetRect && !isFullscreen && (
        <div
          className="absolute border border-cyan-400/50 rounded-lg"
          style={{
            top: targetRect.top - 4,
            left: targetRect.left - 4,
            width: targetRect.width + 8,
            height: targetRect.height + 8,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.7), 0 0 20px rgba(0,255,255,0.3)',
            zIndex: 51,
          }}
        />
      )}

      {/* Tooltip card — always centered */}
      <div className="absolute inset-0 z-[52] flex items-center justify-center px-6 pointer-events-none">
        <div className="bg-black border border-cyan-500/60 rounded-lg p-4 shadow-lg shadow-cyan-500/10 max-w-[340px] w-full pointer-events-auto">
          <div className="text-cyan-400 text-[10px] font-mono tracking-widest mb-1">
            {currentStep.title}
          </div>
          <p className="text-gray-200 text-xs font-mono leading-relaxed mb-3">
            {currentStep.text}
          </p>
          <div className="flex items-center justify-between">
            <button
              onClick={onNext}
              className="px-4 py-1.5 bg-cyan-500/20 border border-cyan-500/50 rounded text-cyan-300 text-[10px] font-mono tracking-wider hover:bg-cyan-500/30 transition-colors"
            >
              {step === TOTAL_STEPS - 1 ? 'FINISH' : 'NEXT'}
            </button>
            <span className="text-gray-500 text-[9px] font-mono">
              {step + 1}/{TOTAL_STEPS}
            </span>
          </div>
        </div>
      </div>

      {/* Skip button */}
      <button
        onClick={onSkip}
        className="absolute top-3 right-3 z-[53] text-gray-500 text-[9px] font-mono tracking-wider hover:text-gray-300 transition-colors"
      >
        SKIP
      </button>
    </div>
  );
}
