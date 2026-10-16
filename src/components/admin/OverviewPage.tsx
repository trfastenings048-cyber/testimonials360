'use client';

import { useState, type ChangeEvent, type FormEvent } from 'react';
import Image from 'next/image';
import { toast } from 'sonner';
import { Download, Eye, EyeOff, ImagePlus, Images, Loader2, Trash2 } from 'lucide-react';
import { deleteImage as deleteImageApi, downloadGroupImage, updateImageVisibility, uploadImageToDB } from '@/lib/api';
import { imageSrc } from '@/lib/image-urls';
import type { EventImage } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useAdminData } from './AdminDataProvider';
import { PageHeader } from './PageHeader';
import { EmptyState } from './EmptyState';

export function OverviewPage() {
  const { images, setImages, imagesLoading } = useAdminData();
  const [groupName, setGroupName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [downloadingImageId, setDownloadingImageId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<EventImage | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !groupName) {
      toast.error('Please provide both an image and a unique group name');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    try {
      // Goes straight to Cloudinary, so photos larger than Vercel's 4.5 MB body limit work.
      const newImage = await uploadImageToDB(selectedFile, groupName.trim(), { onProgress: setUploadProgress });

      setImages((prev) => [newImage, ...prev]);
      setSelectedFile(null);
      setPreviewUrl('');
      setGroupName('');
      toast.success('Image saved to database successfully!');
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'Failed to save image to database');
    } finally {
      setIsUploading(false);
    }
  };

  const toggleVisibility = async (id: string, current: boolean) => {
    try {
      await updateImageVisibility(id, !current);
      setImages((prev) => prev.map((img) => (img.id === id ? { ...img, isVisible: !current } : img)));
      toast.success(`Image ${!current ? 'visible' : 'hidden'}`);
    } catch {
      toast.error('Failed to update visibility');
    }
  };

  const handleDownloadImage = async (image: EventImage) => {
    setDownloadingImageId(image.id);
    try {
      const { blob, filename } = await downloadGroupImage(image);
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(downloadUrl);
      toast.success(`${image.groupName} image downloaded`);
    } catch (error) {
      console.error('Failed to download group image:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to download group image');
    } finally {
      setDownloadingImageId(null);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setIsDeleting(true);
    try {
      await deleteImageApi(pendingDelete.id);
      setImages((prev) => prev.filter((img) => img.id !== pendingDelete.id));
      toast.success('Image deleted');
      setPendingDelete(null);
    } catch {
      toast.error('Failed to delete image');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete content?"
        description={`Are you sure you want to delete "${pendingDelete?.groupName ?? ''}" from the Content Library?`}
        confirmLabel="Yes, delete"
        cancelLabel="No, keep it"
        isLoading={isDeleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setPendingDelete(null)}
      />

      <PageHeader
        eyebrow="Workspace overview"
        title="Overview"
        description="Upload, organise and control the group photos shown on the event display."
      />

      <Card className="admin-card overflow-hidden">
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <ImagePlus className="size-5 text-secondary" aria-hidden="true" />
            Upload new content
          </CardTitle>
          <CardDescription>Select an image and assign a unique group name.</CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="group-name">Group name</Label>
                <Input
                  id="group-name"
                  placeholder="e.g. Group A, Stage 1"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="h-10"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="image-file">Image file</Label>
                <div className="flex items-center gap-3">
                  {previewUrl && (
                    <div className="relative size-14 shrink-0 overflow-hidden rounded-md border bg-muted">
                      <Image
                        src={previewUrl}
                        alt="Selected image preview"
                        fill
                        unoptimized
                        sizes="56px"
                        className="object-cover"
                      />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <Input
                      id="image-file"
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      disabled={isUploading}
                      className="h-10"
                    />
                    {selectedFile && <p className="mt-1 truncate text-xs text-muted-foreground">{selectedFile.name}</p>}
                  </div>
                </div>
              </div>
            </div>

            <Button
              type="submit"
              className="admin-button h-10 w-full bg-secondary text-secondary-foreground hover:bg-brand-teal-hover"
              disabled={isUploading || !selectedFile}
            >
              {isUploading && <Loader2 className="animate-spin" aria-hidden="true" />}
              {isUploading ? `Uploading… ${uploadProgress}%` : 'Submit content'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="admin-card">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Content library</CardTitle>
          <CardDescription>Manage visibility and deletion of uploaded images.</CardDescription>
        </CardHeader>
        <CardContent>
          {imagesLoading ? (
            <ul className="space-y-3" aria-label="Loading content">
              {Array.from({ length: 3 }).map((_, index) => (
                <li key={index} className="flex items-center gap-4 rounded-lg border p-3">
                  <Skeleton className="h-14 w-20" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                </li>
              ))}
            </ul>
          ) : images.length === 0 ? (
            <EmptyState
              icon={<Images />}
              title="No photos yet"
              description="Upload the first group photo above and it will appear on the big screen."
            />
          ) : (
            <ul className="max-h-[480px] space-y-3 overflow-y-auto pr-1">
              {images.map((img) => (
                <li
                  key={img.id}
                  className="flex flex-col gap-3 rounded-lg border p-3 transition-shadow hover:shadow-sm sm:flex-row sm:items-center sm:gap-4"
                >
                  <div className="relative h-40 w-full overflow-hidden rounded sm:h-14 sm:w-20 sm:shrink-0">
                    <Image
                      src={imageSrc(img, 'thumb')}
                      alt={img.groupName}
                      fill
                      unoptimized
                      sizes="(min-width: 640px) 80px, 100vw"
                      className="object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{img.groupName}</p>
                    <p className="text-xs text-muted-foreground">{new Date(img.timestamp).toLocaleString()}</p>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end">
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground sm:mr-4">
                      {img.isVisible ? (
                        <Eye className="size-4 text-secondary" aria-hidden="true" />
                      ) : (
                        <EyeOff className="size-4" aria-hidden="true" />
                      )}
                      <span>{img.isVisible ? 'On screen' : 'Hidden'}</span>
                      <Switch
                        checked={img.isVisible}
                        onCheckedChange={() => void toggleVisibility(img.id, img.isVisible)}
                        aria-label={`Show ${img.groupName} on the big screen`}
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-lg"
                      onClick={() => void handleDownloadImage(img)}
                      disabled={downloadingImageId === img.id}
                      className="text-secondary hover:bg-accent hover:text-brand-teal-hover"
                      title={`Download ${img.groupName} image`}
                      aria-label={`Download ${img.groupName} image`}
                    >
                      {downloadingImageId === img.id ? <Loader2 className="animate-spin" /> : <Download />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-lg"
                      onClick={() => setPendingDelete(img)}
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      title={`Delete ${img.groupName}`}
                      aria-label={`Delete ${img.groupName}`}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
