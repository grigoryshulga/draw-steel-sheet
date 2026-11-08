import { expect, it } from "vitest";
import {
  readOfflineAccount,
  rememberOfflineAccount,
} from "../src/lib/offline-account";

it("opens only the last authenticated local scope while offline and clears it on sign-out", () => {
  const values = new Map<string, string>();
  const store = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
  const account = {
    id: "00000000-0000-0000-0000-000000000001",
    email: "local@example.test",
  };
  rememberOfflineAccount(account, store);
  expect(readOfflineAccount(true, store)).toBeNull();
  expect(readOfflineAccount(false, store)).toEqual(account);
  rememberOfflineAccount(null, store);
  expect(readOfflineAccount(false, store)).toBeNull();
});

it("does not fail the auth screen when browser storage is corrupt or unavailable", () => {
  expect(readOfflineAccount(false, { getItem: () => "{broken" })).toBeNull();
  expect(
    readOfflineAccount(false, {
      getItem: () => {
        throw new Error("denied");
      },
    }),
  ).toBeNull();
});
