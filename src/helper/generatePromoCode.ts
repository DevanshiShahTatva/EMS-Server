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

export const generateSecurePassword = (length: number = 12): string => {
  if (length < 8 || length > 50) {
    throw new Error("Password length must be between 8 and 50 characters");
  }

  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lower = "abcdefghijklmnopqrstuvwxyz";
  const numbers = "0123456789";
  const special = "!@#$%^&*()-_=+[]{};:,.<>?";

  const all = upper + lower + numbers + special;

  const getRandom = (chars: string) => chars[Math.floor(Math.random() * chars.length)];

  // Ensure each requirement is satisfied
  let password = [
    getRandom(upper),
    getRandom(lower),
    getRandom(numbers),
    getRandom(special),
  ];

  // Fill the rest randomly
  for (let i = password.length; i < length; i++) {
    password.push(getRandom(all));
  }

  // Shuffle to avoid predictable patterns
  password = password.sort(() => Math.random() - 0.5);

  return password.join("");
}
