function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function localDateKeyFromDate(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function localDateKeyFromDateTime(value: string) {
  return localDateKeyFromDate(new Date(value));
}

export function toDateTimeLocalValue(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 16);
  return `${localDateKeyFromDate(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function toStorageDateTime(value: string) {
  if (!value) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString();
}
