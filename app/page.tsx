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
const monthFormatter = new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "long" });
const selectedDateFormatter = new Intl.DateTimeFormat("ja-JP", { month: "long", day: "numeric", weekday: "long" });

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

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

function dayStatus(dateValue: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateValue);
  const targetDay = new Date(target);
  targetDay.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((targetDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "今日";
  if (diffDays === 1) return "明日";
  if (diffDays > 1 && diffDays <= 3) return "もうすぐ";
  return "";
}

function monthDays(appointments: AppointmentView[]) {
  const current = new Date();
  const todayKey = localDateKey(current);
  const first = new Date(current.getFullYear(), current.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const key = localDateKey(date);
    return {
      date,
      key,
      inMonth: date.getMonth() === current.getMonth(),
      isToday: key === todayKey,
      count: appointments.filter((appointment) => appointment.appointment_datetime.slice(0, 10) === key).length
    };
  });
}

function isMyCompanion(appointment: AppointmentView, user: AuthUser) {
  return appointment.companion?.user_id === user.id;
}

export default function HomePage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [appointments, setAppointments] = useState<AppointmentView[]>([]);
  const [mode, setMode] = useState<"list" | "calendar">("list");
  const [selectedDate, setSelectedDate] = useState(localDateKey(new Date()));
  const [loading, setLoading] = useState(true);
  const [showPendingOnly, setShowPendingOnly] = useState(false);

  async function refresh() {
    setLoading(true);
    const current = await getActiveUser();
    if (current) seedDemoData(current);
    setUser(current);
    setAppointments(current ? await getAppointments() : []);
    setLoading(false);
  }

  useEffect(() => {
    void refresh();
  }, []);

  const grouped = useMemo(() => {
    const visibleAppointments = showPendingOnly ? appointments.filter((appointment) => !appointment.companion) : appointments;
    return visibleAppointments.reduce<Record<string, AppointmentView[]>>((acc, appointment) => {
      const bucket = bucketFor(appointment.appointment_datetime);
      acc[bucket] = [...(acc[bucket] || []), appointment];
      return acc;
    }, {});
  }, [appointments, showPendingOnly]);

  const pendingCount = appointments.filter((appointment) => !appointment.companion).length;
  const hasAppointments = appointments.length > 0;
  const visibleCount = showPendingOnly ? pendingCount : appointments.length;
  const calendarAppointments = showPendingOnly ? appointments.filter((appointment) => !appointment.companion) : appointments;
  const calendarDays = useMemo(() => monthDays(calendarAppointments), [calendarAppointments]);
  const selectedAppointments = appointments.filter(
    (appointment) => appointment.appointment_datetime.slice(0, 10) === selectedDate
  );

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
        {loading ? (
          <>
            <strong>予定を読み込んでいます</strong>
            <p>登録済みの通院予定を確認しています。</p>
          </>
        ) : !hasAppointments ? (
          <>
            <strong>まずは通院予定を登録しましょう</strong>
            <p>患者名と日時を入れるだけで、家族に共有できる予定が作れます。</p>
          </>
        ) : pendingCount > 0 ? (
          <>
            <strong>付き添い未定が{pendingCount}件あります</strong>
            <p>家族で共有して、担当者を早めに決めましょう。</p>
          </>
        ) : (
          <>
            <strong>すべての付き添いが決まっています</strong>
            <p>予定の日時と持ち物を確認しておきましょう。</p>
          </>
        )}
      </section>

      <div className="top-actions single">
        <Link className="primary-action" href="/appointments/new">
          通院予定を登録する
        </Link>
      </div>

      {hasAppointments && (
        <>
          <div className="filter-row">
            <button
              className={showPendingOnly ? "filter-chip active" : "filter-chip"}
              onClick={() => setShowPendingOnly((current) => !current)}
              type="button"
            >
              付き添い未定だけ
            </button>
            <span>{visibleCount}件表示</span>
          </div>
          <div className="segmented">
            <button className={mode === "list" ? "active" : ""} onClick={() => setMode("list")}>一覧</button>
            <button className={mode === "calendar" ? "active" : ""} onClick={() => setMode("calendar")}>カレンダー</button>
          </div>
        </>
      )}

      {loading ? (
        <section className="empty-state">
          <h2>読み込み中です</h2>
          <p>少しだけお待ちください。</p>
        </section>
      ) : !hasAppointments ? (
        <section className="empty-state start-state">
          <h2>最初の予定を入れると便利さが分かります</h2>
          <p>母・父・祖母などの患者名を入力すると、あとから家族を招待できる共有先も自動で作られます。</p>
          <Link className="primary-action full" href="/appointments/new">最初の通院予定を登録する</Link>
        </section>
      ) : mode === "list" ? (
        <section className="appointment-feed">
          {["今日", "今週", "来週以降"].map((bucket) => (
            <div className="feed-group" key={bucket}>
              <h2>{bucket}</h2>
              {(grouped[bucket] || []).length === 0 && <p className="muted">予定はありません</p>}
              {(grouped[bucket] || []).map((appointment) => (
                <Link
                  className={[
                    "schedule-card",
                    appointment.companion ? "" : "urgent",
                    isMyCompanion(appointment, user) ? "self-escort" : ""
                  ].filter(Boolean).join(" ")}
                  href={`/appointments/${appointment.id}`}
                  key={appointment.id}
                >
                  {isMyCompanion(appointment, user) && <span className="self-escort-badge">私が付き添い</span>}
                  {dayStatus(appointment.appointment_datetime) && (
                    <span className="soon-badge">{dayStatus(appointment.appointment_datetime)}</span>
                  )}
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
          <div className="calendar-title">
            <strong>{monthFormatter.format(new Date())}</strong>
            <span>{visibleCount}件</span>
          </div>
          <div className="calendar-grid header">
            {["日", "月", "火", "水", "木", "金", "土"].map((day) => <span key={day}>{day}</span>)}
          </div>
          <div className="calendar-grid">
            {calendarDays.map((day) => (
              <button
                aria-label={`${day.date.getDate()}日 ${day.count}件`}
                className={[
                  "calendar-day",
                  day.inMonth ? "" : "muted-day",
                  day.count > 0 ? "has-events" : "",
                  day.isToday ? "today" : "",
                  selectedDate === day.key ? "selected" : ""
                ].filter(Boolean).join(" ")}
                key={day.key}
                onClick={() => setSelectedDate(day.key)}
                type="button"
              >
                <span>{day.date.getDate()}</span>
                {day.count > 0 && <strong>{day.count}</strong>}
              </button>
            ))}
          </div>
          <div className="calendar-day-list">
            <h2>{selectedDateFormatter.format(new Date(`${selectedDate}T00:00:00`))}</h2>
            {selectedAppointments.length === 0 && <p className="muted">この日の予定はありません</p>}
            {(showPendingOnly ? selectedAppointments.filter((appointment) => !appointment.companion) : selectedAppointments).map((appointment) => (
              <Link
                className={[
                  "calendar-schedule",
                  appointment.companion ? "" : "urgent",
                  isMyCompanion(appointment, user) ? "self-escort" : ""
                ].filter(Boolean).join(" ")}
                href={`/appointments/${appointment.id}`}
                key={appointment.id}
              >
                {isMyCompanion(appointment, user) && <span className="self-escort-badge">私が付き添い</span>}
                {dayStatus(appointment.appointment_datetime) && (
                  <span className="soon-badge">{dayStatus(appointment.appointment_datetime)}</span>
                )}
                <strong>{timeFormatter.format(new Date(appointment.appointment_datetime))}</strong>
                <span>{appointment.group.patient_name}さん / {appointment.hospital_name}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <BottomNav />
    </main>
  );
}
