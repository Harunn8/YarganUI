type ClassValue = string | number | false | null | undefined

/** Koşullu className birleştirici. */
export function cn(...values: ClassValue[]): string {
  return values.filter(Boolean).join(' ')
}
