import { requireClientSession } from "@/lib/auth/guards";
import { listPortalMessages } from "@/lib/data/portal";
import { formatDateTime, relativeTime } from "@/lib/format";
import { EmptyState, Panel } from "@/components/ui/primitives";
import { MessageComposer } from "./MessageComposer";

export const dynamic = "force-dynamic";

/**
 * Client messages.
 *
 * A direct thread with the Rhymvex team, separate from email. Email is the
 * record of what was sent; this is where a conversation happens in the portal.
 */
export default async function PortalMessagesPage() {
  const session = await requireClientSession();
  const messages = await listPortalMessages(session);

  return (
    <div className="flex flex-col gap-6">
      <header className="rv-page-head">
        <div>
          <h1 className="rv-page-title">Messages</h1>
          <p className="rv-page-sub">
            A direct line to the Rhymvex team. Replies usually land same day during working hours.
          </p>
        </div>
      </header>

      <MessageComposer csrfToken={session.csrfToken} />

      <Panel flush>
        {messages.length === 0 ? (
          <EmptyState>No messages yet. Send the first one above.</EmptyState>
        ) : (
          <ul>
            {messages.map((message) => {
              const fromStaff = Boolean(message.from_staff);
              const unread = !message.read_at && fromStaff;

              return (
                <li
                  key={message.id}
                  className={`border-b border-rhymvex-white/5 px-4 py-4 last:border-b-0 ${
                    unread ? "bg-rhymvex-volt/[0.03]" : ""
                  }`}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] ${
                          fromStaff
                            ? "border-rhymvex-volt/40 text-rhymvex-volt"
                            : "border-rhymvex-white/15 text-rhymvex-white/45"
                        }`}
                      >
                        {fromStaff ? "Rhymvex" : "You"}
                      </span>
                      {message.subject ? (
                        <span className="text-xs font-semibold text-rhymvex-white">
                          {message.subject}
                        </span>
                      ) : null}
                      {unread ? (
                        <span className="size-1.5 rounded-full bg-rhymvex-volt" aria-label="Unread" />
                      ) : null}
                    </div>
                    <time
                      dateTime={new Date(message.created_at).toISOString()}
                      className="text-[10px] text-rhymvex-white/30"
                      title={formatDateTime(message.created_at)}
                    >
                      {relativeTime(message.created_at)}
                    </time>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-rhymvex-white/70">
                    {message.body}
                  </p>
                  <p className="mt-1.5 text-[10px] text-rhymvex-white/25">
                    {message.from_staff ?? message.from_client}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}
