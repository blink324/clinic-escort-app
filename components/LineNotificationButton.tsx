"use client";

import Link from "next/link";
import { isLineConnectReady, lineConnectPath, lineFriendUrl } from "@/lib/line";

type Props = {
  full?: boolean;
};

export function LineNotificationButton({ full = false }: Props) {
  const connectPath = lineConnectPath();
  const friendUrl = lineFriendUrl();
  const className = full ? "line-notify-button full" : "line-notify-button";

  if (connectPath) {
    return (
      <Link className={className} href={connectPath}>
        LINE通知を受け取る
      </Link>
    );
  }

  if (friendUrl) {
    return (
      <a className={className} href={friendUrl} target="_blank" rel="noreferrer">
        つきそいLINEを追加
      </a>
    );
  }

  return (
    <button className={className} disabled={!isLineConnectReady()} type="button">
      LINE通知は準備中
    </button>
  );
}
