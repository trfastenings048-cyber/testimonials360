-- Persist the administrator's preferred video sound settings. The display still begins
-- muted until it receives a local browser gesture, as required by autoplay policies.
ALTER TABLE "DisplaySettings"
  ADD COLUMN "videoMuted" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "videoVolume" INTEGER NOT NULL DEFAULT 68;
