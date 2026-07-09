"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { BottomNav } from "@/components/BottomNav";
import { getActiveUser, updateDisplayName } from "@/lib/auth";
import { appointmentDateTime, appointmentDisplayDateTimeValue } from "@/lib/datetime";
import { friendlyErrorMessage } from "@/lib/errors";
import { getAppointments, getGroup, getGroupMembers, leaveGroup, regenerateGroupInviteToken, updateGroup } from "@/lib/storage";
import type { AppointmentView, GroupMember, PatientGroup } from "@/lib/types";

const roleLabels = {
  admin: "管理者",
  member: "家族",
  viewer: "閲覧のみ"
} as const;

export default function GroupDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [group, setGroup] = useState<PatientGroup | null>();
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [appointments, setAppointments] = useState<AppointmentView[]>([]);
  const [copied, setCopied] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [savingGroup, setSavingGroup] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [regeneratingInvite, setRegeneratingInvite] = useState(false);
  const [nameMessage, setNameMessage] = useState("");
  const [groupMessage, setGroupMessage] = useState("");
  const [leaveMessage, setLeaveMessage] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");
  const [myName, setMyName] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [editingGroup, setEditingGroup] = useState(false);
  const [groupForm, setGroupForm] = useState({ patient_name: "", group_name: "", memo: "" });

  useEffect(() => {
    if (!params.id) return;
    async function loadGroup() {
      const nextGroup = (await getGroup(params.id)) || null;
      setGroup(nextGroup);
      setGroupForm({
        patient_name: nextGroup?.patient_name || "",
        group_name: nextGroup?.group_name || "",
        memo: nextGroup?.memo || ""
      });
      const currentUser = await getActiveUser();
      setMyName(currentUser?.display_name || "");
      setCurrentUserId(currentUser?.id || "");
      setMembers(await getGroupMembers(params.id));
      setAppointments((await getAppointments()).filter((appointment) => appointment.group_id === params.id));
    }
    void loadGroup();
  }, [params.id]);

  const inviteUrl = useMemo(() => {
    if (!group || typeof window === "undefined") return "";
    return `${window.location.origin}/invite/${group.invite_token}`;
  }, [group]);
  const lineUrl = `https://line.me/R/msg/text/?${encodeURIComponent(`${group?.group_name}に招待します\n${inviteUrl}`)}`;

  async function copyInvite() {
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  async function regenerateInvite() {
    if (!group) return;
    const ok = window.confirm("招待リンクを作り直します。古い招待URLは使えなくなります。実行しますか？");
    if (!ok) return;
    setRegeneratingInvite(true);
    setInviteMessage("");
    try {
      const nextGroup = await regenerateGroupInviteToken(group.id);
      if (nextGroup) setGroup(nextGroup);
      setCopied(false);
      setInviteMessage("招待リンクを作り直しました。新しいURLを共有してください。");
    } catch (caught) {
      setInviteMessage(friendlyErrorMessage(caught, "招待リンクを作り直せませんでした。時間を置いてもう一度お試しください。"));
    } finally {
      setRegeneratingInvite(false);
    }
  }

  async function saveMyName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingName(true);
    setNameMessage("");
    try {
      const user = await updateDisplayName(myName);
      setMyName(user.display_name);
      setMembers((current) =>
        current.map((member) => (member.user_id === user.id ? { ...member, display_name: user.display_name } : member))
      );
      setAppointments((current) =>
        current.map((appointment) =>
          appointment.companion?.user_id === user.id
            ? { ...appointment, companion: { ...appointment.companion, display_name: user.display_name } }
            : appointment
        )
      );
      setNameMessage("名前を更新しました");
      setEditingName(false);
    } catch (caught) {
      setNameMessage(friendlyErrorMessage(caught, "名前を更新できませんでした。時間を置いてもう一度お試しください。"));
    } finally {
      setSavingName(false);
    }
  }

  async function saveGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!group) return;
    setSavingGroup(true);
    setGroupMessage("");
    try {
      const nextGroup = await updateGroup(group.id, groupForm);
      if (nextGroup) {
        setGroup(nextGroup);
        setGroupForm({
          patient_name: nextGroup.patient_name,
          group_name: nextGroup.group_name,
          memo: nextGroup.memo
        });
      }
      setGroupMessage("共有先を更新しました");
      setEditingGroup(false);
    } catch (caught) {
      setGroupMessage(friendlyErrorMessage(caught, "共有先を更新できませんでした。入力内容を確認してください。"));
    } finally {
      setSavingGroup(false);
    }
  }

  async function leaveCurrentGroup() {
    if (!group) return;
    const ok = window.confirm(`${group.group_name}から抜けます。よろしいですか？`);
    if (!ok) return;
    setLeaving(true);
    setLeaveMessage("");
    try {
      await leaveGroup(group.id);
      router.push("/groups");
    } catch (caught) {
      setLeaveMessage(friendlyErrorMessage(caught, "共有先から抜けられませんでした。時間を置いてもう一度お試しください。"));
    } finally {
      setLeaving(false);
    }
  }

  if (group === undefined) return <main className="mobile-shell">読み込み中です</main>;
  if (!group) {
    return (
      <main className="mobile-shell with-nav">
        <div className="empty-state"><h1>共有先が見つかりません</h1></div>
        <BottomNav />
      </main>
    );
  }

  return (
    <main className="mobile-shell with-nav">
      <Link className="back-link" href="/groups">共有先へ戻る</Link>
      <section className="detail-hero">
        <p className="eyebrow">通院共有</p>
        <h1>{group.group_name}</h1>
        <p className="lead">{group.memo || "家族で通院予定と付き添い担当を共有します。"}</p>
        <button className="secondary-action full hero-edit-action" onClick={() => setEditingGroup(true)} type="button">
          名前を変更
        </button>
      </section>

      <section className="section-block compact">
        <div className="section-heading">
          <h2>招待リンク</h2>
          <span>LINEで送れます</span>
        </div>
        <div className="action-grid">
          <a className="line-action" href={lineUrl} target="_blank" rel="noreferrer">LINEで招待</a>
          <button className="secondary-action" onClick={copyInvite}>{copied ? "コピーしました" : "招待URLをコピー"}</button>
          <button className="secondary-action" disabled={regeneratingInvite} onClick={() => void regenerateInvite()} type="button">
            {regeneratingInvite ? "再発行中..." : "招待リンクを再発行"}
          </button>
        </div>
        {inviteMessage && (
          <p className={inviteMessage.includes("作り直しました") ? "notice-text" : "error-text"}>{inviteMessage}</p>
        )}
      </section>

      <section className="section-block compact">
        <div className="section-heading">
          <h2>メンバー</h2>
          <span>{members.length}人</span>
        </div>
        <div className="member-list">
          {members.map((member) => (
            <button
              className={member.user_id === currentUserId ? "member-row editable" : "member-row"}
              disabled={member.user_id !== currentUserId}
              key={member.id}
              onClick={() => {
                if (member.user_id === currentUserId) {
                  setMyName(myName || member.display_name);
                  setNameMessage("");
                  setEditingName(true);
                }
              }}
              type="button"
            >
              <strong>{member.user_id === currentUserId ? myName || member.display_name : member.display_name}</strong>
              <span>{member.user_id === currentUserId ? "自分・変更" : roleLabels[member.role]}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="section-block compact">
        <div className="section-heading">
          <h2>この患者の予定</h2>
          <Link href={`/appointments/new?group=${group.id}`}>予定を追加</Link>
        </div>
        <div className="mini-schedules">
          {appointments.map((appointment) => (
            <Link href={`/appointments/${appointment.id}`} key={appointment.id}>
              <strong>{appointmentDateTime(appointmentDisplayDateTimeValue(appointment))}</strong>
              <span>{appointment.hospital_name} / {appointment.companion ? appointment.companion.display_name : "付き添い未定"}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="section-block compact">
        <h2>この共有先から抜ける</h2>
        <p className="muted">抜けると、この共有先の予定は自分の画面に表示されなくなります。</p>
        {leaveMessage && <p className="error-text">{leaveMessage}</p>}
        <button className="danger-action full compact-form" disabled={leaving} onClick={() => void leaveCurrentGroup()} type="button">
          {leaving ? "処理中..." : "共有先から抜ける"}
        </button>
      </section>

      {editingName && (
        <div className="modal-backdrop top-modal" role="dialog" aria-modal="true" aria-labelledby="member-name-title">
          <section className="modal-panel">
            <div className="modal-header">
              <h2 id="member-name-title">自分の名前を変更</h2>
              <button className="text-button" onClick={() => setEditingName(false)} type="button">
                閉じる
              </button>
            </div>
            <form className="inline-form" onSubmit={(event) => void saveMyName(event)}>
              <label>
                メンバーに表示する名前
                <input required value={myName} onChange={(event) => setMyName(event.target.value)} />
              </label>
              {nameMessage && <p className="notice-text">{nameMessage}</p>}
              <button className="primary-action full" disabled={savingName} type="submit">
                {savingName ? "更新中..." : "名前を更新"}
              </button>
            </form>
          </section>
        </div>
      )}

      {editingGroup && (
        <div className="modal-backdrop top-modal" role="dialog" aria-modal="true" aria-labelledby="group-name-title">
          <section className="modal-panel">
            <div className="modal-header">
              <h2 id="group-name-title">共有先の名前を変更</h2>
              <button className="text-button" onClick={() => setEditingGroup(false)} type="button">
                閉じる
              </button>
            </div>
            <form className="inline-form" onSubmit={(event) => void saveGroup(event)}>
              <label>
                患者名
                <input
                  required
                  value={groupForm.patient_name}
                  onChange={(event) => setGroupForm((current) => ({ ...current, patient_name: event.target.value }))}
                />
              </label>
              <label>
                共有先の名前
                <input
                  required
                  value={groupForm.group_name}
                  onChange={(event) => setGroupForm((current) => ({ ...current, group_name: event.target.value }))}
                />
              </label>
              <label>
                メモ
                <textarea
                  rows={3}
                  value={groupForm.memo}
                  onChange={(event) => setGroupForm((current) => ({ ...current, memo: event.target.value }))}
                />
              </label>
              {groupMessage && <p className="notice-text">{groupMessage}</p>}
              <button className="primary-action full" disabled={savingGroup} type="submit">
                {savingGroup ? "更新中..." : "共有先を更新"}
              </button>
            </form>
          </section>
        </div>
      )}
      <BottomNav />
    </main>
  );
}
