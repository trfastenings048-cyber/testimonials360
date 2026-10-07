'use client';

import { useState, useEffect, useRef, FormEvent } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { downloadGroupImage, fetchImages, createCertificate, downloadCertificateFile, uploadFile } from '@/lib/api';
import { imagePreviewSrc } from '@/lib/image-urls';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Download, CheckCircle2, Award, Mail } from 'lucide-react';
import { EventImage } from '@/types';
import jsPDF from 'jspdf';
import confetti from 'canvas-confetti';
import { motion, AnimatePresence } from 'motion/react';

// To link your Google Sheet automatically, paste the Web App URL from Extensions -> Apps Script here:
const GOOGLE_SHEETS_WEBHOOK_URL = '';
const LOGO_URL = '/tr-fastenings-logo.jpg';
const LOGO_RATIO = 140 / 134; // width / height

const NAVY: [number, number, number] = [3, 43, 105];
const TEAL: [number, number, number] = [0, 169, 183];

const PLEDGE_INTRO =
  'Today, you explored the hidden journey of water beyond the tap and beyond the drain, discovering how innovation, infrastructure, and collective action can transform wastewater into a resource that protects public health, strengthens communities, and secures our shared future.';
const PLEDGE_COMMITMENT =
  'As you leave, you are invited to carry this awareness beyond these walls and make a personal commitment towards a more water-secure future.';
const PLEDGE_ITEMS = [
  'Value every drop of water and use it responsibly.',
  'Think beyond the flush and recognise the journey water continues to take.',
  'Encourage conversations and actions that build healthier, more water-secure communities.',
  'Carry this awareness into my everyday choices and inspire others to do the same.',
];

let logoDataUrlPromise: Promise<string> | null = null;

const loadLogo = () => {
  if (!logoDataUrlPromise) {
    logoDataUrlPromise = fetch(LOGO_URL)
      .then((response) => {
        if (!response.ok) throw new Error('Unable to load the logo');
        return response.blob();
      })
      .then((blob) => new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Unable to read the logo'));
        reader.readAsDataURL(blob);
      }));
  }

  return logoDataUrlPromise;
};

interface PledgeDetails {
  name: string;
  designation?: string;
  organisation?: string;
}

// On-screen preview that mirrors the generated PDF (A4 at 595x842 units, scaled to fit).
function CertificatePreview({ name, designation, organisation }: PledgeDetails) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.6);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / 595);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const role = [designation, organisation].filter(Boolean).join(' · ');
  const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div
      ref={wrapRef}
      className="relative mx-auto w-full max-w-sm overflow-hidden rounded-lg shadow-xl ring-1 ring-black/10"
      style={{ aspectRatio: '595 / 842' }}
    >
      <div
        className="absolute left-0 top-0 origin-top-left bg-white text-left"
        style={{ width: 595, height: 842, transform: `scale(${scale})` }}
      >
        <div className="absolute inset-[18px] border-2 border-[#032b69]" />
        <div className="absolute inset-[26px] border border-[#00a9b7]" />
        <div className="absolute inset-x-[27px] top-[27px] h-[150px] bg-[#032b69]" />
        <div className="absolute left-1/2 top-[48px] -translate-x-1/2 rounded-md bg-white p-1.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO_URL} alt="TR Fastenings" style={{ height: 78, width: 78 * LOGO_RATIO }} />
        </div>
        <p className="absolute inset-x-0 top-[148px] text-center text-[10px] font-bold uppercase tracking-[0.3em] text-[#7fe3ec]">Sanitation Sandbox</p>
        <h3 className="absolute inset-x-0 top-[200px] text-center text-[30px] font-black uppercase tracking-[0.08em] text-[#032b69]">Certificate of Pledge</h3>
        <div className="absolute left-1/2 top-[246px] h-[3px] w-[70px] -translate-x-1/2 bg-[#00a9b7]" />
        <p className="absolute inset-x-0 top-[268px] text-center text-[12px] uppercase tracking-[0.2em] text-neutral-500">This pledge is made by</p>
        <p className="absolute inset-x-[60px] top-[292px] truncate text-center text-[34px] font-bold leading-tight text-[#032b69]">{name.trim()}</p>
        <div className="absolute inset-x-[110px] top-[342px] h-px bg-[#00a9b7]" />
        {role && <p className="absolute inset-x-[60px] top-[350px] truncate text-center text-[12px] text-neutral-500">{role}</p>}
        <p className="absolute inset-x-[64px] top-[386px] text-[11.5px] leading-[17px] text-neutral-700">{PLEDGE_INTRO}</p>
        <p className="absolute inset-x-[64px] top-[470px] text-[11.5px] leading-[17px] text-neutral-700">{PLEDGE_COMMITMENT}</p>
        <p className="absolute inset-x-[64px] top-[522px] text-[13px] font-bold uppercase tracking-wider text-[#032b69]">I pledge to</p>
        <ul className="absolute inset-x-[64px] top-[548px] space-y-[7px] text-[11.5px] leading-[16px] text-neutral-700">
          {PLEDGE_ITEMS.map((item) => (
            <li key={item} className="flex gap-2.5">
              <span className="mt-[5px] h-[6px] w-[6px] shrink-0 rounded-full bg-[#00a9b7]" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <div className="absolute inset-x-[27px] bottom-[27px] flex h-[56px] items-center justify-between bg-[#032b69] px-[38px] text-[10px] text-white">
          <span className="font-semibold tracking-wider">TR FASTENINGS · A Trifast plc Group company</span>
          <span className="text-[#7fe3ec]">{date}</span>
        </div>
      </div>
    </div>
  );
}

export default function CertificateSystem() {
  const [images, setImages] = useState<EventImage[]>([]);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [teamName, setTeamName] = useState(''); // organization / team name
  const [designation, setDesignation] = useState('');
  const [feedback, setFeedback] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGenerated, setIsGenerated] = useState(false);
  const [currentCertUrl, setCurrentCertUrl] = useState('');
  const [currentCertificateId, setCurrentCertificateId] = useState('');
  const [currentCertName, setCurrentCertName] = useState('');
  const [backgroundUploading, setBackgroundUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const router = useRouter();

  useEffect(() => {
    const loadData = async () => {
      try {
        // The certificate form must list every uploaded group, including groups
        // hidden from the rotating big-screen display.
        const imgs = await fetchImages();
        const groups = new Map<string, EventImage>();

        // The API returns newest uploads first, so retain the newest image when
        // the same group has been uploaded more than once.
        imgs.forEach((img) => {
          const groupKey = img.groupName.trim().toLowerCase();
          if (groupKey && !groups.has(groupKey)) {
            groups.set(groupKey, img);
          }
        });

        const unique = Array.from(groups.values()).sort((a, b) =>
          a.groupName.localeCompare(b.groupName, undefined, {
            numeric: true,
            sensitivity: 'base',
          })
        );
        setImages(unique);
      } catch (err) {
        console.error("Error loading images:", err);
      }
    };
    loadData();
  }, []);

  const generatePDF = async ({ name, designation, organisation }: PledgeDetails) => {
    const logoDataUrl = await loadLogo();
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const cx = W / 2;
    const margin = 64;

    // Frame
    doc.setDrawColor(...NAVY);
    doc.setLineWidth(2);
    doc.rect(18, 18, W - 36, H - 36);
    doc.setDrawColor(...TEAL);
    doc.setLineWidth(0.75);
    doc.rect(26, 26, W - 52, H - 52);

    // Header band with logo tile
    doc.setFillColor(...NAVY);
    doc.rect(27, 27, W - 54, 150, 'F');
    const logoH = 78;
    const logoW = logoH * LOGO_RATIO;
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(cx - logoW / 2 - 6, 48, logoW + 12, logoH + 12, 4, 4, 'F');
    doc.addImage(logoDataUrl, 'JPEG', cx - logoW / 2, 54, logoW, logoH);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(127, 227, 236);
    doc.text('SANITATION SANDBOX', cx, 158, { align: 'center', charSpace: 3 });

    // Title
    doc.setTextColor(...NAVY);
    doc.setFontSize(28);
    doc.text('CERTIFICATE OF PLEDGE', cx, 222, { align: 'center', charSpace: 2 });
    doc.setFillColor(...TEAL);
    doc.rect(cx - 35, 240, 70, 3, 'F');

    // Name
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(115, 115, 115);
    doc.text('THIS PLEDGE IS MADE BY', cx, 276, { align: 'center', charSpace: 2 });

    let nameFontSize = 32;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(nameFontSize);
    const maxNameWidth = W - 2 * margin;
    while (doc.getTextWidth(name.trim()) > maxNameWidth && nameFontSize > 12) {
      nameFontSize -= 1;
      doc.setFontSize(nameFontSize);
    }
    doc.setTextColor(...NAVY);
    doc.text(name.trim(), cx, 320, { align: 'center' });
    doc.setDrawColor(...TEAL);
    doc.setLineWidth(1);
    doc.line(cx - 190, 336, cx + 190, 336);

    const role = [designation, organisation].map((v) => v?.trim()).filter(Boolean).join('  ·  ');
    if (role) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(12);
      doc.setTextColor(115, 115, 115);
      doc.text(role, cx, 356, { align: 'center', maxWidth: W - 2 * margin });
    }

    // Body
    const textWidth = W - 2 * margin;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11.5);
    doc.setTextColor(64, 64, 64);
    const intro = doc.splitTextToSize(PLEDGE_INTRO, textWidth) as string[];
    doc.text(intro, margin, 396, { lineHeightFactor: 1.5 });
    const commitY = 396 + intro.length * 17 + 14;
    const commitment = doc.splitTextToSize(PLEDGE_COMMITMENT, textWidth) as string[];
    doc.text(commitment, margin, commitY, { lineHeightFactor: 1.5 });

    let y = commitY + commitment.length * 17 + 24;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...NAVY);
    doc.text('I PLEDGE TO', margin, y, { charSpace: 1 });
    y += 24;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11.5);
    doc.setTextColor(64, 64, 64);
    PLEDGE_ITEMS.forEach((item) => {
      const lines = doc.splitTextToSize(item, textWidth - 16) as string[];
      doc.setFillColor(...TEAL);
      doc.circle(margin + 3, y - 3.5, 3, 'F');
      doc.text(lines, margin + 16, y, { lineHeightFactor: 1.4 });
      y += lines.length * 16 + 7;
    });

    // Footer band
    doc.setFillColor(...NAVY);
    doc.rect(27, H - 83, W - 54, 56, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text('TR FASTENINGS · A Trifast plc Group company', 65, H - 51, { charSpace: 0.5 });
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(127, 227, 236);
    doc.text(
      new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
      W - 65,
      H - 51,
      { align: 'right' }
    );

    return doc;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!userName || !userEmail || !selectedGroupId) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);
    const selectedImage = images.find(img => img.id === selectedGroupId);
    
    if (!selectedImage) {
      toast.error('Selected group data not found');
      setIsSubmitting(false);
      return;
    }

    try {
      // Generate the fixed pledge design with only the participant name personalised.
      const pdfDoc = await generatePDF({ name: userName, designation, organisation: teamName });
      const pdfBlob = pdfDoc.output('blob');

      // Build a named File and local object URL so the user can download immediately
      const safeName = `Certificate_${userName.trim().replace(/\s+/g, '_')}.pdf`;
      setCurrentCertName(safeName);
      const pdfFile = new File([pdfBlob], safeName, { type: 'application/pdf' });
      const localUrl = URL.createObjectURL(pdfFile);

      // Show certificate immediately (fast) and clear submitting state
      setCurrentCertUrl(localUrl);
      setIsGenerated(true);
      setIsSubmitting(false);

      confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
      toast.success('Certificate generated — uploading in background');

      // 2️⃣ Background upload & Firestore save (do not block UI)
      (async () => {
        setBackgroundUploading(true);
        setUploadProgress(0);
        const uid = crypto.randomUUID();
        let certUrl = localUrl;
        try {
          certUrl = await uploadFile(pdfFile, uid, 'certificates', (pct) => setUploadProgress(pct));
        } catch (uploadErr) {
          console.error('Background upload failed, keeping local URL:', uploadErr);
        }

        try {
          const savedCertificate = await createCertificate({
            userName,
            userEmail,
            teamName,
            designation,
            groupName: selectedImage.groupName,
            imageUrl: selectedImage.url,
            certificateUrl: certUrl,
            feedback,
            showOnDisplay: true,
            createdAt: Date.now()
          });
          setCurrentCertificateId(savedCertificate.id);

          // Notify BigScreen to refresh — no polling needed.
          try {
            const channel = new BroadcastChannel('gates360-events');
            channel.postMessage({ type: 'certificate-submitted' });
            channel.close();
          } catch {
            // BroadcastChannel unavailable (e.g. cross-origin iframe) — silently ignore.
          }

          // Send to Google Sheets if Webhook URL is configured
          const sheetsUrl = process.env.NEXT_PUBLIC_GOOGLE_SHEETS_WEBHOOK_URL || GOOGLE_SHEETS_WEBHOOK_URL;
          if (sheetsUrl) {
            try {
              await fetch(sheetsUrl, {
                method: 'POST',
                mode: 'no-cors',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  date: new Date().toLocaleString(),
                  userName,
                  userEmail,
                  teamName,
                  designation,
                  groupName: selectedImage.groupName,
                  feedback,
                }),
              });
            } catch (sheetErr) {
              console.error('Failed to send to Google Sheets:', sheetErr);
            }
          }

          // Send an email notification to sanitationsandbox@gmail.com with the form data
          try {
            await fetch('https://formsubmit.co/ajax/sanitationsandbox@gmail.com', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
              },
              body: JSON.stringify({
                _subject: "New Certificate Form Submission",
                name: userName,
                email: userEmail,
                teamName: teamName,
                designation: designation,
                groupName: selectedImage.groupName,
                feedback: feedback,
              })
            });
          } catch (emailErr) {
            console.error('Failed to send email notification:', emailErr);
          }
        } catch (fsErr: any) {
          console.warn('Firestore save failed in background:', fsErr?.message || fsErr);
          toast.error('Database save failed: ' + (fsErr?.message || fsErr));
        }

        if (certUrl && certUrl !== localUrl) setCurrentCertUrl(certUrl);
        setBackgroundUploading(false);
        setUploadProgress(0);
      })();
    } catch (error) {
      console.error('Certificate processing error:', error);
      const msg = (error && (error as any).message) ? (error as any).message : 'Failed to process your certificate';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const downloadCertificate = async () => {
    const selectedImage = images.find(img => img.id === selectedGroupId);
    if (!selectedImage) return;

    const filename = currentCertName || `Certificate_${userName.replace(/\s+/g, '_')}.pdf`;

    if (currentCertificateId) {
      try {
        const { blob, filename: storedFilename } = await downloadCertificateFile(currentCertificateId);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = storedFilename || filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        return;
      } catch (e) {
        console.warn('Stored certificate download failed, falling back to local PDF:', e);
      }
    }

    if (currentCertUrl?.startsWith('blob:')) {
      try {
        const a = document.createElement('a');
        a.href = currentCertUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        return;
      } catch (e) {
        console.warn('Direct download failed, regenerating PDF', e);
      }
    }

    const doc = await generatePDF({ name: userName, designation, organisation: teamName });
    doc.save(filename);
  };

  const downloadPhoto = async () => {
    const selectedImage = images.find(img => img.id === selectedGroupId);
    if (!selectedImage) return;
    try {
      const { blob, filename } = await downloadGroupImage(selectedImage.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || `${(userName || 'photo').replace(/\s+/g, '_')}_${selectedImage.id}.jpg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error('Failed to download image');
    }
  };

  const shareViaEmail = () => {
    const selectedImage = images.find(img => img.id === selectedGroupId);
    const subject = `Event Certificate: ${userName}`;
    const origin = window.location.origin;
    const photoUrl = selectedImage ? `${origin}/api/images/${encodeURIComponent(selectedImage.id)}/download` : '';
    const certificateUrl = currentCertificateId
      ? `${origin}/api/certificates/${encodeURIComponent(currentCertificateId)}/download`
      : currentCertUrl;
    const body = `Hi,\n\nHere is the certificate for ${userName} from ${teamName || 'N/A'} (${designation || 'N/A'}).\n\nGroup: ${selectedImage?.groupName}\nView Photo: ${photoUrl}\n\nDownload Certificate: ${certificateUrl}`;
    window.location.href = `mailto:nabeel@redsxp.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  if (isGenerated) {
    return (
      <div className="theme-tr min-h-screen w-full bg-gradient-to-b from-[#032b69] via-[#4fc3e8] via-45% to-white to-85% bg-fixed text-neutral-900">
      <header className="relative overflow-hidden bg-transparent text-white shadow-[0_8px_24px_-6px_rgba(3,43,105,0.55)]">
        <div className="relative mx-auto flex w-full max-w-4xl items-center gap-4 px-3 py-5 sm:px-6 sm:py-7">
          <div className="shrink-0 rounded-md bg-white p-1.5 shadow-md">
            <Image
              src="/tr-fastenings-logo.jpg"
              alt="TR Fastenings, part of the Trifast plc Group"
              width={140}
              height={134}
              priority
              className="h-12 w-auto sm:h-16"
            />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#00a9b7]">User Portal</p>
            <h1 className="mt-1 text-2xl font-black uppercase tracking-tight sm:text-4xl">360 Camera</h1>
          </div>
        </div>
      </header>
      <div className="flex flex-col items-center gap-6 px-3 py-6 sm:p-6">
        <Card className="w-full max-w-2xl text-center border border-neutral-200 bg-white text-neutral-900 shadow-2xl overflow-hidden">
          <div className="h-2 bg-[#00a9b7]" />
          <CardHeader className="pt-8">
            <div className="w-20 h-20 bg-[#e6f6f8] rounded-full flex items-center justify-center mx-auto mb-4">
              <Award className="w-10 h-10 text-[#00a9b7]" />
            </div>
            <CardTitle className="text-3xl font-bold">Great Job, {userName}!</CardTitle>
            <CardDescription className="text-lg">Your certificate is ready for your collection.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pb-8">
            <CertificatePreview name={userName} designation={designation} organisation={teamName} />

            <div className="flex flex-col gap-3">
              <Button onClick={downloadCertificate} size="lg" className="w-full gap-2 text-lg h-14 bg-[#00a9b7] text-white hover:bg-[#0094a1]">
                <Download className="w-5 h-5" /> Download PDF Certificate
              </Button>
              <Button onClick={downloadPhoto} variant="outline" className="w-full gap-2 h-12 border-[#032b69] text-[#032b69] hover:bg-[#032b69] hover:text-white">
                <Download className="w-4 h-4" /> Download Selected Photo
              </Button>
             
              <Button variant="outline" onClick={() => setIsGenerated(false)} className="w-full h-12 border-[#032b69] text-[#032b69] hover:bg-[#032b69] hover:text-white">
                Generate Another
              </Button>
              <Button variant="ghost" onClick={() => router.push('/certificate/thank-you')} className="w-full h-12">
                Complete
              </Button>
            </div>
            
            <p className="text-xs text-muted-foreground">A copy of this record has been saved to your participation history.</p>
          </CardContent>
        </Card>

        {/* Upload loader shifted below the card */}
        {backgroundUploading && (
          <div className="w-full max-w-2xl bg-white border border-neutral-200 rounded-2xl p-6 shadow-lg space-y-3 text-center">
            <div className="flex items-center gap-3 justify-center text-neutral-800 text-sm font-semibold">
              <Loader2 className="w-4 h-4 animate-spin text-[#00a9b7]" />
              <span>Uploading certificate to server... {uploadProgress}%</span>
            </div>
            <div className="w-full bg-neutral-100 rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#4fc3e8] to-[#00a9b7] transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}
      </div>
      </div>
    );
  }

  const selectedImage = images.find(img => img.id === selectedGroupId);

  return (
    <div className="theme-tr min-h-screen w-full bg-gradient-to-b from-[#032b69] via-[#4fc3e8] via-45% to-white to-85% bg-fixed text-neutral-900">
      <header className="relative overflow-hidden bg-transparent text-white shadow-[0_8px_24px_-6px_rgba(3,43,105,0.55)]">
        <div className="relative mx-auto flex w-full max-w-4xl items-center gap-4 px-3 py-5 sm:px-6 sm:py-7">
          <div className="shrink-0 rounded-md bg-white p-1.5 shadow-md">
            <Image
              src="/tr-fastenings-logo.jpg"
              alt="TR Fastenings, part of the Trifast plc Group"
              width={140}
              height={134}
              priority
              className="h-12 w-auto sm:h-16"
            />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#00a9b7]">User Portal</p>
            <h1 className="mt-1 text-2xl font-black uppercase tracking-tight sm:text-4xl">360 Camera</h1>
          </div>
        </div>
      </header>
      <div className="relative mx-auto flex w-full max-w-4xl flex-col items-center gap-4 px-3 py-5 sm:gap-8 sm:px-6 sm:py-10">
        {/* Group Image above Card */}
        <AnimatePresence>
          {selectedImage && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
              className="w-full overflow-hidden rounded-2xl border border-white/80 bg-white/90 p-1.5 shadow-[0_24px_70px_-28px_rgba(15,23,42,0.35)] backdrop-blur sm:rounded-[28px] sm:p-2"
            >
              <div className="relative h-[clamp(190px,58vw,260px)] w-full overflow-hidden rounded-xl sm:h-[340px] sm:rounded-[20px] md:h-[416px]">
                <Image
                  src={imagePreviewSrc(selectedImage.id)}
                  alt={selectedImage.groupName}
                  fill
                  priority
                  unoptimized
                  sizes="(min-width: 768px) 896px, 100vw"
                  className="object-cover"
                />
                <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/75 via-black/5 to-transparent p-3 sm:p-6">
                  <span className="max-w-full truncate rounded-full border border-white/20 bg-black/45 px-3 py-1.5 text-xs font-bold tracking-tight text-white shadow-lg backdrop-blur-md sm:px-4 sm:py-2 sm:text-sm">
                    Group: {selectedImage.groupName}
                  </span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <Card className="w-full overflow-hidden rounded-2xl border border-white/80 bg-white text-neutral-900 shadow-[0_28px_80px_-32px_rgba(15,23,42,0.38)] sm:rounded-[28px]">
          <div className="relative flex min-h-40 flex-col items-start justify-end overflow-hidden bg-gradient-to-br from-[#032b69] via-[#04408f] to-[#021d47] px-4 py-6 sm:min-h-52 sm:px-10 sm:py-9">
            <div className="absolute -right-12 -top-16 h-56 w-56 rounded-full border-[36px] border-white/5" />
            <Award className="absolute -bottom-10 right-1 h-36 w-36 rotate-12 text-white/10 sm:right-5 sm:h-52 sm:w-52" />
            <span className="relative z-10 mb-3 rounded-full border border-[#00a9b7]/40 bg-[#00a9b7]/15 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#7fe3ec] sm:mb-4 sm:text-[11px] sm:tracking-[0.22em]">
              TR Fastenings · 360 Experience
            </span>
            <h2 className="relative z-10 text-2xl font-black tracking-tight text-white sm:text-4xl">Your moment. Your certificate.</h2>
            <p className="relative z-10 mt-2 max-w-xl text-sm leading-relaxed text-white/65 sm:text-base">
              Tell us a little about yourself and we’ll prepare your personalised Sanitation Sandbox certificate.
            </p>
          </div>
          <CardHeader className="px-4 pt-6 sm:px-10 sm:pt-9">
            <CardTitle className="text-xl font-black tracking-tight text-neutral-950 sm:text-2xl">Claim your certificate</CardTitle>
            <CardDescription className="text-sm leading-relaxed text-neutral-500">
              All fields marked with <span className="font-semibold text-[#00a9b7]">*</span> are required.
            </CardDescription>
          </CardHeader>
        <CardContent className="px-4 pb-6 sm:px-10 sm:pb-10">
          <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-7">
            <div className="grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2">
               <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-bold text-neutral-700">Full Name <span className="text-[#00a9b7]">*</span></Label>
                <Input
                  id="name"
                  autoComplete="name"
                  placeholder="Enter your full name"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  className="h-12 rounded-xl border-neutral-200 bg-neutral-50 px-4 text-[15px] text-neutral-950 placeholder:text-neutral-400 focus-visible:border-[#00a9b7] focus-visible:ring-[#00a9b7]/20"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-bold text-neutral-700">Email Address <span className="text-[#00a9b7]">*</span></Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@company.com"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  className="h-12 rounded-xl border-neutral-200 bg-neutral-50 px-4 text-[15px] text-neutral-950 placeholder:text-neutral-400 focus-visible:border-[#00a9b7] focus-visible:ring-[#00a9b7]/20"
                  required
                />
              </div>

                <div className="space-y-2">
                  <Label htmlFor="organisation" className="text-sm font-bold text-neutral-700">Organisation / Company <span className="text-[#00a9b7]">*</span></Label>
                  <Input
                    id="organisation"
                    autoComplete="organization"
                    placeholder="Where do you work?"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    className="h-12 rounded-xl border-neutral-200 bg-neutral-50 px-4 text-[15px] text-neutral-950 placeholder:text-neutral-400 focus-visible:border-[#00a9b7] focus-visible:ring-[#00a9b7]/20"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="designation" className="text-sm font-bold text-neutral-700">Designation <span className="text-[#00a9b7]">*</span></Label>
                  <Input
                    id="designation"
                    autoComplete="organization-title"
                    placeholder="Your role or title"
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    className="h-12 rounded-xl border-neutral-200 bg-neutral-50 px-4 text-[15px] text-neutral-950 placeholder:text-neutral-400 focus-visible:border-[#00a9b7] focus-visible:ring-[#00a9b7]/20"
                    required
                  />
                </div>

               <div className="space-y-2 md:col-span-2">
                <Label htmlFor="group" className="text-sm font-bold text-neutral-700">Select Your Event Group <span className="text-[#00a9b7]">*</span></Label>
                <Select value={selectedGroupId} onValueChange={(value) => setSelectedGroupId(value ?? '')} required>
                  <SelectTrigger id="group" className="h-12 w-full rounded-xl border-neutral-200 bg-neutral-50 px-4 text-[15px] text-neutral-950 focus-visible:border-[#00a9b7] focus-visible:ring-[#00a9b7]/20">
                    <SelectValue placeholder="Choose a group" />
                  </SelectTrigger>
                  <SelectContent className="group-select-scroll max-h-64 overflow-y-scroll overscroll-contain">
                    {images.length === 0 ? (
                      <SelectItem value="none" disabled>No groups found</SelectItem>
                    ) : (
                      images.map((img) => (
                        <SelectItem key={img.id} value={img.id} className="py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="relative block h-4 w-6 shrink-0 overflow-hidden rounded">
                              <Image
                                src={imagePreviewSrc(img.id)}
                                alt=""
                                fill
                                unoptimized
                                sizes="24px"
                                className="object-cover"
                              />
                            </span>
                            {img.groupName}
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
                  <Label htmlFor="feedback" className="text-sm font-bold text-neutral-700">How was your experience?</Label>
                  <span className="text-xs tabular-nums text-neutral-400">{feedback.length}/500</span>
                </div>
                <textarea
                  id="feedback"
                  className="min-h-[132px] w-full resize-y rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-[15px] leading-relaxed text-neutral-950 caret-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-[#00a9b7] focus:ring-4 focus:ring-[#00a9b7]/15 disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="Share a memorable takeaway from the Sanitation Sandbox..."
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  maxLength={500}
                />
                <p className="text-xs leading-relaxed text-neutral-400">Optional — your feedback may appear in the event display.</p>
              </div>
            </div>

            <Button type="submit" className="h-14 w-full gap-2 rounded-xl bg-[#00a9b7] text-base font-bold text-white shadow-lg shadow-[#032b69]/20 transition hover:bg-[#0094a1] hover:shadow-xl disabled:bg-neutral-300" disabled={isSubmitting || images.length === 0}>
              {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
              Generate My Certificate
            </Button>
            <p className="text-center text-xs leading-relaxed text-neutral-400">
              Your details are used only to generate and deliver your certificate.
            </p>
          </form>
        </CardContent>
      </Card>

      </div>
    </div>
  );
}
