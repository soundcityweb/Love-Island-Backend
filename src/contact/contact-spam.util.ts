const URL_REGEX = /\bhttps?:\/\/[^\s]+/gi;

/** Honeypot must be empty. */
export function isHoneypotTriggered(website: string | undefined): boolean {
  return website != null && String(website).trim().length > 0;
}

export function looksLikeSpamMessage(message: string): boolean {
  const t = message.trim();
  if (t.length < 20) return true;
  const urls = t.match(URL_REGEX) ?? [];
  if (urls.length > 10) return true;
  const letters = t.replace(/[^a-zA-Z]/g, '');
  if (letters.length > 40) {
    const upper = t.replace(/[^A-Z]/g, '').length;
    if (upper / letters.length > 0.85) return true;
  }
  const spammy = [/viagra/i, /crypto investment/i, /\bseo\b.*\bservice/i];
  return spammy.some((r) => r.test(t));
}
