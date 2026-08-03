export function normalizeFullName(value = "") {
  return String(value).trim().replace(/\s+/g, " ");
}

export function isFullName(value = "") {
  const parts = normalizeFullName(value).split(" ").filter(Boolean);
  return parts.length >= 2 && parts.every((part) => /[\p{L}\p{M}]/u.test(part));
}
