import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MAX_BYTES = 2_000_000;
const FETCH_TIMEOUT_MS = 8_000;
const APPROVED_HOSTS = new Set([
  "tabs.ultimate-guitar.com",
  "www.ultimate-guitar.com",
  "azlyrics.com",
  "www.azlyrics.com",
  "lyrics.com",
  "www.lyrics.com",
  "essentialworship.com",
  "www.essentialworship.com",
  "worshiptogether.com",
  "www.worshiptogether.com",
  "chordify.net",
  "www.chordify.net",
  "songsterr.com",
  "www.songsterr.com",
  "chordie.com",
  "www.chordie.com",
]);
const SECTION_NAMES =
  /^(intro|verse(?:\s+\d+)?|pre[- ]?chorus|chorus|bridge|instrumental|solo|outro)$/i;
const CHORD =
  /^(?:[A-G](?:#|b)?)(?:maj|min|m|dim|aug|sus|add)?\d*(?:[#b]\d+)?(?:\/[A-G](?:#|b)?)?$/;

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:div|p|section|article|li|tr|h[1-6])\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&rsquo;|&lsquo;|&#8217;|&#8216;/gi, "'")
    .replace(/&ldquo;|&rdquo;|&#8220;|&#8221;/gi, '"')
    .replace(/&#(\d+);/g, (_match, code: string) =>
      String.fromCodePoint(Number(code)),
    );
}

function cleanChartMarkup(value: string) {
  return decodeHtml(value)
    .replace(/\[\/tab\]/gi, "\n")
    .replace(/\[tab\]/gi, "")
    .replace(/\[\/?ch\]/gi, "")
    .replace(
      /\[(intro|verse(?:\s+\d+)?|pre[- ]?chorus|chorus|bridge(?:\s+x\d+)?|instrumental|solo|outro|tag|half chorus)\]/gi,
      "$1",
    );
}

function extractChartText(html: string) {
  const structuredBlocks = extractStructuredBlocks(html);
  if (structuredBlocks.length) {
    return structuredBlocks.sort(
      (left, right) => chartScore(right) - chartScore(left),
    )[0];
  }
  const blocks = [
    ...html.matchAll(/<(?:pre|code)[^>]*>([\s\S]*?)<\/(?:pre|code)>/gi),
    ...html.matchAll(
      /<(?:div|article|section)[^>]+(?:class|id)=["'][^"']*(?:tab|song|lyrics|chord|content)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|article|section)>/gi,
    ),
  ].map((match) => stripHtml(decodeHtml(match[1])));
  const candidates = blocks.filter(
    (block) => block.split("\n").length > 1 && block.length > 20,
  );
  if (candidates.length)
    return candidates.sort(
      (left, right) => chartScore(right) - chartScore(left),
    )[0];
  return stripHtml(html);
}

function extractStructuredBlocks(html: string) {
  const values: string[] = [];
  const payloads = [
    ...html.matchAll(/data-content=(['"])([\s\S]*?)\1/gi),
    ...html.matchAll(
      /<script[^>]+type=['"]application\/json['"][^>]*>([\s\S]*?)<\/script>/gi,
    ),
  ];
  for (const match of payloads) {
    const raw = decodeHtml(match[2] || match[1]);
    try {
      collectContentStrings(JSON.parse(raw), values);
    } catch {
      const content = raw.match(
        /(?:"content"|"tab_view"|"lyrics")[\s]*:[\s]*"([\s\S]{80,}?)"(?:,|})/i,
      )?.[1];
      if (content)
        values.push(content.replace(/\\n/g, "\n").replace(/\\"/g, '"'));
    }
  }
  return values
    .map((value) => stripHtml(decodeHtml(value)))
    .filter((value) => value.length > 20 && value.split("\n").length > 1);
}

function collectContentStrings(value: unknown, output: string[], depth = 0) {
  if (depth > 8 || value === null || value === undefined) return;
  if (typeof value === "string") {
    if (
      value.length > 80 &&
      (value.includes("\n") || /\[[A-G](?:#|b)?[^\]]*\]/.test(value))
    )
      output.push(value);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectContentStrings(item, output, depth + 1));
    return;
  }
  if (typeof value === "object")
    Object.values(value as Record<string, unknown>).forEach((item) =>
      collectContentStrings(item, output, depth + 1),
    );
}
function chartScore(text: string) {
  const lines = text.split("\n").filter((line) => line.trim());
  const chordRows = lines.filter((line) => isChordLine(line)).length;
  const inlineChords = (text.match(/\[[A-G](?:#|b)?[^\]]*\]/g) || []).length;
  return chordRows * 10 + inlineChords * 8 + Math.min(lines.length, 30);
}

function escapeChordPro(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\{/g, "\\{")
    .replace(/\}/g, "\\}");
}

function extractMeta(html: string, name: string) {
  const tag =
    html.match(
      new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]*>`, "i"),
    )?.[0] || "";
  return tag.match(/content=["']([^"']+)["']/i)?.[1]?.trim() || "";
}

function isChordLine(line: string) {
  const tokens = line.trim().split(/\s+/).filter(Boolean);
  return (
    tokens.length > 0 &&
    tokens.every((token) => CHORD.test(token) || token === "|")
  );
}

function alignChordLine(chordLine: string, lyricLine: string) {
  const matches = [
    ...chordLine.matchAll(
      /[A-G](?:#|b)?(?:maj|min|m|dim|aug|sus|add)?\d*(?:[#b]\d+)?(?:\/[A-G](?:#|b)?)?/g,
    ),
  ];
  let result = lyricLine;
  for (const match of matches.reverse()) {
    const position = Math.min(match.index || 0, result.length);
    result = `${result.slice(0, position)}[${match[0]}]${result.slice(position)}`;
  }
  return result;
}

function normalizeSectionLines(lines: string[]) {
  const normalized: string[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (
      isChordLine(lines[index]) &&
      lines[index + 1] &&
      !isChordLine(lines[index + 1])
    ) {
      normalized.push(alignChordLine(lines[index], lines[index + 1]));
      index += 1;
    } else normalized.push(lines[index]);
  }
  return normalized;
}

function toChordPro(html: string, sourceUrl: string) {
  const rawTitle = decodeHtml(
    extractMeta(html, "og:title") ||
      html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ||
      "Imported song",
  );
  let title = rawTitle.replace(/\s*[-|].*$/, "").trim();
  let artist = decodeHtml(
    extractMeta(html, "music:musician") ||
      extractMeta(html, "author") ||
      rawTitle.match(/\s[-|]\s([^|-]+)$/)?.[1] ||
      "",
  );
  if (sourceUrl.includes("ultimate-guitar.com") && rawTitle.includes(" - ")) {
    const titleParts = rawTitle.split(" - ");
    artist = titleParts.shift() || "";
    title = titleParts
      .join(" - ")
      .replace(/\s*\((?:chords|tabs?)\)\s*$/i, "")
      .trim();
  }
  const text = cleanChartMarkup(extractChartText(html));
  const lines = text
    .split("\n")
    .map((line) => line.replace(/\r/g, "").trimEnd())
    .filter((line) => line.trim());
  const sections: { name: string; lines: string[] }[] = [];
  let current = { name: "Main", lines: [] as string[] };
  for (const line of lines) {
    if (SECTION_NAMES.test(line)) {
      if (current.lines.length) sections.push(current);
      current = { name: line, lines: [] };
    } else if (line.length <= 180) current.lines.push(line);
  }
  if (current.lines.length) sections.push(current);
  const chordLines = sections.flatMap((section) =>
    section.lines.filter(
      (line) =>
        line
          .trim()
          .split(/\s+/)
          .filter((token) => CHORD.test(token)).length > 0,
    ),
  );
  const confidence =
    sections.length > 0 && chordLines.length > 0 ? "review" : "low";
  const body = sections
    .map(
      (section) =>
        `{section: ${escapeChordPro(section.name)}}\n${normalizeSectionLines(section.lines).join("\n")}`,
    )
    .join("\n\n");
  return {
    title,
    artist,
    key: "",
    capo: "",
    confidence,
    rawText: text.slice(0, 20_000),
    chordpro: `{title: ${escapeChordPro(title)}}${artist ? `\n{artist: ${escapeChordPro(artist)}}` : ""}\n\n${body}`,
    sourceUrl,
  };
}

async function readLimited(responseValue: Response) {
  const reader = responseValue.body?.getReader();
  if (!reader)
    throw new Error("The source page did not include readable content.");
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES)
      throw new Error("The source page is too large to import.");
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

serve(async (request) => {
  if (request.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });
  try {
    const { url: rawUrl } = await request.json();
    if (typeof rawUrl !== "string" || !rawUrl.trim())
      return response({ error: "A song URL is required." }, 400);
    const url = new URL(rawUrl.trim());
    if (url.protocol !== "https:")
      return response({ error: "Only HTTPS song URLs are supported." }, 400);
    if (!APPROVED_HOSTS.has(url.hostname.toLowerCase()))
      return response({ error: "That website is not supported yet." }, 400);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let page: Response;
    try {
      page = await fetch(url, {
        redirect: "error",
        signal: controller.signal,
        headers: {
          Accept: "text/html",
          "User-Agent": "Onesys Song Importer/1.0",
        },
      });
    } finally {
      clearTimeout(timeout);
    }
    if (!page.ok)
      return response(
        { error: `The source page could not be loaded (${page.status}).` },
        502,
      );
    const contentType = page.headers.get("content-type") || "";
    if (!contentType.includes("text/html"))
      return response(
        { error: "The source URL did not return an HTML page." },
        415,
      );
    const html = await readLimited(page);
    return response({ song: toChordPro(html, url.toString()) });
  } catch (error) {
    const message =
      error instanceof DOMException && error.name === "AbortError"
        ? "The source page took too long to respond."
        : error instanceof Error
          ? error.message
          : "Song import failed.";
    return response({ error: message }, 500);
  }
});
