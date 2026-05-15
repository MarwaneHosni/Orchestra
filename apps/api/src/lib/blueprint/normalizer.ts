const VAGUE_PATTERNS = [
  /\bnot sure\b/i,
  /\bI don'?t know\b/i,
  /\bwhatever\b/i,
  /\bTBD\b/i,
  /\bto be determined\b/i,
  /\bnot decided\b/i,
  /\bno preference\b/i,
  /\bI'll figure it out\b/i,
  /\bdoesn'?t matter\b/i,
];

const FILLER_PREFIXES = [
  /^I think\s+/i,
  /^I believe\s+/i,
  /^maybe\s+/i,
  /^just\s+/i,
  /^probably\s+/i,
  /^honestly,\s+/i,
  /^personally,\s+/i,
];

export function normalizeText(raw: string): string {
  let text = raw.trim();
  text = text.replace(/\s+/g, " ");
  for (const prefix of FILLER_PREFIXES) {
    text = text.replace(prefix, "");
  }
  text = text.trim();
  if (text.length > 1000) {
    text = text.slice(0, 997) + "...";
  }
  return text;
}

export function isVague(text: string): boolean {
  return VAGUE_PATTERNS.some((p) => p.test(text));
}

export function isTooShort(text: string, type: string): boolean {
  if (type === "boolean") return false;
  if (type === "select" || type === "multi_select") return false;
  return text.trim().length < 10;
}

export function buildSummary(answers: { questionText: string; normalizedValue: string }[]): string {
  if (answers.length === 0) return "";

  const parts: string[] = [];
  for (const a of answers) {
    const short =
      a.normalizedValue.length > 120 ? a.normalizedValue.slice(0, 117) + "..." : a.normalizedValue;
    parts.push(short);
  }
  return parts.join("; ");
}
