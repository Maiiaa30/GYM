"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "gym:keep-awake";

type WakeLockSentinelLike = {
  released: boolean;
  release: () => Promise<void>;
  addEventListener: (type: "release", listener: () => void) => void;
};

type WakeLockCapableNavigator = Navigator & {
  wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> };
};

function storedPreference(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

/**
 * Keeps the screen on while a session is running.
 *
 * Without this a phone locks between sets and every set starts with unlocking
 * it and finding your place again. The lock is released as soon as the session
 * ends or the component unmounts, and is re-acquired when the tab comes back
 * to the foreground, because the browser drops it whenever the page is hidden.
 *
 * The preference is per device, so leaving it off on one phone does not change
 * the other.
 */
export function useWakeLock(active: boolean) {
  const [enabled, setEnabled] = useState(true);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setEnabled(storedPreference());
    setSupported(
      typeof navigator !== "undefined" &&
        "wakeLock" in (navigator as WakeLockCapableNavigator),
    );
  }, []);

  const toggle = useCallback((next: boolean) => {
    setEnabled(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? "on" : "off");
    } catch {
      // A device that refuses storage still gets the choice for this session.
    }
  }, []);

  useEffect(() => {
    if (!active || !enabled) return;

    const capable = navigator as WakeLockCapableNavigator;
    if (!capable.wakeLock) return;

    let sentinel: WakeLockSentinelLike | null = null;
    let cancelled = false;

    const acquire = async () => {
      try {
        const lock = await capable.wakeLock!.request("screen");
        if (cancelled) {
          void lock.release();
          return;
        }
        sentinel = lock;
      } catch {
        // Denied, low battery, or unsupported: the session continues regardless.
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") void acquire();
    };

    void acquire();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      if (sentinel && !sentinel.released) void sentinel.release();
    };
  }, [active, enabled]);

  return { enabled, supported, toggle };
}
