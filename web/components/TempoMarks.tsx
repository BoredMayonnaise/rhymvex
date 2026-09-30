import { NOTES, type NoteName } from "@/lib/notes";

/**
 * One tempo mark. Falls back rather than throwing: a typo in the content file
 * must not take the page down.
 */
export function TempoMark({
  note,
  className,
}: {
  note: string;
  className?: string;
}) {
  const Glyph = NOTES[note as NoteName] ?? NOTES.music2;
  return <Glyph className={className} aria-hidden="true" />;
}

/**
 * The package tempo marks as a phrase — the same Music glyphs each card carries,
 * in card order, so the counts climb the way the cards do. Decorative only:
 * hidden from assistive tech and never wrapped in a list, because it carries no
 * information the cards do not already carry.
 */
export function TempoPhrase({
  notes,
  className = "",
  markClassName = "size-4",
}: {
  notes: readonly string[];
  className?: string;
  markClassName?: string;
}) {
  return (
    <span className={`flex items-center ${className}`} aria-hidden="true">
      {notes.map((note, i) => (
        <TempoMark key={`${note}-${i}`} note={note} className={markClassName} />
      ))}
    </span>
  );
}

/**
 * A hairline that breaks to let the tempo phrase through. Used instead of a flat
 * rule where a section break needs to carry the motif rather than just separate
 * two blocks.
 */
export function TempoDivider({
  notes,
  className = "",
}: {
  notes: readonly string[];
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-5 ${className}`} aria-hidden="true">
      <span className="h-px flex-1 bg-rhymvex-white/10" />
      <TempoPhrase
        notes={notes}
        className="gap-4 text-rhymvex-white/20"
        markClassName="size-3.5"
      />
      <span className="h-px flex-1 bg-rhymvex-white/10" />
    </div>
  );
}
