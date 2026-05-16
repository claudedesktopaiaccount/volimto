"use client";

import { useState } from "react";
import { getConsentStatus, setConsent, type ConsentStatus } from "@/lib/consent";

export default function ConsentManager() {
  const [status, setStatus] = useState<ConsentStatus>(() =>
    typeof window === "undefined" ? null : getConsentStatus()
  );

  function handleChange(newStatus: "accepted" | "rejected") {
    setConsent(newStatus);
    setStatus(newStatus);
  }

  return (
    <div className="border border-divider bg-surface p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-ink">Fingerprinting súhlas</span>
        <span
          className={`text-xs font-bold uppercase tracking-wider px-2 py-1 ${
            status === "accepted"
              ? "text-ink bg-hover"
              : status === "rejected"
                ? "text-danger bg-hover"
                : "text-text/40 bg-hover"
          }`}
        >
          {status === "accepted" ? "Povolený" : status === "rejected" ? "Odmietnutý" : "Nerozhodnuté"}
        </span>
      </div>
      <p className="text-sm text-text">
        Fingerprinting sa používa výhradne na zabránenie duplicitným hlasom v sekcii Tipovanie.
      </p>
      <div className="flex gap-3">
        {status !== "rejected" && (
          <button
            onClick={() => handleChange("rejected")}
            className="px-4 py-2 text-sm font-medium text-text border border-divider hover:bg-hover transition-colors"
          >
            Odmietnuť
          </button>
        )}
        {status !== "accepted" && (
          <button
            onClick={() => handleChange("accepted")}
            className="px-4 py-2 text-sm font-semibold bg-ink text-paper border border-ink hover:bg-transparent hover:text-ink transition-colors"
          >
            Povoliť
          </button>
        )}
      </div>
    </div>
  );
}
