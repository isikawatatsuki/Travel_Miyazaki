import { Code, ExternalLink } from "lucide-react";

const BIO = [
  "2000年生まれ",
  "趣味はグランピングとゲームと立ち飲み屋",
  "OSS活動を最近始めた",
  "好きなものはエスニック料理とGopherくん",
  "地元は宮崎、18から熊本で学生生活を送り、大阪で拾われた",
  "現在は自社サ企業でBtoCサービスの開発・保守をしている",
];

const SKILLS = ["PHP", "Ethna", "Laravel", "Go", "BubbleTea", "JavaScript", "jQuery", "Vue.js", "TypeScript", "MySQL", "AWS", "Docker", "Nix", "Make", "Just", "Claude"];

const LINKS = [
  { label: "GitHub", href: "https://github.com/isikawatatsuki" },
  { label: "X", href: "https://x.com/i0ry_y" },
  { label: "Blog", href: "https://blog-bcj.pages.dev/about/" },
];

/**
 * チケット一覧の末尾に置く作者紹介。券が主役なので折りたたんでおく。
 * 「新しいチケットを作る」「参加コードで参加する」と同じ ticket-fold に揃える。
 * アバターは同一オリジンから配るので CSP の変更は要らない。
 */
export function AboutDeveloper() {
  return (
    <details className="ticket-fold about-dev-fold">
      <summary><Code size={18} aria-hidden="true" />開発者</summary>
      <div className="about-dev">
        <div className="about-dev-head">
          <img src="/icons/avatar.png" alt="" width={56} height={49} />
          <div>
            <p className="about-dev-name">tatsuki_ishikawa</p>
            <p className="about-dev-role">Backend Engineer</p>
          </div>
        </div>

        <ul className="about-dev-bio">
          {BIO.map((line) => <li key={line}>{line}</li>)}
        </ul>

        <p className="about-dev-label">Skills</p>
        <ul className="about-dev-skills">
          {SKILLS.map((skill) => <li key={skill}>{skill}</li>)}
        </ul>

        <ul className="about-dev-links">
          {LINKS.map(({ label, href }) => (
            <li key={label}>
              <a href={href} target="_blank" rel="noreferrer noopener">
                {label}
                <ExternalLink size={13} aria-hidden="true" />
                <span className="visually-hidden">（新しいタブで開きます）</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
