import type { AppointmentView } from "@/lib/types";

function formatDateForGoogle(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function formatDateForIcs(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escapeIcsText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

export function googleCalendarUrl(appointment: AppointmentView) {
  const start = new Date(appointment.appointment_datetime);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `${appointment.group.patient_name} 通院付き添い`,
    dates: `${formatDateForGoogle(start)}/${formatDateForGoogle(end)}`,
    location: appointment.hospital_name,
    details: [appointment.department, appointment.items_to_bring, appointment.memo].filter(Boolean).join("\n")
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function calendarFileName(appointment: AppointmentView) {
  return `${appointment.group.patient_name}-${appointment.hospital_name}-通院予定.ics`;
}

export function createIcsFile(appointment: AppointmentView) {
  const start = new Date(appointment.appointment_datetime);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const details = [appointment.department, appointment.items_to_bring, appointment.memo].filter(Boolean).join("\n");
  const now = new Date();

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Tsukisoi//Clinic Escort//JA",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${appointment.id}@clinic-tsukisoi.jp`,
    `DTSTAMP:${formatDateForIcs(now)}`,
    `DTSTART:${formatDateForIcs(start)}`,
    `DTEND:${formatDateForIcs(end)}`,
    `SUMMARY:${escapeIcsText(`${appointment.group.patient_name} 通院付き添い`)}`,
    `LOCATION:${escapeIcsText(appointment.hospital_name)}`,
    `DESCRIPTION:${escapeIcsText(details)}`,
    "END:VEVENT",
    "END:VCALENDAR"
  ].join("\r\n");
}
