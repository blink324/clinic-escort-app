"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { authErrorMessage, registerWithEmail, signInWithEmail } from "@/lib/auth";

type Props = {
  onSignedIn: () => void;
};

type AuthMode = "login" | "register";
type AuthMessageAction = "login" | null;

export function AuthPanel({ onSignedIn }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [message, setMessage] = useState("");
  const [isNotice, setIsNotice] = useState(false);
  const [messageAction, setMessageAction] = useState<AuthMessageAction>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");
    setIsNotice(false);
    setMessageAction(null);

    try {
      if (mode === "login") {
        await signInWithEmail(email, password);
      } else {
        await registerWithEmail(email, password, displayName.trim());
      }
      onSignedIn();
    } catch (caught) {
      const text = authErrorMessage(caught);
      setMessage(text);
      setIsNotice(text.includes("確認メール"));
      setMessageAction(mode === "register" && (text.includes("登録済み") || text.includes("ログイン")) ? "login" : null);
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
          <p className="legal-inline dark">
            <Link href="/about">どんなアプリ？</Link>・<Link href="/help">ヘルプ</Link>・<Link href="/terms">利用規約</Link>・<Link href="/privacy">プライバシーポリシー</Link>
          </p>
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
              <input
                placeholder="例：太郎、長女、花子"
                required
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
              />
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
          {messageAction === "login" && (
            <button
              className="secondary-action full"
              onClick={() => {
                setMode("login");
                setMessage("");
                setIsNotice(false);
                setMessageAction(null);
              }}
              type="button"
            >
              ログイン画面へ進む
            </button>
          )}
          <div className="auth-help">
            <strong>メールが届かない場合</strong>
            <p>
              すでに登録済みのメールアドレスには、新規登録メールが届かないことがあります。その場合はログインを選んでください。
              迷惑メールやプロモーションも確認してください。
              <Link href="/help">詳しい確認方法</Link>
            </p>
          </div>
          <button className="primary-action full" disabled={submitting} type="submit">
            {submitting ? "送信中..." : mode === "login" ? "ログイン" : "登録する"}
          </button>
        </form>
        <p className="legal-inline">
          登録すると<Link href="/terms">利用規約</Link>と<Link href="/privacy">プライバシーポリシー</Link>に同意したものとします。
        </p>
      </div>
    </section>
  );
}
