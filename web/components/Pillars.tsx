import { BarChart3, Layers, Lightbulb, Megaphone } from "lucide-react";
import { RhythmGlyph } from "@/components/RhythmGlyph";
import { Section } from "@/components/Section";
import { TempoMark } from "@/components/TempoMarks";

/**
 * The four content pillars from docs/AGENTS.md — one idea per card.
 *
 * `note` walks the full set in lib/notes.ts, one mark per pillar, so this is
 * the only place all four tempo figures appear together. The icons stay
 * semantic — they say what the pillar is; the note says it is part of the
 * rhythm, and it replaces the ordinal it used to carry.
 */
const PILLARS = [
  {
    icon: BarChart3,
    note: "music",
    title: "Work / Case Studies",
    body: "Before and after, with the real numbers. Challenge, solution, result, in that order.",
  },
  {
    icon: Layers,
    note: "music2",
    title: "Process & Systems",
    body: "How the work actually gets made. Frameworks, checklists, and the boring parts that decide whether it holds up.",
  },
  {
    icon: Lightbulb,
    note: "music3",
    title: "Thought Leadership",
    body: "Positions we can defend, and the reason most brands get the same thing wrong.",
  },
  {
    icon: Megaphone,
    note: "music4",
    title: "Offers & Lead Magnents",
    body: "Audits, templates and the occasional open slot. Something worth reading before anyone gets on a call.",
  },
] as const;

export function Pillars() {
  return (
    <Section
      id="pillars"
      eyebrow="What we create"
      title="Four pillars. Everything we make fits exactly one of them."
      overlay={
        /* The flattest of the note pieces (1.99:1), because this is the shortest
           section — one row of cards. Sized by HEIGHT, not width: the free
           margin beside the max-w-3xl heading is 162px at 1024 and 700px at
           1920, so a proportional width would either crowd the heading or grow
           down into the card row. Height keeps the bottom edge fixed.
           Hidden below xl, where the heading fills the container and there is no
           margin to fill. The per-card tempo marks carry the motif at every
           size, so nothing is lost on small screens. */
        <RhythmGlyph className="pointer-events-none absolute right-0 top-[110px] hidden h-[220px] w-auto max-w-none text-rhymvex-white opacity-[0.05] xl:block" />
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">
        {PILLARS.map((pillar) => (
          <article key={pillar.title} className="rv-card flex flex-col gap-3 p-6">
            <div className="flex items-center justify-between">
              <pillar.icon
                className="size-4 text-rhymvex-volt"
                aria-hidden="true"
              />
              <TempoMark
                note={pillar.note}
                className="size-4 text-rhymvex-white/40"
              />
            </div>
            <h3 className="text-display-3">{pillar.title}</h3>
            <p className="text-sm leading-relaxed text-rhymvex-white/60">
              {pillar.body}
            </p>
          </article>
        ))}
      </div>
    </Section>
  );
}
