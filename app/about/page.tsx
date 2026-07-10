import Link from "next/link";

export default function AboutPage() {
  return (
    <main className="mobile-shell legal-shell">
      <Link className="back-link" href="/">つきそいへ戻る</Link>
      <section className="about-hero">
        <p className="eyebrow">家族の付き添い調整</p>
        <h1>つきそい</h1>
        <p>親や高齢家族の通院予定を共有し、誰が付き添うかを家族で決めるためのアプリです。</p>
        <Link className="primary-action full" href="/">はじめる</Link>
      </section>

      <section className="about-section">
        <h2>できること</h2>
        <div className="about-list">
          <div>
            <strong>通院予定をまとめる</strong>
            <p>患者名、病院名、診療科、受診日時、持ち物、メモ、予約票写真を登録できます。</p>
          </div>
          <div>
            <strong>家族にLINEで共有</strong>
            <p>共有URLを送れば、家族が予定を確認し、付き添い担当を決められます。</p>
          </div>
          <div>
            <strong>リマインドを受け取る</strong>
            <p>前日や当日朝のLINE通知で、受診忘れ・付き添い忘れを防ぎます。</p>
          </div>
        </div>
      </section>

      <section className="about-section">
        <h2>使い方</h2>
        <ol className="about-steps">
          <li>通院予定を登録する</li>
          <li>家族にLINEで共有する</li>
          <li>誰が付き添うかを決める</li>
          <li>前日・当日朝にリマインドを確認する</li>
        </ol>
      </section>

      <section className="about-section">
        <h2>大切にしていること</h2>
        <p>
          つきそいは医療判断を行うサービスではありません。家族の予定共有と付き添い調整を分かりやすくすることで、通院前後の不安や連絡漏れを減らすことを目指しています。
        </p>
        <div className="profile-link-list">
          <Link href="/privacy">プライバシーポリシー</Link>
          <Link href="/help">お問い合わせはこちらから</Link>
        </div>
      </section>
    </main>
  );
}
