"use client";

import { useState, useTransition } from "react";
import type { ReactNode } from "react";
import { createRedirect, deleteRedirect, setRedirectActive, type RedirectRow } from "./actions";

export type { RedirectRow };

export function RedirectsTable({ initial }: { readonly initial: RedirectRow[] }): ReactNode {
  const [rows, setRows] = useState(initial);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <>
      <details className="ad-notice">
        <summary>Add redirect</summary>
        <form
          action={(form) =>
            startTransition(async () => {
              const result = await createRedirect(form);
              setMessage(result.message);
              if (result.row) setRows((current) => [...current, result.row!]);
            })
          }
          className="ad-user-form"
        >
          <label>
            From path
            <input name="fromPath" required maxLength={2000} placeholder="/old-page" />
          </label>
          <label>
            To path
            <input name="toPath" required maxLength={2000} placeholder="/new-page" />
          </label>
          <label>
            Status code
            <select name="statusCode" defaultValue="301">
              <option value="301">301 — Permanent</option>
              <option value="302">302 — Temporary</option>
            </select>
          </label>
          <label>
            Locale (optional)
            <input name="locale" maxLength={10} placeholder="Leave blank for every locale" />
          </label>
          <p className="ad-note">
            Both paths are matched and used exactly as typed, including any locale prefix (e.g.
            "/en/old-page"). A blank locale applies the rule regardless of which locale the visitor
            lands in.
          </p>
          <button type="submit" disabled={pending}>
            {pending ? "Creating…" : "Create redirect"}
          </button>
        </form>
      </details>

      <p className="ad-note">{rows.length} redirects</p>
      {rows.length > 0 && (
        <div className="ad-table-scroll" role="region" aria-label="Redirects" tabIndex={0}>
          <table className="ad-table">
            <caption className="ad-sr-only">Current redirects. {rows.length} shown.</caption>
            <thead>
              <tr>
                <th scope="col">From</th>
                <th scope="col">To</th>
                <th scope="col">Status</th>
                <th scope="col">Locale</th>
                <th scope="col">Active</th>
                <th scope="col">
                  <span className="ad-sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <th scope="row" className="ad-cell-name">
                    {row.fromPath}
                  </th>
                  <td>{row.toPath}</td>
                  <td>{row.statusCode}</td>
                  <td>{row.locale ?? "All"}</td>
                  <td>
                    <span className={`ad-badge ad-badge--${row.isActive ? "active" : "disabled"}`}>
                      {row.isActive ? "Active" : "Disabled"}
                    </span>
                  </td>
                  <td>
                    <div className="ad-product-media-actions">
                      <button
                        className="ad-chip"
                        type="button"
                        disabled={pending}
                        onClick={() =>
                          startTransition(async () => {
                            const result = await setRedirectActive(row.id, !row.isActive);
                            setMessage(result.message);
                            if (result.ok)
                              setRows((current) =>
                                current.map((entry) =>
                                  entry.id === row.id
                                    ? { ...entry, isActive: !entry.isActive }
                                    : entry,
                                ),
                              );
                          })
                        }
                      >
                        {row.isActive ? "Disable" : "Enable"}
                      </button>
                      <button
                        className="ad-chip"
                        type="button"
                        disabled={pending}
                        onClick={() => {
                          if (!window.confirm(`Remove the redirect from ${row.fromPath}?`)) return;
                          startTransition(async () => {
                            const result = await deleteRedirect(row.id);
                            setMessage(result.message);
                            if (result.ok)
                              setRows((current) => current.filter((entry) => entry.id !== row.id));
                          });
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {rows.length === 0 && <p className="ad-notice">No redirects exist yet.</p>}
      <p role="status" aria-live="polite">
        {message}
      </p>
    </>
  );
}
