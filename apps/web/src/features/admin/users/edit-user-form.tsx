"use client";
import { useActionState } from "react";
import type { ReactNode } from "react";
import { updateUser } from "./actions";
export function EditUserForm({
  user,
  self,
}: {
  user: { id: string; role: string; status: string; adminRevision: number };
  self: boolean;
}): ReactNode {
  const [message, action, pending] = useActionState(updateUser, "");
  return (
    <form action={action} className="ad-user-form">
      <input type="hidden" name="id" value={user.id} />
      <input type="hidden" name="revision" value={user.adminRevision} />
      <label>
        Role
        <select name="role" defaultValue={user.role} disabled={self}>
          <option value="admin">Admin</option>
          <option value="content_manager">Content Manager</option>
          <option value="sales_expert">Sales Expert</option>
          <option value="customer">Customer</option>
        </select>
      </label>
      <label>
        Account status
        <select name="status" defaultValue={user.status} disabled={self}>
          <option value="active">Active</option>
          <option value="disabled">Disabled</option>
        </select>
      </label>
      <p className="ad-note">
        Disabling an account revokes its sessions. Re-enabling requires a new sign-in. Role changes
        take effect on subsequent requests.
      </p>
      {self && <p>Another administrator must change your account.</p>}
      <button type="submit" disabled={self || pending || message.startsWith("Account updated")}>
        {pending ? "Saving…" : "Save account changes"}
      </button>
      <p role="status">{message}</p>
    </form>
  );
}
