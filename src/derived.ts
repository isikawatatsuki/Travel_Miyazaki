import { baseCost } from "./data";
import type { AdjustState, Person, SettlementState } from "./types";

const amount = (value: unknown) => Math.max(0, Number(value || 0));

export type BudgetSummary = {
  hotel: number;
  souvenirs: number;
  custom: number;
  perPerson: number;
  tripTotal: number;
  peopleCount: number;
};

export function getBudgetSummary(adjust: AdjustState, peopleCount: number): BudgetSummary {
  const count = Math.max(1, peopleCount);
  const hotel = adjust.breakfast ? amount(adjust.hotelBreakfast) : amount(adjust.hotelNoBreakfast);
  const souvenirs = adjust.souvenirs.reduce((sum, item) => sum + amount(item.qty) * amount(item.price), 0);
  const custom = adjust.customItems.reduce((sum, item) => sum + amount(item.amount), 0);
  const perPerson = baseCost.flight + baseCost.access + hotel + souvenirs + custom;

  return { hotel, souvenirs, custom, perPerson, tripTotal: perPerson * count, peopleCount: count };
}

export type Balance = Person & { paid: number; share: number; balance: number };
export type Transfer = { from: string; to: string; amount: number };
export type SettlementSummary = {
  paidTotal: number;
  baseShare: number;
  remainder: number;
  balances: Balance[];
  transfers: Transfer[];
};

export function getSettlementSummary(settlement: SettlementState): SettlementSummary {
  const peopleCount = Math.max(1, settlement.people.length);
  const paidTotal = settlement.payments.reduce((sum, payment) => sum + amount(payment.amount), 0);
  const baseShare = Math.floor(paidTotal / peopleCount);
  const remainder = paidTotal % peopleCount;
  const balances = settlement.people.map((person, index) => ({
    ...person,
    paid: settlement.payments
      .filter((payment) => payment.payerId === person.id)
      .reduce((sum, payment) => sum + amount(payment.amount), 0),
    share: baseShare + (index < remainder ? 1 : 0),
  })).map((person) => ({ ...person, balance: person.paid - person.share }));

  const debtors = balances.filter((person) => person.balance < 0).map((person) => ({ ...person, left: -person.balance }));
  const creditors = balances.filter((person) => person.balance > 0).map((person) => ({ ...person, left: person.balance }));
  const transfers: Transfer[] = [];
  let debtorIndex = 0;
  let creditorIndex = 0;

  while (debtors[debtorIndex] && creditors[creditorIndex]) {
    const transfer = Math.min(debtors[debtorIndex].left, creditors[creditorIndex].left);
    if (transfer) transfers.push({ from: debtors[debtorIndex].name, to: creditors[creditorIndex].name, amount: transfer });
    debtors[debtorIndex].left -= transfer;
    creditors[creditorIndex].left -= transfer;
    if (!debtors[debtorIndex].left) debtorIndex += 1;
    if (!creditors[creditorIndex].left) creditorIndex += 1;
  }

  return { paidTotal, baseShare, remainder, balances, transfers };
}
