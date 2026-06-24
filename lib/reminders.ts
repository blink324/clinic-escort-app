import type { AppointmentView, ReminderType } from "@/lib/types";

export const reminderTypeLabel: Record<ReminderType, string> = {
  one_week_before: "1週間前",
  one_day_before: "前日",
  same_day_morning: "当日朝"
};

export function enabledReminderText(appointment: AppointmentView) {
  const enabled = appointment.reminders.filter((reminder) => reminder.enabled);
  if (enabled.length === 0) return "リマインドなし";
  return enabled.map((reminder) => reminderTypeLabel[reminder.reminder_type]).join(" / ");
}
