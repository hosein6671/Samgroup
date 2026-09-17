"use client";

import { useState, useTransition } from "react";
import type { ReactNode } from "react";
import { setProductSegments } from "./segment-actions";

type Segment = { id: string; name: string; slug: string };

export function ProductSegmentManager({
  productId,
  initial,
}: {
  readonly productId: string;
  readonly initial: { assigned: string[]; available: Segment[] };
}): ReactNode {
  const [assigned, setAssigned] = useState(new Set(initial.assigned));
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function toggle(id: string): void {
    setAssigned((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function save(): void {
    startTransition(async () => {
      const result = await setProductSegments(productId, [...assigned]);
      setMessage(result.message);
      if (result.ok && result.assigned) setAssigned(new Set(result.assigned));
    });
  }

  return (
    <section className="ad-product-media" aria-labelledby="product-segments-heading">
      <h3 id="product-segments-heading">Segments</h3>
      <p className="ad-note">
        Which buyer segments this product appears under in the public Product Finder.
      </p>
      {initial.available.length === 0 ? (
        <p className="ad-notice">No Segments exist yet.</p>
      ) : (
        <div className="ad-filters" role="group" aria-label="Assigned segments">
          {initial.available.map((segment) => {
            const on = assigned.has(segment.id);
            return (
              <button
                key={segment.id}
                type="button"
                className={on ? "ad-chip ad-chip--on" : "ad-chip"}
                aria-pressed={on}
                disabled={pending}
                onClick={() => toggle(segment.id)}
              >
                {segment.name}
              </button>
            );
          })}
        </div>
      )}
      <button className="ad-btn" type="button" disabled={pending} onClick={save}>
        {pending ? "Saving…" : "Save segments"}
      </button>
      <p role="status" aria-live="polite">
        {message}
      </p>
    </section>
  );
}
