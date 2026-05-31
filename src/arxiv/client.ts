import { XMLParser } from "fast-xml-parser";
import { env } from "../config/env.js";
import { fetchText } from "../lib/http.js";

export interface ArxivEntry {
  id: string;
  title: string;
  abstract: string;
  authors: string[];
  publishedAt: Date;
  categories: string[];
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  trimValues: true
});

function parseEntryId(idValue: string): string {
  const parts = idValue.split("/");
  const raw = parts[parts.length - 1] ?? idValue;
  return raw.replace(/v\d+$/, "");
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

export async function fetchNewArxivEntries(maxResults: number): Promise<ArxivEntry[]> {
  const url = new URL("https://export.arxiv.org/api/query");
  url.searchParams.set("search_query", env.ARXIV_QUERY);
  url.searchParams.set("start", "0");
  url.searchParams.set("max_results", String(maxResults));
  url.searchParams.set("sortBy", "submittedDate");
  url.searchParams.set("sortOrder", "descending");

  const xml = await fetchText(url.toString());
  const parsed = xmlParser.parse(xml) as {
    feed?: {
      entry?: Array<{
        id: string;
        title: string;
        summary: string;
        author?: Array<{ name: string }> | { name: string };
        published: string;
        category?: Array<{ "@_term": string }> | { "@_term": string };
      }>;
    };
  };

  const entries = asArray(parsed.feed?.entry);
  const minPublishedAt = new Date(Date.now() - env.ARXIV_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

  return entries
    .map((entry) => ({
      id: parseEntryId(entry.id),
      title: entry.title.replace(/\s+/g, " ").trim(),
      abstract: entry.summary.replace(/\s+/g, " ").trim(),
      authors: asArray(entry.author).map((author) => author.name),
      publishedAt: new Date(entry.published),
      categories: asArray(entry.category).map((category) => category["@_term"])
    }))
    .filter((entry) => entry.publishedAt >= minPublishedAt);
}
