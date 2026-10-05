/**
 * Studio systems shown on the home page.
 *
 * Only things that exist and that the studio built for itself. There are no
 * client case studies here because there are none to show yet, and the page
 * says so in as many words (see `home.work.*` in the message catalogues).
 *
 * An earlier version of this list presented the seed demo client
 * ("Harbour Light Logistics", from lib/db/seed.ts) as a delivered engagement,
 * labelled internal tooling as "Case study", and attached figures that were
 * never measured ("14 days", "sub-48hr turnaround", "60fps"). Do not reintroduce
 * any of that. A client entry goes here when there is a client, their
 * permission, and a result someone actually measured.
 *
 * Copy lives in the catalogues, keyed by `key`, so every locale gets the same
 * honest version of the section.
 */

export type WorkEntry = {
  /** URL segment, for a future /work/<slug> route. Unique. */
  slug: string;
  /** Message key prefix under `home.work`, e.g. "core" -> home.work.coreTitle. */
  key: string;
  /**
   * A real screenshot under public/, or omitted to let the card draw its own
   * diagram. Not a render: the old `*-v2.jpg` images were generated art with a
   * made-up client name ("Nexus Inc.") and made-up figures printed on screen.
   */
  image?: string;
};

export const work: WorkEntry[] = [
  { slug: "rhymvex-brand-system", key: "core" },
  { slug: "rhymvex-platform", key: "portal", image: "/work/platform-intake.jpg" },
];
