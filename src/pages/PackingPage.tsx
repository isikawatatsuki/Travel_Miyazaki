import { CheckCheck, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTrip } from "../TripContext";
import { makeId } from "../lib";
import { EmptyState, IconButton, Panel, SectionHeading } from "../components/ui";

export function PackingPage() {
  const { checklist, setChecklist } = useTrip();
  const [newItem, setNewItem] = useState("");
  const done = checklist.items.filter((item) => item.checked).length;
  const progress = checklist.items.length ? Math.round((done / checklist.items.length) * 100) : 0;

  const addItem = () => {
    const label = newItem.trim();
    if (!label) return;
    setChecklist((current) => ({ ...current, items: [...current.items, { id: makeId("check"), label, checked: false, removable: true }] }));
    setNewItem("");
  };

  return (
    <div className="page">
      <SectionHeading eyebrow="PACKING" title="持っていくもの" description="チェックも追加・削除も、グループで同じ状態になります。" />
      <Panel className="progress-panel">
        <div><CheckCheck size={24} /><span>準備できたもの</span><strong>{done} / {checklist.items.length}</strong></div>
        <div className="progress-track" aria-label={`準備 ${progress}%`}><i style={{ width: `${progress}%` }} /></div>
      </Panel>
      <Panel className="checklist-panel">
        <form className="add-form" onSubmit={(event) => { event.preventDefault(); addItem(); }}>
          <label><span>持ち物を追加</span><input value={newItem} onChange={(event) => setNewItem(event.target.value)} placeholder="例：イヤホン" /></label>
          <button className="button button-primary" type="submit"><Plus size={19} />追加</button>
        </form>
        <div className="check-list">
          {checklist.items.length ? checklist.items.map((item) => (
            <div className={`check-row ${item.checked ? "is-checked" : ""}`} key={item.id}>
              <label><input type="checkbox" checked={item.checked} onChange={(event) => setChecklist((current) => ({ ...current, items: current.items.map((entry) => entry.id === item.id ? { ...entry, checked: event.target.checked } : entry) }))} /><span>{item.label}</span></label>
              <IconButton label={`${item.label}を削除`} className="danger" onClick={() => setChecklist((current) => ({ ...current, items: current.items.filter((entry) => entry.id !== item.id) }))}><Trash2 size={18} /></IconButton>
            </div>
          )) : <EmptyState>持ち物はまだありません。</EmptyState>}
        </div>
      </Panel>
    </div>
  );
}
