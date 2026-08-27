"use client";

import { useEffect } from "react";

export function VisitBeacon() {
  useEffect(() => {
    fetch("/api/public/visit", { method: "POST", credentials: "same-origin" }).catch(() => {});
  }, []);
  return null;
}
