"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AuthPanel } from "@/components/AuthPanel";
import { BottomNav } from "@/components/BottomNav";
import { LineNotificationButton } from "@/components/LineNotificationButton";
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
  const [showPastHistory, setShowPastHistory] = useState(false);

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

  useEffect(() => {
    if (!showPastHistory) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [showPastHistory]);

  const nowTime = Date.now();
  const futureAppointments = useMemo(
    () => appointments.filter((appointment) => new Date(appointment.appointment_datetime).getTime() >= nowTime),
    [appointments, nowTime]
  );
  const pastAppointments = useMemo(
    () =>
      appointments
        .filter((appointment) => new Date(appointment.appointment_datetime).getTime() < nowTime)
        .sort((a, b) => new Date(b.appointment_datetime).getTime() - new Date(a.appointment_datetime).getTime()),
    [appointments, nowTime]
  );

  const grouped = useMemo(() => {
    const visibleAppointments = showPendingOnly
      ? futureAppointments.filter((appointment) => !appointment.companion)
      : futureAppointments;
    return visibleAppointments.reduce<Record<string, AppointmentView[]>>((acc, appointment) => {
      const bucket = bucketFor(appointment.appointment_datetime);
      acc[bucket] = [...(acc[bucket] || []), appointment];
      return acc;
    }, {});
  }, [futureAppointments, showPendingOnly]);

  const pendingCount = futureAppointments.filter((appointment) => !appointment.companion).length;
  const hasFutureAppointments = futureAppointments.length > 0;
  const hasAnyAppointments = appointments.length > 0;
  const visibleCount = showPendingOnly ? pendingCount : futureAppointments.length;
  const calendarAppointments = showPendingOnly
    ? futureAppointments.filter((appointment) => !appointment.companion)
    : futureAppointments;
  const calendarDays = useMemo(() => monthDays(calendarAppointments), [calendarAppointments]);
  const selectedAppointments = futureAppointments.filter(
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
        ) : !hasFutureAppointments ? (
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

      {hasAnyAppointments && (
        <>
          <div className="filter-row">
            <button
              className={showPendingOnly ? "filter-chip active" : "filter-chip"}
              onClick={() => setShowPendingOnly((current) => !current)}
              type="button"
            >
              付き添い未定だけ
            </button>
            <button className="filter-chip history" onClick={() => setShowPastHistory(true)} type="button">
              過去の通院履歴
            </button>
            <span>{visibleCount}件表示</span>
          </div>
          {hasFutureAppointments && (
            <div className="segmented">
              <button className={mode === "list" ? "active" : ""} onClick={() => setMode("list")}>一覧</button>
              <button className={mode === "calendar" ? "active" : ""} onClick={() => setMode("calendar")}>カレンダー</button>
            </div>
          )}
        </>
      )}

      {loading ? (
        <section className="empty-state">
          <h2>読み込み中です</h2>
          <p>少しだけお待ちください。</p>
        </section>
      ) : !hasFutureAppointments ? (
        <section className="empty-state start-state">
          <h2>{hasAnyAppointments ? "今後の通院予定はありません" : "最初の予定を入れると便利さが分かります"}</h2>
          <p>
            {hasAnyAppointments
              ? "過去の通院は履歴から確認できます。次の予定が決まったら登録しましょう。"
              : "母・父・祖母などの患者名を入力すると、あとから家族を招待できる共有先も自動で作られます。"}
          </p>
          <Link className="primary-action full" href="/appointments/new">
            {hasAnyAppointments ? "次の通院予定を登録する" : "最初の通院予定を登録する"}
          </Link>
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
                  {(isMyCompanion(appointment, user) || dayStatus(appointment.appointment_datetime)) && (
                    <div className="status-badges">
                      {isMyCompanion(appointment, user) && <span className="self-escort-badge">私が付き添い</span>}
                      {dayStatus(appointment.appointment_datetime) && (
                        <span className="soon-badge">{dayStatus(appointment.appointment_datetime)}</span>
                      )}
                    </div>
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
                {(isMyCompanion(appointment, user) || dayStatus(appointment.appointment_datetime)) && (
                  <div className="status-badges">
                    {isMyCompanion(appointment, user) && <span className="self-escort-badge">私が付き添い</span>}
                    {dayStatus(appointment.appointment_datetime) && (
                      <span className="soon-badge">{dayStatus(appointment.appointment_datetime)}</span>
                    )}
                  </div>
                )}
                <strong>{timeFormatter.format(new Date(appointment.appointment_datetime))}</strong>
                <span>{appointment.group.patient_name}さん / {appointment.hospital_name}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="line-notify-panel lower">
        <div>
          <strong>LINEでリマインドを受け取る</strong>
          <p>付き添い担当になった時や、前日・当日朝の通知に使います。</p>
        </div>
        <LineNotificationButton full />
      </section>

      {showPastHistory && (
        <div className="modal-backdrop top-modal" role="dialog" aria-modal="true" aria-labelledby="past-history-title">
          <section className="modal-panel past-history-panel">
            <div className="modal-header">
              <h2 id="past-history-title">過去の通院履歴</h2>
              <button className="text-button" onClick={() => setShowPastHistory(false)} type="button">
                閉じる
              </button>
            </div>
            <div className="past-history-list">
              {pastAppointments.length === 0 && <p className="muted">過去の通院履歴はまだありません</p>}
              {pastAppointments.map((appointment) => (
                <Link
                  className="schedule-card past"
                  href={`/appointments/${appointment.id}`}
                  key={appointment.id}
                  onClick={() => setShowPastHistory(false)}
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
                      <span>{appointment.status === "completed" ? "受診完了" : appointment.status === "missed" ? "未受診" : "未確認"}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </div>
      )}

      <BottomNav />
    </main>
  );
}
