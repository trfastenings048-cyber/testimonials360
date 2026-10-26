'use client';

import { useEffect, useState } from 'react';
import { X, Upload } from 'lucide-react';
import { useAdminData } from '../AdminDataProvider';
import { UploadPhotosModal } from './UploadPhotosModal';
import { ContentLibraryTable } from './ContentLibraryTable';
import type { EventImage } from '@/types';

export function PhotosDrawer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { images, setImages, imagesLoading } = useAdminData();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open && !uploadOpen) onOpenChange(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, uploadOpen, onOpenChange]);

  const onUploaded = (image: EventImage) => {
    setImages((prev) => [image, ...prev.filter((item) => item.id !== image.id)]);
    setHighlightId(image.id);
    setTimeout(() => setHighlightId(null), 3000);
  };

  if (!open) return null;

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Photos library"
        className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={(e) => {
          if (e.target === e.currentTarget) onOpenChange(false);
        }}
      >
        <div className="theme-tr theme-admin relative w-full max-w-5xl max-h-[90vh] rounded-3xl bg-[#0e1628] border border-slate-700/80 shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-slate-800 shrink-0">
            <div>
              <h2 className="text-lg font-semibold text-white">Photos library</h2>
              <p className="text-xs text-slate-400 mt-0.5">All uploaded group photos — manage, hide or remove them.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setUploadOpen(true)}
                className="rounded-full bg-[#9bb3ff] hover:bg-[#88a3f8] text-[#0b1228] px-4 py-2 text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer shadow-md"
              >
                <Upload className="size-3.5" />
                Upload photos
              </button>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                aria-label="Close"
                className="size-8 rounded-full bg-[#16213e] border border-slate-700/60 flex items-center justify-center text-slate-400 hover:text-white hover:bg-[#223158] transition-colors cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          {/* Body — the real ContentLibraryTable */}
          <div className="flex-1 overflow-auto">
            <ContentLibraryTable
              images={images}
              setImages={setImages}
              loading={imagesLoading}
              highlightId={highlightId}
              onUploadClick={() => setUploadOpen(true)}
            />
          </div>
        </div>
      </div>

      <UploadPhotosModal
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        images={images}
        onUploaded={onUploaded}
      />
    </>
  );
}
