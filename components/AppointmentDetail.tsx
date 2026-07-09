"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { CompanionForm } from "@/components/CompanionForm";
import { LineNotificationButton } from "@/components/LineNotificationButton";
import { calendarFileName, createIcsFile, googleCalendarUrl } from "@/lib/calendar";
import {
  appointmentDateTime,
  appointmentDisplayDateTimeValue,
  normalizeDisplayDateTime,
  toDateTimeLocalValue,
  toStorageDateTime
} from "@/lib/datetime";
import { notifyCompanionAssigned, notifyCompanionRemoved } from "@/lib/line-notify-client";
import {
  deleteAppointment,
  deleteCompanion,
  getCurrentUser,
  getGroupMembers,
  saveCompanion,
  updateAppointment,
  updateAppointmentStatus
} from "@/lib/storage";
import { enabledReminderText, reminderTypeLabel } from "@/lib/reminders";
import type { AppointmentCompanion, AppointmentStatus, AppointmentView, GroupMember, ReminderType } from "@/lib/types";

type Props = {
  appointment: AppointmentView;
  shared?: boolean;
};

function reminderValues(appointment: AppointmentView) {
  return {
    one_week_before: appointment.reminders.find((reminder) => reminder.reminder_type === "one_week_before")?.enabled ?? true,
    one_day_before: appointment.reminders.find((reminder) => reminder.reminder_type === "one_day_before")?.enabled ?? true,
    same_day_morning: appointment.reminders.find((reminder) => reminder.reminder_type === "same_day_morning")?.enabled ?? true
  } satisfies Record<ReminderType, boolean>;
}

export function AppointmentDetail({ appointment: initialAppointment, shared = false }: Props) {
  const router = useRouter();
  const [appointment, setAppointment] = useState(initialAppointment);
  const [copied, setCopied] = useState(false);
  const [editingCompanion, setEditingCompanion] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState(false);
  const [selectingCompanion, setSelectingCompanion] = useState(false);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [savingAppointment, setSavingAppointment] = useState(false);
  const [editForm, setEditForm] = useState({
    hospital_name: initialAppointment.hospital_name,
    department: initialAppointment.department,
    appointment_datetime: toDateTimeLocalValue(initialAppointment.appointment_datetime),
    display_datetime: normalizeDisplayDateTime(initialAppointment.appointment_datetime, initialAppointment.display_datetime),
    items_to_bring: initialAppointment.items_to_bring,
    memo: initialAppointment.memo,
    reservation_image_url: initialAppointment.reservation_image_url || "",
    reminders: reminderValues(initialAppointment)
  });
  const user = getCurrentUser();
  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/share/${appointment.share_token}`;
  }, [appointment.share_token]);
  const calendarUrl = useMemo(() => googleCalendarUrl(appointment), [appointment]);
  const displayDateTime = appointmentDisplayDateTimeValue(appointment);
  const lineUrl = `https://line.me/R/msg/text/?${encodeURIComponent(
    `${appointment.group.patient_name}さんの通院予定\n${appointment.hospital_name} ${appointment.department}\n${appointmentDateTime(
      displayDateTime
    )}\n付き添い調整: ${shareUrl}`
  )}`;
  const companionNoticeLineUrl = `https://line.me/R/msg/text/?${encodeURIComponent(
    `${appointment.group.patient_name}さんの通院付き添いが決まりました\n\n${appointmentDateTime(
      displayDateTime
    )}\n${appointment.hospital_name} / ${appointment.department}\n付き添い: ${
      appointment.companion?.display_name || "未定"
    }さん\n\n確認する: ${shareUrl}`
  )}`;
  const isMyCompanion = Boolean(user && appointment.companion?.user_id === user.id);

  useEffect(() => {
    if (!editingAppointment && !selectingCompanion) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [editingAppointment, selectingCompanion]);

  useEffect(() => {
    async function loadMembers() {
      setMembers(await getGroupMembers(appointment.group_id));
    }
    void loadMembers();
  }, [appointment.group_id]);

  function setCompanion(companion: AppointmentCompanion) {
    setAppointment((current) => ({ ...current, companion }));
    setEditingCompanion(false);
    setSelectingCompanion(false);
    void notifyCompanionAssigned(appointment.id);
  }

  async function removeCompanion() {
    await notifyCompanionRemoved(appointment.id);
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

  async function assignMember(member: GroupMember) {
    setCompanion(
      await saveCompanion(appointment.id, {
        display_name: member.display_name,
        contact: member.contact,
        user_id: member.user_id
      })
    );
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

  function updateEditForm<K extends keyof typeof editForm>(key: K, value: (typeof editForm)[K]) {
    setEditForm((current) => ({ ...current, [key]: value }));
  }

  function updateAppointmentDateTime(value: string) {
    setEditForm((current) => ({ ...current, appointment_datetime: value, display_datetime: value }));
  }

  function updateReservationImage(file?: File) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => updateEditForm("reservation_image_url", String(reader.result || ""));
    reader.readAsDataURL(file);
  }

  async function saveEditedAppointment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingAppointment(true);
    try {
      const updatedAppointment = await updateAppointment(appointment.id, editForm);
      const appointmentDatetime = toStorageDateTime(editForm.appointment_datetime);
      const nextAppointmentDatetime = updatedAppointment?.appointment_datetime || appointmentDatetime;
      setAppointment((current) => ({
        ...current,
        hospital_name: editForm.hospital_name,
        department: editForm.department,
        appointment_datetime: nextAppointmentDatetime,
        display_datetime:
          updatedAppointment?.display_datetime ||
          normalizeDisplayDateTime(nextAppointmentDatetime, editForm.display_datetime || nextAppointmentDatetime),
        items_to_bring: editForm.items_to_bring,
        memo: editForm.memo,
        reservation_image_url:
          editForm.reservation_image_url || updatedAppointment?.reservation_image_url || current.reservation_image_url,
        reminders: current.reminders.map((reminder) => ({
          ...reminder,
          enabled: editForm.reminders[reminder.reminder_type]
        }))
      }));
      setEditForm((current) => ({
        ...current,
        appointment_datetime: toDateTimeLocalValue(nextAppointmentDatetime),
        display_datetime:
          updatedAppointment?.display_datetime ||
          normalizeDisplayDateTime(nextAppointmentDatetime, current.display_datetime || nextAppointmentDatetime),
        reservation_image_url:
          current.reservation_image_url || updatedAppointment?.reservation_image_url || appointment.reservation_image_url || ""
      }));
      setEditingAppointment(false);
    } finally {
      setSavingAppointment(false);
    }
  }

  async function toggleReminder(reminderType: ReminderType) {
    const originalReminders = reminderValues(appointment);
    const nextReminders = {
      ...originalReminders,
      [reminderType]: !originalReminders[reminderType]
    };

    setAppointment((current) => ({
      ...current,
      reminders: current.reminders.map((reminder) =>
        reminder.reminder_type === reminderType ? { ...reminder, enabled: nextReminders[reminderType] } : reminder
      )
    }));
    setEditForm((current) => ({ ...current, reminders: nextReminders }));

    try {
      await updateAppointment(appointment.id, {
        hospital_name: appointment.hospital_name,
        department: appointment.department,
        appointment_datetime: appointment.appointment_datetime,
        display_datetime: normalizeDisplayDateTime(appointment.appointment_datetime, appointment.display_datetime),
        items_to_bring: appointment.items_to_bring,
        memo: appointment.memo,
        reminders: nextReminders
      });
    } catch {
      setAppointment((current) => ({
        ...current,
        reminders: current.reminders.map((reminder) => ({
          ...reminder,
          enabled: originalReminders[reminder.reminder_type]
        }))
      }));
      setEditForm((current) => ({ ...current, reminders: originalReminders }));
    }
  }

  async function removeAppointment() {
    const ok = window.confirm("この通院予定を削除します。元に戻せません。");
    if (!ok) return;
    await deleteAppointment(appointment.id);
    router.push("/");
  }

  function downloadCalendarFile() {
    const blob = new Blob([createIcsFile(appointment)], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = calendarFileName(appointment);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  const isPast = new Date(appointment.appointment_datetime).getTime() < Date.now();
  const statusLabel =
    appointment.status === "completed" ? "受診完了" : appointment.status === "missed" ? "未受診" : "未確認";

  return (
    <article className={shared ? "detail-stack shared-detail" : "detail-stack"}>
      {!shared && (
        <section className={appointment.companion ? "detail-hero" : "detail-hero needs-escort"}>
          <p className="eyebrow">{appointment.group.group_name}</p>
          <h1>{appointment.group.patient_name}さんの通院</h1>
          <div className="visit-place">
            <strong>{appointment.hospital_name}</strong>
            <span>{appointment.department}</span>
          </div>
          <p className="large-date">{appointmentDateTime(displayDateTime)}</p>
          <div className="summary-tags">
            <span>{appointment.companion ? `付き添い: ${appointment.companion.display_name}さん` : "付き添い未定"}</span>
          </div>
        </section>
      )}

      {!shared && !appointment.companion && (
        <section className="next-actions">
          <button className="primary-action" onClick={() => void quickAssignMe()} type="button">
            自分が付き添う
          </button>
        </section>
      )}

      <section className="focus-panel">
        <div>
          <h2>付き添い担当</h2>
          {appointment.companion ? (
            <div className="escort-box ready">
              <strong>{appointment.companion.display_name}さん</strong>
              {isMyCompanion && <p>あなたが付き添い担当です。</p>}
              {appointment.companion.contact && <p>連絡先: {appointment.companion.contact}</p>}
              {appointment.companion.comment && <p>{appointment.companion.comment}</p>}
              <a className="line-action full notify-line" href={companionNoticeLineUrl} target="_blank" rel="noreferrer">
                LINEで家族に知らせる
              </a>
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
              {members.length > 1 || !isMyCompanion ? (
                <button className="secondary-action full" onClick={() => setSelectingCompanion(true)}>
                  担当者を変更
                </button>
              ) : null}
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
        {!shared && (
          <div className="info-panel">
            <h2>リマインド</h2>
            <p>{enabledReminderText(appointment)}</p>
            <div className="mini-list">
              {appointment.reminders.map((reminder) => (
                <button
                  key={reminder.id}
                  className={reminder.enabled ? "mini-pill on" : "mini-pill"}
                  onClick={() => void toggleReminder(reminder.reminder_type)}
                  type="button"
                >
                  {reminderTypeLabel[reminder.reminder_type]} {reminder.enabled ? "ON" : "OFF"}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {appointment.reservation_image_url && (
        <section className="section-block compact">
          <h2>予約票写真</h2>
          <img className="reservation-image" src={appointment.reservation_image_url} alt="予約票" />
        </section>
      )}

      <section className="section-block compact">
        <h2>カレンダーに追加</h2>
        <div className="action-grid no-bottom">
          <a className="secondary-action" href={calendarUrl} target="_blank" rel="noreferrer">
            Googleカレンダー
          </a>
          <button className="secondary-action" onClick={downloadCalendarFile} type="button">
            iPhone/Appleカレンダー
          </button>
        </div>
      </section>

      {!shared && (
        <section className="action-grid">
          <button className="secondary-action" onClick={() => setEditingAppointment(true)}>
            予定を編集
          </button>
          <button className="danger-action" onClick={() => void removeAppointment()}>
            予定を削除
          </button>
          <a className="line-action" href={lineUrl} target="_blank" rel="noreferrer">
            LINEで予定共有
          </a>
          <button className="secondary-action" onClick={copyUrl}>
            {copied ? "コピーしました" : "共有URLをコピー"}
          </button>
        </section>
      )}

      {editingAppointment && !shared && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="appointment-edit-title">
          <section className="modal-panel">
            <div className="modal-header">
              <h2 id="appointment-edit-title">予定を編集</h2>
              <button className="text-button" onClick={() => setEditingAppointment(false)} type="button">
                閉じる
              </button>
            </div>
            <form className="inline-form" onSubmit={(event) => void saveEditedAppointment(event)}>
              <label>
                病院名
                <input
                  required
                  value={editForm.hospital_name}
                  onChange={(event) => updateEditForm("hospital_name", event.target.value)}
                />
              </label>
              <label>
                診療科
                <input
                  required
                  value={editForm.department}
                  onChange={(event) => updateEditForm("department", event.target.value)}
                />
              </label>
              <label>
                予約日時
                <input
                  required
                  type="datetime-local"
                  value={editForm.appointment_datetime}
                  onChange={(event) => updateAppointmentDateTime(event.target.value)}
                />
              </label>
              <label>
                持ち物
                <textarea
                  rows={3}
                  value={editForm.items_to_bring}
                  onChange={(event) => updateEditForm("items_to_bring", event.target.value)}
                />
              </label>
              <label>
                メモ
                <textarea rows={4} value={editForm.memo} onChange={(event) => updateEditForm("memo", event.target.value)} />
              </label>
              <label>
                予約票写真
                <input accept="image/*" onChange={(event) => updateReservationImage(event.target.files?.[0])} type="file" />
              </label>
              {editForm.reservation_image_url && (
                <div className="reservation-edit-preview">
                  <img className="reservation-preview" src={editForm.reservation_image_url} alt="予約票プレビュー" />
                </div>
              )}
              <fieldset className="reminder-fieldset">
                <legend>リマインド設定</legend>
                {[
                  ["one_week_before", "1週間前"],
                  ["one_day_before", "前日"],
                  ["same_day_morning", "当日朝"]
                ].map(([key, label]) => (
                  <label className="switch-line" key={key}>
                    <span>{label}</span>
                    <input
                      checked={editForm.reminders[key as ReminderType]}
                      onChange={(event) =>
                        updateEditForm("reminders", {
                          ...editForm.reminders,
                          [key]: event.target.checked
                        })
                      }
                      type="checkbox"
                    />
                  </label>
                ))}
              </fieldset>
              <button className="primary-action full" disabled={savingAppointment} type="submit">
                {savingAppointment ? "保存中..." : "変更を保存"}
              </button>
            </form>
          </section>
        </div>
      )}

      {selectingCompanion && (
        <div className="modal-backdrop top-modal" role="dialog" aria-modal="true" aria-labelledby="companion-select-title">
          <section className="modal-panel">
            <div className="modal-header">
              <h2 id="companion-select-title">担当者を変更</h2>
              <button className="text-button" onClick={() => setSelectingCompanion(false)} type="button">
                閉じる
              </button>
            </div>
            <div className="history-list">
              {members.map((member) => (
                <button className="history-card" key={member.id} onClick={() => void assignMember(member)} type="button">
                  <strong>{member.display_name}</strong>
                  <span>{member.contact || "連絡先未登録"}</span>
                </button>
              ))}
              <button
                className="secondary-action full"
                onClick={() => {
                  setSelectingCompanion(false);
                  setEditingCompanion(true);
                }}
                type="button"
              >
                名前を入力して変更
              </button>
            </div>
          </section>
        </div>
      )}

      {isPast && !shared && (
        <section className="section-block compact">
          <h2>受診後の確認</h2>
          <p className="help-text">現在の記録: {statusLabel}</p>
          <div className="action-grid">
            <button
              className={appointment.status === "completed" ? "primary-action" : "secondary-action"}
              onClick={() => void setStatus("completed")}
              type="button"
            >
              受診完了{appointment.status === "completed" ? "中" : "に変更"}
            </button>
            <button
              className={appointment.status === "missed" ? "primary-action" : "secondary-action"}
              onClick={() => void setStatus("missed")}
              type="button"
            >
              未受診{appointment.status === "missed" ? "中" : "に変更"}
            </button>
            <Link className="secondary-action" href={`/appointments/new?group=${appointment.group_id}`}>
              次の予定を登録
            </Link>
          </div>
        </section>
      )}

      {!shared && (
        <section className="line-notify-panel detail-bottom">
          <div>
            <strong>LINE通知</strong>
            <p>付き添い担当や通院前のリマインド通知を管理できます。</p>
          </div>
          <LineNotificationButton full />
        </section>
      )}
    </article>
  );
}
