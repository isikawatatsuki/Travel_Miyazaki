import { Plus, ReceiptText, Trash2, UsersRound } from "lucide-react";
import { useTrip } from "../TripContext";
import { baseCost } from "../data";
import { getBudgetSummary, getSettlementSummary } from "../derived";
import { makeId, yen } from "../lib";
import type { Payment } from "../types";
import { EmptyState, IconButton, Panel, SectionHeading } from "../components/ui";

const amount = (value: unknown) => Math.max(0, Number(value || 0));

export function MoneyPage() {
  const { adjust, setAdjust, settlement, setSettlement } = useTrip();
  const budget = getBudgetSummary(adjust, settlement.people.length);
  const settlementSummary = getSettlementSummary(settlement);
  const { hotel, souvenirs, perPerson, tripTotal, peopleCount } = budget;
  const { paidTotal, baseShare, remainder, transfers } = settlementSummary;

  const updatePayment = (id: string, patch: Partial<Payment>) => setSettlement((current) => ({
    ...current,
    payments: current.payments.map((item) => item.id === id ? { ...item, ...patch } : item),
  }));
  const addPayment = () => setSettlement((current) => ({
    ...current,
    payments: [...current.payments, { id: makeId("payment"), title: "", payerId: current.people[0]?.id || "", amount: 0, participantIds: current.people.map((person) => person.id) }],
  }));

  return (
    <div className="page">
      <SectionHeading eyebrow="BUDGET" title="旅のお金" description="予算と実際の支払いを分けて確認できます。" />
      <section className="money-summary" aria-label="旅費の目安">
        <Panel className="total-card"><span>1人あたり</span><strong>{yen.format(perPerson)}</strong><small>設定した項目の合計</small></Panel>
        <Panel className="total-card muted"><span>{peopleCount}人の合計</span><strong>{yen.format(tripTotal)}</strong><small>目安として表示</small></Panel>
      </section>

      <section className="section-block">
        <SectionHeading eyebrow="ADJUST" title="予算を調整" />
        <Panel className="budget-panel">
          <div className="cost-list">
            <div><span>Peach 往復</span><strong>{yen.format(baseCost.flight)}</strong></div>
            <div><span>市岡元町〜関空 往復</span><strong>{yen.format(baseCost.access)}</strong></div>
            <div><span>ホテル</span><strong>{yen.format(hotel)}</strong></div>
            <div><span>お土産</span><strong>{yen.format(souvenirs)}</strong></div>
            {adjust.customItems.map((item) => <div key={item.id}><span>{item.name || "追加項目"}</span><strong>{yen.format(amount(item.amount))}</strong></div>)}
          </div>
          <label className="switch-row"><span><strong>朝食をつける</strong><small>ホテル料金を切り替えます</small></span><input type="checkbox" role="switch" checked={adjust.breakfast} onChange={(event) => setAdjust((current) => ({ ...current, breakfast: event.target.checked }))} /></label>
          <div className="field-grid two">
            <label><span>朝食なし</span><input type="number" inputMode="numeric" min="0" value={adjust.hotelNoBreakfast} onChange={(event) => setAdjust((current) => ({ ...current, hotelNoBreakfast: amount(event.target.value) }))} /></label>
            <label><span>朝食あり</span><input type="number" inputMode="numeric" min="0" value={adjust.hotelBreakfast} onChange={(event) => setAdjust((current) => ({ ...current, hotelBreakfast: amount(event.target.value) }))} /></label>
          </div>

          <div className="subsection-head"><h3>追加項目</h3><button className="button button-secondary small" onClick={() => setAdjust((current) => ({ ...current, customItems: [...current.customItems, { id: makeId("cost"), name: "", amount: 0 }] }))}><Plus size={17} />追加</button></div>
          {adjust.customItems.length ? adjust.customItems.map((item) => (
            <div className="editable-row" key={item.id}>
              <label><span>項目名</span><input value={item.name} placeholder="例：バス代" onChange={(event) => setAdjust((current) => ({ ...current, customItems: current.customItems.map((entry) => entry.id === item.id ? { ...entry, name: event.target.value } : entry) }))} /></label>
              <label><span>金額</span><input type="number" inputMode="numeric" min="0" value={item.amount} onChange={(event) => setAdjust((current) => ({ ...current, customItems: current.customItems.map((entry) => entry.id === item.id ? { ...entry, amount: amount(event.target.value) } : entry) }))} /></label>
              <IconButton label="追加項目を削除" className="danger" onClick={() => setAdjust((current) => ({ ...current, customItems: current.customItems.filter((entry) => entry.id !== item.id) }))}><Trash2 size={18} /></IconButton>
            </div>
          )) : <EmptyState>追加項目はまだありません。</EmptyState>}

          <div className="subsection-head"><h3>お土産</h3><button className="button button-secondary small" onClick={() => setAdjust((current) => ({ ...current, souvenirs: [...current.souvenirs, { id: makeId("souvenir"), name: "", qty: 1, price: 0 }] }))}><Plus size={17} />追加</button></div>
          {adjust.souvenirs.length ? adjust.souvenirs.map((item, index) => (
            <div className="editable-row souvenir" key={item.id || index}>
              <label><span>名前</span><input value={item.name} placeholder="お土産" onChange={(event) => setAdjust((current) => ({ ...current, souvenirs: current.souvenirs.map((entry, target) => target === index ? { ...entry, name: event.target.value } : entry) }))} /></label>
              <label><span>個数</span><input type="number" inputMode="numeric" min="0" value={item.qty} onChange={(event) => setAdjust((current) => ({ ...current, souvenirs: current.souvenirs.map((entry, target) => target === index ? { ...entry, qty: amount(event.target.value) } : entry) }))} /></label>
              <label><span>単価</span><input type="number" inputMode="numeric" min="0" value={item.price} onChange={(event) => setAdjust((current) => ({ ...current, souvenirs: current.souvenirs.map((entry, target) => target === index ? { ...entry, price: amount(event.target.value) } : entry) }))} /></label>
              <IconButton label="お土産を削除" className="danger" onClick={() => setAdjust((current) => ({ ...current, souvenirs: current.souvenirs.filter((_, target) => target !== index) }))}><Trash2 size={18} /></IconButton>
            </div>
          )) : <EmptyState>お土産はまだありません。</EmptyState>}
        </Panel>
      </section>

      <section className="section-block">
        <SectionHeading eyebrow="PAYMENTS" title="立替・割り勘メモ" description="支払いごとに、払った人と割り勘するメンバーを選べます。" />
        <Panel className="payment-panel">
          <div className="settlement-metrics"><div><ReceiptText /><span>支払い合計</span><strong>{yen.format(paidTotal)}</strong></div><div><UsersRound /><span>1人あたり</span><strong>{yen.format(baseShare)}{remainder ? `〜${yen.format(baseShare + 1)}` : ""}</strong></div></div>
          <div className="subsection-head"><h3>支払いメモ</h3><button className="button button-secondary small" onClick={addPayment}><Plus size={17} />追加</button></div>
          {settlement.payments.length ? settlement.payments.map((payment) => (
            <div className="payment-row" key={payment.id}>
              <label><span>内容</span><input value={payment.title} placeholder="例：夕食" onChange={(event) => updatePayment(payment.id, { title: event.target.value })} /></label>
              <label><span>払った人</span><select value={payment.payerId} onChange={(event) => updatePayment(payment.id, { payerId: event.target.value })}>{settlement.people.map((person) => <option value={person.id} key={person.id}>{person.name}</option>)}</select></label>
              <label><span>金額</span><input type="number" inputMode="numeric" min="0" value={payment.amount} onChange={(event) => updatePayment(payment.id, { amount: amount(event.target.value) })} /></label>
              <fieldset className="payment-participants"><legend>割り勘する人</legend><div>{settlement.people.map((person) => {
                const selected = payment.participantIds?.length ? payment.participantIds : settlement.people.map((member) => member.id);
                return <label key={person.id}><input type="checkbox" checked={selected.includes(person.id)} onChange={(event) => {
                  const next = event.target.checked ? [...selected, person.id] : selected.filter((id) => id !== person.id);
                  updatePayment(payment.id, { participantIds: next.length ? next : [person.id] });
                }} />{person.name}</label>;
              })}</div></fieldset>
              <IconButton label="支払いを削除" className="danger" onClick={() => setSettlement((current) => ({ ...current, payments: current.payments.filter((entry) => entry.id !== payment.id) }))}><Trash2 size={18} /></IconButton>
            </div>
          )) : <EmptyState>支払いを追加すると精算結果が出ます。</EmptyState>}

          <div className="subsection-head"><h3>精算結果</h3></div>
          {transfers.length ? <div className="transfer-list">{transfers.map((transfer, index) => <div key={`${transfer.from}-${transfer.to}-${index}`}><strong>{transfer.from}</strong><span>から</span><strong>{transfer.to}</strong><em>{yen.format(transfer.amount)}</em></div>)}</div> : <EmptyState>{paidTotal ? "今のところ精算は不要です。" : "支払いを入力すると表示されます。"}</EmptyState>}
        </Panel>
      </section>
    </div>
  );
}
