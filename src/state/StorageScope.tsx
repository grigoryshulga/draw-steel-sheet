import { createContext, useContext } from "react";

export const StorageScope = createContext("local");

export function useStorageScope(): string {
  return useContext(StorageScope);
}

export interface AccountControls {
  email: string;
  signingOut: boolean;
  signOut: () => void;
}

/** Выход из аккаунта; null, когда вход не используется (локальный режим). */
export const AccountContext = createContext<AccountControls | null>(null);

export function useAccount(): AccountControls | null {
  return useContext(AccountContext);
}
