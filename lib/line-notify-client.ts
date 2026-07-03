type CompanionNotificationAction = "assigned" | "removed";

async function notifyCompanion(appointmentId: string, action: CompanionNotificationAction) {
  try {
    await fetch("/api/line/notify-companion", {
      body: JSON.stringify({ action, appointmentId }),
      headers: { "Content-Type": "application/json" },
      method: "POST"
    });
  } catch {
    // LINE notification failure should not block appointment coordination.
  }
}

export async function notifyCompanionAssigned(appointmentId: string) {
  await notifyCompanion(appointmentId, "assigned");
}

export async function notifyCompanionRemoved(appointmentId: string) {
  await notifyCompanion(appointmentId, "removed");
}
