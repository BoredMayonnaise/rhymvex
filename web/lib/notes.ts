import { Music, Music2, Music3, Music4, type LucideIcon } from "lucide-react";

/**
 * Tempo glyphs, keyed by the `note` field on each package.
 *
 * The choice is semantic rather than arbitrary — the figure says what the
 * package is: a quick two-note hit for the sprint, one sustained note for the
 * foundation, a running sixteenth figure for the retainer that repeats on a
 * cadence. They are also distinct at 16px, which is the size they ship at.
 */
export const NOTES = {
  music: Music,
  music2: Music2,
  music3: Music3,
  music4: Music4,
} as const satisfies Record<string, LucideIcon>;

export type NoteName = keyof typeof NOTES;
