export function friendlyErrorMessage(caught: unknown, fallback = "処理に失敗しました。時間を置いてもう一度お試しください。") {
  const raw =
    caught instanceof Error
      ? caught.message
      : typeof caught === "string"
        ? caught
        : caught && typeof caught === "object" && "message" in caught && typeof caught.message === "string"
          ? caught.message
          : "";
  const message = raw.trim();
  if (!message || message === "{}" || message === "[object Object]") return fallback;

  const lower = message.toLowerCase();
  if (lower.includes("jwt") || lower.includes("auth") || lower.includes("session")) {
    return "ログイン状態を確認できませんでした。もう一度ログインしてください。";
  }
  if (lower.includes("permission") || lower.includes("row-level security") || lower.includes("policy")) {
    return "この操作を行う権限がありません。共有先の参加状態を確認してください。";
  }
  if (lower.includes("storage") || lower.includes("bucket") || lower.includes("upload")) {
    return "写真を保存できませんでした。画像サイズや通信状況を確認して、もう一度お試しください。";
  }
  if (lower.includes("network") || lower.includes("fetch") || lower.includes("failed to fetch")) {
    return "通信に失敗しました。電波状況を確認して、もう一度お試しください。";
  }
  if (lower.includes("duplicate") || lower.includes("unique")) {
    return "すでに登録済みの可能性があります。画面を更新して確認してください。";
  }
  if (lower.includes("invalid input") || lower.includes("invalid")) {
    return "入力内容を確認してください。日時や必須項目が正しく入っているか見てみてください。";
  }
  if (/^[A-Z0-9_:\s.-]+$/.test(message) || lower.includes("supabase") || lower.includes("postgres")) {
    return fallback;
  }
  return message;
}
