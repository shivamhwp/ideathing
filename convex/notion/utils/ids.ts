export const normalizeNotionId = (value: string) => value.replace(/-/g, "").toLowerCase();

const toDashedUuid = (value: string) => {
  if (!/^[0-9a-f]{32}$/i.test(value)) return null;
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(
    16,
    20,
  )}-${value.slice(20)}`.toLowerCase();
};

export const getNotionIdVariants = (value: string) => {
  const trimmed = value.trim();
  const normalized = normalizeNotionId(trimmed);
  const dashed = toDashedUuid(normalized);
  return Array.from(new Set([trimmed, normalized, dashed].filter(Boolean) as string[]));
};
