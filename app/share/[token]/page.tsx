"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AppointmentDetail } from "@/components/AppointmentDetail";
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
      <div className="share-notice">LINE共有から開ける付き添い調整ページです</div>
      <AppointmentDetail appointment={appointment} shared />
    </main>
  );
}
