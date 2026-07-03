export function lineConnectPath() {
  const liffId = process.env.NEXT_PUBLIC_LINE_LIFF_ID;
  return liffId ? "/line/connect" : "";
}

export function lineFriendUrl() {
  return process.env.NEXT_PUBLIC_LINE_FRIEND_URL || "";
}

export function isLineConnectReady() {
  return Boolean(lineConnectPath() || lineFriendUrl());
}
