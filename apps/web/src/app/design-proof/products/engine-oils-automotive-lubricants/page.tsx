import { redirect } from "next/navigation";

/**
 * Engine Oils & Automotive Lubricants — a retired proof route, identical to the Base Oils redirect
 * but for the slug. That file carries the reasoning: ADR-010's proof transition, why the target is
 * the default-locale canonical URL rather than the locale-less one, and why no metadata remains.
 */
export default function EngineOilsProofPage(): never {
  redirect("/en/products/engine-oils-automotive-lubricants");
}
