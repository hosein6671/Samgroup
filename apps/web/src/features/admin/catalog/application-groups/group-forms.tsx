"use client";
import { useActionState, useState, useTransition } from "react";
import type { ReactNode } from "react";

import { createApplicationGroup, deleteApplicationGroup, updateApplicationGroup } from "./actions";

type Family = { id: string; name: string };

export function CreateApplicationGroupForm({
  families,
}: {
  readonly families: readonly Family[];
}): ReactNode {
  const [message, action, pending] = useActionState(createApplicationGroup, "");
  return (
    <details className="ad-notice">
      <summary>Add application group</summary>
      <form action={action} className="ad-user-form">
        <label>
          Product Family
          <select name="categoryId" required defaultValue="">
            <option value="" disabled>
              Choose a family
            </option>
            {families.map((family) => (
              <option key={family.id} value={family.id}>
                {family.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Name (English)
          <input name="name" required maxLength={80} autoComplete="off" />
        </label>
        <p className="ad-note">
          The group is added to the end of its family. Set the order and the names in other
          languages in the table below.
        </p>
        <button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create group"}
        </button>
        <p role="status">{message}</p>
      </form>
    </details>
  );
}

export type GroupRowData = {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly sortOrder: number;
  readonly productCount: number;
  readonly translations: Readonly<Record<string, string>>;
};

export function ApplicationGroupRow({
  group,
  locales,
}: {
  readonly group: GroupRowData;
  /** Non-default locales whose name can be edited here, e.g. `[{ code: "fa", name: "Persian" }]`. */
  readonly locales: readonly { code: string; name: string }[];
}): ReactNode {
  const [name, setName] = useState(group.name);
  const [order, setOrder] = useState(String(group.sortOrder));
  const [translations, setTranslations] = useState<Record<string, string>>({
    ...group.translations,
  });
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function save(): void {
    startTransition(async () => {
      const result = await updateApplicationGroup(group.id, {
        name,
        sortOrder: Number(order),
        translations,
      });
      setMessage(result.message);
    });
  }

  function remove(): void {
    startTransition(async () => {
      const result = await deleteApplicationGroup(group.id);
      setMessage(result.message);
    });
  }

  return (
    <tr>
      <th scope="row" className="ad-cell-name">
        <label className="ad-sr-only" htmlFor={`group-name-${group.id}`}>
          Name in English
        </label>
        <input
          id={`group-name-${group.id}`}
          value={name}
          maxLength={80}
          onChange={(event) => setName(event.target.value)}
        />
      </th>
      {locales.map((locale) => (
        <td key={locale.code}>
          <label className="ad-sr-only" htmlFor={`group-${locale.code}-${group.id}`}>
            Name in {locale.name}
          </label>
          <input
            id={`group-${locale.code}-${group.id}`}
            lang={locale.code}
            dir="auto"
            value={translations[locale.code] ?? ""}
            maxLength={80}
            onChange={(event) =>
              setTranslations((current) => ({ ...current, [locale.code]: event.target.value }))
            }
          />
        </td>
      ))}
      <td>
        <label className="ad-sr-only" htmlFor={`group-order-${group.id}`}>
          Display order
        </label>
        <input
          id={`group-order-${group.id}`}
          type="number"
          min={0}
          max={10000}
          inputMode="numeric"
          value={order}
          onChange={(event) => setOrder(event.target.value)}
          style={{ maxWidth: 88 }}
        />
      </td>
      <td>{group.productCount}</td>
      <td>
        <div className="ad-filters">
          <button className="ad-btn" type="button" disabled={pending} onClick={save}>
            {pending ? "Saving…" : "Save"}
          </button>
          <button
            className="ad-chip"
            type="button"
            disabled={pending || group.productCount > 0}
            title={group.productCount > 0 ? "Move its products first" : undefined}
            onClick={remove}
          >
            Delete
          </button>
        </div>
        <p role="status" aria-live="polite" className="ad-note">
          {message}
        </p>
      </td>
    </tr>
  );
}
