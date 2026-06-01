import type { ParsedSection } from "./schema.js";

function isHeading(line: string): { level: number; text: string } | null {
  const trimmed = line.trim();
  const match = trimmed.match(/^(#{1,6})\s+(.+)$/);
  if (!match) return null;
  return { level: match[1]!.length, text: match[2]!.trim() };
}

export function parseMarkdownSections(markdown: string): ParsedSection[] {
  const lines = markdown.split("\n");
  const sections: ParsedSection[] = [];

  let currentHeading: { level: number; text: string; lineStart: number } | null = null;
  let currentContent: string[] = [];

  function flushSection(): void {
    if (!currentHeading) return;
    const content = currentContent.join("\n").trim();
    sections.push({
      id: "",
      heading: currentHeading.text,
      headingLevel: currentHeading.level,
      content,
      lineStart: currentHeading.lineStart,
      lineEnd: lines.length - 1,
    });
    currentContent = [];
  }

  for (let i = 0; i < lines.length; i++) {
    const heading = isHeading(lines[i]!);

    if (heading && heading.level === 2) {
      flushSection();
      currentHeading = { ...heading, lineStart: i };
    } else if (currentHeading) {
      currentContent.push(lines[i]!);
    }
  }

  flushSection();

  return sections;
}

export function matchSectionId(heading: string, knownSections: { heading: string; id: string }[]): string {
  const lower = heading.toLowerCase().trim();
  for (const known of knownSections) {
    if (known.heading.toLowerCase() === lower) return known.id;
    if (lower.startsWith(known.heading.toLowerCase())) return known.id;
  }
  return heading;
}
