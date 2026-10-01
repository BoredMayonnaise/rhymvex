import { RisingStaff } from "@/components/RisingStaff";
import { Section } from "@/components/Section";

/** Mirrors the Process / Framework card template from docs/DESIGN.md. */
const STEPS = [
  {
    title: "Diagnose",
    body: "Audit what exists, then interview the people who built it. You get the two or three gaps that are actually costing you.",
  },
  {
    title: "Define",
    body: "Lock the message, the audience and the promise. It gets written down and signed off, so nobody reopens it in week six.",
  },
  {
    title: "Systemise",
    body: "Identity, tokens, templates and the rules that hold them together, delivered as a library your team can open and use.",
  },
  {
    title: "Hand over",
    body: "Your team gets the playbook, the files and a walkthrough. After that we stay on a rhythm if it turns out to be useful.",
  },
] as const;

export function Process() {
  return (
    <Section
      id="process"
      eyebrow="Process"
      title="Four steps, and you know the price before step one."
      overlay={
        /* The staff climbs left to right, so the four steps read as one
           movement. Anchored top-right: the heading is capped at max-w-3xl, so
           that corner is empty on wide screens and the artwork never sits under
           the step copy. */
        <RisingStaff className="pointer-events-none absolute -top-[8%] -right-[8%] w-[95%] max-w-none text-rhymvex-ember opacity-[0.08] sm:-top-[4%] sm:-right-[4%] sm:w-[68%] lg:-top-[6%] lg:-right-[3%] lg:w-[46%]" />
      }
    >
      {/* Vertical connector on narrow screens, horizontal rule from lg up. */}
      <ol className="grid gap-8 sm:gap-10 lg:grid-cols-4 lg:gap-8">
        {STEPS.map((step, i) => (
          <li key={step.title} className="group relative flex gap-5 lg:block">
            <span
              className="absolute bottom-[-2.25rem] start-5 top-12 w-px bg-rhymvex-white/10 group-last:hidden lg:hidden sm:bottom-[-2.5rem]"
              aria-hidden="true"
            />
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-rhymvex-white/15 font-display text-xs font-bold text-rhymvex-volt lg:border-rhymvex-white/20">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className="min-w-0 lg:mt-6">
              <h3 className="text-display-3">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-rhymvex-white/60">
                {step.body}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </Section>
  );
}
