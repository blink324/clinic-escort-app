import Link from "next/link";

export default function InstallPage() {
  return (
    <main className="mobile-shell legal-shell">
      <Link className="back-link" href="/">つきそいへ戻る</Link>
      <section className="legal-card install-card">
        <p className="eyebrow">スマホに追加</p>
        <h1>つきそいをホーム画面に追加する</h1>
        <p>
          ホーム画面に追加すると、アプリのようにすぐ開けます。App Storeでインストールしなくても使えます。
        </p>

        <div className="install-preview">
          <img src="/apple-touch-icon.png" alt="つきそいのアイコン" />
          <div>
            <strong>つきそい</strong>
            <span>家族の通院を、いっしょに。</span>
          </div>
        </div>

        <section className="install-section">
          <h2>iPhoneの場合</h2>
          <ol className="install-steps">
            <li>Safariでこのページを開きます。</li>
            <li>画面下の共有ボタンを押します。</li>
            <li>「ホーム画面に追加」を選びます。</li>
            <li>右上の「追加」を押します。</li>
          </ol>
        </section>

        <section className="install-section">
          <h2>Androidの場合</h2>
          <ol className="install-steps">
            <li>Chromeでこのページを開きます。</li>
            <li>右上のメニューを押します。</li>
            <li>「ホーム画面に追加」または「アプリをインストール」を選びます。</li>
            <li>確認画面で追加します。</li>
          </ol>
        </section>

        <div className="support-list">
          <div>
            <strong>LINEで開いている場合</strong>
            <p>
              うまく追加できない時は、右上メニューからSafariまたはChromeで開き直してから追加してください。
            </p>
          </div>
        </div>

        <Link className="primary-action full" href="/">
          つきそいを開く
        </Link>
      </section>
    </main>
  );
}
