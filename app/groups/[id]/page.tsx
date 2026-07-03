"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { BottomNav } from "@/components/BottomNav";
import { updateDisplayName } from "@/lib/auth";
import { getAppointments, getCurrentUser, getGroup, getGroupMembers, updateGroup } from "@/lib/storage";
import type { AppointmentView, GroupMember, PatientGroup } from "@/lib/types";

const dateFormatter = new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
const roleLabels = {
  admin: "管理者",
  member: "家族",
  viewer: "閲覧のみ"
} as const;

export default function GroupDetailPage() {
  const params = useParams<{ id: string }>();
  const [group, setGroup] = useState<PatientGroup | null>();
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [appointments, setAppointments] = useState<AppointmentView[]>([]);
  const [copied, setCopied] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [savingGroup, setSavingGroup] = useState(false);
  const [nameMessage, setNameMessage] = useState("");
  const [groupMessage, setGroupMessage] = useState("");
  const [myName, setMyName] = useState("");
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
      setMyName(getCurrentUser()?.display_name || "");
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
      setNameMessage("名前を更新しました");
    } catch (caught) {
      setNameMessage(caught instanceof Error ? caught.message : "名前を更新できませんでした");
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
    } catch (caught) {
      setGroupMessage(caught instanceof Error ? caught.message : "共有先を更新できませんでした");
    } finally {
      setSavingGroup(false);
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
        <p className="eyebrow">{group.relation}</p>
        <h1>{group.group_name}</h1>
        <p className="lead">{group.memo || "家族で通院予定と付き添い担当を共有します。"}</p>
      </section>

      <section className="section-block compact">
        <div className="section-heading">
          <h2>招待リンク</h2>
          <span>LINEで送れます</span>
        </div>
        <div className="action-grid">
          <a className="line-action" href={lineUrl} target="_blank" rel="noreferrer">LINEで招待</a>
          <button className="secondary-action" onClick={copyInvite}>{copied ? "コピーしました" : "招待URLをコピー"}</button>
        </div>
      </section>

      <section className="section-block compact">
        <div className="section-heading">
          <h2>メンバー</h2>
          <span>{members.length}人</span>
        </div>
        <div className="member-list">
          {members.map((member) => (
            <div key={member.id}>
              <strong>{member.display_name}</strong>
              <span>{roleLabels[member.role]}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="section-block compact">
        <h2>自分の名前</h2>
        <form className="inline-form compact-form" onSubmit={(event) => void saveMyName(event)}>
          <label>
            メンバーに表示する名前
            <input required value={myName} onChange={(event) => setMyName(event.target.value)} />
          </label>
          {nameMessage && <p className="notice-text">{nameMessage}</p>}
          <button className="secondary-action full" disabled={savingName} type="submit">
            {savingName ? "更新中..." : "名前を更新"}
          </button>
        </form>
      </section>

      <section className="section-block compact">
        <div className="section-heading">
          <h2>この患者の予定</h2>
          <Link href={`/appointments/new?group=${group.id}`}>予定を追加</Link>
        </div>
        <div className="mini-schedules">
          {appointments.map((appointment) => (
            <Link href={`/appointments/${appointment.id}`} key={appointment.id}>
              <strong>{dateFormatter.format(new Date(appointment.appointment_datetime))}</strong>
              <span>{appointment.hospital_name} / {appointment.companion ? appointment.companion.display_name : "付き添い未定"}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="section-block compact">
        <h2>共有設定</h2>
        <form className="inline-form compact-form" onSubmit={(event) => void saveGroup(event)}>
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
          <button className="secondary-action full" disabled={savingGroup} type="submit">
            {savingGroup ? "更新中..." : "共有先を更新"}
          </button>
        </form>
      </section>
      <BottomNav />
    </main>
  );
}
