"use client";
import { useActionState } from "react";
import type { ReactNode } from "react";
import { createSegment } from "./actions";

export function CreateSegmentForm(): ReactNode {
  const [message, action, pending] = useActionState(createSegment, "");
  return (
    <details className="ad-notice">
      <summary>Add Segment</summary>
      <form action={action} className="ad-user-form">
        <label>
          Name
          <input name="name" required maxLength={60} autoComplete="off" />
        </label>
        <p className="ad-note">
          The URL slug is generated from the name. Added to the end of the list — reordering and
          renaming are not available here yet.
        </p>
        <button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create Segment"}
        </button>
        <p role="status">{message}</p>
      </form>
    </details>
  );
}
