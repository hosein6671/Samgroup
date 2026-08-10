import type { ReactNode } from "react";

import { LogoMark } from "./logo-mark";
import { FOOTER_COLUMNS } from "./site-routes";

/** The footer. A Server Component — there is nothing here that needs the client. */
export function SiteFooter(): ReactNode {
  return (
    <footer className="fs-footer" data-surface="midnight">
      <div className="fs-wrap">
        <div className="fs-fgrid">
          <div className="fs-fcol">
            <a
              href="#top"
              className="fs-logo"
              aria-label="Sam Group — home"
              style={{ marginBottom: 18 }}
            >
              <LogoMark height={28} />
              <span>
                <span className="fs-logo-txt">SAM GROUP</span>
                <span className="fs-logo-sub">Petroleum Engineering</span>
              </span>
            </a>
            <p style={{ maxWidth: "34ch" }}>
              Advanced petroleum products, lubricants, base oils and industrial solutions —
              engineered, tested and shipped from our own complexes.
            </p>
          </div>

          {FOOTER_COLUMNS.map((col) => (
            <div className="fs-fcol" key={col.heading}>
              <h2>{col.heading}</h2>
              {col.links.map((link) => (
                <a href={link.href} key={link.label}>
                  {link.label}
                </a>
              ))}
            </div>
          ))}

          <div className="fs-fcol">
            <h2>Contact</h2>
            <p>Head office · Dubai, UAE</p>
            <p>Plant · Persian Gulf complex</p>
            <a href="#partnership">partnership@samgroup.example</a>
          </div>
        </div>

        <div className="fs-fbot">
          <span>© 2026 Sam Group · All rights reserved</span>
          <span>ISO 9001 · ISO 14001 · API licensed</span>
        </div>
      </div>
    </footer>
  );
}
