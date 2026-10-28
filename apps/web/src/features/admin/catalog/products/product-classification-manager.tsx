"use client";

import { useState, useTransition } from "react";
import type { ReactNode } from "react";

import { setProductClassification } from "./classification-actions";

type Option = { id: string; name: string; slug: string };

/** Product Family and Product Type (ADR-030). Shown to Admin only; the API enforces it too. */
export function ProductClassificationManager({
  productId,
  initial,
}: {
  readonly productId: string;
  readonly initial: {
    categoryId: string;
    productTypeId: string | null;
    families: Option[];
    types: Option[];
  };
}): ReactNode {
  const [family, setFamily] = useState(initial.categoryId);
  const [type, setType] = useState(initial.productTypeId ?? "");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const moving = family !== initial.categoryId;

  function save(): void {
    startTransition(async () => {
      const result = await setProductClassification(productId, family, type === "" ? null : type);
      setMessage(result.message);
    });
  }

  return (
    <section className="ad-product-media" aria-labelledby="product-classification-heading">
      <h3 id="product-classification-heading">Family and type</h3>
      <p className="ad-note">
        The Product Family page this product is listed on, and its Product Type. Changing them does
        not change the product&apos;s address.
      </p>
      <label>
        Product Family
        <select
          value={family}
          disabled={pending}
          onChange={(event) => setFamily(event.target.value)}
        >
          {initial.families.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Product Type
        <select value={type} disabled={pending} onChange={(event) => setType(event.target.value)}>
          <option value="">No type</option>
          {initial.types.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
      </label>
      {moving && (
        <p className="ad-notice">
          Moving to another family removes the product from its application group. Choose a group of
          the new family after saving.
        </p>
      )}
      <button className="ad-btn" type="button" disabled={pending} onClick={save}>
        {pending ? "Saving…" : "Save family and type"}
      </button>
      <p role="status" aria-live="polite">
        {message}
      </p>
    </section>
  );
}
