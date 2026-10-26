'use client';

import { useEffect, useState } from 'react';
import { X, Download } from 'lucide-react';
import { toast } from 'sonner';
import { useAdminData } from '../AdminDataProvider';

// ---- inline extract of the real Testimonials table ----
import type { CertificateRecord, EventImage } from '@/types';
import { Dialog } from '@base-ui/react/dialog';
import {
  BadgeCheck,
  Building2,
  CalendarClock,
  Eye,
  FileText,
  Image as ImageIcon,
  Mail,
  MessageSquareQuote,
  MessageSquareText,
  Search,
  Trash2,
  User,
} from 'lucide-react';
import { bulkDeleteCertificates, deleteCertificate, updateCertificate } from '@/lib/api';
import { imageSrc } from '@/lib/image-urls';
import { Arches } from '@/components/shared/Arches';
import { InitialAvatar } from '@/components/shared/InitialAvatar';
import Image from 'next/image';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';

type DeleteConfirmation =
  | { type: 'certificate'; id: string; name: string }
  | { type: 'selected-certificates'; count: number }
  | { type: 'all-certificates'; count: number };

const certDownloadSrc = (id: string) => `/api/certificates/${encodeURIComponent(id)}/download`;
const normalizeGroup = (name?: string) => name?.trim().toLowerCase() || '';

function DetailField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-[#141e36] p-3">
      <div className="text-[10px] font-medium text-slate-400 mb-1">{label}</div>
      <div className="text-xs font-medium text-white break-words">{value || '—'}</div>
    </div>
  );
}

function CertDetail({
  cert,
  groupImage,
  onClose,
}: {
  cert: CertificateRecord | null;
  groupImage: EventImage | null;
  onClose: () => void;
}) {
  const submittedAt = cert ? new Date(cert.createdAt) : null;
  return (
    <Dialog.Root open={Boolean(cert)} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-[201] flex max-h-[92vh] w-[calc(100%-1.5rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-3xl bg-[#0e1628] border border-slate-700 text-white shadow-2xl outline-none">
          {cert && submittedAt && (
            <>
              <div className="flex items-start justify-between gap-4 border-b border-slate-800 p-5">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">Submission details</p>
                  <Dialog.Title className="mt-1 text-xl font-semibold text-white">{cert.userName}</Dialog.Title>
                  <Dialog.Description className="mt-0.5 text-xs text-slate-400 break-all">{cert.userEmail}</Dialog.Description>
                </div>
                <Dialog.Close
                  render={
                    <button
                      type="button"
                      aria-label="Close"
                      className="size-8 rounded-full bg-[#16213e] border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white cursor-pointer"
                    />
                  }
                >
                  <X className="size-4" />
                </Dialog.Close>
              </div>

              <div className="overflow-y-auto p-5 space-y-4">
                {groupImage && (
                  <div className="relative h-44 rounded-2xl overflow-hidden">
                    <Image src={imageSrc(groupImage, 'card')} alt={groupImage.groupName} fill unoptimized sizes="640px" className="object-cover" />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                      <p className="text-xs font-medium text-white truncate">{groupImage.groupName}</p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <DetailField label="Name" value={cert.userName} />
                  <DetailField label="Email" value={cert.userEmail} />
                  <DetailField label="Organisation" value={cert.teamName} />
                  <DetailField label="Designation" value={cert.designation} />
                  <DetailField label="Group" value={cert.groupName} />
                  <DetailField label="Submitted" value={`${submittedAt.toLocaleDateString()} ${submittedAt.toLocaleTimeString()}`} />
                </div>

                {cert.feedback && (
                  <div className="rounded-2xl bg-gradient-to-br from-[#1a2f5c] to-[#1a3a6e] p-5 relative overflow-hidden">
                    <Arches className="text-white/20 absolute" />
                    <div className="relative">
                      <div className="flex items-center gap-2 text-xs font-medium text-slate-300 mb-2">
                        <span className="size-6 rounded-full bg-white/10 flex items-center justify-center">
                          <MessageSquareText className="size-3" />
                        </span>
                        Feedback
                      </div>
                      <p className="text-sm text-white/90 leading-relaxed italic">{`"${cert.feedback}"`}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2 border-t border-slate-800 p-4 sm:flex-row sm:justify-end">
                {cert.certificateUrl ? (
                  <a
                    href={certDownloadSrc(cert.id)}
                    className="rounded-full bg-[#9bb3ff] hover:bg-[#88a3f8] text-[#0b1228] px-5 py-2 text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-md"
                  >
                    <Download className="size-3.5" />
                    Download certificate
                  </a>
                ) : (
                  <span className="text-xs text-slate-400">Certificate pending</span>
                )}
                <Dialog.Close render={<button type="button" className="rounded-full border border-slate-700 text-slate-300 hover:text-white px-5 py-2 text-xs font-medium cursor-pointer" />}>
                  Close
                </Dialog.Close>
              </div>
            </>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function TestimonialsDrawer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { images, certificates, setCertificates, certificatesLoading } = useAdminData();
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [viewingCert, setViewingCert] = useState<CertificateRecord | null>(null);
  const [deleteConf, setDeleteConf] = useState<DeleteConfirmation | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open && !viewingCert) onOpenChange(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, viewingCert, onOpenChange]);

  if (!open) return null;

  const filtered = certificates.filter((c) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return [c.userName, c.userEmail, c.teamName, c.designation, c.groupName, c.feedback].some((v) =>
      (v || '').toLowerCase().includes(q)
    );
  });

  const toggle = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const allSelected = filtered.length > 0 && filtered.every((c) => selectedIds.has(c.id));

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
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `testimonials_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('CSV exported!');
  };

  const confirmDelete = async () => {
    if (!deleteConf) return;
    setIsDeleting(true);
    try {
      if (deleteConf.type === 'certificate') {
        await deleteCertificate(deleteConf.id);
        setCertificates((prev) => prev.filter((c) => c.id !== deleteConf.id));
        setSelectedIds((prev) => { const n = new Set(prev); n.delete(deleteConf.id); return n; });
        toast.success('Submission deleted');
      } else if (deleteConf.type === 'selected-certificates') {
        await bulkDeleteCertificates(Array.from(selectedIds));
        setCertificates((prev) => prev.filter((c) => !selectedIds.has(c.id)));
        toast.success(`Deleted ${selectedIds.size} submissions`);
        setSelectedIds(new Set());
      } else {
        await bulkDeleteCertificates();
        toast.success(`Deleted all ${certificates.length} submissions`);
        setCertificates([]);
        setSelectedIds(new Set());
      }
    } catch {
      toast.error('Delete failed');
    } finally {
      setIsDeleting(false);
      setDeleteConf(null);
    }
  };

  const availableGroups = Array.from(new Set([...images.map((i) => i.groupName), ...certificates.map((c) => c.groupName)].filter(Boolean))).sort();

  const handleGroupChange = async (id: string, groupName: string) => {
    try {
      await updateCertificate(id, { groupName });
      setCertificates((prev) => prev.map((c) => (c.id === id ? { ...c, groupName } : c)));
      toast.success(`Group updated`);
    } catch {
      toast.error('Failed to update group');
    }
  };

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Testimonials"
        className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={(e) => { if (e.target === e.currentTarget) onOpenChange(false); }}
      >
        <div className="theme-tr theme-admin relative w-full max-w-5xl max-h-[90vh] rounded-3xl bg-[#0e1628] border border-slate-700/80 shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-slate-800 shrink-0">
            <div>
              <h2 className="text-lg font-semibold text-white">Testimonials</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {certificates.length} submissions · Participant feedback and certificates
              </p>
            </div>
            <div className="flex items-center gap-2">
              {selectedIds.size > 0 && (
                <button
                  type="button"
                  onClick={() => setDeleteConf({ type: 'selected-certificates', count: selectedIds.size })}
                  className="rounded-full border border-red-500/50 text-red-400 hover:bg-red-500/10 px-4 py-2 text-xs font-medium flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <Trash2 className="size-3.5" />
                  Delete ({selectedIds.size})
                </button>
              )}
              <button
                type="button"
                onClick={exportCSV}
                className="rounded-full bg-[#1a2544] hover:bg-[#223058] border border-slate-700 text-white px-4 py-2 text-xs font-medium flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Download className="size-3.5" />
                Export CSV
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

          {/* Search bar */}
          <div className="px-6 py-3 border-b border-slate-800/60 shrink-0">
            <div className="relative">
              <Search className="absolute top-1/2 left-3 -translate-y-1/2 size-4 text-slate-500" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, email, company, designation…"
                className="w-full bg-[#131b31] border border-slate-700/80 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#9bb3ff]/50"
              />
            </div>
          </div>

          {/* Table body */}
          <div className="flex-1 overflow-auto">
            {certificatesLoading ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full bg-slate-800/60" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <MessageSquareQuote className="size-10 mb-3 opacity-40" />
                <p className="font-medium">{search ? 'No matching submissions' : 'No submissions yet'}</p>
                <p className="text-xs mt-1 opacity-70">{search ? 'Try a different search term.' : 'Submissions will appear here.'}</p>
              </div>
            ) : (
              <>
                {/* Mobile: cards */}
                <div className="md:hidden divide-y divide-slate-800/60">
                  {filtered.map((cert) => (
                    <div key={cert.id} className="p-4 flex items-start gap-3">
                      <Checkbox
                        checked={selectedIds.has(cert.id)}
                        onCheckedChange={() => toggle(cert.id)}
                        aria-label={`Select ${cert.userName}`}
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-white truncate">{cert.userName}</p>
                          <span className="text-[11px] text-slate-400 shrink-0">{new Date(cert.createdAt).toLocaleDateString()}</span>
                        </div>
                        <p className="text-xs text-slate-400 truncate">{cert.userEmail}</p>
                        {cert.teamName && <p className="text-xs text-slate-500 mt-0.5">{cert.teamName}</p>}
                        {cert.feedback && <p className="text-xs text-slate-400 mt-1.5 line-clamp-2 italic">{`"${cert.feedback}"`}</p>}
                        <div className="flex items-center gap-2 mt-2">
                          <button onClick={() => setViewingCert(cert)} className="text-[11px] text-[#9bb3ff] cursor-pointer hover:underline">View</button>
                          <button
                            onClick={() => setDeleteConf({ type: 'certificate', id: cert.id, name: cert.userName })}
                            className="text-[11px] text-red-400 cursor-pointer hover:underline"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop: table */}
                <table className="hidden md:table w-full border-collapse text-sm">
                  <thead className="sticky top-0 bg-[#0a1221] border-b border-slate-800 z-10">
                    <tr className="text-left text-[11px] font-medium text-slate-400">
                      <th className="w-10 px-4 py-3">
                        <Checkbox
                          checked={allSelected}
                          onCheckedChange={() => {
                            if (allSelected) setSelectedIds(new Set());
                            else setSelectedIds(new Set(filtered.map((c) => c.id)));
                          }}
                          aria-label="Select all"
                        />
                      </th>
                      <th className="px-4 py-3 whitespace-nowrap">Date & time</th>
                      <th className="px-4 py-3 whitespace-nowrap">Name</th>
                      <th className="px-4 py-3 whitespace-nowrap">Email</th>
                      <th className="px-4 py-3 whitespace-nowrap">Organisation</th>
                      <th className="px-4 py-3 whitespace-nowrap">Designation</th>
                      <th className="px-4 py-3 whitespace-nowrap">Group</th>
                      <th className="px-4 py-3 whitespace-nowrap">Feedback</th>
                      <th className="px-4 py-3 whitespace-nowrap text-center">Certificate</th>
                      <th className="px-4 py-3 whitespace-nowrap text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filtered.map((cert) => (
                      <tr key={cert.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-3">
                          <Checkbox checked={selectedIds.has(cert.id)} onCheckedChange={() => toggle(cert.id)} aria-label={`Select ${cert.userName}`} />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <p className="text-white text-xs font-medium">{new Date(cert.createdAt).toLocaleDateString()}</p>
                          <p className="text-slate-400 text-[11px]">{new Date(cert.createdAt).toLocaleTimeString()}</p>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <InitialAvatar name={cert.userName} className="bg-[#1a2544] text-[#9bb3ff] border border-slate-700" />
                            <span className="text-white text-xs font-medium truncate max-w-[120px]" title={cert.userName}>{cert.userName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-300 text-xs max-w-[140px]">
                          <span className="truncate block" title={cert.userEmail}>{cert.userEmail}</span>
                        </td>
                        <td className="px-4 py-3 text-slate-300 text-xs whitespace-nowrap">{cert.teamName || '—'}</td>
                        <td className="px-4 py-3 text-slate-300 text-xs whitespace-nowrap">{cert.designation || '—'}</td>
                        <td className="px-4 py-3">
                          <select
                            value={cert.groupName || ''}
                            onChange={(e) => void handleGroupChange(cert.id, e.target.value)}
                            className="bg-[#131b31] border border-slate-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-[#9bb3ff] cursor-pointer"
                          >
                            {availableGroups.map((g) => <option key={g} value={g}>{g}</option>)}
                          </select>
                        </td>
                        <td className="px-4 py-3 text-slate-300 text-xs max-w-[200px]">
                          <span className="line-clamp-2">{cert.feedback || '—'}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {cert.certificateUrl ? (
                            <a
                              href={certDownloadSrc(cert.id)}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[#9bb3ff] hover:underline text-xs cursor-pointer"
                              aria-label={`Download certificate for ${cert.userName}`}
                            >
                              <FileText className="size-4 inline" />
                            </a>
                          ) : (
                            <span className="text-slate-500 text-xs">Pending</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => setViewingCert(cert)}
                              className="size-7 rounded-lg bg-[#1a2544] hover:bg-[#223058] flex items-center justify-center text-[#9bb3ff] cursor-pointer transition-colors"
                              aria-label={`View ${cert.userName}`}
                            >
                              <Eye className="size-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteConf({ type: 'certificate', id: cert.id, name: cert.userName })}
                              className="size-7 rounded-lg hover:bg-red-500/10 flex items-center justify-center text-red-400/70 hover:text-red-400 cursor-pointer transition-colors"
                              aria-label={`Delete ${cert.userName}`}
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        </div>
      </div>

      <CertDetail
        cert={viewingCert}
        groupImage={viewingCert ? images.find((img) => normalizeGroup(img.groupName) === normalizeGroup(viewingCert.groupName)) ?? null : null}
        onClose={() => setViewingCert(null)}
      />

      <ConfirmDialog
        open={Boolean(deleteConf)}
        title={
          deleteConf?.type === 'certificate'
            ? 'Delete this submission?'
            : deleteConf?.type === 'selected-certificates'
              ? `Delete ${deleteConf.count} submissions?`
              : `Delete all ${deleteConf?.type === 'all-certificates' ? (deleteConf as { count: number }).count : ''} submissions?`
        }
        description={
          deleteConf?.type === 'certificate'
            ? `"${deleteConf.name}" will be permanently removed.`
            : deleteConf?.type === 'selected-certificates'
              ? `These ${deleteConf.count} submissions will be permanently removed.`
              : 'All submissions will be permanently removed. Export a CSV first if you need a record.'
        }
        confirmLabel="Yes, delete"
        cancelLabel="No, keep"
        isLoading={isDeleting}
        requireText={deleteConf?.type === 'all-certificates' ? 'DELETE' : undefined}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteConf(null)}
      />
    </>
  );
}
