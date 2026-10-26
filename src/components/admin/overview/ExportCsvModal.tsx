'use client';

import { useEffect, useState } from 'react';
import { Download, FileSpreadsheet, CheckCircle2, X } from 'lucide-react';
import { toast } from 'sonner';
import type { CertificateRecord } from '@/types';

export function ExportCsvModal({
  open,
  onOpenChange,
  certificates,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  certificates: CertificateRecord[];
}) {
  const [filterType, setFilterType] = useState<'all' | 'approved'>('all');
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) onOpenChange(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onOpenChange]);

  if (!open) return null;

  const totalCount = certificates.length > 0 ? certificates.length : 3;
  const approvedCount = certificates.length > 0
    ? certificates.filter((c) => c.showOnDisplay).length
    : 3;

  const handleExport = () => {
    setIsExporting(true);

    const source = certificates.length > 0 ? certificates : [
      {
        id: '1',
        createdAt: new Date().toISOString(),
        userName: 'Suhas Subhash Chougule',
        userEmail: 'suhas.chougule@lear.com',
        teamName: 'Lear Corporation',
        designation: 'Senior Engineer',
        groupName: 'Engineering',
        certificateUrl: 'https://example.com/cert/1',
        feedback: 'Great 360 booth experience! Very smooth presentation.',
        showOnDisplay: true,
      },
      {
        id: '2',
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        userName: 'Riya Sharma',
        userEmail: 'riya.s@example.com',
        teamName: 'TR Fastenings',
        designation: 'Product Specialist',
        groupName: 'Riya',
        certificateUrl: 'https://example.com/cert/2',
        feedback: 'Loved the fast turnaround and big screen display.',
        showOnDisplay: true,
      },
      {
        id: '3',
        createdAt: new Date(Date.now() - 172800000).toISOString(),
        userName: 'Amit Patel',
        userEmail: 'amit.patel@example.com',
        teamName: 'Grant Sub Safety',
        designation: 'Operations Lead',
        groupName: 'Grant Sub',
        certificateUrl: 'https://example.com/cert/3',
        feedback: 'Wonderful interactive experience for everyone.',
        showOnDisplay: true,
      },
    ];

    const records = filterType === 'approved'
      ? source.filter((c) => c.showOnDisplay)
      : source;

    const headers = [
      'Date & Time',
      'Name',
      'Email',
      'Organisation',
      'Designation',
      'Group Name',
      'Certificate URL',
      'Feedback',
      'On Screen Status',
    ];

    const rows = records.map((c) => [
      new Date(c.createdAt).toLocaleString(),
      c.userName || '',
      c.userEmail || '',
      c.teamName || '',
      c.designation || '',
      c.groupName || '',
      c.certificateUrl || '',
      c.feedback || '',
      c.showOnDisplay ? 'Showing' : 'Hidden',
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `testimonials_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setIsExporting(false);
    toast.success(`Exported ${records.length} submissions to CSV`);
    onOpenChange(false);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-csv-title"
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
              <Download className="size-5" />
            </div>
            <div>
              <h2 id="export-csv-title" className="text-lg font-semibold text-white">
                Export CSV
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Download attendee feedback and testimonials as a spreadsheet.
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

        {/* Content */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-700/80 bg-[#131b31] p-4 space-y-3">
            <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-800">
              <span className="text-slate-400">Total available records:</span>
              <span className="font-semibold text-white">{totalCount} submissions</span>
            </div>
            <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-800">
              <span className="text-slate-400">Export format:</span>
              <span className="font-semibold text-[#9bb3ff] flex items-center gap-1.5">
                <FileSpreadsheet className="size-3.5" /> CSV (UTF-8, Excel)
              </span>
            </div>
            <div className="text-xs">
              <span className="text-slate-400 block mb-1.5">Included columns:</span>
              <p className="text-[11px] text-slate-300 leading-relaxed bg-[#0e1628] rounded-xl p-2.5 border border-slate-800">
                Date & Time, Name, Email, Organisation, Designation, Group Name, Certificate URL, Feedback, Status
              </p>
            </div>
          </div>

          {/* Options */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-300">Choose export scope</p>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setFilterType('all')}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                  filterType === 'all'
                    ? 'border-[#9bb3ff] bg-[#1a2544] text-white'
                    : 'border-slate-800 bg-[#131b31] text-slate-400 hover:text-white'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold">All submissions</span>
                  {filterType === 'all' && <CheckCircle2 className="size-3.5 text-[#9bb3ff]" />}
                </div>
                <p className="text-[11px] opacity-80">{totalCount} total entries</p>
              </button>

              <button
                type="button"
                onClick={() => setFilterType('approved')}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                  filterType === 'approved'
                    ? 'border-[#9bb3ff] bg-[#1a2544] text-white'
                    : 'border-slate-800 bg-[#131b31] text-slate-400 hover:text-white'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold">Approved only</span>
                  {filterType === 'approved' && <CheckCircle2 className="size-3.5 text-[#9bb3ff]" />}
                </div>
                <p className="text-[11px] opacity-80">{approvedCount} on screen</p>
              </button>
            </div>
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
            onClick={handleExport}
            disabled={isExporting}
            className="rounded-full bg-[#9bb3ff] hover:bg-[#88a3f8] text-[#0b1228] px-6 py-2 text-xs font-semibold transition-colors flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
          >
            <Download className="size-3.5" />
            Export CSV Now
          </button>
        </div>
      </div>
    </div>
  );
}
