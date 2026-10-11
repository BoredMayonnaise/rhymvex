"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { relativeTime } from "@/lib/format";

type ClientMessage = {
  id: string;
  subject: string | null;
  body: string;
  created_at: Date;
  from_staff: string | null;
  from_client: string | null;
};

export function ClientMessages({ messages }: { messages: ClientMessage[] }) {
  const [selected, setSelected] = useState<ClientMessage | null>(null);

  return (
    <>
      <ul>
        {messages.map((message) => (
          <li key={message.id} className="border-b border-rhymvex-white/5 last:border-b-0">
            <button
              type="button"
              onClick={() => setSelected(message)}
              className="block w-full min-w-0 px-4 py-2.5 text-left transition-colors hover:bg-rhymvex-white/[0.03]"
            >
              <p className="truncate text-xs font-medium text-rhymvex-white">
                {message.subject || "(no subject)"}
              </p>
              {/* Clamped so a long message never stretches the row. */}
              <p className="mt-0.5 line-clamp-1 text-[11px] text-rhymvex-white/50 break-words">
                {message.body}
              </p>
              <p className="mt-1 text-[10px] text-rhymvex-white/50">
                {message.from_staff ?? message.from_client} · {relativeTime(message.created_at)}
              </p>
            </button>
          </li>
        ))}
      </ul>

      <Modal
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected?.subject || "(no subject)"}
        eyebrow={selected ? `${selected.from_staff ?? selected.from_client} · ${relativeTime(selected.created_at)}` : undefined}
      >
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-rhymvex-white/80 break-words">
          {selected?.body}
        </p>
      </Modal>
    </>
  );
}
