"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AuthPanel } from "@/components/AuthPanel";
import { BottomNav } from "@/components/BottomNav";
import { LineNotificationButton } from "@/components/LineNotificationButton";
import { getActiveUser } from "@/lib/auth";
import {
  appointmentDate,
  appointmentTime,
  localDateKeyFromDate,
  localDateKeyFromDateTime
} from "@/lib/datetime";
import { enabledReminderText } from "@/lib/reminders";
import { getAppointments, seedDemoData, updateAppointmentStatus } from "@/lib/storage";
import type { AppointmentStatus, AppointmentView, AuthUser } from "@/lib/types";

const monthFormatter = new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "long" });
const selectedDateFormatter = new Intl.DateTimeFormat("ja-JP", { month: "long", day: "numeric", weekday: "long" });
const ONBOARDING_SEEN_KEY = "tsukisoi-onboarding-seen";

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
  const todayKey = localDateKeyFromDate(current);
  const first = new Date(current.getFullYear(), current.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const key = localDateKeyFromDate(date);
    return {
      date,
      key,
      inMonth: date.getMonth() === current.getMonth(),
      isToday: key === todayKey,
      count: appointments.filter((appointment) => localDateKeyFromDateTime(appointment.appointment_datetime) === key).length
    };
  });
}

function isMyCompanion(appointment: AppointmentView, user: AuthUser) {
  return appointment.companion?.user_id === user.id;
}

function statusText(status: AppointmentStatus) {
  if (status === "completed") return "受診完了";
  if (status === "missed") return "未受診";
  return "未確認";
}

export default function HomePage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [appointments, setAppointments] = useState<AppointmentView[]>([]);
  const [recentAfterVisit, setRecentAfterVisit] = useState<{
    groupId: string;
    patientName: string;
    status: AppointmentStatus;
  } | null>(null);
  const [mode, setMode] = useState<"list" | "calendar">("list");
  const [selectedDate, setSelectedDate] = useState(localDateKeyFromDate(new Date()));
  const [loading, setLoading] = useState(true);
  const [showPendingOnly, setShowPendingOnly] = useState(false);
  const [showPastHistory, setShowPastHistory] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

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
    setShowOnboarding(window.localStorage.getItem(ONBOARDING_SEEN_KEY) !== "true");
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
  const unconfirmedPastAppointments = useMemo(
    () => pastAppointments.filter((appointment) => appointment.status === "upcoming").slice(0, 3),
    [pastAppointments]
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
    (appointment) => localDateKeyFromDateTime(appointment.appointment_datetime) === selectedDate
  );
  const shouldShowOnboarding = !hasAnyAppointments && showOnboarding;

  function closeOnboarding() {
    window.localStorage.setItem(ONBOARDING_SEEN_KEY, "true");
    setShowOnboarding(false);
  }

  async function setAppointmentStatus(appointmentId: string, status: AppointmentStatus) {
    const target = appointments.find((appointment) => appointment.id === appointmentId);
    await updateAppointmentStatus(appointmentId, status);
    setAppointments((current) =>
      current.map((appointment) => (appointment.id === appointmentId ? { ...appointment, status } : appointment))
    );
    if (target) {
      setRecentAfterVisit({
        groupId: target.group_id,
        patientName: target.group.patient_name,
        status
      });
    }
  }

  if (!user) return <AuthPanel onSignedIn={() => void refresh()} />;

  return (
    <main className="mobile-shell with-nav">
      <header className="app-header">
        <div>
          <p className="eyebrow">予定</p>
          <h1>付き添い調整</h1>
        </div>
        <Link className="secondary-action small" href="/mypage">マイページ</Link>
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

      {recentAfterVisit && (
        <section className="after-visit-done-panel" aria-label="受診後の記録完了">
          <div>
            <strong>
              {recentAfterVisit.patientName}さんの通院を
              {recentAfterVisit.status === "completed" ? "受診完了" : "未受診"}で記録しました
            </strong>
            <p>
              次回予約票をもらっている場合は、このまま次の予定を登録できます。
            </p>
          </div>
          <div className="after-visit-done-actions">
            <Link className="primary-action" href={`/appointments/new?group=${recentAfterVisit.groupId}`}>
              次の予定を登録
            </Link>
            <button className="secondary-action" onClick={() => setRecentAfterVisit(null)} type="button">
              閉じる
            </button>
          </div>
        </section>
      )}

      {unconfirmedPastAppointments.length > 0 && (
        <section className="after-visit-panel" aria-label="受診後の確認">
          <div className="after-visit-heading">
            <div>
              <p className="eyebrow">受診後の確認</p>
              <h2>受診しましたか？</h2>
            </div>
            <span>{unconfirmedPastAppointments.length}件</span>
          </div>
          <div className="after-visit-list">
            {unconfirmedPastAppointments.map((appointment) => (
              <article className="after-visit-card" key={appointment.id}>
                <div>
                  <strong>{appointment.group.patient_name}さんの通院</strong>
                  <p>
                    {appointmentDate(appointment.appointment_datetime)} {appointmentTime(appointment.appointment_datetime)}
                  </p>
                  <p>{appointment.hospital_name} / {appointment.department}</p>
                </div>
                <div className="after-visit-actions">
                  <button
                    className="primary-action"
                    onClick={() => void setAppointmentStatus(appointment.id, "completed")}
                    type="button"
                  >
                    受診完了
                  </button>
                  <button
                    className="secondary-action"
                    onClick={() => void setAppointmentStatus(appointment.id, "missed")}
                    type="button"
                  >
                    未受診
                  </button>
                  <Link className="text-button" href={`/appointments/${appointment.id}`}>
                    詳細
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

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
          {shouldShowOnboarding && (
            <div className="onboarding-steps" aria-label="最初の使い方">
              <button className="onboarding-close" onClick={closeOnboarding} type="button">
                閉じる
              </button>
              <div>
                <span>1</span>
                <strong>予定を登録</strong>
                <p>病院名・診療科・日時を入れます。</p>
              </div>
              <div>
                <span>2</span>
                <strong>LINEで共有</strong>
                <p>家族に予定ページを送れます。</p>
              </div>
              <div>
                <span>3</span>
                <strong>付き添い決定</strong>
                <p>誰が行くかをその場で決めます。</p>
              </div>
            </div>
          )}
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
                    <span>{appointmentDate(appointment.appointment_datetime)}</span>
                    <strong>{appointmentTime(appointment.appointment_datetime)}</strong>
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
                <strong>{appointmentTime(appointment.appointment_datetime)}</strong>
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
                <article
                  className="schedule-card past"
                  key={appointment.id}
                >
                  <div className="date-tile">
                    <span>{appointmentDate(appointment.appointment_datetime)}</span>
                    <strong>{appointmentTime(appointment.appointment_datetime)}</strong>
                  </div>
                  <div className="schedule-main">
                    <strong>{appointment.group.patient_name}</strong>
                    <p>{appointment.hospital_name} / {appointment.department}</p>
                    <div className="schedule-meta">
                      <span>{appointment.companion ? `付き添い: ${appointment.companion.display_name}` : "付き添い: 未定"}</span>
                      <span>{statusText(appointment.status)}</span>
                    </div>
                    {appointment.status === "upcoming" ? (
                      <div className="history-status-actions">
                        <button
                          className="primary-action"
                          onClick={() => void setAppointmentStatus(appointment.id, "completed")}
                          type="button"
                        >
                          受診完了
                        </button>
                        <button
                          className="secondary-action"
                          onClick={() => void setAppointmentStatus(appointment.id, "missed")}
                          type="button"
                        >
                          未受診
                        </button>
                      </div>
                    ) : (
                      <div className="history-follow-actions">
                        <Link
                          className="secondary-action"
                          href={`/appointments/${appointment.id}`}
                          onClick={() => setShowPastHistory(false)}
                        >
                          詳細を見る
                        </Link>
                        <Link
                          className="primary-action"
                          href={`/appointments/new?group=${appointment.group_id}`}
                          onClick={() => setShowPastHistory(false)}
                        >
                          {appointment.status === "completed" ? "次の予定を登録" : "再予約を登録"}
                        </Link>
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      )}

      <BottomNav />
    </main>
  );
}
