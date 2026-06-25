"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AuthPanel } from "@/components/AuthPanel";
import { BottomNav } from "@/components/BottomNav";
import { getActiveUser, signOut } from "@/lib/auth";
import { enabledReminderText } from "@/lib/reminders";
import { getAppointments, seedDemoData } from "@/lib/storage";
import type { AppointmentView, AuthUser } from "@/lib/types";

const dateFormatter = new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric", weekday: "short" });
const timeFormatter = new Intl.DateTimeFormat("ja-JP", { hour: "2-digit", minute: "2-digit" });

function bucketFor(dateValue: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateValue);
  const targetDay = new Date(target);
  targetDay.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((targetDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "今日";
  if (diffDays > 0 && diffDays <= 7) return "今週";
  return "来週以降";
}

function monthDays(appointments: AppointmentView[]) {
  const current = new Date();
  const first = new Date(current.getFullYear(), current.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const key = date.toISOString().slice(0, 10);
    return {
      date,
      key,
      inMonth: date.getMonth() === current.getMonth(),
      count: appointments.filter((appointment) => appointment.appointment_datetime.slice(0, 10) === key).length
    };
  });
}

export default function HomePage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [appointments, setAppointments] = useState<AppointmentView[]>([]);
  const [mode, setMode] = useState<"list" | "calendar">("list");

  async function refresh() {
    const current = await getActiveUser();
    if (current) seedDemoData(current);
    setUser(current);
    setAppointments(current ? await getAppointments() : []);
  }

  useEffect(() => {
    void refresh();
  }, []);

  const grouped = useMemo(() => {
    return appointments.reduce<Record<string, AppointmentView[]>>((acc, appointment) => {
      const bucket = bucketFor(appointment.appointment_datetime);
      acc[bucket] = [...(acc[bucket] || []), appointment];
      return acc;
    }, {});
  }, [appointments]);

  const pendingCount = appointments.filter((appointment) => !appointment.companion).length;

  if (!user) return <AuthPanel onSignedIn={() => void refresh()} />;

  return (
    <main className="mobile-shell with-nav">
      <header className="app-header">
        <div>
          <p className="eyebrow">予定</p>
          <h1>付き添い調整</h1>
        </div>
        <button className="text-button" onClick={async () => { await signOut(); await refresh(); }}>
          ログアウト
        </button>
      </header>

      <section className={pendingCount > 0 ? "attention-panel" : "attention-panel calm"}>
        <strong>{pendingCount > 0 ? `付き添い未定が${pendingCount}件あります` : "付き添い未定はありません"}</strong>
        <p>家族で共有して、担当者を早めに決めましょう。</p>
      </section>

      <div className="top-actions">
        <Link className="primary-action" href="/appointments/new">
          予定を登録
        </Link>
        <Link className="secondary-action" href="/groups/new">
          グループ作成
        </Link>
      </div>

      <div className="segmented">
        <button className={mode === "list" ? "active" : ""} onClick={() => setMode("list")}>一覧</button>
        <button className={mode === "calendar" ? "active" : ""} onClick={() => setMode("calendar")}>カレンダー</button>
      </div>

      {mode === "list" ? (
        <section className="appointment-feed">
          {["今日", "今週", "来週以降"].map((bucket) => (
            <div className="feed-group" key={bucket}>
              <h2>{bucket}</h2>
              {(grouped[bucket] || []).length === 0 && <p className="muted">予定はありません</p>}
              {(grouped[bucket] || []).map((appointment) => (
                <Link
                  className={appointment.companion ? "schedule-card" : "schedule-card urgent"}
                  href={`/appointments/${appointment.id}`}
                  key={appointment.id}
                >
                  <div className="date-tile">
                    <span>{dateFormatter.format(new Date(appointment.appointment_datetime))}</span>
                    <strong>{timeFormatter.format(new Date(appointment.appointment_datetime))}</strong>
                  </div>
                  <div className="schedule-main">
                    <strong>{appointment.group.patient_name}</strong>
                    <p>{appointment.hospital_name} / {appointment.department}</p>
                    <div className="schedule-meta">
                      <span>{appointment.companion ? `付き添い: ${appointment.companion.display_name}` : "付き添い: 未定"}</span>
                      <span>{enabledReminderText(appointment)}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ))}
        </section>
      ) : (
        <section className="calendar-card">
          <div className="calendar-grid header">
            {["日", "月", "火", "水", "木", "金", "土"].map((day) => <span key={day}>{day}</span>)}
          </div>
          <div className="calendar-grid">
            {monthDays(appointments).map((day) => (
              <div className={day.inMonth ? "calendar-day" : "calendar-day muted-day"} key={day.key}>
                <span>{day.date.getDate()}</span>
                {day.count > 0 && <strong>{day.count}件</strong>}
              </div>
            ))}
          </div>
        </section>
      )}

      <BottomNav />
    </main>
  );
}
