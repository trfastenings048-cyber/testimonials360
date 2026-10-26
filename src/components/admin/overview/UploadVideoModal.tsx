'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Film, Upload, Video, X } from 'lucide-react';

export function UploadVideoModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [selectedSet, setSelectedSet] = useState<'single' | 'parts'>('parts');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) onOpenChange(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-video-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false);
      }}
    >
      <div className="relative w-full max-w-lg rounded-2xl sm:rounded-3xl bg-[#0e1628] border border-slate-700/80 p-4 sm:p-6 lg:p-7 text-white shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-2xl bg-[#1a2544] border border-slate-700/70 flex items-center justify-center text-[#9bb3ff]">
              <Film className="size-5" />
            </div>
            <div>
              <h2 id="upload-video-title" className="text-lg font-semibold text-white">
                Upload video
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Add video clips to play on the big screen.
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

        {/* Body */}
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-300">Choose destination video set</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSelectedSet('single')}
                className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                  selectedSet === 'single'
                    ? 'border-[#9bb3ff] bg-[#1a2544] text-white'
                    : 'border-slate-800 bg-[#131b31] text-slate-400 hover:text-white'
                }`}
              >
                <div className="font-semibold text-xs text-white">Video 1</div>
                <div className="text-[11px] text-slate-400 mt-0.5">Grant sub Safety kiosk</div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedSet('parts')}
                className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                  selectedSet === 'parts'
                    ? 'border-[#9bb3ff] bg-[#1a2544] text-white'
                    : 'border-slate-800 bg-[#131b31] text-slate-400 hover:text-white'
                }`}
              >
                <div className="font-semibold text-xs text-white">Video 2</div>
                <div className="text-[11px] text-slate-400 mt-0.5">10 short parts playlist</div>
              </button>
            </div>
          </div>

          <div className="rounded-2xl border-2 border-dashed border-slate-700 bg-[#131b31]/50 p-6 text-center flex flex-col items-center justify-center gap-2">
            <div className="size-10 rounded-full bg-[#1a2544] flex items-center justify-center text-[#9bb3ff]">
              <Video className="size-5" />
            </div>
            <p className="text-xs font-medium text-slate-200">
              Drag & drop an MP4 video or visit the full Video Studio
            </p>
            <p className="text-[11px] text-slate-500">Max file size 250MB (H.264 / AAC)</p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 pt-6">
          <Link
            href="/admin/videos"
            onClick={() => onOpenChange(false)}
            className="text-xs text-[#9bb3ff] hover:underline underline-offset-2"
          >
            Go to Full Video Library →
          </Link>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-full px-5 py-2 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <Link
              href="/admin/videos"
              onClick={() => onOpenChange(false)}
              className="rounded-full bg-[#9bb3ff] hover:bg-[#88a3f8] text-[#0b1228] px-5 py-2 text-xs font-semibold transition-colors flex items-center gap-2 shadow-md"
            >
              <Upload className="size-3.5" />
              Upload in Studio
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
