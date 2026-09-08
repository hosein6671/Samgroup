"use client";

import { useState } from "react";
import type { ReactNode } from "react";

import "./product-workspace-preview.css";

// Design fixtures only. No product data or publication state is loaded or saved.
const examples = [
  { name: "Base Oil Group I", family: "Base Oils", slug: "base-oil-group-i" },
  { name: "Bright Stock", family: "Base Oils", slug: "bright-stock" },
];
const sections = [
  "Content",
  "Images",
  "Grades",
  "Applications",
  "Features",
  "FAQ",
  "Family page",
  "Specifications",
  "Documents",
  "SEO",
] as const;
type Section = (typeof sections)[number];

export function ProductWorkspacePreview(): ReactNode {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [familyEditor, setFamilyEditor] = useState(false);
  const [sharedEditor, setSharedEditor] = useState(false);
  const [familyFilter, setFamilyFilter] = useState("all");
  const [section, setSection] = useState<Section>("Content");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const product = familyEditor
    ? { name: "Base Oils", family: "Category", slug: "base-oils" }
    : selected === null
      ? null
      : (examples[selected] ?? null);
  const editorSections = familyEditor
    ? sections.filter((item) => item === "Family page" || item === "SEO")
    : sections.filter((item) => item !== "Family page");
  const visible = examples.filter(
    (item) =>
      (familyFilter === "all" || item.family === familyFilter) &&
      `${item.name} ${item.family}`.toLowerCase().includes(query.toLowerCase()),
  );

  function openProduct(index: number): void {
    const example = examples[index];
    if (!example) return;
    setSelected(index);
    setFamilyEditor(false);
    setTitle(example.name);
    setDescription("");
    setMetaTitle("");
    setMetaDescription("");
    setSection("Content");
  }

  return (
    <div className="ap-preview">
      <p className="ap-preview-note">
        <strong>Design preview</strong> · Sample entries only. Changes are temporary and disappear
        when you leave or reload. Saving, uploads and publishing are not connected.
      </p>
      {sharedEditor ? (
        <SharedCataloguePreview onBack={() => setSharedEditor(false)} />
      ) : product === null ? (
        <>
          <header className="ap-intro">
            <div>
              <p className="ap-eyebrow">Product workspace</p>
              <h2>Your catalogue, organised.</h2>
              <p>Manage product content, imagery and search appearance in one place.</p>
            </div>
            <button type="button" disabled>
              Add product · coming next
            </button>
          </header>
          <section className="ap-category-entry" aria-label="Category pages">
            <div>
              <p className="ap-eyebrow">Category pages</p>
              <h3>Base Oils</h3>
              <p className="ap-muted">Sample category · shared page content and category SEO</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setFamilyEditor(true);
                setSelected(null);
                setTitle("Base Oils");
                setMetaTitle("");
                setMetaDescription("");
                setSection("Family page");
              }}
            >
              Open category preview →
            </button>
          </section>
          <div className="ap-toolbar">
            <button type="button" onClick={() => setSharedEditor(true)}>
              Shared catalogue content →
            </button>
            <label>
              Find a product
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by name or family"
              />
            </label>
            <label>
              Category
              <select
                value={familyFilter}
                onChange={(event) => setFamilyFilter(event.target.value)}
              >
                <option value="all">All sample categories</option>
                <option value="Base Oils">Base Oils</option>
              </select>
            </label>
            <span aria-live="polite">{visible.length} sample entries</span>
          </div>
          <div className="ap-products">
            {visible.map((item) => (
              <article className="ap-product" key={item.slug}>
                <div className="ap-thumbnail" aria-hidden="true">
                  ▧
                </div>
                <div>
                  <p className="ap-eyebrow">{item.family}</p>
                  <h3>{item.name}</h3>
                  <p className="ap-muted">{item.slug}</p>
                  <span className="ap-tag">Sample · status not loaded</span>
                </div>
                <button type="button" onClick={() => openProduct(examples.indexOf(item))}>
                  Open editor preview →
                </button>
              </article>
            ))}
            {visible.length === 0 && (
              <p className="ap-empty">No sample products match. Try “Base” or “Bright”.</p>
            )}
          </div>
        </>
      ) : (
        <>
          <button
            type="button"
            className="ap-back"
            onClick={() => {
              setSelected(null);
              setFamilyEditor(false);
            }}
          >
            ← Back to sample products
          </button>
          <header className="ap-editor-header">
            <div>
              <p className="ap-eyebrow">{product.family} / Editor preview</p>
              <h2>{product.name}</h2>
            </div>
            <button type="button" disabled>
              Save changes
            </button>
          </header>
          <nav
            className="ap-sections"
            aria-label={familyEditor ? "Category editor sections" : "Product editor sections"}
          >
            {editorSections.map((item) => (
              <button
                key={item}
                type="button"
                aria-current={section === item ? "page" : undefined}
                onClick={() => setSection(item)}
              >
                {item}
              </button>
            ))}
          </nav>
          <div className="ap-editor-grid">
            <section
              className="ap-panel"
              aria-label={section}
              key={familyEditor ? "family" : product.slug}
            >
              <div hidden={section !== "Grades"}>
                <PreviewRows
                  title="Product grades"
                  fields={["Grade name", "Grade system", "Description"]}
                />
              </div>
              <div hidden={section !== "Applications"}>
                <PreviewRows title="Applications" fields={["Application title", "Description"]} />
              </div>
              <div hidden={section !== "Features"}>
                <PreviewRows
                  title="Features and benefits"
                  fields={["Feature title", "Description", "Supporting source"]}
                />
              </div>
              <div hidden={section !== "FAQ"}>
                <PreviewRows title="Frequently asked questions" fields={["Question", "Answer"]} />
              </div>
              <div hidden={section !== "Family page"}>
                <h3>Base Oils · family page</h3>
                <p className="ap-preview-note">
                  Shared category content. These fields describe the family page, not this
                  individual product. Preview only.
                </p>
                <label>
                  Hero headline
                  <input placeholder="Family page headline" />
                </label>
                <label>
                  Introduction
                  <textarea rows={4} />
                </label>
                <details className="ap-coverage-group">
                  <summary>Overview and quick facts</summary>
                  <label>
                    Overview heading
                    <input />
                  </label>
                  <label>
                    Overview body
                    <textarea rows={4} />
                  </label>
                  <PreviewRows title="Quick facts" fields={["Label", "Value"]} />
                </details>
                <div className="ap-image-placeholder">
                  Family hero image placeholder
                  <button type="button" disabled>
                    Choose image
                  </button>
                </div>
                <label>
                  Hero image alternative text
                  <input />
                </label>
                <label>
                  Hero image caption
                  <input />
                </label>
                <PreviewRows
                  title="Classification and range"
                  fields={["Group name", "Axis", "Classification", "Summary", "Published grades"]}
                />
                <details className="ap-coverage-group">
                  <summary>Technical properties and quality</summary>
                  <label>
                    Properties heading
                    <input />
                  </label>
                  <label>
                    Properties introduction
                    <textarea rows={3} />
                  </label>
                  <PreviewRows
                    title="Property columns"
                    fields={["Group", "Property", "Unit", "Method", "Test condition", "Guidance"]}
                  />
                  <PreviewRows
                    title="Property values"
                    fields={["Group", "Range or grade", "Property", "Value", "Source reference"]}
                  />
                  <label>
                    Pending data note
                    <textarea rows={2} />
                  </label>
                  <label>
                    Method note
                    <textarea rows={2} />
                  </label>
                  <label>
                    Quality heading
                    <input />
                  </label>
                  <label>
                    Quality introduction
                    <textarea rows={3} />
                  </label>
                  <label>
                    Named process
                    <input />
                  </label>
                  <label>
                    Process note
                    <textarea rows={3} />
                  </label>
                  <PreviewRows title="Quality stages" fields={["Stage name", "Summary"]} />
                  <PreviewRows title="Quality tests" fields={["Property", "Method"]} />
                  <label>
                    Quality footnote
                    <textarea rows={2} />
                  </label>
                  <p className="ap-muted">
                    Technical values and claims still require review before publication.
                  </p>
                </details>
                <PreviewRows
                  title="Applications and process"
                  fields={["Section title", "Description"]}
                />
                <div className="ap-image-placeholder">
                  Process image placeholder
                  <button type="button" disabled>
                    Choose image
                  </button>
                </div>
                <PreviewRows title="Supply and packaging" fields={["Title", "Description"]} />
                <details className="ap-coverage-group">
                  <summary>Shared product selection guidance</summary>
                  <p className="ap-muted">This guidance is shared by products in this family.</p>
                  <label>
                    Selection heading
                    <input />
                  </label>
                  <label>
                    Selection introduction
                    <textarea rows={3} />
                  </label>
                  <PreviewRows title="Selection criteria" fields={["Title", "Detail"]} />
                </details>
                <details className="ap-coverage-group">
                  <summary>Documentation content</summary>
                  <label>
                    Documentation heading
                    <input />
                  </label>
                  <label>
                    Documentation introduction
                    <textarea rows={3} />
                  </label>
                  <PreviewRows
                    title="Category document entries"
                    fields={["Code", "Label", "Scope", "Access: open or gated"]}
                  />
                  <label>
                    Documentation note
                    <textarea rows={2} />
                  </label>
                </details>
                <PreviewRows title="Family questions" fields={["Question", "Answer"]} />
                <label>
                  Enquiry heading
                  <input disabled placeholder="Shared catalogue setting" />
                </label>
                <label>
                  Enquiry description
                  <textarea rows={3} disabled placeholder="Shared catalogue setting" />
                </label>
                <p className="ap-preview-note">
                  The closing enquiry block and default supply formats are currently shared across
                  catalogue pages. Open Shared catalogue content from the list to preview their
                  editor; these controls are not category overrides.
                </p>
                <p className="ap-muted">
                  Use the SEO section above to edit this category’s search appearance. No category
                  changes are saved in this preview.
                </p>
              </div>
              <div hidden={section !== "Content"}>
                <p className="ap-eyebrow">English content</p>
                <h3>Product information</h3>
                <label>
                  Product name
                  <input value={title} onChange={(event) => setTitle(event.target.value)} />
                </label>
                <label>
                  URL slug
                  <input defaultValue={product.slug} key={product.slug} />
                </label>
                <label>
                  Family
                  <select defaultValue="base">
                    <option value="base">Base Oils</option>
                  </select>
                </label>
                <label>
                  Product description
                  <textarea
                    rows={6}
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Write a clear introduction for the buyer…"
                  />
                </label>
                <label>
                  Product type
                  <input placeholder="Classification from the product catalogue" />
                </label>
                <p className="ap-preview-note">
                  Selection guidance comes from the family. Packaging and the closing enquiry block
                  use shared catalogue content. These are not individual product fields today.
                </p>
                <p className="ap-muted">
                  Family options and product content will come from the catalogue when connected.
                </p>
              </div>
              <div hidden={section !== "Images"}>
                <h3>Product images</h3>
                <GalleryPreview />
                <p className="ap-muted">
                  Upload, ordering and primary-image selection will be connected in the next
                  implementation stage.
                </p>
              </div>
              <div hidden={section !== "Specifications"}>
                <h3>Technical specifications</h3>
                <p>Specifications and their approval status will appear here.</p>
                <div className="ap-empty">No technical data loaded in this preview.</div>
                <PreviewRows
                  title="Specification entry preview"
                  fields={["Property", "Value", "Unit", "Test method", "Source reference"]}
                />
                <p className="ap-muted">
                  Technical approval remains a separate review step. Editing product copy does not
                  approve specifications.
                </p>
              </div>
              <div hidden={section !== "Documents"}>
                <h3>Product documents</h3>
                <p>Manage product data sheets and safety documents.</p>
                <div className="ap-empty">Document placeholder · no files loaded</div>
                <PreviewRows
                  title="Document details"
                  fields={["Document title", "Document type", "Language", "Revision"]}
                />
                <button type="button" disabled>
                  Attach document
                </button>
              </div>
              <div hidden={section !== "SEO"}>
                <h3>Search appearance</h3>
                <p className="ap-muted">
                  The single editing location for this {familyEditor ? "category’s" : "product’s"}{" "}
                  SEO.
                </p>
                <label>
                  SEO title
                  <input
                    value={metaTitle}
                    onChange={(event) => setMetaTitle(event.target.value)}
                    placeholder={title}
                  />
                  <small>{metaTitle.length} characters</small>
                </label>
                <label>
                  Meta description
                  <textarea
                    rows={3}
                    value={metaDescription}
                    onChange={(event) => setMetaDescription(event.target.value)}
                  />
                  <small>{metaDescription.length} characters</small>
                </label>
                <div className="ap-search-preview">
                  <span>samgp.com › en › products › {product.slug}</span>
                  <h4>{metaTitle || title || product.name}</h4>
                  <p>{metaDescription || "Your search description preview will appear here."}</p>
                </div>
                <details>
                  <summary>Advanced SEO settings</summary>
                  <label>
                    Canonical URL
                    <input type="url" placeholder="https://samgp.com/en/products/…" />
                  </label>
                  <label>
                    Social title
                    <input />
                  </label>
                  <label>
                    Social description
                    <textarea rows={3} />
                  </label>
                  <label>
                    Social image
                    <input disabled placeholder="Image selection coming next" />
                  </label>
                  <label>
                    Indexing
                    <select defaultValue="index">
                      <option value="index">Allow indexing</option>
                      <option value="noindex">Exclude from search</option>
                    </select>
                  </label>
                  <label>
                    Follow links
                    <select defaultValue="follow">
                      <option value="follow">Follow</option>
                      <option value="nofollow">Nofollow</option>
                    </select>
                  </label>
                  <label>
                    Structured data override
                    <textarea rows={4} placeholder="JSON-LD" />
                  </label>
                  <p className="ap-muted">
                    Preview controls only. Validation and public output will be verified when
                    connected.
                  </p>
                </details>
              </div>
            </section>
            <aside className="ap-panel ap-status">
              <p className="ap-eyebrow">Publishing</p>
              <h3>{familyEditor ? "Category status" : "Product status"}</h3>
              <dl>
                <dt>Publication</dt>
                <dd>Not loaded</dd>
                <dt>Technical approval</dt>
                <dd>Not loaded</dd>
                <dt>Last saved</dt>
                <dd>Not connected</dd>
              </dl>
              <button type="button" disabled>
                Publish {familyEditor ? "category" : "product"}
              </button>
              <p className="ap-muted">
                Draft and publication controls will be enabled after the saving workflow is
                implemented.
              </p>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}

function SharedCataloguePreview({ onBack }: { onBack: () => void }): ReactNode {
  return (
    <>
      <button type="button" className="ap-back" onClick={onBack}>
        ← Back to sample products
      </button>
      <header className="ap-editor-header">
        <div>
          <p className="ap-eyebrow">Shared catalogue content</p>
          <h2>One change, across the catalogue.</h2>
        </div>
        <button disabled type="button">
          Save shared content
        </button>
      </header>
      <p className="ap-preview-note">
        These are shared defaults used by product and category pages. Category-specific exceptions
        remain separate. This preview does not change the website.
      </p>
      <div className="ap-editor-grid">
        <section className="ap-panel" aria-label="Shared content editor">
          <h3>Packaging and delivery</h3>
          <label>
            Section heading
            <input placeholder="Packaging and delivery terms" />
          </label>
          <label>
            Introduction
            <textarea rows={3} />
          </label>
          <PreviewRows title="Supply formats" fields={["Format name"]} />
          <PreviewRows title="Delivery terms" fields={["Incoterm"]} />
          <details>
            <summary>Default quality content</summary>
            <PreviewRows title="Default quality stages" fields={["Stage name", "Summary"]} />
            <label>
              Quality footnote
              <textarea rows={3} />
            </label>
            <label>
              Pending technical data note
              <textarea rows={3} />
            </label>
            <label>
              Pending test method note
              <textarea rows={3} />
            </label>
          </details>
          <details>
            <summary>Closing enquiry block</summary>
            <label>
              Enquiry heading
              <input />
            </label>
            <label>
              Enquiry description
              <textarea rows={3} />
            </label>
            <label>
              Primary action label
              <input />
            </label>
            <label>
              Primary destination
              <select defaultValue="customization">
                <option value="customization">Customized solutions</option>
              </select>
            </label>
            <PreviewRows title="Supporting action copy" fields={["Action label", "Description"]} />
            <p className="ap-muted">
              Existing destinations remain Product Finder, Sample Request and Request a Quote.
              Product context and language routing are retained by the application.
            </p>
          </details>
          <details>
            <summary>Product technical-document enquiry</summary>
            <label>
              Section heading
              <input />
            </label>
            <label>
              Explanation
              <textarea rows={3} />
            </label>
            <label>
              Enquiry button label
              <input />
            </label>
            <p className="ap-muted">
              This edits shared wording. Files and technical approval are managed separately.
            </p>
          </details>
        </section>
        <aside className="ap-panel ap-status">
          <h3>Scope of changes</h3>
          <p>Product pages and category pages that use these defaults.</p>
          <p className="ap-muted">
            No live content loaded. Saving and publication are not connected.
          </p>
          <button type="button" disabled>
            Publish shared content
          </button>
        </aside>
      </div>
    </>
  );
}

function GalleryPreview(): ReactNode {
  const [items, setItems] = useState<number[]>([1]);
  const [nextId, setNextId] = useState(2);
  const [primary, setPrimary] = useState<number | null>(1);
  return (
    <section aria-label="Gallery preview">
      <p className="ap-muted">
        Arrange placeholder images and choose a primary image. No files are uploaded.
      </p>
      <div aria-live="polite">
        {items.length} placeholders ·{" "}
        {primary === null ? "No primary image" : `Placeholder ${primary} is primary`}
      </div>
      {items.map((id, index) => (
        <fieldset className="ap-gallery-item" key={id}>
          <legend>
            Image placeholder {id}
            {primary === id ? " · Primary" : ""}
          </legend>
          <div className="ap-image-placeholder" aria-hidden="true">
            ▧
          </div>
          <label>
            Alternative text
            <input placeholder="Describe what the image shows" />
          </label>
          <label>
            Caption
            <input />
          </label>
          <div className="ap-gallery-actions">
            <button type="button" aria-pressed={primary === id} onClick={() => setPrimary(id)}>
              {primary === id ? "Primary image" : "Set as primary"}
            </button>
            <button
              type="button"
              disabled={index === 0}
              onClick={() =>
                setItems((current) => {
                  const copy = [...current];
                  const previous = copy[index - 1];
                  if (previous !== undefined) {
                    copy[index - 1] = id;
                    copy[index] = previous;
                  }
                  return copy;
                })
              }
            >
              Move earlier
            </button>
            <button
              type="button"
              onClick={() => {
                const remaining = items.filter((item) => item !== id);
                setItems(remaining);
                if (primary === id) setPrimary(remaining[0] ?? null);
              }}
            >
              Remove placeholder
            </button>
          </div>
        </fieldset>
      ))}
      <button
        type="button"
        onClick={() => {
          setItems((current) => [...current, nextId]);
          if (primary === null) setPrimary(nextId);
          setNextId((id) => id + 1);
        }}
      >
        Add image placeholder
      </button>
    </section>
  );
}

/** Temporary form rows, never persisted or sent to an API. */
function PreviewRows({ title, fields }: { title: string; fields: string[] }): ReactNode {
  const [rows, setRows] = useState<number[]>([]);
  const [nextId, setNextId] = useState(1);
  return (
    <section className="ap-repeater" aria-label={title}>
      <h3>{title}</h3>
      <p className="ap-muted">Add sample entries to review the form. Nothing is saved.</p>
      {rows.map((id, index) => (
        <fieldset key={id}>
          <legend>Entry {index + 1}</legend>
          {fields.map((field) => (
            <label key={field}>
              {field}
              {/description|answer/i.test(field) ? <textarea rows={3} /> : <input />}
            </label>
          ))}
          <button
            type="button"
            disabled={index === 0}
            aria-label={`Move entry ${index + 1} up`}
            onClick={() =>
              setRows((current) => {
                const copy = [...current];
                const previous = copy[index - 1];
                if (previous !== undefined) {
                  copy[index - 1] = id;
                  copy[index] = previous;
                }
                return copy;
              })
            }
          >
            Move up
          </button>{" "}
          <button
            type="button"
            aria-label={`Remove entry ${index + 1}`}
            onClick={() => setRows((current) => current.filter((row) => row !== id))}
          >
            Remove
          </button>
        </fieldset>
      ))}
      <button
        type="button"
        onClick={() => {
          setRows((current) => [...current, nextId]);
          setNextId((id) => id + 1);
        }}
      >
        Add entry
      </button>
    </section>
  );
}
