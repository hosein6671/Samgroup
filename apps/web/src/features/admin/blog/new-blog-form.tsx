"use client";

import { useActionState } from "react";
import { createBlogPost } from "./actions";
import type { ReactNode } from "react";

export function NewBlogForm({
  categories,
  tags,
}: {
  categories: { id: string; name: string }[];
  tags: { id: string; name: string }[];
}): ReactNode {
  const [message, action, pending] = useActionState(createBlogPost, "");
  return (
    <form action={action} className="ad-user-form ad-content-form">
      <label>
        Article title
        <input name="title" required maxLength={200} />
      </label>
      <label>
        URL slug
        <input name="slug" required maxLength={200} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" />
      </label>
      <label>
        Category
        <select name="categoryId" required>
          <option value="">Select</option>
          {categories.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Tags
        <select name="tagIds" multiple>
          {tags.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Article content
        <textarea name="content" required rows={12} maxLength={100000} />
      </label>
      <button disabled={pending}>{pending ? "Creating…" : "Create private draft"}</button>
      <p role="status" aria-live="polite">
        {message}
      </p>
    </form>
  );
}
