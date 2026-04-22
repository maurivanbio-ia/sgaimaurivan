import { useState, useEffect } from "react";

// Module-level state: shared across all components in the session
let _unlocked = false;
const _listeners = new Set<() => void>();

function notifyAll() {
  _listeners.forEach((fn) => fn());
}

export const CONTRACT_PASSWORD = "Bor192023";

export function unlockContractValues(password: string): boolean {
  if (password === CONTRACT_PASSWORD) {
    _unlocked = true;
    notifyAll();
    return true;
  }
  return false;
}

export function useContractUnlock() {
  const [unlocked, setUnlocked] = useState(_unlocked);

  useEffect(() => {
    const listener = () => { setUnlocked(true); };
    _listeners.add(listener);
    return () => {
      _listeners.delete(listener);
    };
  }, []);

  return { unlocked };
}
