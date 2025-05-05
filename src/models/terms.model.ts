// src/models/terms.model.ts
import mongoose, { Document, Model, Schema } from 'mongoose';
import { appLogger } from '../helper/logger';

export interface ITerms extends Document {
  content: string;
  updatedAt?: Date;
}

interface ITermsModel extends Model<ITerms> {
  getSingleton(): Promise<ITerms>;
}

const termsSchema = new Schema<ITerms>(
  {
    content: { type: String, required: true }
  },
  { timestamps: true }
);

// Add static method
termsSchema.statics.getSingleton = async function() {
  let terms = await this.findOne();
  if (!terms) {
    terms = await this.create({ content: 'Initial terms and conditions' });
    appLogger.info('Created initial terms document');
  }
  return terms;
};

const Terms = mongoose.model<ITerms, ITermsModel>('Terms', termsSchema);
export default Terms;