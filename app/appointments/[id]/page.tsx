"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AppointmentDetail } from "@/components/AppointmentDetail";
import { BottomNav } from "@/components/BottomNav";
import { getAppointment } from "@/lib/storage";
import type { AppointmentView } from "@/lib/types";

export default function AppointmentPage() {
  const params = useParams<{ id: string }>();
  const [appointment, setAppointment] = useState<AppointmentView | null>();

  useEffect(() => {
    async function loadAppointment() {
      if (params.id) setAppointment((await getAppointment(params.id)) || null);
    }
    void loadAppointment();
  }, [params.id]);

  if (appointment === undefined) return <main className="mobile-shell">読み込み中です</main>;

  if (!appointment) {
    return (
      <main className="mobile-shell with-nav">
        <div className="empty-state">
          <h1>予定が見つかりません</h1>
          <Link className="primary-action" href="/">予定へ戻る</Link>
        </div>
        <BottomNav />
      </main>
    );
  }

  return (
    <main className="mobile-shell with-nav">
      <Link className="back-link" href="/">予定へ戻る</Link>
      <AppointmentDetail appointment={appointment} />
      <BottomNav />
    </main>
  );
}
