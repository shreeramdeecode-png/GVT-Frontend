const getBucket = (label) => {
  const s = String(label ?? "").trim();
  if (!s) return 3;
  const ch = s[0];
  if (/[A-Za-z]/.test(ch)) return 0;
  if (/[0-9]/.test(ch)) return 1;
  return 2;
};

const normalize = (label) => String(label ?? "").trim().toLowerCase();

export const compareDropdownLabels = (a, b) => {
  const bucketA = getBucket(a);
  const bucketB = getBucket(b);
  if (bucketA !== bucketB) return bucketA - bucketB;

  const cmp = normalize(a).localeCompare(normalize(b), undefined, { numeric: true });
  if (cmp !== 0) return cmp;
  return String(a ?? "").localeCompare(String(b ?? ""), undefined, { numeric: true });
};

export const sortDropdownStrings = (items = []) =>
  [...items].sort((a, b) => compareDropdownLabels(a, b));

export const sortDropdownObjects = (items = [], labelSelector) =>
  [...items].sort((a, b) => compareDropdownLabels(labelSelector(a), labelSelector(b)));
