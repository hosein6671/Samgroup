"use client";

import { useActionState } from "react";
import { createBlogReference } from "./actions";
import type { ReactNode } from "react";

export function BlogReferenceForm({ kind }: { kind: "categories" | "tags" }): ReactNode {
  const [message, action, pending] = useActionState(createBlogReference, "");
  return (
    <form action={action} className="ad-user-form">
      <input type="hidden" name="kind" value={kind} />
      <label>
        {kind === "categories" ? "Category name" : "Tag name"}
        <input name="name" required maxLength={100} />
      </label>
      <label>
        URL slug
        <input name="slug" required maxLength={100} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" />
      </label>
      <button disabled={pending}>
        {pending ? "Creating…" : `Create ${kind === "categories" ? "category" : "tag"}`}
      </button>
      <p role="status" aria-live="polite">
        {message}
      </p>
    </form>
  );
}
