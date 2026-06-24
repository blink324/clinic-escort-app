"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CompanionForm } from "@/components/CompanionForm";
import { deleteCompanion, getCurrentUser, saveCompanion, updateAppointmentStatus } from "@/lib/storage";
import { enabledReminderText, reminderTypeLabel } from "@/lib/reminders";
import type { AppointmentCompanion, AppointmentStatus, AppointmentView } from "@/lib/types";

type Props = {
  appointment: AppointmentView;
  shared?: boolean;
};

const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "long",
  hour: "2-digit",
  minute: "2-digit"
});

export function AppointmentDetail({ appointment: initialAppointment, shared = false }: Props) {
  const [appointment, setAppointment] = useState(initialAppointment);
  const [copied, setCopied] = useState(false);
  const [editingCompanion, setEditingCompanion] = useState(false);
  const user = getCurrentUser();
  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/share/${appointment.share_token}`;
  }, [appointment.share_token]);
  const lineUrl = `https://line.me/R/msg/text/?${encodeURIComponent(
    `${appointment.group.patient_name}さんの通院予定\n${appointment.hospital_name} ${appointment.department}\n${dateFormatter.format(
      new Date(appointment.appointment_datetime)
    )}\n付き添い調整: ${shareUrl}`
  )}`;

  function setCompanion(companion: AppointmentCompanion) {
    setAppointment((current) => ({ ...current, companion }));
    setEditingCompanion(false);
  }

  async function removeCompanion() {
    await deleteCompanion(appointment.id);
    setAppointment((current) => ({ ...current, companion: undefined }));
  }

  async function quickAssignMe() {
    if (!user) {
      setEditingCompanion(true);
      return;
    }
    setCompanion(await saveCompanion(appointment.id, { display_name: user.display_name, contact: user.email, user_id: user.id }));
  }

  async function copyUrl() {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  async function setStatus(status: AppointmentStatus) {
    await updateAppointmentStatus(appointment.id, status);
    setAppointment((current) => ({ ...current, status }));
  }

  const isPast = new Date(appointment.appointment_datetime).getTime() < Date.now();

  return (
    <article className="detail-stack">
      <section className={appointment.companion ? "detail-hero" : "detail-hero needs-escort"}>
        <p className="eyebrow">{appointment.group.group_name}</p>
        <h1>{appointment.group.patient_name}さんの通院</h1>
        <p className="large-date">{dateFormatter.format(new Date(appointment.appointment_datetime))}</p>
        <div className="summary-tags">
          <span>{appointment.hospital_name}</span>
          <span>{appointment.department}</span>
          <span>{appointment.companion ? `付き添い: ${appointment.companion.display_name}さん` : "付き添い未定"}</span>
        </div>
      </section>

      <section className="focus-panel">
        <div>
          <h2>付き添い担当</h2>
          {appointment.companion ? (
            <div className="escort-box ready">
              <strong>{appointment.companion.display_name}さん</strong>
              {appointment.companion.contact && <p>連絡先: {appointment.companion.contact}</p>}
              {appointment.companion.comment && <p>{appointment.companion.comment}</p>}
            </div>
          ) : (
            <div className="escort-box missing">
              <strong>まだ決まっていません</strong>
              <p>家族の誰かが付き添える場合は、この画面から担当できます。</p>
            </div>
          )}
        </div>
        <div className="button-column">
          {!appointment.companion && <CompanionForm appointmentId={appointment.id} compact={shared} onSaved={setCompanion} />}
          {appointment.companion && (
            <>
              <button className="secondary-action full" onClick={() => void quickAssignMe()}>
                担当者を変更
              </button>
              <button className="danger-action full" onClick={() => void removeCompanion()}>
                担当者を削除
              </button>
            </>
          )}
          {editingCompanion && <CompanionForm appointmentId={appointment.id} compact onSaved={setCompanion} />}
        </div>
      </section>

      <section className="info-grid">
        <div className="info-panel">
          <h2>持ち物</h2>
          <p>{appointment.items_to_bring || "未登録"}</p>
        </div>
        <div className="info-panel">
          <h2>メモ</h2>
          <p>{appointment.memo || "未登録"}</p>
        </div>
        <div className="info-panel">
          <h2>リマインド</h2>
          <p>{enabledReminderText(appointment)}</p>
          <div className="mini-list">
            {appointment.reminders.map((reminder) => (
              <span key={reminder.id} className={reminder.enabled ? "mini-pill on" : "mini-pill"}>
                {reminderTypeLabel[reminder.reminder_type]} {reminder.enabled ? "ON" : "OFF"}
              </span>
            ))}
          </div>
        </div>
      </section>

      {appointment.reservation_image_url && (
        <section className="section-block compact">
          <h2>予約票写真</h2>
          <img className="reservation-image" src={appointment.reservation_image_url} alt="予約票" />
        </section>
      )}

      {!shared && (
        <section className="action-grid">
          <a className="line-action" href={lineUrl} target="_blank" rel="noreferrer">
            LINEで予定共有
          </a>
          <button className="secondary-action" onClick={copyUrl}>
            {copied ? "コピーしました" : "共有URLをコピー"}
          </button>
        </section>
      )}

      {isPast && !shared && (
        <section className="section-block compact">
          <h2>受診後の確認</h2>
          <div className="action-grid">
            <button className="primary-action" onClick={() => void setStatus("completed")}>
              受診完了
            </button>
            <button className="secondary-action" onClick={() => void setStatus("missed")}>
              未受診
            </button>
            <Link className="secondary-action" href={`/appointments/new?group=${appointment.group_id}`}>
              次の予定を登録
            </Link>
          </div>
        </section>
      )}
    </article>
  );
}
