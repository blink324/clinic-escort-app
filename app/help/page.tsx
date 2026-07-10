import Link from "next/link";

const supportEmail = "shun.business.nakano@gmail.com";

export default function HelpPage() {
  return (
    <main className="mobile-shell legal-shell">
      <Link className="back-link" href="/">つきそいへ戻る</Link>
      <section className="legal-card">
        <p className="eyebrow">ヘルプ</p>
        <h1>困ったときの確認</h1>
        <p>
          メール確認、LINE連携、リマインド通知でつまずいたときは、上から順番に確認してください。
        </p>

        <div className="support-list">
          <div>
            <strong>確認メールが届かない</strong>
            <p>
              迷惑メール、プロモーション、受信拒否設定を確認してください。短時間に何度も登録すると、確認メールの送信上限に達することがあります。その場合は少し時間を置いてから、登録済みならログインを試してください。
            </p>
          </div>
          <div>
            <strong>登録後にログインできない</strong>
            <p>
              確認メール内のリンクを開いてから、同じメールアドレスとパスワードでログインしてください。リンクを開いたあとに画面が変わらない場合は、トップページを開き直してください。
            </p>
          </div>
          <div>
            <strong>LINE連携できない</strong>
            <p>
              マイページのLINE連携から進み、LINEの許可画面で承認してください。つきそい公式LINEを友だち追加していない場合、通知が届かないことがあります。
            </p>
          </div>
          <div>
            <strong>LINE通知が届かない</strong>
            <p>
              マイページで連携状態が「連携済み」、LINE通知が「受け取る」になっているか確認してください。そのあと「LINEテスト通知を送る」で届くか確認できます。
            </p>
          </div>
          <div>
            <strong>リマインド通知が届かない</strong>
            <p>
              予定のリマインドがONになっているか、付き添い担当に自分が設定されているかを確認してください。前日・当日朝の時刻はマイページで変更できます。
            </p>
          </div>
          <div>
            <strong>予定や写真を直したい</strong>
            <p>
              予定詳細から編集できます。病院名、診療科、日時、持ち物、メモ、予約票写真、リマインド設定をあとから変更できます。
            </p>
          </div>
          <div>
            <strong>退会・データ削除したい</strong>
            <p>
              マイページの「退会してデータを削除する」から、アカウントとアプリ内データを削除できます。実行後は元に戻せません。
            </p>
          </div>
        </div>

        <a className="primary-action full" href={`mailto:${supportEmail}?subject=つきそいへの問い合わせ`}>
          お問い合わせはこちらから
        </a>
        <p className="muted">連絡先：{supportEmail}</p>
      </section>
    </main>
  );
}
