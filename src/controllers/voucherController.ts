import { Request, Response } from 'express';
import Voucher from '../models/voucher.model';
import { getUserIdFromToken, throwError } from "../helper/common";

export const applyPromoCode = async (req: Request, res: Response) => {
  const userId = getUserIdFromToken(req);
  try {
    const { promoCode, amount } = req.body;
    const voucher = await Voucher.findOne({ userId, promoCode });
    if (!voucher) {
      return res.status(400).json({
        success: false,
        message: "Invalid promo code"
      });
    }
    if (voucher.used) {
      return res.status(400).json({
        success: false,
        message: "Promo code already used"
      });
    }
    if (new Date() > new Date(voucher.expireTime)) {
      return res.status(400).json({
        success: false,
        message: "Promo code expired"
      });
    }

    if (voucher.appliedBy && voucher.appliedBy.toString() !== userId.toString()) {
      return res.status(400).json({
        success: false,
        message: "Promo code already applied by another user"
      });
    }

    voucher.appliedBy = userId;
    voucher.appliedAt = new Date();
    await voucher.save();

    const rawDiscount = (voucher.percentage / 100) * amount;
    const discount = Math.min(rawDiscount, voucher.maxDiscount);

    res.status(200).json({
      discount,
      success: true,
      voucherId: voucher._id,
      message: `Promo code applied. You saved ₹${discount.toFixed(2)}`,
    });
  } catch (error) {
    return throwError(error, 'Failed', 400);
  }
}