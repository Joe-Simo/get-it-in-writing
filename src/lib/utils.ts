import { clsx, type ClassValue } from "clsx"
import { ConvexError } from "convex/values"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Convex redacts plain Error messages on production deployments, so only
// ConvexError data is safe to show; anything else gets the caller's fallback.
export function errorText(error: unknown, fallback: string) {
  return error instanceof ConvexError && typeof error.data === "string"
    ? error.data
    : fallback
}
