import { XMLParser } from "fast-xml-parser";

// Pure parsers for BoardGameGeek XML API2 responses
// (https://boardgamegeek.com/wiki/page/BGG_XML_API2).

export interface BggSearchResult {
  id: number;
  type: string;
  name: string;
  year: number | null;
}

export interface BggThing {
  id: number;
  type: string;
  name: string;
  alternateNames: string[];
  year: number | null;
  description: string;
  categories: string[];
  mechanics: string[];
  families: string[];
  minPlayers: number | null;
  maxPlayers: number | null;
  playingTimeMin: number | null;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  isArray: (name) => ["item", "name", "link"].includes(name),
});

type Attr = { value?: string };
type RawItem = {
  id: string;
  type: string;
  name?: (Attr & { type?: string })[];
  yearpublished?: Attr;
  description?: string;
  link?: (Attr & { type: string })[];
  minplayers?: Attr;
  maxplayers?: Attr;
  playingtime?: Attr;
};

function int(attr: Attr | undefined): number | null {
  const n = Number.parseInt(attr?.value ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** BGG descriptions are double-escaped HTML with numeric entities for newlines etc. */
export function decodeBggText(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(Number.parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&hellip;/g, "…")
    .replace(/&rsquo;/g, "’")
    .replace(/&lsquo;/g, "‘")
    .replace(/&ldquo;/g, "“")
    .replace(/&rdquo;/g, "”")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function items(xml: string): RawItem[] {
  const doc = parser.parse(xml) as { items?: { item?: RawItem[] } };
  return doc.items?.item ?? [];
}

function primaryName(item: RawItem): string {
  const names = item.name ?? [];
  return (names.find((n) => n.type === "primary") ?? names[0])?.value ?? "";
}

export function parseSearch(xml: string): BggSearchResult[] {
  return items(xml).map((item) => ({
    id: Number(item.id),
    type: item.type,
    name: decodeBggText(primaryName(item)),
    year: int(item.yearpublished),
  }));
}

export function parseThing(xml: string): BggThing | undefined {
  const item = items(xml)[0];
  if (!item) return undefined;
  const links = (type: string) =>
    (item.link ?? []).filter((l) => l.type === type).map((l) => decodeBggText(l.value ?? ""));
  return {
    id: Number(item.id),
    type: item.type,
    name: decodeBggText(primaryName(item)),
    alternateNames: (item.name ?? [])
      .filter((n) => n.type === "alternate")
      .map((n) => decodeBggText(n.value ?? "")),
    year: int(item.yearpublished),
    description: decodeBggText(item.description ?? ""),
    categories: links("boardgamecategory"),
    mechanics: links("boardgamemechanic"),
    families: links("boardgamefamily"),
    minPlayers: int(item.minplayers),
    maxPlayers: int(item.maxplayers),
    playingTimeMin: int(item.playingtime),
  };
}
