export type TripSettings = {
  tripName: string;
  startDate: string;
  endDate: string;
  dateLabel: string;
  routeLabel: string;
  heroRouteLabel: string;
  outboundLabel: string;
  returnLabel: string;
  hotelName: string;
  hotelAddress: string;
  departureTime: string;
  arrivalTargetTime: string;
  mapOrigin: string;
  mapDestination: string;
  mapNote: string;
};

export type ScheduleDay = { id: string; label: string; shortLabel: string };
export type ScheduleItem = {
  id: string;
  day: string;
  time: string;
  title: string;
  memo: string;
  mapUrl: string;
  isTimeUnset: boolean;
};
export type ScheduleState = { activeDay: string; items: ScheduleItem[] };

export type CostItem = { id: string; name: string; amount: number };
export type SouvenirItem = { id?: string; name: string; qty: number; price: number };
export type AdjustState = {
  breakfast: boolean;
  hotelNoBreakfast: number;
  hotelBreakfast: number;
  customItems: CostItem[];
  souvenirs: SouvenirItem[];
};

export type Person = { id: string; name: string; role: string; memo: string };
export type Payment = { id: string; title: string; payerId: string; amount: number };
export type SettlementState = { people: Person[]; payments: Payment[] };
export type ChecklistItem = { id: string; label: string; checked: boolean; removable: boolean };
export type ChecklistState = { items: ChecklistItem[] };
export type NoteItem = { id: string; text: string };
export type NotesState = { items: NoteItem[] };

export type SharedState = {
  tripSettings: TripSettings;
  schedule: ScheduleState;
  adjust: AdjustState;
  settlement: SettlementState;
  checklist: ChecklistState;
  notes: NotesState;
  spots: unknown[];
};

export type Group = {
  id: string;
  name: string;
  joinCode: string;
  editToken: string;
  updatedAt?: string;
  state?: Partial<SharedState>;
};

export type PageKey = "home" | "plan" | "money" | "packing" | "share";
