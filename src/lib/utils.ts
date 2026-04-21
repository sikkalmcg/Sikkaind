import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * @fileOverview Registry Utility Node.
 * Manages Tailwind class merging and conditional formatting.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
