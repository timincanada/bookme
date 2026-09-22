import { createContext, useContext } from "react";
import type { MyCoach } from "./api";

export type CoachContextValue = { coach: MyCoach | null; reload: () => void };

export const CoachContext = createContext<CoachContextValue>({
  coach: null,
  reload: () => {},
});

export function useCoach() {
  return useContext(CoachContext);
}
