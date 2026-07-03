export async function notifyCompanionAssigned(appointmentId: string) {
  try {
    await fetch("/api/line/notify-companion", {
      body: JSON.stringify({ appointmentId }),
      headers: { "Content-Type": "application/json" },
      method: "POST"
    });
  } catch {
    // LINE notification failure should not block appointment coordination.
  }
}
