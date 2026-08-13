import { redirect } from "next/navigation";

/**
 * Industrial Oils & Lubricants — a retired proof route, identical to the Base Oils redirect but for
 * the slug. That file carries the reasoning: ADR-010's proof transition, why the target is the
 * default-locale canonical URL rather than the locale-less one, and why no metadata remains.
 */
export default function IndustrialOilsProofPage(): never {
  redirect("/en/products/industrial-oils-lubricants");
}
