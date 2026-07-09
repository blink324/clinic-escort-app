import Link from "next/link";

const supportEmail = "shun.business.nakano@gmail.com";

export default function ContactPage() {
  return (
    <main className="mobile-shell legal-shell">
      <Link className="back-link" href="/">つきそいへ戻る</Link>
      <section className="legal-card">
        <p className="eyebrow">お問い合わせ</p>
        <h1>困ったときの連絡先</h1>
        <p>
          メールが届かない、LINE連携ができない、データ削除をしたい、使い方が分からない場合は、下記メールアドレスへご連絡ください。
        </p>
        <a className="primary-action full" href={`mailto:${supportEmail}?subject=つきそいへの問い合わせ`}>
          メールで問い合わせる
        </a>
        <Link className="secondary-action full" href="/help">
          よくある困りごとを見る
        </Link>
        <div className="support-list">
          <div>
            <strong>メールが届かない場合</strong>
            <p>迷惑メール、プロモーション、受信拒否設定を確認してください。何度も登録すると確認メールの送信上限に達することがあります。</p>
          </div>
          <div>
            <strong>LINE通知が届かない場合</strong>
            <p>マイページでLINE連携が「連携済み」か、つきそい公式LINEを友だち追加しているか確認してください。</p>
          </div>
          <div>
            <strong>データ削除・退会したい場合</strong>
            <p>マイページの「データ削除」からアプリ内データを削除できます。アカウント自体の完全削除はメールでご連絡ください。</p>
          </div>
        </div>
        <p className="muted">連絡先：{supportEmail}</p>
      </section>
    </main>
  );
}
