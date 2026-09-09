"use client";
import { useActionState } from "react";
import type { ReactNode } from "react";
import { createUser } from "./actions";
export function CreateUserForm(): ReactNode {
  const [message, action, pending] = useActionState(createUser, "");
  return (
    <details className="ad-notice">
      <summary>Create platform user</summary>
      <form action={action} className="ad-user-form">
        <label>
          Email
          <input name="email" type="email" required maxLength={254} autoComplete="off" />
        </label>
        <label>
          Initial password
          <input
            name="password"
            type="password"
            required
            minLength={12}
            maxLength={1024}
            autoComplete="new-password"
          />
        </label>
        <label>
          Role
          <select name="role" defaultValue="content_manager">
            <option value="admin">Admin — full administration</option>
            <option value="content_manager">Content Manager — editorial role</option>
            <option value="sales_expert">Sales Expert — sales workflow</option>
            <option value="customer">Customer — no Admin access</option>
          </select>
        </label>
        <p className="ad-note">
          Content Managers can edit website content and product descriptions and SEO here. Technical
          approval and user management remain Admin-only.
        </p>
        <button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create user"}
        </button>
        <p role="status">{message}</p>
      </form>
    </details>
  );
}
