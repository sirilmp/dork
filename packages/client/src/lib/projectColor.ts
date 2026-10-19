// Jira shows each "Space" as a colored square + initial letter. We don't
// store a per-project color, so we derive a stable one from the project
// key: a small fixed palette indexed by a cheap string hash, so the same
// project always renders the same color without a schema change.
const PALETTE = [
  '#2563eb',
  '#7c3aed',
  '#db2777',
  '#dc2626',
  '#d97706',
  '#65a30d',
  '#059669',
  '#0891b2',
  '#4f46e5',
  '#9333ea',
];

export function projectColor(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}
