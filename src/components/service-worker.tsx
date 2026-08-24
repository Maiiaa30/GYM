"use client";

import { useEffect } from "react";

/**
 * Registers the service worker. Renders nothing; failure is silent because a
 * browser without one simply gets the ordinary online application.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    const register = () => {
      void navigator.serviceWorker.register("/sw.js").catch(() => {
        // Private windows and unsupported browsers land here.
      });
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  return null;
}
