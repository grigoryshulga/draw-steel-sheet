export interface OfflineAccount {
  id: string;
  email: string;
}
const KEY = `draw-steel:offline-account:v1:${import.meta.env.VITE_SUPABASE_URL ?? "local"}`;

/** A local cache selector, never a credential. Remote operations still require Auth. */
export function readOfflineAccount(
  online: boolean,
  storage?: Pick<Storage, "getItem">,
): OfflineAccount | null {
  if (online) return null;
  try {
    const value: unknown = JSON.parse(
      (storage ?? localStorage).getItem(KEY) ?? "null",
    );
    if (
      !value ||
      typeof value !== "object" ||
      !("id" in value) ||
      !("email" in value)
    )
      return null;
    return typeof value.id === "string" &&
      /^[0-9a-f-]{36}$/i.test(value.id) &&
      typeof value.email === "string"
      ? { id: value.id, email: value.email }
      : null;
  } catch {
    return null;
  }
}

export function rememberOfflineAccount(
  account: OfflineAccount | null,
  storage?: Pick<Storage, "setItem" | "removeItem">,
) {
  try {
    if (account)
      (storage ?? localStorage).setItem(KEY, JSON.stringify(account));
    else (storage ?? localStorage).removeItem(KEY);
  } catch {
    /* The persistence panel separately reports unavailable local storage. */
  }
}
