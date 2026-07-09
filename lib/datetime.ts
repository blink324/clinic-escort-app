function pad(value: number) {
  return String(value).padStart(2, "0");
}

const weekdayLabels = ["日", "月", "火", "水", "木", "金", "土"];
const hasTimeZone = (value: string) => /[zZ]|[+-]\d{2}:?\d{2}$/.test(value);

function japanParts(date: Date) {
  const parts = new Intl.DateTimeFormat("ja-JP", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Tokyo",
    year: "numeric"
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value || 0);
  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: value("hour"),
    minute: value("minute")
  };
}

function parseDateTimeLocalValue(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5])
  };
}

function utcClockDateTimeValue(value: string) {
  if (!value) return "";
  if (!hasTimeZone(value)) return value.slice(0, 16);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 16);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(
    date.getUTCHours()
  )}:${pad(date.getUTCMinutes())}`;
}

function localDateTimeMinutes(value: string) {
  const parts = parseDateTimeLocalValue(value);
  if (!parts) return null;
  return Math.floor(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute) / (1000 * 60));
}

function isNineHourDisplayShift(displayValue: string, expectedValue: string) {
  const displayMinutes = localDateTimeMinutes(displayValue);
  const expectedMinutes = localDateTimeMinutes(expectedValue);
  if (displayMinutes === null || expectedMinutes === null) return false;
  return displayMinutes - expectedMinutes === 9 * 60;
}

export function localDateKeyFromDate(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function localDateKeyFromDateTime(value: string) {
  return toDateTimeLocalValue(value).slice(0, 10);
}

export function toDateTimeLocalValue(value: string) {
  if (!value) return "";
  if (!hasTimeZone(value)) return value.slice(0, 16);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 16);
  const parts = japanParts(date);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;
}

export function toStorageDateTime(value: string) {
  if (!value) return value;
  if (hasTimeZone(value)) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toISOString();
  }
  const localParts = parseDateTimeLocalValue(value);
  const date = localParts
    ? new Date(Date.UTC(localParts.year, localParts.month - 1, localParts.day, localParts.hour - 9, localParts.minute))
    : new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString();
}

export function appointmentDate(value: string) {
  const localValue = toDateTimeLocalValue(value);
  const parts = parseDateTimeLocalValue(localValue);
  if (!parts) return localValue;
  const weekday = weekdayLabels[new Date(parts.year, parts.month - 1, parts.day).getDay()];
  return `${parts.month}/${parts.day}(${weekday})`;
}

export function appointmentTime(value: string) {
  const localValue = toDateTimeLocalValue(value);
  const parts = parseDateTimeLocalValue(localValue);
  if (!parts) return localValue;
  return `${pad(parts.hour)}:${pad(parts.minute)}`;
}

export function appointmentDateTime(value: string) {
  const localValue = toDateTimeLocalValue(value);
  const parts = parseDateTimeLocalValue(localValue);
  if (!parts) return localValue;
  const weekday = weekdayLabels[new Date(parts.year, parts.month - 1, parts.day).getDay()];
  return `${parts.year}年${parts.month}月${parts.day}日${weekday}曜日 ${pad(parts.hour)}:${pad(parts.minute)}`;
}

export function normalizeDisplayDateTime(appointmentDateTimeValue: string, displayDateTimeValue?: string | null) {
  const expectedValue = toDateTimeLocalValue(appointmentDateTimeValue);
  const displayValue = displayDateTimeValue ? toDateTimeLocalValue(displayDateTimeValue) : "";
  if (!displayValue) return expectedValue || utcClockDateTimeValue(appointmentDateTimeValue);
  if (isNineHourDisplayShift(displayValue, expectedValue)) return expectedValue;
  return displayValue;
}

export function appointmentDisplayDateTimeValue(appointment: {
  appointment_datetime: string;
  display_datetime?: string | null;
}) {
  return toDateTimeLocalValue(appointment.appointment_datetime);
}
