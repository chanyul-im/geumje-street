/** True when the last Hangul syllable has a final consonant. */
export function hasBatchim(word: string): boolean {
  const ch = word.charCodeAt(word.length - 1);
  if (Number.isNaN(ch) || ch < 0xac00 || ch > 0xd7a3) return false;
  return (ch - 0xac00) % 28 !== 0;
}

export function josa(word: string, pair: "이/가" | "은/는" | "을/를" | "과/와"): string {
  const [withBatchim, without] = pair.split("/");
  return hasBatchim(word) ? withBatchim : without;
}

export function withJosa(word: string, pair: "이/가" | "은/는" | "을/를" | "과/와"): string {
  return `${word}${josa(word, pair)}`;
}
