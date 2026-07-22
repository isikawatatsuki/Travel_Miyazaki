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
  mapOriginLat: number;
  mapOriginLng: number;
  mapDestinationLat: number;
  mapDestinationLng: number;
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
  transportCost: number;
  accessCost: number;
  breakfast: boolean;
  hotelNoBreakfast: number;
  hotelBreakfast: number;
  customItems: CostItem[];
  souvenirs: SouvenirItem[];
};

export type Person = { id: string; name: string; role: string; memo: string };
export type Payment = { id: string; title: string; payerId: string; amount: number; participantIds?: string[] };
export type SettlementState = { people: Person[]; payments: Payment[] };
export type ChecklistItem = { id: string; label: string; checked: boolean; removable: boolean };
export type ChecklistState = { items: ChecklistItem[] };
export type NoteItem = { id: string; text: string };
export type NotesState = { items: NoteItem[] };

export type ReservationType = "transport" | "stay" | "activity" | "other";
export type Reservation = {
  id: string;
  type: ReservationType;
  title: string;
  reference: string;
  date: string;
  time: string;
  deadline: string;
  memo: string;
  attachmentName: string;
  attachmentData: string;
};
export type ReservationsState = { items: Reservation[] };

export type AlbumPhoto = {
  id: string;
  dataUrl: string;
  caption: string;
  date: string;
  place: string;
  createdAt: string;
};
export type AlbumState = { items: AlbumPhoto[] };

export type HistoryItem = { id: string; text: string; createdAt: string; source: string };
export type HistoryState = { items: HistoryItem[] };

export type SharedState = {
  tripSettings: TripSettings;
  schedule: ScheduleState;
  adjust: AdjustState;
  settlement: SettlementState;
  checklist: ChecklistState;
  notes: NotesState;
  reservations: ReservationsState;
  album: AlbumState;
  history: HistoryState;
  spots: unknown[];
};

export type TravelProfile = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  archived: boolean;
  state: SharedState;
};

export type SavePhase = "saving" | "saved" | "syncing" | "synced" | "error";

export type Group = {
  id: string;
  name: string;
  joinCode: string;
  editToken: string;
  updatedAt?: string;
  state?: Partial<SharedState>;
};

export type PageKey = "home" | "plan" | "money" | "packing" | "share" | "details";
