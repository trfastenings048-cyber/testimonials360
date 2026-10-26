'use client';

import { useEffect } from 'react';
import { Moon, Sparkles, Sun, Check, X } from 'lucide-react';
import { toast } from 'sonner';

export function DarkModeModal({
  open,
  onOpenChange,
  darkMode,
  setDarkMode,
  softBlueStyle,
  setSoftBlueStyle,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  darkMode: boolean;
  setDarkMode: (val: boolean) => void;
  softBlueStyle: boolean;
  setSoftBlueStyle: (val: boolean) => void;
}) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) onOpenChange(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onOpenChange]);

  if (!open) return null;

  const handleApply = () => {
    toast.success('Appearance preferences saved');
    onOpenChange(false);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="dark-mode-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false);
      }}
    >
      <div className="relative w-full max-w-md rounded-2xl sm:rounded-3xl bg-[#0e1628] border border-slate-700/80 p-4 sm:p-6 lg:p-7 text-white shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-2xl bg-[#1a2544] border border-slate-700/70 flex items-center justify-center text-[#9bb3ff]">
              <Moon className="size-5" />
            </div>
            <div>
              <h2 id="dark-mode-title" className="text-lg font-semibold text-white">
                Dark mode & Style
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Customize colors for the live booth and admin interface.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Close dialog"
            className="size-8 rounded-full bg-[#16213e] border border-slate-700/60 flex items-center justify-center text-slate-400 hover:text-white hover:bg-[#223158] transition-colors cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Options */}
        <div className="space-y-3">
          {/* Dark Mode Card */}
          <button
            type="button"
            onClick={() => setDarkMode(!darkMode)}
            className={`w-full rounded-2xl border p-4 text-left transition-all flex items-center justify-between cursor-pointer ${
              darkMode
                ? 'border-[#9bb3ff] bg-[#1a2544]'
                : 'border-slate-800 bg-[#131b31] opacity-75'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-xl bg-[#0e1628] flex items-center justify-center text-[#9bb3ff]">
                <Moon className="size-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Dark mode</p>
                <p className="text-xs text-slate-400">Deep navy palette for stage & booth setups</p>
              </div>
            </div>
            <div
              className={`size-5 rounded-full flex items-center justify-center border ${
                darkMode
                  ? 'bg-[#9bb3ff] border-[#9bb3ff] text-[#0b1228]'
                  : 'border-slate-600'
              }`}
            >
              {darkMode && <Check className="size-3 stroke-[3]" />}
            </div>
          </button>

          {/* Soft Blue Style Card */}
          <button
            type="button"
            onClick={() => setSoftBlueStyle(!softBlueStyle)}
            className={`w-full rounded-2xl border p-4 text-left transition-all flex items-center justify-between cursor-pointer ${
              softBlueStyle
                ? 'border-[#9bb3ff] bg-[#1a2544]'
                : 'border-slate-800 bg-[#131b31] opacity-75'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-xl bg-[#0e1628] flex items-center justify-center text-[#9bb3ff]">
                <Sparkles className="size-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Soft blue style</p>
                <p className="text-xs text-slate-400">Periwinkle highlights & active pill styling</p>
              </div>
            </div>
            <div
              className={`size-5 rounded-full flex items-center justify-center border ${
                softBlueStyle
                  ? 'bg-[#9bb3ff] border-[#9bb3ff] text-[#0b1228]'
                  : 'border-slate-600'
              }`}
            >
              {softBlueStyle && <Check className="size-3 stroke-[3]" />}
            </div>
          </button>

          {/* Light Mode Preview */}
          <div className="w-full rounded-2xl border border-slate-800/80 bg-[#131b31]/40 p-4 text-left flex items-center justify-between opacity-50 cursor-not-allowed">
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-xl bg-[#0e1628] flex items-center justify-center text-slate-400">
                <Sun className="size-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Light mode</p>
                <p className="text-xs text-slate-400">Daylight high-contrast interface</p>
              </div>
            </div>
            <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">Coming soon</span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 pt-6">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-full px-5 py-2 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="rounded-full bg-[#9bb3ff] hover:bg-[#88a3f8] text-[#0b1228] px-6 py-2 text-xs font-semibold transition-colors cursor-pointer shadow-md"
          >
            Apply & Close
          </button>
        </div>
      </div>
    </div>
  );
}
