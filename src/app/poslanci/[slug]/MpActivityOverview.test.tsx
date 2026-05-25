import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import MpActivityOverview from "./MpActivityOverview";
import type { MpDetailOverview } from "@/lib/db/mps";

describe("MpActivityOverview", () => {
  it("shows all overview sections with empty states", () => {
    const overview: MpDetailOverview = {
      speeches: [],
      speechTotal: 0,
      interpellations: [],
      interpellationTotal: 0,
      companies: [],
      contractPreview: [],
      contractTotal: 0,
      contractTotalAmount: 0,
    };

    render(<MpActivityOverview overview={overview} mpSlug="michal-simecka" />);

    expect(screen.getByText("Reči")).toBeInTheDocument();
    expect(screen.getByText("Interpelácie")).toBeInTheDocument();
    expect(screen.getByText("Firmy")).toBeInTheDocument();
    expect(screen.getByText("Zmluvy")).toBeInTheDocument();
    expect(screen.getByText("Žiadne evidované reči")).toBeInTheDocument();
    expect(screen.getByText("Žiadne evidované interpelácie")).toBeInTheDocument();
    expect(screen.getByText("Žiadne overené prepojenia")).toBeInTheDocument();
    expect(screen.getByText("Žiadne overené zmluvy")).toBeInTheDocument();
  });
});
