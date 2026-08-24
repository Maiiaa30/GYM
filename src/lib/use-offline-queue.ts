"use client";

import { useCallback, useEffect, useState } from "react";
import {
  enqueue,
  flushQueue,
  readQueue,
  type PendingSet,
  type Sender,
} from "@/lib/offline-queue";

/**
 * Keeps the pending count in view and drains the queue whenever there is a
 * plausible chance of it working: on mount, when the connection returns, and
 * when the tab comes back to the foreground after a phone unlocks.
 */
export function useOfflineQueue(send: Sender) {
  const [pending, setPending] = useState(0);
  const [online, setOnline] = useState(true);

  const flush = useCallback(async () => {
    const left = await flushQueue(send);
    setPending(left);
    return left;
  }, [send]);

  useEffect(() => {
    setOnline(navigator.onLine);
    void readQueue().then((entries) => setPending(entries.length));
    void flush();

    const onOnline = () => {
      setOnline(true);
      void flush();
    };
    const onOffline = () => setOnline(false);
    const onVisible = () => {
      if (document.visibilityState === "visible") void flush();
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [flush]);

  /** Records a set: to the queue first, then straight out if there is a line. */
  const record = useCallback(
    async (entry: Omit<PendingSet, "queuedAt">) => {
      const queued: PendingSet = { ...entry, queuedAt: Date.now() };
      await enqueue(queued);
      setPending((count) => count + 1);
      const left = await flush();
      setPending(left);
    },
    [flush],
  );

  return { pending, online, record, flush };
}
