export function normalizeMedicineName(raw: string): string[] {
  if (!raw) return [];

  const cleaned = raw
    .trim()
    .toLowerCase()
    // collapse multiple spaces
    .replace(/\s+/g, ' ')
    // remove special characters except hyphens (common in drug names)
    .replace(/[^a-z0-9\s\-\.]/g, '');

  if (!cleaned) return [];

  const tokens = cleaned.split(' ');
  const variants: string[] = [cleaned];

  // Progressively drop trailing tokens to broaden the search
  // e.g. ["amoxicillin 500mg capsule", "amoxicillin 500mg", "amoxicillin"]
  for (let i = tokens.length - 1; i >= 1; i--) {
    const variant = tokens.slice(0, i).join(' ');
    if (variant && !variants.includes(variant)) {
      variants.push(variant);
    }
  }

  return variants;
}
