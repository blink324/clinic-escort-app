import type { AppointmentView } from "@/lib/types";

function formatDateForGoogle(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
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
