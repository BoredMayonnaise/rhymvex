import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SIGN_IN_PATH } from "@/lib/auth/workspace";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Kept only so links already in circulation keep working.
 *
 * This was the client portal's own sign-in page. There is one sign-in form now,
 * at `/login`, and it works out which workspace a person belongs to — so this
 * route pins the answer to "client" and forwards.
 *
 * `/portal-sign-in?next=/portal/invoices` still has to work, because it is what
 * `proxy.ts` sends people to when they deep-link into the portal without a
 * session, and a link in an invitation email is the whole reason someone visits
 * this route at all. Dropping it would turn those links into a 404 on the exact
 * page a new client is trying to reach.
 */
export default async function PortalSignInPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string; invited?: string }>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams({ workspace: "client" });

  // Only carried over, never interpreted: `next` is re-validated against
  // `/portal` by the page it lands on.
  if (params?.next) query.set("next", params.next);
  if (params?.invited) query.set("invited", params.invited);

  redirect(`${SIGN_IN_PATH}?${query.toString()}`);
}