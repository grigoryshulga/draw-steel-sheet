import { createContext, useContext } from "react";

export const StorageScope = createContext("local");

export function useStorageScope(): string {
  return useContext(StorageScope);
}
