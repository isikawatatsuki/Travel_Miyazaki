import { createContext, useContext, type PropsWithChildren } from "react";
import { useTripState } from "./useTripState";

type TripStore = ReturnType<typeof useTripState>;
const TripContext = createContext<TripStore | null>(null);

export function TripProvider({ children }: PropsWithChildren) {
  const store = useTripState();
  return <TripContext.Provider value={store}>{children}</TripContext.Provider>;
}

export function useTrip() {
  const value = useContext(TripContext);
  if (!value) throw new Error("useTrip must be used within TripProvider");
  return value;
}
