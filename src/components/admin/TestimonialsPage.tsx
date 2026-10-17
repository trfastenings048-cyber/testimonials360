'use client';

import { useMemo, useState, type ReactNode } from 'react';
import Image from 'next/image';
import { Dialog } from '@base-ui/react/dialog';
import { toast } from 'sonner';
import {
  BadgeCheck,
  Building2,
  CalendarClock,
  Download,
  Eye,
  FileText,
  Image as ImageIcon,
  Mail,
  MessageSquareQuote,
  MessageSquareText,
  Search,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { bulkDeleteCertificates, deleteCertificate, updateCertificate } from '@/lib/api';
import { imageSrc } from '@/lib/image-urls';
import type { CertificateRecord, EventImage } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useAdminData } from './AdminDataProvider';
import { PageHeader } from './PageHeader';
import { StatCard } from './StatCard';
import { Arches } from '@/components/shared/Arches';
import { InitialAvatar } from '@/components/shared/InitialAvatar';
import { EmptyState } from './EmptyState';

type DeleteConfirmation =
  | { type: 'certificate'; id: string; name: string }
  | { type: 'selected-certificates'; count: number }
  | { type: 'all-certificates'; count: number };

const certificateDownloadSrc = (id: string) => `/api/certificates/${encodeURIComponent(id)}/download`;
const normalizeGroupName = (name?: string) => name?.trim().toLowerCase() || '';

function DetailField({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="rounded-2xl bg-surface-page/60 p-3">
      <div className="mb-1 flex items-center gap-2 text-xs font-medium text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="text-sm font-medium break-words text-foreground">{value || '—'}</div>
    </div>
  );
}

function CertificateDetailsDialog({
  certificate,
  groupImage,
  onClose,
}: {
  certificate: CertificateRecord | null;
  groupImage: EventImage | null;
  onClose: () => void;
}) {
  const submittedAt = certificate ? new Date(certificate.createdAt) : null;

  return (
    <Dialog.Root open={Boolean(certificate)} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[190] bg-black/55 backdrop-blur-sm transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-[191] flex max-h-[92vh] w-[calc(100%-1.5rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-3xl bg-card text-foreground shadow-2xl outline-none transition-all duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
          {certificate && submittedAt && (
            <>
              <div className="flex items-start justify-between gap-4 border-b p-4 sm:p-5">
                <div className="min-w-0">
                  <p className="text-eyebrow text-muted-foreground">Certificate submission</p>
                  <Dialog.Title className="mt-1 truncate text-xl font-medium tracking-tight sm:text-2xl">
                    {certificate.userName}
                  </Dialog.Title>
                  <Dialog.Description className="mt-1 text-sm break-all text-muted-foreground">
                    {certificate.userEmail}
                  </Dialog.Description>
                </div>
                <Dialog.Close render={<Button type="button" variant="ghost" size="icon-lg" aria-label="Close details" />}>
                  <X />
                </Dialog.Close>
              </div>

              <div className="overflow-y-auto p-4 sm:p-5">
                {groupImage && (
                  <div className="relative mb-4 h-44 overflow-hidden rounded-2xl bg-muted sm:h-56">
                    <Image
                      src={imageSrc(groupImage, 'card')}
                      alt={groupImage.groupName}
                      fill
                      unoptimized
                      sizes="(min-width: 640px) 768px, 100vw"
                      className="object-cover"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-3">
                      <p className="truncate text-sm font-medium text-white">{groupImage.groupName}</p>
                    </div>
                  </div>
                )}

                <div className="mb-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl bg-ink p-3 text-white">
                    <p className="text-xs font-medium opacity-80">Display status</p>
                    <p className="mt-1 text-lg font-medium">Automatically shown</p>
                  </div>
                  <div className="rounded-2xl bg-accent-blue-soft p-3 text-ink">
                    <p className="text-xs font-medium opacity-80">Event group</p>
                    <p className="mt-1 truncate text-lg font-medium">{certificate.groupName}</p>
                  </div>
                  <div className="rounded-2xl bg-surface-page/60 p-3 text-ink">
                    <p className="text-xs font-medium opacity-80">Certificate</p>
                    <p className="mt-1 text-lg font-medium">{certificate.certificateUrl ? 'Ready' : 'Pending'}</p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <DetailField icon={<User className="size-3.5" />} label="Name" value={certificate.userName} />
                  <DetailField icon={<Mail className="size-3.5" />} label="Email" value={certificate.userEmail} />
                  <DetailField icon={<Building2 className="size-3.5" />} label="Organisation" value={certificate.teamName} />
                  <DetailField icon={<BadgeCheck className="size-3.5" />} label="Designation" value={certificate.designation} />
                  <DetailField
                    icon={<CalendarClock className="size-3.5" />}
                    label="Submitted"
                    value={`${submittedAt.toLocaleDateString()} ${submittedAt.toLocaleTimeString()}`}
                  />
                  <DetailField icon={<ImageIcon className="size-3.5" />} label="Group image" value={certificate.groupName} />
                </div>

                {/* Rendered like the big screen's testimonial card, so admins see what the room sees. */}
                <div className="bg-signature relative mt-3 overflow-hidden rounded-3xl p-5">
                  <Arches className="text-white/60" />
                  <div className="relative mb-3 flex items-center gap-2 text-xs font-medium text-ink">
                    <span className="flex size-7 items-center justify-center rounded-full bg-ink text-white">
                      <MessageSquareText className="size-3.5" aria-hidden="true" />
                    </span>
                    Feedback
                  </div>
                  <p className="relative max-w-[92%] text-lg leading-7 font-light whitespace-pre-wrap text-ink">
                    {certificate.feedback ? `“${certificate.feedback}”` : 'No feedback provided.'}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-2 border-t bg-card p-4 sm:flex-row sm:items-center sm:justify-end">
                {certificate.certificateUrl ? (
                  <Button
                    type="button"
                    className="h-10 gap-2"
                    onClick={() => {
                      window.location.href = certificateDownloadSrc(certificate.id);
                    }}
                  >
                    <Download />
                    Download certificate
                  </Button>
                ) : (
                  <Button className="h-10 gap-2" disabled>
                    <FileText />
                    Certificate pending
                  </Button>
                )}
                <Dialog.Close render={<Button type="button" variant="outline" className="h-10" />}>Close</Dialog.Close>
              </div>
            </>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function TestimonialsPage() {
  const { images, certificates, setCertificates, certificatesLoading } = useAdminData();
  const [selectedCertIds, setSelectedCertIds] = useState<Set<string>>(new Set());
  const [isDeletingCerts, setIsDeletingCerts] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<DeleteConfirmation | null>(null);
  const [viewingCertificate, setViewingCertificate] = useState<CertificateRecord | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const toggleSelectCert = (id: string) => {
    setSelectedCertIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllCerts = (filteredCerts: CertificateRecord[]) => {
    const allSelected = filteredCerts.length > 0 && filteredCerts.every((c) => selectedCertIds.has(c.id));
    setSelectedCertIds((prev) => {
      const next = new Set(prev);
      filteredCerts.forEach((c) => {
        if (allSelected) next.delete(c.id);
        else next.add(c.id);
      });
      return next;
    });
  };

  const deleteSelectedCerts = async () => {
    if (selectedCertIds.size === 0) {
      toast.error('No certificates selected');
      return;
    }

    setIsDeletingCerts(true);
    try {
      await bulkDeleteCertificates(Array.from(selectedCertIds));
      setCertificates((prev) => prev.filter((c) => !selectedCertIds.has(c.id)));
      toast.success(`Successfully deleted ${selectedCertIds.size} certificate(s)`);
      setSelectedCertIds(new Set());
    } catch (err) {
      console.error('Failed to delete certificates:', err);
      toast.error('Failed to delete selected certificates');
    } finally {
      setIsDeletingCerts(false);
    }
  };

  const clearAllCerts = async () => {
    if (certificates.length === 0) {
      toast.error('No certificates to delete');
      return;
    }

    setIsDeletingCerts(true);
    try {
      await bulkDeleteCertificates();
      const count = certificates.length;
      setCertificates([]);
      toast.success(`Successfully deleted all ${count} certificate(s)`);
      setSelectedCertIds(new Set());
    } catch (err) {
      console.error('Failed to clear certificates:', err);
      toast.error('Failed to clear certificates');
    } finally {
      setIsDeletingCerts(false);
    }
  };

  const deleteSingleCertificate = async (id: string) => {
    try {
      await deleteCertificate(id);
      setCertificates((prev) => prev.filter((item) => item.id !== id));
      setSelectedCertIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      toast.success('Submission deleted');
    } catch (e) {
      console.error('Failed to delete submission:', e);
      toast.error('Failed to delete submission');
    }
  };

  const getDeleteDialogCopy = () => {
    if (!deleteConfirmation) return { title: '', description: '' };

    if (deleteConfirmation.type === 'certificate') {
      return {
        title: 'Delete certificate submission?',
        description: `Are you sure you want to delete the certificate submission for "${deleteConfirmation.name}"?`,
      };
    }

    if (deleteConfirmation.type === 'selected-certificates') {
      return {
        title: 'Delete selected submissions?',
        description: `Are you sure you want to delete ${deleteConfirmation.count} selected certificate submission(s)?`,
      };
    }

    return {
      title: 'Delete all certificate submissions?',
      description: `This permanently deletes all ${deleteConfirmation.count} submission(s) and their certificates. Export a CSV first if you need a record.`,
    };
  };

  const confirmDelete = async () => {
    if (!deleteConfirmation) return;

    setIsDeletingCerts(true);
    try {
      if (deleteConfirmation.type === 'certificate') {
        await deleteSingleCertificate(deleteConfirmation.id);
      } else if (deleteConfirmation.type === 'selected-certificates') {
        await deleteSelectedCerts();
      } else {
        await clearAllCerts();
      }
      setDeleteConfirmation(null);
    } finally {
      setIsDeletingCerts(false);
    }
  };

  const exportCSV = () => {
    const headers = ['Date & Time', 'Name', 'Email', 'Organisation', 'Designation', 'Group Name', 'Certificate URL', 'Feedback'];
    const rows = certificates.map((c) => [
      new Date(c.createdAt).toLocaleString(),
      c.userName || '',
      c.userEmail || '',
      c.teamName || '',
      c.designation || '',
      c.groupName || '',
      c.certificateUrl || '',
      c.feedback || '',
    ]);
    const escape = (value: string) => `"${String(value).replace(/"/g, '""')}"`;
    const csvContent = [headers, ...rows].map((row) => row.map(escape).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `certificates_export_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('CSV exported successfully!');
  };

  const availableGroups = useMemo(() => {
    const names = [...images.map((img) => img.groupName), ...certificates.map((c) => c.groupName)].filter(
      (n): n is string => Boolean(n)
    );
    return Array.from(new Set(names)).sort();
  }, [images, certificates]);

  const handleGroupChange = async (id: string, newGroupName: string) => {
    try {
      await updateCertificate(id, { groupName: newGroupName });
      setCertificates((prev) => prev.map((c) => (c.id === id ? { ...c, groupName: newGroupName } : c)));
      toast.success(`Group updated to ${newGroupName}`);
    } catch (error) {
      console.error('Failed to update group name:', error);
      toast.error('Failed to update group name');
    }
  };

  const filteredCertificates = certificates.filter((c) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return [c.userName, c.userEmail, c.teamName, c.designation, c.groupName, c.feedback].some((value) =>
      (value || '').toLowerCase().includes(q)
    );
  });

  const allFilteredSelected =
    filteredCertificates.length > 0 && filteredCertificates.every((c) => selectedCertIds.has(c.id));
  const someFilteredSelected = !allFilteredSelected && filteredCertificates.some((c) => selectedCertIds.has(c.id));
  const todayCount = certificates.filter((c) => new Date(c.createdAt).toDateString() === new Date().toDateString()).length;
  const onScreenCount = certificates.length;

  const groupSelect = (cert: CertificateRecord, className: string) => (
    <select
      value={cert.groupName}
      onChange={(e) => void handleGroupChange(cert.id, e.target.value)}
      aria-label={`Event group for ${cert.userName}`}
      className={className}
    >
      {availableGroups.map((group) => (
        <option key={group} value={group} className="bg-card text-foreground">
          {group}
        </option>
      ))}
    </select>
  );

  const emptyOrLoading = certificatesLoading ? (
    <div className="space-y-3 p-4" aria-label="Loading submissions">
      {Array.from({ length: 4 }).map((_, index) => (
        <Skeleton key={index} className="h-12 w-full" />
      ))}
    </div>
  ) : (
    <EmptyState
      icon={<MessageSquareQuote />}
      title={searchQuery ? 'No matching submissions' : 'No submissions yet'}
      description={
        searchQuery
          ? 'Try a different name, email, organisation or group.'
          : 'Submissions from the participant portal will appear here.'
      }
      action={
        searchQuery ? (
          <Button variant="outline" onClick={() => setSearchQuery('')}>
            Clear search
          </Button>
        ) : undefined
      }
    />
  );

  return (
    <div className="space-y-6">
      <ConfirmDialog
        open={Boolean(deleteConfirmation)}
        title={getDeleteDialogCopy().title}
        description={getDeleteDialogCopy().description}
        confirmLabel="Yes, delete"
        cancelLabel="No, keep it"
        isLoading={isDeletingCerts}
        requireText={deleteConfirmation?.type === 'all-certificates' ? 'DELETE' : undefined}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteConfirmation(null)}
      />
      <CertificateDetailsDialog
        certificate={viewingCertificate}
        groupImage={
          viewingCertificate
            ? images.find(
                (image) => normalizeGroupName(image.groupName) === normalizeGroupName(viewingCertificate.groupName)
              ) || null
            : null
        }
        onClose={() => setViewingCertificate(null)}
      />

      <PageHeader
        eyebrow="Operations"
        title="Testimonials"
        description="Review participant testimonials shown automatically on the big screen."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total submissions" value={certificates.length} />
        <StatCard label="Submitted today" value={todayCount} tone="primary" />
        <StatCard label="On the big screen" value={onScreenCount} tone="signature" hint="Testimonials are shown automatically" />
      </div>

      {/* Action bar */}
      <div className="admin-card flex flex-col items-stretch justify-between gap-3 p-3 sm:p-4 md:flex-row md:items-center">
        <div className="relative flex-1 md:max-w-md">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            type="search"
            aria-label="Search submissions"
            placeholder="Search by name, email, company, designation…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-10 w-full bg-card pl-9"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <Button onClick={exportCSV} variant="outline" className="admin-button h-10 gap-2">
            <Download /> Export CSV
          </Button>
          <Button onClick={() => toggleSelectAllCerts(filteredCertificates)} variant="outline" className="admin-button h-10">
            {allFilteredSelected ? 'Deselect all' : 'Select all'}
          </Button>
          {selectedCertIds.size > 0 && (
            <Button
              onClick={() => setDeleteConfirmation({ type: 'selected-certificates', count: selectedCertIds.size })}
              variant="destructive"
              className="admin-button col-span-2 h-10 gap-2 sm:col-span-1"
              disabled={isDeletingCerts}
            >
              <Trash2 /> Delete selected ({selectedCertIds.size})
            </Button>
          )}
          <Button
            onClick={() => setDeleteConfirmation({ type: 'all-certificates', count: certificates.length })}
            variant="destructive"
            className="admin-button h-10"
            disabled={isDeletingCerts || certificates.length === 0}
          >
            Clear all
          </Button>
        </div>
      </div>

      <Card className="admin-card gap-0 overflow-hidden py-0">
        <CardHeader className="border-b px-4 py-4 sm:px-6">
          <CardTitle className="text-base font-medium">Submissions</CardTitle>
          <CardDescription>Participants, their designations, event groups and feedback.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {/* Mobile: card list */}
          <div className="max-h-[calc(100vh-18rem)] space-y-3 overflow-y-auto p-3 md:hidden">
            {certificatesLoading || filteredCertificates.length === 0
              ? emptyOrLoading
              : filteredCertificates.map((cert) => (
                  <div key={cert.id} className="space-y-3 rounded-2xl bg-surface-page/60 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <InitialAvatar name={cert.userName} className="bg-white" />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-ink">{cert.userName}</p>
                          <p className="font-display-mono text-xs break-all text-muted-foreground">{cert.userEmail}</p>
                        </div>
                      </div>
                      <Checkbox
                        checked={selectedCertIds.has(cert.id)}
                        onCheckedChange={() => toggleSelectCert(cert.id)}
                        aria-label={`Select ${cert.userName}`}
                        className="mt-1 size-5"
                      />
                    </div>
                    <dl className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <dt className="text-muted-foreground">Date</dt>
                        <dd className="font-medium">{new Date(cert.createdAt).toLocaleDateString()}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Time</dt>
                        <dd className="font-medium">{new Date(cert.createdAt).toLocaleTimeString()}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Organisation</dt>
                        <dd className="font-medium">{cert.teamName || '—'}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Designation</dt>
                        <dd className="font-medium">{cert.designation || '—'}</dd>
                      </div>
                    </dl>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Event group</p>
                      {groupSelect(
                        cert,
                        'w-full rounded-lg border border-primary/15 bg-primary/5 px-3 py-2 text-sm font-medium text-primary outline-none focus:border-ring focus:ring-2 focus:ring-ring/30'
                      )}
                    </div>
                    <p className="line-clamp-3 text-xs text-muted-foreground">
                      {cert.feedback || <span className="italic opacity-60">No feedback provided</span>}
                    </p>
                    <div className="flex items-center justify-between gap-3 border-t pt-3">
                      <span className="text-xs font-medium text-emerald-700">Automatically on screen</span>
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon-lg"
                          variant="ghost"
                          className="text-primary hover:bg-accent"
                          onClick={() => setViewingCertificate(cert)}
                          aria-label={`View details for ${cert.userName}`}
                        >
                          <Eye />
                        </Button>
                        {cert.certificateUrl && (
                          <a
                            href={certificateDownloadSrc(cert.id)}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex size-9 items-center justify-center rounded-full bg-accent-blue-soft text-accent-blue-strong transition-colors hover:bg-accent-blue/20"
                            aria-label={`Download certificate for ${cert.userName}`}
                          >
                            <FileText className="size-4" />
                          </a>
                        )}
                        <Button
                          size="icon-lg"
                          variant="ghost"
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => setDeleteConfirmation({ type: 'certificate', id: cert.id, name: cert.userName })}
                          aria-label={`Delete submission from ${cert.userName}`}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
          </div>

          {/* Desktop: table */}
          <div className="admin-table-scroll hidden h-[calc(100vh-20rem)] min-h-[360px] overflow-auto md:block">
            {certificatesLoading || filteredCertificates.length === 0 ? (
              emptyOrLoading
            ) : (
              <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0 z-10 border-b border-border bg-surface-page/95 backdrop-blur">
                  <tr className="text-left text-xs font-medium text-muted-foreground">
                    <th scope="col" className="w-10 px-4 py-3.5">
                      <Checkbox
                        checked={allFilteredSelected}
                        indeterminate={someFilteredSelected}
                        onCheckedChange={() => toggleSelectAllCerts(filteredCertificates)}
                        aria-label="Select all visible submissions"
                      />
                    </th>
                    <th scope="col" className="px-4 py-3.5 whitespace-nowrap">Date & time</th>
                    <th scope="col" className="px-4 py-3.5 whitespace-nowrap">Name</th>
                    <th scope="col" className="px-4 py-3.5 whitespace-nowrap">Email</th>
                    <th scope="col" className="px-4 py-3.5 whitespace-nowrap">Organisation</th>
                    <th scope="col" className="px-4 py-3.5 whitespace-nowrap">Designation</th>
                    <th scope="col" className="px-4 py-3.5 whitespace-nowrap">Event group</th>
                    <th scope="col" className="px-4 py-3.5 whitespace-nowrap">Feedback</th>
                    <th scope="col" className="w-24 px-4 py-3.5 text-center whitespace-nowrap">Certificate</th>
                    <th scope="col" className="w-24 px-4 py-3.5 text-center whitespace-nowrap">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredCertificates.map((cert) => (
                    <tr key={cert.id} className="transition-colors hover:bg-surface-page/50">
                      <td className="px-4 py-3">
                        <Checkbox
                          checked={selectedCertIds.has(cert.id)}
                          onCheckedChange={() => toggleSelectCert(cert.id)}
                          aria-label={`Select ${cert.userName}`}
                        />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-display-mono text-xs text-ink">{new Date(cert.createdAt).toLocaleDateString()}</div>
                        <div className="font-display-mono text-xs text-muted-foreground">{new Date(cert.createdAt).toLocaleTimeString()}</div>
                      </td>
                      <td className="px-4 py-3 font-medium whitespace-nowrap text-ink">
                        <span className="flex items-center gap-2.5">
                          <InitialAvatar name={cert.userName} className="size-8 text-xs" />
                          {cert.userName}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-display-mono text-xs whitespace-nowrap text-muted-foreground">{cert.userEmail}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{cert.teamName || <span className="text-muted-foreground/60">—</span>}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{cert.designation || <span className="text-muted-foreground/60">—</span>}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {groupSelect(
                          cert,
                          'cursor-pointer rounded-full border border-transparent bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary outline-none hover:border-primary/20 focus:border-ring focus:ring-2 focus:ring-ring/30'
                        )}
                      </td>
                      <td className="max-w-[200px] truncate px-4 py-3 text-xs text-muted-foreground" title={cert.feedback}>
                        {cert.feedback || <span className="italic opacity-50">No feedback provided</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {cert.certificateUrl ? (
                          <a
                            href={certificateDownloadSrc(cert.id)}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center justify-center rounded-full bg-accent-blue-soft p-2 text-accent-blue-strong transition-colors hover:bg-accent-blue/20"
                            aria-label={`Download certificate for ${cert.userName}`}
                            title="Download / view certificate PDF"
                          >
                            <FileText className="size-4" />
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">Pending</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-primary hover:bg-accent"
                            onClick={() => setViewingCertificate(cert)}
                            aria-label={`View details for ${cert.userName}`}
                            title="View submission details"
                          >
                            <Eye />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => setDeleteConfirmation({ type: 'certificate', id: cert.id, name: cert.userName })}
                            aria-label={`Delete submission from ${cert.userName}`}
                            title="Delete submission"
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
