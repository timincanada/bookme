import { createContext, useContext } from "react";

export type StudentContextValue = { email: string; signedOut: () => void };

export const StudentContext = createContext<StudentContextValue>({ email: "", signedOut: () => {} });

export function useStudent() {
  return useContext(StudentContext);
}
