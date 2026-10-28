"use client";

import { useState, useTransition } from "react";
import type { ReactNode } from "react";

import { setProductApplicationGroup } from "./application-group-actions";

type Group = { id: string; name: string; slug: string };

/** The product's application group within its family (ADR-029), as shown on the family page. */
export function ProductApplicationGroupManager({
  productId,
  initial,
}: {
  readonly productId: string;
  readonly initial: { assigned: string | null; available: Group[] };
}): ReactNode {
  const [value, setValue] = useState(initial.assigned ?? "");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function save(): void {
    startTransition(async () => {
      const result = await setProductApplicationGroup(productId, value === "" ? null : value);
      setMessage(result.message);
    });
  }

  return (
    <section className="ad-product-media" aria-labelledby="product-group-heading">
      <h3 id="product-group-heading">Application group</h3>
      <p className="ad-note">
        Where this product is listed on its Product Family page (for example Compressors or
        Turbines).
      </p>
      {initial.available.length === 0 ? (
        <p className="ad-notice">This family has no application groups yet.</p>
      ) : (
        <label>
          Group
          <select
            value={value}
            disabled={pending}
            onChange={(event) => setValue(event.target.value)}
          >
            <option value="">No group (listed under “Other products”)</option>
            {initial.available.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <button className="ad-btn" type="button" disabled={pending} onClick={save}>
        {pending ? "Saving…" : "Save group"}
      </button>
      <p role="status" aria-live="polite">
        {message}
      </p>
    </section>
  );
}
