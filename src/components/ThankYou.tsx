'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { ArrowRight, CheckCircle2, MonitorPlay } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function ThankYou() {
  const router = useRouter();
  return (
    <div className="theme-tr min-h-screen w-full bg-gradient-to-b from-[#032b69] via-[#4fc3e8] via-45% to-white to-85% bg-fixed text-neutral-900">
      <header className="bg-transparent text-white shadow-[0_8px_24px_-6px_rgba(3,43,105,0.55)]">
        <div className="mx-auto flex w-full max-w-4xl items-center gap-4 px-3 py-5 sm:px-6 sm:py-7">
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

      <div className="mx-auto flex w-full max-w-2xl items-center justify-center px-3 py-8 sm:px-6 sm:py-14">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="w-full"
        >
          <Card className="w-full overflow-hidden rounded-2xl border border-white/80 bg-white text-center text-neutral-900 shadow-[0_28px_80px_-32px_rgba(3,43,105,0.55)] sm:rounded-[28px]">
            <div className="h-2 bg-[#00a9b7]" />
            <CardContent className="px-5 pb-8 pt-9 sm:px-12 sm:pb-12 sm:pt-12">
              <motion.div
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.15, type: 'spring', stiffness: 220, damping: 14 }}
                className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-[#e6f6f8] ring-8 ring-[#e6f6f8]/60"
              >
                <CheckCircle2 className="h-12 w-12 text-[#00a9b7]" />
              </motion.div>

              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#00a9b7]">All done</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-[#032b69] sm:text-4xl">Thank you!</h2>
              <p className="mt-3 text-base text-neutral-500">Your certificate has been recorded.</p>

              <div className="mx-auto my-7 h-[3px] w-16 rounded-full bg-[#00a9b7]" />

              <p className="mx-auto max-w-md text-sm leading-relaxed text-neutral-600 sm:text-base">
                You can close this page, or head back to the display to see more moments from the event.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
                <Button
                  onClick={() => router.push('/display')}
                  className="h-12 gap-2 rounded-xl bg-[#00a9b7] px-6 text-base font-bold text-white shadow-lg shadow-[#032b69]/20 hover:bg-[#0094a1]"
                >
                  <MonitorPlay className="h-4 w-4" /> Back to Display
                </Button>
                <Button
                  variant="outline"
                  onClick={() => router.push('/certificate')}
                  className="h-12 gap-2 rounded-xl border-[#032b69] bg-white px-6 text-base font-bold text-[#032b69] hover:bg-[#032b69] hover:text-white"
                >
                  Generate Another <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
