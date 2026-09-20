"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import type { ReactNode } from "react";
import {
  removeCategoryImage,
  uploadCategoryImage,
  type CategoryProcessImage,
} from "./image-actions";

/** One category's process-photograph control — upload when empty, replace or remove when set. */
export function CategoryImageManager({
  categoryId,
  categoryName,
  initial,
}: {
  categoryId: string;
  categoryName: string;
  initial: CategoryProcessImage;
}): ReactNode {
  const [image, setImage] = useState(initial);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <div className="ad-category-image">
      {image && (
        <figure className="ad-category-image-preview">
          <Image src={image.url} alt={image.altText ?? ""} width={160} height={90} />
          <figcaption>{image.altText || "No alt text"}</figcaption>
          <button
            className="ad-chip"
            type="button"
            disabled={pending}
            onClick={() => {
              if (!window.confirm(`Remove the process image for ${categoryName}?`)) return;
              startTransition(async () => {
                const result = await removeCategoryImage(categoryId, image.id);
                setMessage(result.message);
                if (result.ok) setImage(null);
              });
            }}
          >
            Remove
          </button>
        </figure>
      )}
      <form
        action={(form) =>
          startTransition(async () => {
            const result = await uploadCategoryImage(categoryId, form);
            setMessage(result.message);
            if (result.image !== undefined) setImage(result.image);
          })
        }
        className="ad-category-image-upload"
      >
        <div className="ad-field">
          <label className="ad-label" htmlFor={`category-image-${categoryId}`}>
            {image ? "Replace image" : "Upload image"}
          </label>
          <input
            className="ad-input"
            id={`category-image-${categoryId}`}
            name="image"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            required
          />
        </div>
        <div className="ad-field">
          <label className="ad-label" htmlFor={`category-alt-${categoryId}`}>
            Descriptive alt text
          </label>
          <input
            className="ad-input"
            id={`category-alt-${categoryId}`}
            name="altText"
            type="text"
            maxLength={300}
            required
          />
        </div>
        <button className="ad-btn" disabled={pending}>
          {pending ? "Uploading…" : image ? "Replace image" : "Upload image"}
        </button>
      </form>
      <p role="status" aria-live="polite">
        {message}
      </p>
    </div>
  );
}
