"use client";

import { FormEvent, useState } from "react";
import { registerWithEmail, signInWithEmail } from "@/lib/auth";

type Props = {
  onSignedIn: () => void;
};

type AuthMode = "login" | "register";

export function AuthPanel({ onSignedIn }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("自分");
  const [message, setMessage] = useState("");
  const [isNotice, setIsNotice] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");
    setIsNotice(false);

    try {
      if (mode === "login") {
        await signInWithEmail(email, password);
      } else {
        await registerWithEmail(email, password, displayName);
      }
      onSignedIn();
    } catch (caught) {
      const text = caught instanceof Error ? caught.message : "処理できませんでした";
      setMessage(text);
      setIsNotice(text.includes("確認メール"));
    } finally {
      setSubmitting(false);
    }
  }

  if (!showForm) {
    return (
      <section className="brand-screen">
        <div className="brand-glow" />
        <div className="brand-hero">
          <p className="brand-kicker">家族の通院付き添いを、ひとつに。</p>
          <h1>つきそい</h1>
          <p>
            親や高齢家族の通院予定を共有し、誰が付き添うかを家族で決められるアプリです。
          </p>
          <div className="brand-actions">
            <button
              className="primary-action full"
              onClick={() => {
                setMode("register");
                setShowForm(true);
              }}
            >
              新規登録する
            </button>
            <button
              className="secondary-action full dark"
              onClick={() => {
                setMode("login");
                setShowForm(true);
              }}
            >
              ログイン
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="auth-screen">
      <div className="auth-card">
        <p className="eyebrow">つきそい</p>
        <h1>{mode === "login" ? "ログイン" : "新規登録"}</h1>
        <p>
          {mode === "login"
            ? "登録済みのメールアドレスとパスワードでログインしてください。"
            : "確認メールが届いた場合は、メール内のリンクを開いてからログインしてください。"}
        </p>

        <div className="auth-mode-switch">
          <button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")} type="button">
            ログイン
          </button>
          <button className={mode === "register" ? "active" : ""} onClick={() => setMode("register")} type="button">
            新規登録
          </button>
        </div>

        <form className="inline-form" onSubmit={submit}>
          {mode === "register" && (
            <label>
              表示名
              <input required value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
            </label>
          )}
          <label>
            メールアドレス
            <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label>
            パスワード
            <input
              required
              minLength={6}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {message && <p className={isNotice ? "notice-text" : "error-text"}>{message}</p>}
          <button className="primary-action full" disabled={submitting} type="submit">
            {submitting ? "送信中..." : mode === "login" ? "ログイン" : "登録する"}
          </button>
        </form>
      </div>
    </section>
  );
}
