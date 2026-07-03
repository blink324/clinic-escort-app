"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { BottomNav } from "@/components/BottomNav";
import { getAppointments, getGroup, getGroupMembers } from "@/lib/storage";
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

  useEffect(() => {
    if (!params.id) return;
    async function loadGroup() {
      setGroup((await getGroup(params.id)) || null);
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
        <p className="muted">家族の招待やメンバー確認ができます。細かい権限設定は今後追加できます。</p>
      </section>
      <BottomNav />
    </main>
  );
}
