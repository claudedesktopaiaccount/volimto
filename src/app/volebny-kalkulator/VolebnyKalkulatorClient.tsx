"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import SectionHeading from "@/components/ui/SectionHeading";
import { PARTIES, PARTY_LIST } from "@/lib/parties";
import { QUESTIONS } from "@/lib/kalkulator/questions";
import type { Question } from "@/lib/kalkulator/questions";

interface Props {
  questions?: Question[];
}

export default function VolebnyKalkulatorClient({ questions: questionsProp }: Props) {
  const questions = questionsProp ?? QUESTIONS;
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [showResults, setShowResults] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);

  const partyIds = PARTY_LIST.map((p) => p.id);

  useEffect(() => {
    if (showResults) {
      document.cookie = "volimto_engaged=1; path=/; max-age=31536000; SameSite=Lax";
    }
  }, [showResults]);

  function selectAnswer(answerIdx: number) {
    setSelectedAnswer(answerIdx);
    setTimeout(() => {
      setAnswers((prev) => ({ ...prev, [currentQ]: answerIdx }));
      if (currentQ < questions.length - 1) {
        setCurrentQ(currentQ + 1);
      } else {
        setShowResults(true);
      }
      setSelectedAnswer(null);
    }, 300);
  }

  function calculateResults() {
    const userVector: number[] = partyIds.map((partyId) => {
      let total = 0;
      for (const [qIdx, aIdx] of Object.entries(answers)) {
        const q = questions[Number(qIdx)];
        const answer = q.answers[aIdx];
        total += answer.weights[partyId] ?? 0;
      }
      return total;
    });

    return partyIds.map((partyId, i) => {
      const score = userVector[i];
      const maxPossible = questions.length * 2;
      const percentage = Math.max(0, Math.min(100, ((score + maxPossible) / (2 * maxPossible)) * 100));
      return {
        partyId,
        party: PARTIES[partyId],
        score: Math.round(percentage),
      };
    }).sort((a, b) => b.score - a.score);
  }

  if (showResults) {
    const results = calculateResults();
    const top = results[0];

    return (
      <div className="max-w-[680px] mx-auto px-6 py-8">
        <SectionHeading title="Váš výsledok" subtitle="Na základe vašich odpovedí vám najviac vyhovuje:" />

        {/* Top match */}
        <div className="bg-page rounded-[12px] p-6 flex items-center gap-5 mb-6">
          <div
            className="w-14 h-14 rounded-[12px] shrink-0"
            style={{ background: top.party?.color ?? "#1a6eb5" }}
          />
          <div>
            <h2 className="text-[24px] font-extrabold text-ink">{top.party?.name}</h2>
            <p className="text-[15px] text-muted">{top.score}% zhoda</p>
          </div>
        </div>

        {/* Share button */}
        <div className="flex justify-center mb-6">
          <button
            onClick={() => {
              const shareText = `Môj výsledok volebnej kalkulačky: ${top.score}% zhoda s ${top.party?.name ?? ""} — volimto.sk`;
              if (typeof navigator !== "undefined" && navigator.share) {
                navigator.share({
                  title: "Volebný kalkulátor · VolímTo",
                  text: shareText,
                  url: "https://volimto.sk/volebny-kalkulator",
                }).catch(() => {/* user cancelled */});
              } else {
                const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;
                window.open(twitterUrl, "_blank", "noopener");
              }
            }}
            className="flex items-center gap-2 border border-border bg-card px-5 py-2.5 text-sm font-semibold text-ink hover:bg-subtle transition-colors rounded-lg"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
              <polyline points="16 6 12 2 8 6"/>
              <line x1="12" y1="2" x2="12" y2="15"/>
            </svg>
            Zdieľať môj výsledok
          </button>
        </div>

        {/* All results bars */}
        <div className="space-y-3 mb-6">
          {results.map((r) => (
            <div key={r.partyId} className="flex items-center gap-3">
              <span className="text-[13px] text-secondary w-32 shrink-0">{r.party?.name}</span>
              <div className="flex-1 h-[6px] bg-[#eeeeee] rounded-[3px] overflow-hidden">
                <div
                  className="h-full rounded-[3px] transition-all duration-700"
                  style={{ width: `${r.score}%`, background: r.party?.color ?? "#1a6eb5" }}
                />
              </div>
              <span className="text-[13px] font-semibold w-10 text-right text-ink">
                {r.score}%
              </span>
            </div>
          ))}
        </div>

        <button
          onClick={() => {
            setCurrentQ(0);
            setAnswers({});
            setShowResults(false);
            setSelectedAnswer(null);
          }}
          className="px-5 py-2.5 text-[14px] font-semibold bg-ink text-white rounded-lg"
          style={{ scrollMarginTop: "calc(var(--nav-height) + 16px)" }}
        >
          Začať znova
        </button>

        {/* Post-quiz funnel */}
        <div className="mt-8 border-t border-border pt-6 space-y-4">
          <div className="bg-page p-4 border border-border rounded-lg">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">Tvoja najväčšia zhoda</p>
            <p className="text-xl font-bold" style={{ color: top.party?.color ?? "var(--ink)" }}>
              {top.party?.name} — {top.score.toFixed(0)}%
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Link
              href="/prieskumy"
              className="block p-4 border border-border hover:bg-page transition-colors rounded-lg"
            >
              <p className="font-semibold text-sm mb-1">Ako sa darí {top.party?.abbreviation}?</p>
              <p className="text-xs text-muted">Pozri si aktuálne prieskumy →</p>
            </Link>
            <Link
              href="/tipovanie"
              className="block p-4 border border-border hover:bg-page transition-colors rounded-lg"
            >
              <p className="font-semibold text-sm mb-1">Tipni si výsledok volieb</p>
              <p className="text-xs text-muted">Ako dopadnú voľby podľa teba? →</p>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const question = questions[currentQ];
  const progress = (currentQ / questions.length) * 100;

  return (
    <div className="max-w-[680px] mx-auto px-6 py-8">
      <SectionHeading
        title="Koho voliť?"
        subtitle="20 otázok · 2 minúty · Váhy strán sú redakčné odhady"
      />

      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex justify-between text-[13px] text-faint mb-2">
          <span>Otázka {currentQ + 1} z {questions.length}</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div
          className="h-[3px] bg-subtle rounded-full overflow-hidden"
          role="progressbar"
          aria-valuenow={Math.round(progress)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Postup v dotazníku"
        >
          <div
            className="h-full bg-ink transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Question card */}
      <div
        className="bg-card border border-border rounded-[12px] mb-4"
        style={{ padding: "28px 26px" }}
      >
        <h2
          className="text-[20px] font-bold text-ink mb-6 leading-[1.4] [text-wrap:balance]"
          style={{ letterSpacing: "-0.3px" }}
        >
          {question.text}
        </h2>
        <div className="space-y-3">
          {question.answers.map((answer, i) => (
            <button
              key={i}
              onClick={() => selectAnswer(i)}
              aria-label={`Odpoveď: ${answer.label}`}
              className="w-full text-left rounded-[9px] text-[14px] font-medium transition-all duration-150"
              style={{
                scrollMarginTop: "calc(var(--nav-height) + 16px)",
                padding: "13px 16px",
                border: selectedAnswer === i ? "1.5px solid #1a1a1a" : "1.5px solid #e8e3db",
                background: selectedAnswer === i ? "#1a1a1a" : "#fff",
                color: selectedAnswer === i ? "#fff" : "#1a1a1a",
                transform: selectedAnswer === i ? "scale(1.01)" : "scale(1)",
              }}
            >
              {answer.label}
            </button>
          ))}
        </div>
      </div>

      {/* Back navigation */}
      {currentQ > 0 && (
        <button
          onClick={() => setCurrentQ(currentQ - 1)}
          className="text-sm text-muted hover:text-ink transition-colors"
        >
          ← Predchádzajúca otázka
        </button>
      )}
    </div>
  );
}
