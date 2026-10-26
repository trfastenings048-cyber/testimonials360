'use client';

import { useEffect, useRef, useState, type DragEvent } from 'react';
import { ImagePlus, Loader2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { uploadImageToDB } from '@/lib/api';
import type { EventImage } from '@/types';

export function UploadPhotosModal({
  open,
  onOpenChange,
  images,
  onUploaded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  images: EventImage[];
  onUploaded: (image: EventImage) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [groupName, setGroupName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (!open) {
      setFile(null);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      setGroupName('');
      setProgress(0);
      setIsUploading(false);
    }
  }, [open, previewUrl]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open && !isUploading) {
        onOpenChange(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, isUploading, onOpenChange]);

  if (!open) return null;

  const handleFile = (pickedFile: File) => {
    if (!pickedFile.type.startsWith('image/')) {
      toast.error('Please select an image file (JPG, PNG, WebP or HEIC)');
      return;
    }
    setFile(pickedFile);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const url = URL.createObjectURL(pickedFile);
    setPreviewUrl(url);
    if (!groupName) {
      // Suggest group name from file name
      const nameWithoutExt = pickedFile.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      setGroupName(nameWithoutExt);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFile(droppedFile);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast.error('Please choose a photo to upload');
      return;
    }
    const finalGroupName = groupName.trim() || 'General';

    setIsUploading(true);
    setProgress(15);

    try {
      const progressTimer = setInterval(() => {
        setProgress((prev) => (prev < 85 ? prev + 15 : prev));
      }, 300);

      const uploadedImage = await uploadImageToDB(file, finalGroupName);
      clearInterval(progressTimer);
      setProgress(100);

      toast.success(`Photo uploaded to "${finalGroupName}" group`);
      onUploaded(uploadedImage);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to upload photo');
    } finally {
      setIsUploading(false);
    }
  };

  const existingGroups = Array.from(new Set(images.map((img) => img.groupName.trim()))).filter(Boolean);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-photos-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isUploading) onOpenChange(false);
      }}
    >
      <div className="relative w-full max-w-lg rounded-2xl sm:rounded-3xl bg-[#0e1628] border border-slate-700/80 p-4 sm:p-6 lg:p-7 text-white shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-2xl bg-[#1a2544] border border-slate-700/70 flex items-center justify-center text-[#9bb3ff]">
              <Upload className="size-5" />
            </div>
            <div>
              <h2 id="upload-photos-title" className="text-lg font-semibold text-white">
                Upload photos
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                The photo appears on the big screen rotation straight away.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={isUploading}
            aria-label="Close dialog"
            className="size-8 rounded-full bg-[#16213e] border border-slate-700/60 flex items-center justify-center text-slate-400 hover:text-white hover:bg-[#223158] transition-colors cursor-pointer disabled:opacity-50"
          >
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* File Dropzone */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const selected = e.target.files?.[0];
              if (selected) handleFile(selected);
            }}
          />

          {!file ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-7 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2.5 ${
                isDragging
                  ? 'border-[#9bb3ff] bg-[#1a2544]/60'
                  : 'border-slate-700 hover:border-slate-500 bg-[#131b31]/40'
              }`}
            >
              <div className="size-11 rounded-full bg-[#1a2544] flex items-center justify-center text-[#9bb3ff]">
                <ImagePlus className="size-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-200">
                  Drop a photo here, or <span className="text-[#9bb3ff] underline underline-offset-2">browse</span>
                </p>
                <p className="text-xs text-slate-500 mt-1">Supports JPG, PNG, WebP or HEIC</p>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-700 bg-[#131b31] p-3.5 flex items-center gap-3">
              {previewUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="size-16 rounded-xl object-cover border border-slate-700"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{file.name}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {(file.size / (1024 * 1024)).toFixed(2)} MB
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setFile(null);
                  if (previewUrl) URL.revokeObjectURL(previewUrl);
                  setPreviewUrl(null);
                }}
                disabled={isUploading}
                className="text-xs text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Change
              </button>
            </div>
          )}

          {/* Group Name input */}
          <div>
            <label htmlFor="group-name-input" className="block text-xs font-medium text-slate-300 mb-1.5">
              Group name
            </label>
            <input
              id="group-name-input"
              type="text"
              list="existing-groups"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="e.g. Sales Team, Engineering, Riya"
              className="w-full bg-[#131b31] border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#9bb3ff]"
            />
            <datalist id="existing-groups">
              {existingGroups.map((grp) => (
                <option key={grp} value={grp} />
              ))}
            </datalist>
            <p className="text-[11px] text-slate-400 mt-1">
              Photos with the same group name rotate together or replace the previous photo on screen.
            </p>
          </div>

          {/* Progress bar */}
          {isUploading && (
            <div className="space-y-1 pt-1">
              <div className="flex justify-between text-xs text-slate-400">
                <span>Uploading...</span>
                <span>{progress}%</span>
              </div>
              <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#9bb3ff] transition-all duration-300 rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={isUploading}
              className="rounded-full px-5 py-2 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!file || isUploading}
              className="rounded-full bg-[#9bb3ff] hover:bg-[#88a3f8] text-[#0b1228] px-6 py-2 text-xs font-semibold transition-colors flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUploading ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="size-3.5" />
                  Upload photo
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
