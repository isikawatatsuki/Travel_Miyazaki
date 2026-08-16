export type TripSettings = {
  tripName: string;
  startDate: string;
  endDate: string;
  dateLabel: string;
  routeLabel: string;
  /** ホームの搭乗券風表示に出す短いコード。空なら表示しない。 */
  originCode: string;
  destinationCode: string;
  outboundLabel: string;
  returnLabel: string;
  hotelName: string;
  hotelAddress: string;
  departureTime: string;
  arrivalTargetTime: string;
  /** 場所はGoogleマップのURLで持つ。地名と座標をここから同時に決めるので食い違わない。 */
  mapOriginUrl: string;
  mapDestinationUrl: string;
  /** URLに地名が含まれない形式のときだけ使う表示名。 */
  mapOrigin: string;
  mapDestination: string;
  mapOriginLat: number;
  mapOriginLng: number;
  mapDestinationLat: number;
  mapDestinationLng: number;
  mapNote: string;
};

export type ScheduleDay = { id: string; label: string; shortLabel: string };
export type MapLocation = { longitude: number; latitude: number };
export type ScheduleItem = {
  id: string;
  day: string;
  time: string;
  title: string;
  memo: string;
  mapUrl: string;
  /** 予定名とは別に表示する、地図上の場所の呼び名。 */
  locationName?: string;
  isTimeUnset: boolean;
  /** 未設定は経路に含める。既存データに欠けていても既定でONになるよう任意にしている。 */
  inRoute?: boolean;
  lat?: number;
  lng?: number;
  /** 宿。日ごとに1つまでで、新しい日は前日の宿を初期値として引き継ぐ。 */
  isStay?: boolean;
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
};

export type TravelProfile = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  archived: boolean;
  state: SharedState;
};

export type TicketStatus = "planning" | "traveling" | "done" | "archived";

/**
 * 画面上の「トラベルチケット」。TravelProfile を拡張したもので、
 * 共有グループは任意の紐付け（groupId）として持つ。グループ未作成でも
 * チケットとして成立するため、端末内だけの旅行が一覧から消えない。
 */
export type Ticket = TravelProfile & {
  themeColor: string;
  /** 手動で「完了」にした時刻。未設定なら日付から自動判定する。 */
  completedAt?: string;
  groupId?: string;
  joinCode?: string;
  readToken?: string;
  editToken?: string;
};

export type SavePhase = "saving" | "saved" | "syncing" | "synced" | "error";

export type Group = {
  id: string;
  name: string;
  joinCode: string;
  readToken?: string;
  editToken?: string;
  updatedAt?: string;
  state?: Partial<SharedState>;
};

export type AccountUser = { id: string; displayName: string; email: string };
export type AccountGroup = Group & { role: "owner" | "editor" | "viewer" };

export type PageKey = "tickets" | "map" | "home" | "plan" | "money" | "packing" | "share" | "details" | "album";
