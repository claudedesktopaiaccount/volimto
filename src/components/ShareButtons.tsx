"use client";

import { useState } from "react";

interface ShareButtonsProps {
  url: string;
  title: string;
  description?: string;
}

export default function ShareButtons({ url, title, description }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);
  const [canNativeShare] = useState(() =>
    typeof navigator !== "undefined" && "share" in navigator
  );

  const encoded = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);

  const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encoded}`;
  const twitterUrl = `https://twitter.com/intent/tweet?url=${encoded}&text=${encodedTitle}`;
  const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encoded}`;

  function openShare(href: string) {
    window.open(href, "_blank", "noopener,noreferrer,width=600,height=400");
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: select text
    }
  }

  async function nativeShare() {
    try {
      await navigator.share({ title, text: description ?? title, url });
    } catch {
      // user cancelled or not supported
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 mt-6 pt-4 border-t border-divider">
      <span className="text-xs font-medium uppercase tracking-widest text-text/40 mr-1">
        Zdieľať
      </span>

      {/* Facebook */}
      <button
        onClick={() => openShare(fbUrl)}
        aria-label="Zdieľať na Facebooku"
        className="flex items-center gap-1.5 px-3 py-1.5 border border-divider text-ink text-xs font-medium hover:bg-hover transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.235 2.686.235v2.97H15.83c-1.491 0-1.956.93-1.956 1.886v2.268h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/>
        </svg>
        Facebook
      </button>

      {/* X / Twitter */}
      <button
        onClick={() => openShare(twitterUrl)}
        aria-label="Zdieľať na X (Twitter)"
        className="flex items-center gap-1.5 px-3 py-1.5 border border-divider text-ink text-xs font-medium hover:bg-hover transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
        </svg>
        X
      </button>

      {/* LinkedIn */}
      <button
        onClick={() => openShare(linkedinUrl)}
        aria-label="Zdieľať na LinkedIn"
        className="flex items-center gap-1.5 px-3 py-1.5 border border-divider text-ink text-xs font-medium hover:bg-hover transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
        </svg>
        LinkedIn
      </button>

      {/* Copy link */}
      <button
        onClick={copyLink}
        aria-label="Kopírovať odkaz"
        className="flex items-center gap-1.5 px-3 py-1.5 border border-divider text-ink text-xs font-medium hover:bg-hover transition-colors"
      >
        {copied ? (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Skopírované!
          </>
        ) : (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
            </svg>
            Kopírovať odkaz
          </>
        )}
      </button>

      {/* Native share — only show if Web Share API supported */}
      {canNativeShare && (
        <button
          onClick={nativeShare}
          aria-label="Zdieľať"
          className="flex items-center gap-1.5 px-3 py-1.5 border border-divider text-ink text-xs font-medium hover:bg-hover transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
          </svg>
          Zdieľať
        </button>
      )}
    </div>
  );
}
