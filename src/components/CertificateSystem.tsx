'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { CheckCircle2, Loader2, Quote, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { createCertificate, fetchImages } from '@/lib/api';
import { imageSrc } from '@/lib/image-urls';
import type { EventImage } from '@/types';

export default function CertificateSystem() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [images, setImages] = useState<EventImage[]>([]);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [teamName, setTeamName] = useState('');
  const [designation, setDesignation] = useState('');
  const [feedback, setFeedback] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  useEffect(() => {
    fetchImages().then((items) => {
      const groups = new Map<string, EventImage>();
      items.forEach((image) => {
        const key = image.groupName.trim().toLowerCase();
        if (key && !groups.has(key)) groups.set(key, image);
      });
      setImages([...groups.values()].sort((a, b) => a.groupName.localeCompare(b.groupName, undefined, { numeric: true })));
    }).catch(() => toast.error('Unable to load event groups. Please refresh and try again.'));
  }, []);

  const selectedImage = images.find((image) => image.id === selectedGroupId);
  const resetForm = () => { setUserName(''); setUserEmail(''); setTeamName(''); setDesignation(''); setFeedback(''); setSelectedGroupId(''); setIsSubmitted(false); };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedImage) { toast.error('Please select your event group.'); return; }
    setIsSubmitting(true);
    try {
      await createCertificate({ userName: userName.trim(), userEmail: userEmail.trim(), teamName: teamName.trim(), designation: designation.trim(), groupName: selectedImage.groupName, imageUrl: selectedImage.url, certificateUrl: '', feedback: feedback.trim(), showOnDisplay: true, createdAt: Date.now() });
      setIsSubmitted(true);
      toast.success('Your testimonial has been submitted successfully.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'We could not submit your testimonial. Please try again.');
    } finally { setIsSubmitting(false); }
  };

  const input = (id: string, label: string, value: string, setter: (value: string) => void, placeholder: string, required = false) => (
    <label className="flex flex-col gap-1 text-[clamp(11px,0.82vw,15px)] font-medium text-display-ink">{label}{required && ' *'}<input id={id} required={required} value={value} onChange={(e) => setter(e.target.value)} placeholder={placeholder} className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-[clamp(13px,0.95vw,17px)] outline-none transition focus:border-display-quote-to focus:ring-4 focus:ring-blue-100" /></label>
  );

  return (
    <main className="theme-display min-h-screen overflow-x-hidden bg-display-bg p-[2.2vw] font-display text-display-ink">
      <div className="mx-auto flex min-h-[calc(100vh-4.4vw)] w-full max-w-[1500px] flex-col gap-[1.6vh]">
        <header className="flex items-center justify-between gap-4 px-[0.4vw] py-[0.4vh]"><span className="display-shadow inline-flex items-center gap-2 rounded-full bg-white px-[1.1em] py-[0.6em] text-[clamp(11px,0.85vw,16px)] font-medium"><span className="size-2 rounded-full bg-display-live" /> Share your experience</span><span className="rounded-full bg-display-ink px-[1.1em] py-[0.55em] text-[clamp(11px,0.85vw,16px)] font-medium text-white">TR Fastenings · 360 Experience</span></header>

        <section className="relative min-h-[clamp(190px,32vh,430px)] overflow-hidden rounded-[28px] border border-slate-300/60 bg-gradient-to-br from-display-stage-from to-display-stage-to display-shadow">
          {selectedImage ? <AnimatePresence initial={false} mode="wait"><motion.div key={selectedImage.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduceMotion ? 0 : 0.5 }} className="absolute inset-0"><Image src={imageSrc(selectedImage, 'full')} alt={`${selectedImage.groupName} group`} fill priority unoptimized sizes="(min-width: 768px) 1500px, 100vw" className="object-contain" /></motion.div></AnimatePresence> : <div className="flex h-full min-h-[inherit] items-center justify-center text-[clamp(16px,1.4vw,28px)] text-display-muted">Choose your group to see the experience photo</div>}
          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-4 p-[1.4vw]"><span className="rounded-full bg-white/90 px-[1.1em] py-[0.55em] text-[clamp(11px,0.85vw,16px)] font-medium backdrop-blur">Your group experience</span>{selectedImage && <span className="max-w-[40vw] truncate rounded-full bg-white/90 px-[1.1em] py-[0.55em] text-[clamp(11px,0.85vw,16px)] font-medium backdrop-blur">{selectedImage.groupName}</span>}</div>
        </section>

        <AnimatePresence mode="wait" initial={false}>{!isSubmitted ? <motion.section key="form" initial={{ opacity: 0, y: reduceMotion ? 0 : 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="grid min-h-[34vh] grid-cols-1 overflow-hidden rounded-[24px] bg-white display-shadow md:grid-cols-[0.9fr_1.4fr]">
          <div className="relative flex min-h-[260px] flex-col justify-end overflow-hidden bg-gradient-to-br from-display-quote-from from-20% to-display-quote-to px-[2.2vw] py-[2.4vh]"><Sparkles className="absolute -right-4 -top-4 size-[clamp(110px,14vw,220px)] rotate-12 text-white/30" /><div className="relative flex size-[clamp(30px,2.6vw,48px)] items-center justify-center rounded-full bg-display-ink text-white"><Quote className="size-[45%] fill-current" /></div><p className="relative mt-[1.8vh] text-[clamp(12px,0.9vw,17px)] font-medium uppercase tracking-[0.16em] text-display-ink/70">Testimonial</p><h1 className="relative mt-[0.8vh] max-w-[14ch] text-[clamp(28px,3.2vw,58px)] leading-[1.05] font-medium">Tell us about your experience.</h1><p className="relative mt-[1.1vh] max-w-[42ch] text-[clamp(13px,1.05vw,20px)] text-display-ink/70">Your feedback helps us improve the TR Fastenings centre and celebrate the moments that matter.</p></div>
          <form onSubmit={handleSubmit} className="flex flex-col gap-[1.3vh] px-[2.2vw] py-[2.4vh]"><div><h2 className="text-[clamp(20px,1.7vw,32px)] font-medium">Share your testimonial</h2><p className="mt-1 text-[clamp(12px,0.9vw,17px)] text-display-muted">Fields marked with * are required.</p></div><div className="grid grid-cols-1 gap-[1vh_1vw] sm:grid-cols-2">{input('name', 'Full name', userName, setUserName, 'Enter your full name', true)}{input('email', 'Email address', userEmail, setUserEmail, 'you@company.com', true)}{input('organisation', 'Organisation / company', teamName, setTeamName, 'Where do you work?')}{input('designation', 'Designation', designation, setDesignation, 'Your role or title')}<label className="flex flex-col gap-1 text-[clamp(11px,0.82vw,15px)] font-medium text-display-ink sm:col-span-2">Event group *<select required value={selectedGroupId} onChange={(e) => setSelectedGroupId(e.target.value)} className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-[clamp(13px,0.95vw,17px)] outline-none focus:border-display-quote-to focus:ring-4 focus:ring-blue-100"><option value="">Choose a group</option>{images.map((image) => <option key={image.id} value={image.id}>{image.groupName}</option>)}</select></label><label className="flex flex-col gap-1 text-[clamp(11px,0.82vw,15px)] font-medium text-display-ink sm:col-span-2">How was your experience?<textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} maxLength={500} placeholder="Share a memorable takeaway from the TR Fastenings centre..." className="min-h-20 resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[clamp(13px,0.95vw,17px)] outline-none focus:border-display-quote-to focus:ring-4 focus:ring-blue-100" /><span className="text-right text-xs font-normal text-display-muted">{feedback.length}/500</span></label></div><button type="submit" disabled={isSubmitting || images.length === 0} className="mt-auto flex h-12 items-center justify-center gap-2 rounded-full bg-display-ink px-5 text-[clamp(13px,0.95vw,17px)] font-medium text-white transition hover:bg-brand-navy-deep disabled:cursor-not-allowed disabled:bg-slate-300">{isSubmitting ? <><Loader2 className="size-4 animate-spin" /> Submitting testimonial…</> : <><CheckCircle2 className="size-4" /> Submit my testimonial</>}</button></form>
        </motion.section> : <motion.section key="success" initial={{ opacity: 0, y: reduceMotion ? 0 : 12 }} animate={{ opacity: 1, y: 0 }} className="relative grid min-h-[34vh] grid-cols-1 gap-[1.4vw] md:grid-cols-[1.25fr_0.9fr]"><div className="relative flex flex-col justify-center overflow-hidden rounded-[24px] bg-gradient-to-br from-display-quote-from from-20% to-display-quote-to px-[2.2vw] py-[2.4vh] display-shadow"><Sparkles className="absolute -right-5 -top-5 size-[clamp(140px,16vw,260px)] rotate-12 text-white/35" /><div className="relative flex size-14 items-center justify-center rounded-full bg-display-ink text-white"><CheckCircle2 className="size-7" /></div><p className="relative mt-4 text-sm font-medium uppercase tracking-[0.16em] text-display-ink/70">Submitted successfully</p><h2 className="relative mt-2 max-w-[18ch] text-[clamp(28px,3vw,54px)] leading-tight font-medium">Your experience with the TR Fastenings centre has been submitted.</h2><p className="relative mt-3 max-w-[46ch] text-[clamp(13px,1vw,19px)] text-display-ink/70">Thank you for taking the time to share your feedback. Your testimonial will be reviewed before it appears on the display.</p></div><div className="flex flex-col justify-center gap-4 rounded-[24px] bg-white px-[2.2vw] py-[2.4vh] display-shadow"><div className="flex items-center gap-3"><span className="flex size-11 items-center justify-center rounded-full bg-display-ink text-white"><Quote className="size-5 fill-current" /></span><div><p className="text-[clamp(16px,1.3vw,24px)] font-medium">{userName}</p><p className="text-[clamp(12px,0.9vw,17px)] text-display-muted">{selectedImage?.groupName}</p></div></div><blockquote className="line-clamp-5 text-[clamp(17px,1.5vw,28px)] leading-tight text-display-ink">“{feedback || 'Thank you for sharing your experience with us.'}”</blockquote><button onClick={() => router.push('/display')} className="flex h-11 items-center justify-center rounded-full bg-display-ink px-4 text-sm font-medium text-white transition hover:bg-brand-navy-deep">See testimonials</button><button onClick={resetForm} className="h-10 rounded-full border border-slate-200 text-sm font-medium text-display-ink transition hover:bg-slate-50">Submit another testimonial</button></div></motion.section>}</AnimatePresence>
      </div>
    </main>
  );
}
