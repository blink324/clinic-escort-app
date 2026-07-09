"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AppointmentDetail } from "@/components/AppointmentDetail";
import { appointmentDateTime, appointmentDisplayDateTimeValue } from "@/lib/datetime";
import { getSharedAppointment } from "@/lib/storage";
import type { AppointmentView } from "@/lib/types";

export default function SharePage() {
  const params = useParams<{ token: string }>();
  const [appointment, setAppointment] = useState<AppointmentView | null>();

  useEffect(() => {
    async function loadAppointment() {
      if (params.token) setAppointment((await getSharedAppointment(params.token)) || null);
    }
    void loadAppointment();
  }, [params.token]);

  if (appointment === undefined) return <main className="mobile-shell">読み込み中です</main>;

  if (!appointment) {
    return (
      <main className="mobile-shell">
        <div className="empty-state">
          <h1>共有予定が見つかりません</h1>
          <p>URLが途中で切れていないか確認してください。</p>
        </div>
      </main>
    );
  }

  return (
    <main className="mobile-shell">
      <section className="share-appointment-hero" aria-label="通院予定">
        <p className="share-patient">{appointment.group.patient_name}さんの通院</p>
        <time>{appointmentDateTime(appointmentDisplayDateTimeValue(appointment))}</time>
        <div className="share-primary-info">
          <span>医療機関</span>
          <strong>{appointment.hospital_name}</strong>
        </div>
        <div className="share-primary-info">
          <span>診療科</span>
          <strong>{appointment.department}</strong>
        </div>
        <div className={appointment.companion ? "share-companion ready" : "share-companion missing"}>
          {appointment.companion ? `付き添い: ${appointment.companion.display_name}さん` : "付き添い: 未定"}
        </div>
      </section>
      <AppointmentDetail appointment={appointment} shared />
    </main>
  );
}
