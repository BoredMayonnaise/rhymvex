"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { confirmCurrencyAction, declineCurrencyAction } from "@/app/actions/currency";
import type { Currency } from "@/lib/currency";

/**
 * The question, not a switch.
 *
 * This is the whole reason the currency of this site is safe to guess at: a
 * detection is offered as a suggestion the visitor has to accept, and the page
 * does not change until they do. That is what the retired switcher got wrong — it
 * set a value on their behalf that nothing could later correct.
 *
 * Rendered only when there is a real alternative to offer and the visitor has
 * not already chosen for this language, so the common case is that this is not
 * on the page at all.
 */
export function CurrencySuggestion({
  suggestion,
  locale,
  current,
}: {
  suggestion: Currency;
  locale: string;
  current: Currency;
}) {
  const [visible, setVisible] = useState(true);
  const [pending, startTransition] = useTransition();

  if (!visible) return null;

  const answer = (code: string | null) => {
    // Hidden straight away rather than on completion: the alternative is a
    // button that sits there while the request is in flight.
    setVisible(false);
    startTransition(async () => {
      if (code) await confirmCurrencyAction(code, locale);
      else await declineCurrencyAction(locale);
    });
  };

  return (
    <div
      role="status"
      className="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-md flex-col gap-2.5 rounded-lg border border-rhymvex-volt/30 bg-rhymvex-black/95 p-3.5 shadow-lg backdrop-blur sm:inset-x-auto sm:right-4 sm:bottom-4"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm leading-relaxed text-rhymvex-white/75">
          Looks like you&rsquo;re in {suggestion.label}. Show the budget ranges in{" "}
          <span className="font-semibold text-rhymvex-white">{suggestion.symbol}</span> instead of{" "}
          <span className="font-semibold text-rhymvex-white">{current.symbol}</span>?
        </p>
        <button
          type="button"
          onClick={() => answer(null)}
          disabled={pending}
          aria-label="Keep the current currency"
          className="shrink-0 text-rhymvex-white/40 transition-colors hover:text-rhymvex-white/70"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => answer(suggestion.code)}
          disabled={pending}
          className="rv-btn rv-btn-primary rv-btn-sm"
        >
          Use {suggestion.code}
        </button>
        <button
          type="button"
          onClick={() => answer(null)}
          disabled={pending}
          className="rv-btn rv-btn-ghost rv-btn-sm"
        >
          Keep {current.code}
        </button>
      </div>
    </div>
  );
}
