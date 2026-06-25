"use client";

import { FormEvent, useState } from "react";
import { signInOrRegister } from "@/lib/auth";

type Props = {
  onSignedIn: () => void;
};

export function AuthPanel({ onSignedIn }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("自分");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await signInOrRegister(email, password, displayName);
      onSignedIn();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "ログインできませんでした");
    }
  }

  return (
    <section className="auth-screen">
      <div className="auth-card">
        <p className="eyebrow">家族の付き添い調整</p>
        <h1>通院予定を家族で分かち合う</h1>
        <p>
          メールアドレスでログインまたは新規登録できます。確認メールが届いた場合は、メール内のリンクを開いてからログインしてください。
        </p>
        <form className="inline-form" onSubmit={submit}>
          <label>
            表示名
            <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
          </label>
          <label>
            メールアドレス
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label>
            パスワード
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          {error && <p className="error-text">{error}</p>}
          <button className="primary-action full" type="submit">
            ログイン / 登録
          </button>
        </form>
      </div>
    </section>
  );
}
