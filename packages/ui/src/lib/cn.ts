import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Compose class names, letting a caller's class win over a primitive's default rather than
 * both landing in the output and the cascade deciding arbitrarily.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
