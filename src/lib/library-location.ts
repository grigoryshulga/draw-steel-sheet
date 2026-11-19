import { createContext, useContext, useEffect, useState } from "react";

export const LibraryLocationContext = createContext<string | null>(null);

export function useLibraryLocation() {
  const localHash = useContext(LibraryLocationContext);
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    if (localHash !== null) return;
    const change = () => setHash(window.location.hash);
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, [localHash]);
  return (localHash ?? hash).split("/").map((part) => {
    try {
      return decodeURIComponent(part);
    } catch {
      return "";
    }
  });
}
