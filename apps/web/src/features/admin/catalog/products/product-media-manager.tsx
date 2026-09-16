"use client";

import { useState, useTransition } from "react";
import type { ReactNode } from "react";
import {
  makeProductImagePrimary,
  removeProductImage,
  uploadProductImage,
  type ProductMediaItem,
} from "./media-actions";

export function ProductMediaManager({
  productId,
  initial,
}: {
  productId: string;
  initial: ProductMediaItem[];
}): ReactNode {
  const [items, setItems] = useState(initial);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <section className="ad-product-media" aria-labelledby="product-media-heading">
      <h3 id="product-media-heading">Product images</h3>
      <p className="ad-note">Upload product-owned images, then choose which one appears first.</p>
      <div className="ad-product-media-grid">
        {items.map((item) => (
          <article key={item.id}>
            <img src={item.url} alt={item.altText ?? ""} width={240} height={160} />
            <p>{item.altText || "No alt text"}</p>
            <div className="ad-product-media-actions">
              {item.isPrimary ? (
                <strong>Primary image</strong>
              ) : (
                <button
                  className="ad-chip"
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const result = await makeProductImagePrimary(productId, item.id);
                      setMessage(result.message);
                      if (result.ok)
                        setItems((current) =>
                          current.map((entry) => ({ ...entry, isPrimary: entry.id === item.id })),
                        );
                    })
                  }
                >
                  Make primary
                </button>
              )}
              <button
                className="ad-chip"
                type="button"
                disabled={pending}
                onClick={() => {
                  if (!window.confirm("Remove this product image? This cannot be undone.")) return;
                  startTransition(async () => {
                    const result = await removeProductImage(productId, item.id);
                    setMessage(result.message);
                    if (result.ok)
                      setItems((current) => current.filter((entry) => entry.id !== item.id));
                  });
                }}
              >
                Remove
              </button>
            </div>
          </article>
        ))}
      </div>
      <form
        action={(form) =>
          startTransition(async () => {
            const result = await uploadProductImage(productId, form);
            setMessage(result.message);
            if (result.item) setItems((current) => [...current, result.item!]);
          })
        }
        className="ad-product-media-upload"
      >
        <div className="ad-field">
          <label className="ad-label" htmlFor="product-media-image">
            Image
          </label>
          <input
            className="ad-input"
            id="product-media-image"
            name="image"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            required
          />
        </div>
        <div className="ad-field">
          <label className="ad-label" htmlFor="product-media-alt">
            Descriptive alt text
          </label>
          <input
            className="ad-input"
            id="product-media-alt"
            name="altText"
            type="text"
            maxLength={300}
            required
          />
        </div>
        <button className="ad-btn" disabled={pending}>
          {pending ? "Uploading…" : "Upload product image"}
        </button>
      </form>
      <p role="status" aria-live="polite">
        {message}
      </p>
    </section>
  );
}
