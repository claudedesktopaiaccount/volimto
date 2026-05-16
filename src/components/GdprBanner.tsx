"use client";

import { useState } from "react";
import Link from "next/link";
import { getConsentStatus, setConsent } from "@/lib/consent";

export default function GdprBanner() {
  const [visible, setVisible] = useState(() =>
    typeof window !== "undefined" && getConsentStatus() === null
  );

  if (!visible) return null;

  function handleAccept() {
    setConsent("accepted");
    setVisible(false);
  }

  function handleReject() {
    setConsent("rejected");
    setVisible(false);
  }

  return (
    <div
      role="dialog"
      aria-label="Súhlas s cookies"
      className="fixed bottom-0 left-0 right-0 z-[500] bg-card border-t border-border"
      style={{ boxShadow: "0 -4px 20px rgba(0,0,0,0.08)" }}
    >
      <div className="max-w-content mx-auto px-6 py-4 flex flex-col sm:flex-row items-center gap-4">
        {/* Avatar circle */}
        <div className="shrink-0 w-9 h-9 rounded-full bg-subtle flex items-center justify-center text-[16px]">
          🍪
        </div>
        <p className="text-[13px] text-secondary flex-1 leading-relaxed">
          Táto stránka používa cookies a fingerprinting na zabránenie duplicitným hlasom v sekcii Tipovanie.
          Viac informácií nájdete na stránke{" "}
          <Link href="/sukromie" className="text-accent underline underline-offset-2">
            Ochrana súkromia
          </Link>
          {" "}alebo{" "}
          <Link href="/cookies" className="text-accent underline underline-offset-2">
            Zásady cookies
          </Link>.
        </p>
        <div className="flex gap-3 shrink-0">
          <button
            onClick={handleReject}
            className="px-4 py-2 text-[13px] font-medium text-secondary border border-border-strong rounded-md hover:bg-subtle transition-colors"
          >
            Odmietnuť
          </button>
          <button
            onClick={handleAccept}
            className="px-4 py-2 text-[13px] font-medium text-white bg-ink rounded-md hover:opacity-90 transition-opacity"
          >
            Prijať
          </button>
        </div>
      </div>
    </div>
  );
}
