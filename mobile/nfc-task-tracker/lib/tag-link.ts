export const TAG_LINK_ORIGIN = 'https://nfc-fit.vercel.app';
export const isTagId = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export function buildTagLink(tagId: string) {
  if (!isTagId(tagId)) throw new Error('Geçerli bir salon kartı seçin.');
  return `${TAG_LINK_ORIGIN}/tag/${tagId.toLowerCase()}`;
}
export function normalizePhysicalUid(uid: string) {
  const value = uid.replace(/[:\s-]/g, '');
  if (value.length < 4 || value.length % 2 || !/^[a-f\d]+$/i.test(value)) throw new Error('Kartın fiziksel UID’si geçerli değil. UID’yi telefonla tekrar okutun.');
  return value.toUpperCase();
}

/** A club-card miss may only fall back to an already owned legacy card, never create one. */
export function matchesOwnedLegacyCard(card: {uid?:string|null;assigned_user_id?:string|null}, uid:string, userId:string) {
  if(!userId || card.assigned_user_id!==userId || !card.uid)return false;
  try{return normalizePhysicalUid(card.uid)===normalizePhysicalUid(uid);}catch{return false;}
}
