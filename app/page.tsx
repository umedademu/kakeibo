import Link from "next/link";

export default function Home() {
  return (
    <main className="home-main">
      <div className="home-content">
        <h1 className="brand-title">kakeibo</h1>
        <Link className="updates-link" href="/updates">
          更新情報
          <span aria-hidden="true">→</span>
        </Link>
      </div>
    </main>
  );
}
