import { ContactAutoCategory, ContactSubject } from '../entities/contact-message.entity';

export function detectAutoCategory(message: string, subject: ContactSubject): ContactAutoCategory {
  const m = message.toLowerCase();

  if (subject === ContactSubject.PARTNERSHIPS) return ContactAutoCategory.PARTNERSHIP;
  if (subject === ContactSubject.MEDIA) return ContactAutoCategory.MEDIA;

  if (/\b(vote|voting|poll|ballot)\b/.test(m)) return ContactAutoCategory.VOTING_COMPETITION;
  if (/\b(competition|contest|entry|submit)\b/.test(m)) return ContactAutoCategory.VOTING_COMPETITION;
  if (/\b(paystack|payment|refund|charged|card|order|money)\b/.test(m)) return ContactAutoCategory.PAYMENT;
  if (/\b(partner|sponsor|collab|brand)\b/.test(m)) return ContactAutoCategory.PARTNERSHIP;
  if (/\b(press|interview|media|coverage|journalist)\b/.test(m)) return ContactAutoCategory.MEDIA;
  if (subject === ContactSubject.SUPPORT) return ContactAutoCategory.SUPPORT;

  return ContactAutoCategory.GENERAL;
}

export function detectUrgent(message: string): boolean {
  const m = message.toLowerCase();
  return (
    /\b(urgent|emergency|asap|immediately)\b/.test(m) ||
    /\b(not working|doesn'?t work|broken|issue|error|help)\b/.test(m)
  );
}
