import { AlertCircle, Camera, ChevronDown, Cloud, LogIn, LogOut, Plus, RefreshCw, Trash2, UserPlus } from "lucide-react";
import { useState } from "react";
import { useTrip } from "../TripContext";
import { makeId } from "../lib";
import type { Person } from "../types";
import { EmptyState, IconButton, PageHelp, Panel, SectionHeading } from "../components/ui";

const AUTH_ERRORS: Record<string, string> = {
  not_configured: "Googleログインがまだ設定されていません。サイト管理者による設定が必要です。",
  no_database: "アカウント情報の保存先が設定されていません。サイト管理者による設定が必要です。",
  state: "認証の途中で情報が失われました。もう一度お試しください。",
  exchange: "Googleとの通信に失敗しました。時間をおいてお試しください。",
  token: "Googleアカウントを確認できませんでした。もう一度お試しください。",
};

// /api/auth/* は失敗すると ?authError=... を付けて戻ってくる。読んだらURLから消す。
function readAuthError() {
  const reason = new URLSearchParams(window.location.search).get("authError");
  if (!reason) return "";
  window.history.replaceState(null, "", `${window.location.pathname}${window.location.hash}`);
  return AUTH_ERRORS[reason] || "ログインできませんでした。";
}

export function SharePage() {
  const { settlement, setSettlement, notes, setNotes, album, groups, activeGroup, syncStatus, createGroup, joinGroup, refreshGroup, switchGroup, helpOpen, setHelpOpen, accountUser, accountGroups, loginWithGoogle, logout, restoreAccountGroup } = useTrip();
  const [newNote, setNewNote] = useState("");
  const [groupName, setGroupName] = useState("旅行グループ");
  const [joinCode, setJoinCode] = useState("");
  const [manageOpen, setManageOpen] = useState(!activeGroup);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [showHelpAfterCreate, setShowHelpAfterCreate] = useState(true);
  const [authError, setAuthError] = useState(() => readAuthError());

  const updatePerson = (id: string, patch: Partial<Person>) => setSettlement((current) => ({
    ...current,
    people: current.people.map((person) => person.id === id ? { ...person, ...patch } : person),
  }));
  const run = async (action: () => Promise<void>) => {
    setBusy(true); setMessage("");
    try { await action(); setManageOpen(false); } catch (error) { setMessage(error instanceof Error ? error.message : "操作できませんでした。"); } finally { setBusy(false); }
  };

  return (
    <div className="page">
      <PageHelp open={helpOpen} onChange={setHelpOpen}><p>メンバー登録がすべての人数計算の基準です。6桁コードでほかの端末も参加できます。</p></PageHelp>
      <SectionHeading eyebrow="TOGETHER" title="みんなで共有" description="メンバー、グループ、共有メモをまとめています。" />

      <section className="section-block">
        <SectionHeading eyebrow="ACCOUNT" title="アカウントで復旧" />
        <Panel className="account-panel">
          {authError && <p className="account-error" role="alert"><AlertCircle size={17} aria-hidden="true" />{authError}<button className="button button-quiet small" type="button" onClick={() => setAuthError("")}>閉じる</button></p>}
          {accountUser ? <><div><strong>{accountUser.displayName || accountUser.email || "Googleアカウント"}</strong><small>ログイン中</small></div><button className="button button-quiet small" type="button" onClick={() => run(logout)}><LogOut size={17} />ログアウト</button></> : <><div><strong>端末を替えても旅行を復元</strong><small>Googleログインは任意です。コード参加は今までどおり使えます。</small></div><button className="button button-secondary" type="button" onClick={loginWithGoogle}><LogIn size={17} />Googleでログイン</button></>}
          {accountUser && accountGroups.length > 0 && <label className="account-restore"><span>アカウントの旅行</span><select defaultValue="" onChange={(event) => event.target.value && run(() => restoreAccountGroup(event.target.value))}><option value="" disabled>復元する旅行を選ぶ</option>{accountGroups.map((group) => <option key={group.id} value={group.id}>{group.name}（{group.role}）</option>)}</select></label>}
        </Panel>
      </section>

      <section className="section-block member-section">
        <SectionHeading eyebrow="MEMBERS" title="メンバー登録" action={<span className="count-badge">{settlement.people.length}人</span>} />
        <Panel className="member-panel">
          {settlement.people.map((person, index) => (
            <div className="member-row" key={person.id}>
              <span className="avatar" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
              <label><span>名前</span><input value={person.name} onChange={(event) => updatePerson(person.id, { name: event.target.value })} /></label>
              <label><span>役割</span><input value={person.role} placeholder="メンバー" onChange={(event) => updatePerson(person.id, { role: event.target.value })} /></label>
              <label className="member-memo"><span>メモ</span><input value={person.memo} placeholder="連絡先やひとこと" onChange={(event) => updatePerson(person.id, { memo: event.target.value })} /></label>
              <IconButton label={`${person.name}を削除`} className="danger" disabled={settlement.people.length <= 1} onClick={() => setSettlement((current) => ({ ...current, people: current.people.filter((entry) => entry.id !== person.id), payments: current.payments.map((payment) => ({ ...payment, payerId: payment.payerId === person.id ? current.people.find((entry) => entry.id !== person.id)?.id || "" : payment.payerId, participantIds: payment.participantIds?.filter((id) => id !== person.id) })) }))}><Trash2 size={18} /></IconButton>
            </div>
          ))}
          <button className="button button-secondary add-wide" onClick={() => setSettlement((current) => ({ ...current, people: [...current.people, { id: makeId("person"), name: `参加者${current.people.length + 1}`, role: "メンバー", memo: "" }] }))}><UserPlus size={19} />メンバーを追加</button>
        </Panel>
      </section>

      <section className="section-block">
        <SectionHeading eyebrow="PHOTOS" title="写真アルバム" action={<span className="count-badge">{album.items.length}枚</span>} />
        <Panel className="album-entry">
          <div className="album-entry-icon"><Camera size={24} aria-hidden="true" /></div>
          <div><strong>撮った写真を追加</strong><p>カメラで撮るか、スマホの写真から選べます。</p></div>
          <a className="button button-primary" href="#album"><Camera size={18} />写真を追加・見る</a>
        </Panel>
      </section>

      <section className="section-block">
        <SectionHeading eyebrow="GROUP" title="グループ共有" />
        <Panel className="group-panel">
          <div className="group-current">
            <div className="group-cloud"><Cloud size={24} /></div>
            <div><span>参加中</span><strong>{activeGroup?.name || "グループ未参加"}</strong><small>{activeGroup ? `参加コード ${activeGroup.joinCode}` : "この端末だけに保存されています"}</small></div>
            {activeGroup && <IconButton label="共有データを更新" onClick={() => run(() => refreshGroup())} disabled={busy}><RefreshCw size={19} className={busy ? "spin" : ""} /></IconButton>}
          </div>
          <p className="sync-status" aria-live="polite">{message || syncStatus}</p>
          {groups.length > 0 && <label className="group-select"><span>参加中のグループ</span><select value={activeGroup?.id || ""} onChange={(event) => run(() => switchGroup(event.target.value))}>{groups.map((group) => <option value={group.id} key={group.id}>{group.name}</option>)}</select></label>}
          <button className="manage-toggle" type="button" aria-expanded={manageOpen} onClick={() => setManageOpen((open) => !open)}>グループの作成・参加<ChevronDown size={18} className={manageOpen ? "rotate" : ""} /></button>
          {manageOpen && <div className="group-manage">
            <form onSubmit={(event) => { event.preventDefault(); setHelpOpen(showHelpAfterCreate); run(() => createGroup(groupName)); }}>
              <h3>新しく作る</h3><label><span>グループ名</span><input value={groupName} maxLength={40} onChange={(event) => setGroupName(event.target.value)} /></label><label className="check-option"><input type="checkbox" checked={showHelpAfterCreate} onChange={(event) => setShowHelpAfterCreate(event.target.checked)} />使い方の説明を表示する</label><button className="button button-primary" disabled={busy}>グループを作成</button>
            </form>
            <form onSubmit={(event) => { event.preventDefault(); run(() => joinGroup(joinCode)); }}>
              <h3>コードで参加</h3><label><span>6桁の参加コード</span><input value={joinCode} inputMode="numeric" pattern="[0-9]{6}" maxLength={6} onChange={(event) => setJoinCode(event.target.value.replace(/\D/g, ""))} /></label><button className="button button-secondary" disabled={busy}>グループに参加</button>
            </form>
          </div>}
        </Panel>
      </section>

      <section className="section-block">
        <SectionHeading eyebrow="MEMO" title={`${settlement.people.length}人の共有メモ`} />
        <Panel className="notes-panel">
          <form className="add-form" onSubmit={(event) => { event.preventDefault(); const text = newNote.trim(); if (!text) return; setNotes((current) => ({ ...current, items: [...current.items, { id: makeId("note"), text }] })); setNewNote(""); }}>
            <label><span>メモを追加</span><input value={newNote} onChange={(event) => setNewNote(event.target.value)} placeholder="気をつけたいこと、待ち合わせなど" /></label>
            <button className="button button-primary" type="submit"><Plus size={19} />追加</button>
          </form>
          <div className="note-list">{notes.items.length ? notes.items.map((note) => <div className="note-row" key={note.id}><p>{note.text}</p><IconButton label="メモを削除" className="danger" onClick={() => setNotes((current) => ({ ...current, items: current.items.filter((entry) => entry.id !== note.id) }))}><Trash2 size={18} /></IconButton></div>) : <EmptyState>共有メモはまだありません。</EmptyState>}</div>
        </Panel>
      </section>
    </div>
  );
}
