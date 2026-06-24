"use client";

import { FormEvent, useState } from "react";
import { signInOrRegister } from "@/lib/auth";

type Props = {
  onSignedIn: () => void;
};

export function AuthPanel({ onSignedIn }: Props) {
  const [email, setEmail] = useState("demo@example.com");
  const [password, setPassword] = useState("password123");
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
          Supabase Authのメール認証に対応したログイン画面です。環境変数が未設定の間は、入力した名前でデモ利用できます。
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
