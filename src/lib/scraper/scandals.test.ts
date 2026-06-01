import { describe, expect, it } from "vitest";
import {
  buildScandalSlug,
  extractScandalEvents,
  extractScandalSources,
  parseScandalLimit,
} from "./scandals";

describe("scandal scraper parsing", () => {
  const post = {
    date: "2026-05-01T10:00:00",
    modified: "2026-05-03T12:00:00",
    link: "https://zastavmekorupciu.sk/kauzy/test-kauza/",
    content: {
      rendered: `
        <article>
          <a href="https://dennikn.sk/123/test">Dennik N</a>
          <a href="https://dennikn.sk/123/test#comments">Duplicate</a>
          <a href="/kauzy/dalsi-zdroj/">Relative source</a>
          <a href="https://example.invalid/untrusted">Ignore</a>
          <a href="mailto:test@example.com">Mail</a>
        </article>
      `,
    },
  };

  it("deduplicates trusted source URLs and keeps deterministic order", () => {
    const sources = extractScandalSources(post);

    expect(sources.map((source) => source.url)).toEqual([
      "https://zastavmekorupciu.sk/kauzy/test-kauza/",
      "https://zastavmekorupciu.sk/kauzy/",
      "https://dennikn.sk/123/test",
      "https://zastavmekorupciu.sk/kauzy/dalsi-zdroj/",
    ]);
    expect(sources[0]).toMatchObject({ isPrimary: true, publishedDate: "2026-05-01" });
  });

  it("builds a stable source-prefixed slug", () => {
    expect(buildScandalSlug("test-kauza")).toBe("zk-test-kauza");
  });

  it("extracts start, process signal, and update timeline events", () => {
    const events = extractScandalEvents(
      post,
      "Policia preveruje podnet a zdroj bol neskor doplneny."
    );

    expect(events.map((event) => event.eventType)).toEqual([
      "source_published",
      "complaint",
      "source_updated",
    ]);
    expect(events.map((event) => event.eventDate)).toEqual([
      "2026-05-01",
      "2026-05-01",
      "2026-05-03",
    ]);
  });

  it("parses CLI limit safely", () => {
    expect(parseScandalLimit(["node", "script", "--limit=12"])).toBe(12);
    expect(parseScandalLimit(["--limit=bad"], 80)).toBe(80);
    expect(parseScandalLimit(["--limit=0"], 80)).toBe(1);
  });
});
