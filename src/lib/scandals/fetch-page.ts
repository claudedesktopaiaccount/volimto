import * as cheerio from "cheerio";
import { classifyScandalSource } from "./trusted-sources";

export async function fetchTrustedScandalPageText(url: string): Promise<string> {
  const classified = classifyScandalSource(url);
  if (!classified.trusted) throw new Error("untrusted_source");

  const res = await fetch(url, {
    redirect: "error",
    signal: AbortSignal.timeout(20_000),
    headers: { "User-Agent": "Mozilla/5.0 (compatible; VolimTo/1.0 scandal-review)" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const html = await res.text();
  const $ = cheerio.load(html);
  $("script, style, nav, footer, header, noscript, form").remove();
  return $("body").text().replace(/\s+/g, " ").trim().slice(0, 20_000);
}
