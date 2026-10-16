'use client';

import { useId, useState } from 'react';
import { AlertDialog } from '@base-ui/react/alert-dialog';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isLoading?: boolean;
  /** When set, the confirm button stays disabled until the user types this exact text. */
  requireText?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Yes',
  cancelLabel = 'No',
  isLoading = false,
  requireText,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState('');
  const [wasOpen, setWasOpen] = useState(open);
  const inputId = useId();

  // Clear the typed confirmation each time the dialog opens (adjusting state during render).
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setTyped('');
  }

  const isConfirmBlocked = Boolean(requireText) && typed.trim() !== requireText;

  return (
    <AlertDialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !isLoading) onCancel();
      }}
    >
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="fixed inset-0 z-[200] bg-black/55 backdrop-blur-sm transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <AlertDialog.Popup className="fixed top-1/2 left-1/2 z-[201] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-background p-5 text-foreground shadow-2xl outline-none transition-all duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
          <div className="mb-4 flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <AlertDialog.Title className="text-base font-semibold">{title}</AlertDialog.Title>
              <AlertDialog.Description className="mt-1 text-sm leading-6 text-muted-foreground">
                {description}
              </AlertDialog.Description>
            </div>
          </div>
          {requireText && (
            <div className="mb-4 space-y-1.5">
              <label htmlFor={inputId} className="text-xs text-muted-foreground">
                Type <span className="font-mono font-semibold text-foreground">{requireText}</span> to confirm
              </label>
              <Input
                id={inputId}
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                autoComplete="off"
                spellCheck={false}
                className="h-10"
              />
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <AlertDialog.Close
              render={<Button type="button" variant="outline" className="h-10" disabled={isLoading} />}
            >
              {cancelLabel}
            </AlertDialog.Close>
            <Button
              type="button"
              className="h-10 bg-destructive text-white hover:bg-destructive/90"
              onClick={onConfirm}
              disabled={isLoading || isConfirmBlocked}
            >
              {isLoading && <Loader2 className="animate-spin" aria-hidden="true" />}
              {confirmLabel}
            </Button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
