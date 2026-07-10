export const defaultPatientIcon = "👤";

export const patientIconOptions = ["👤", "👵", "👴", "👩", "👨", "🧓", "😊", "🌸", "🍀", "⭐", "🏥", "💙"];

export function patientIcon(value?: string | null) {
  return value || defaultPatientIcon;
}
