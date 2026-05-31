import { load } from "cheerio";
import pdfParse from "pdf-parse";
import { env } from "../config/env.js";
import { fetchText } from "../lib/http.js";
import type { PaperContext } from "../types.js";

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function trimWords(text: string, maxWords: number): string {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) {
    return words.join(" ");
  }
  return `${words.slice(0, maxWords).join(" ")}…`;
}

function extractByHeading(html: string): string {
  const $ = load(html);
  const sectionTitles = ["abstract", "results", "conclusion", "conclusions"];
  const chunks: string[] = [];

  $("h1, h2, h3, h4").each((_, element) => {
    const title = $(element).text().trim().toLowerCase();
    if (sectionTitles.some((sectionTitle) => title.includes(sectionTitle))) {
      const body = $(element).nextUntil("h1, h2, h3, h4").text().replace(/\s+/g, " ").trim();
      if (body) {
        chunks.push(`${title}: ${body}`);
      }
    }
  });

  return chunks.join("\n\n");
}

export async function buildPaperContext(arxivId: string, abstract: string): Promise<PaperContext> {
  const abstractClean = abstract.replace(/\s+/g, " ").trim();
  const base: PaperContext = {
    tier: "tier1",
    text: abstractClean,
    wordCount: wordCount(abstractClean)
  };

  if (env.PAPER_PROCESSING_MODE === "abstract") {
    return base;
  }

  try {
    const ar5ivUrl = `${env.AR5IV_BASE_URL}/html/${arxivId}`;
    const html = await fetchText(ar5ivUrl);
    const extracted = trimWords(extractByHeading(html), 1200);
    if (wordCount(extracted) >= 200) {
      return {
        tier: "tier2",
        text: extracted,
        wordCount: wordCount(extracted)
      };
    }
  } catch {
    // Fallback to PDF extraction.
  }

  try {
    const pdfUrl = `https://arxiv.org/pdf/${arxivId}.pdf`;
    const response = await fetch(pdfUrl);
    if (!response.ok) {
      return base;
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    const parsed = await pdfParse(buffer);
    const excerpt = trimWords(parsed.text.replace(/\s+/g, " "), 1200);

    return {
      tier: "tier3",
      text: excerpt || base.text,
      wordCount: wordCount(excerpt || base.text)
    };
  } catch {
    return base;
  }
}
