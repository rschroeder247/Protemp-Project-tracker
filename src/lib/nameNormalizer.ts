/**
 * Utility for parsing, normalizing, and consolidating technician names.
 *
 * Rules:
 * - When multiple persons work on a task, their names are separated by "/" (e.g. "Phumlani/gazi" or "Gazi / Phumlani").
 * - Spaces around "/" are ignored.
 * - Casing is normalized (e.g. "gazi" -> "Gazi", "fani" -> "Fani").
 * - Order is consolidated alphabetically so that regardless of sequence
 *   ("Gazi/fani/khetha/phumlani" vs "fani/khetha/gazi/phumlani"), the consolidated team is identical.
 */

// Known typos or specific variations to clean up
const NAME_REPLACEMENTS: Record<string, string> = {
  khethq: 'Khetha',
  kheta: 'Khetha',
};

/**
 * Normalizes an individual person's name:
 * - Trims whitespace
 * - Applies known typo fixes
 * - Title-cases each word while preserving parentheses like "(Site Team)"
 */
export function normalizePersonName(name: string): string {
  const trimmed = (name || '').trim();
  if (!trimmed) return '';

  const lower = trimmed.toLowerCase();
  if (NAME_REPLACEMENTS[lower]) {
    return NAME_REPLACEMENTS[lower];
  }

  // Preserve parentheses structures like "Lindani (Site Team)"
  return trimmed
    .split(/\s+/)
    .map((word) => {
      if (word.startsWith('(') && word.endsWith(')')) {
        const inner = word.slice(1, -1);
        return `(${inner.charAt(0).toUpperCase() + inner.slice(1).toLowerCase()})`;
      }
      if (word.startsWith('(')) {
        const inner = word.slice(1);
        return `(${inner.charAt(0).toUpperCase() + inner.slice(1).toLowerCase()}`;
      }
      if (word.endsWith(')')) {
        const inner = word.slice(0, -1);
        return `${inner.charAt(0).toUpperCase() + inner.slice(1).toLowerCase()})`;
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

/**
 * Parses a raw name string into an array of distinct, normalized persons.
 * Splits by "/" and trims/ignores all surrounding whitespace.
 * De-duplicates names case-insensitively and sorts alphabetically.
 */
export function parsePersons(rawName?: string | null): string[] {
  if (!rawName) return [];

  const rawTokens = rawName.split('/');
  const normalizedList: string[] = [];
  const seen = new Set<string>();

  for (const token of rawTokens) {
    const cleaned = normalizePersonName(token);
    if (!cleaned) continue;
    const lowerKey = cleaned.toLowerCase();
    if (!seen.has(lowerKey)) {
      seen.add(lowerKey);
      normalizedList.push(cleaned);
    }
  }

  // Sort alphabetically to guarantee consistent ordering
  return normalizedList.sort((a, b) => a.localeCompare(b));
}

/**
 * Consolidates a team name string into a uniform, consistent format.
 * Even if the input order differs ("Gazi/Phumlani" vs "Phumlani/gazi"),
 * the resulting string will always be identical ("Gazi / Phumlani").
 *
 * @param rawName Raw string from DB or user input
 * @param separator Separator between names (defaults to " / ")
 */
export function consolidateTeamName(rawName?: string | null, separator: string = ' / '): string {
  const persons = parsePersons(rawName);
  if (persons.length === 0) {
    return (rawName || '').trim() || 'Technician';
  }
  return persons.join(separator);
}

/**
 * Checks whether a raw name entry matches a search query, matching either:
 * 1. The consolidated full team name
 * 2. Any individual person inside the team
 */
export function matchesPersonOrTeam(rawName: string | null | undefined, query: string): boolean {
  if (!query) return true;
  const q = query.trim().toLowerCase();
  if (!q) return true;

  const consolidated = consolidateTeamName(rawName).toLowerCase();
  if (consolidated.includes(q)) return true;

  const persons = parsePersons(rawName);
  return persons.some((p) => p.toLowerCase().includes(q));
}
