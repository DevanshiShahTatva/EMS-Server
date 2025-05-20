import Voucher from "../models/voucher.model";

export const generateUniquePromoCode = async () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let promoCode;

  const generateCode = () => {
    return Array.from({ length: 10 }, () =>
      chars.charAt(Math.floor(Math.random() * chars.length))
    ).join('');
  };

  let isUnique = false;

  while (!isUnique) {
    promoCode = generateCode();
    const existing = await Voucher.findOne({ promoCode });
    if (!existing) isUnique = true;
  }

  return promoCode;
}