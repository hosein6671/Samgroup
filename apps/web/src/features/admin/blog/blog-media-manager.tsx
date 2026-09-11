"use client";

import { useState, useTransition } from "react";
import type { ReactNode } from "react";
import {
  makeBlogImagePrimary,
  removeBlogImage,
  uploadBlogImage,
  type BlogMediaItem,
} from "./media-actions";

export function BlogMediaManager({
  postId,
  initial,
}: {
  postId: string;
  initial: BlogMediaItem[];
}): ReactNode {
  const [items, setItems] = useState(initial);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <section className="ad-product-media" aria-labelledby="blog-media-heading">
      <h3 id="blog-media-heading">Article images</h3>
      <p className="ad-note">Upload article-owned images and choose the featured image.</p>
      <div className="ad-product-media-grid">
        {items.map((item) => (
          <article key={item.id}>
            <img src={item.url} alt={item.altText ?? ""} width={240} height={160} />
            <p>{item.altText || "No alt text"}</p>
            {item.isPrimary ? (
              <strong>Featured image</strong>
            ) : (
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await makeBlogImagePrimary(postId, item.id);
                    setMessage(result.message);
                    if (result.ok)
                      setItems((current) =>
                        current.map((entry) => ({ ...entry, isPrimary: entry.id === item.id })),
                      );
                  })
                }
              >
                Make featured
              </button>
            )}
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (!window.confirm("Remove this article image? This cannot be undone.")) return;
                startTransition(async () => {
                  const result = await removeBlogImage(postId, item.id);
                  setMessage(result.message);
                  if (result.ok)
                    setItems((current) => current.filter((entry) => entry.id !== item.id));
                });
              }}
            >
              Remove
            </button>
          </article>
        ))}
      </div>
      <form
        action={(form) =>
          startTransition(async () => {
            const result = await uploadBlogImage(postId, form);
            setMessage(result.message);
            if (result.item) setItems((current) => [...current, result.item!]);
          })
        }
        className="ad-media-upload"
      >
        <label>
          Image
          <input
            name="image"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            required
          />
        </label>
        <label>
          Descriptive alt text
          <input name="altText" type="text" maxLength={300} required />
        </label>
        <button disabled={pending}>{pending ? "Uploading…" : "Upload article image"}</button>
      </form>
      <p role="status" aria-live="polite">
        {message}
      </p>
    </section>
  );
}
