// src/models/faqModel.ts
import { Schema, model } from 'mongoose';


export interface IFaq extends Document {
  question: string;
  answer: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const faqSchema = new Schema<IFaq>(
  {
    question: { 
        type: String, 
        required: [true, 'Please enter question'],
        trim: true,
    },
    answer: { 
        type: String, 
        trim: true,
        required: [true, 'Please enter answer'],
    },
  },
  { timestamps: true }
);

const Faq = model('Faq', faqSchema);


export default Faq;