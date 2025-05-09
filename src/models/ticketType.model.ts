import { Schema, model, Document, Model } from 'mongoose';

export interface ITicketType extends Document {
  name: string;
  description?: string;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

// Custom static method interface
interface ITicketTypeModel extends Model<ITicketType> {
  createWithValidation(data: Partial<ITicketType>): Promise<ITicketType>;
}

const ticketTypeSchema = new Schema<ITicketType, ITicketTypeModel>(
  {
    name: {
      type: String,
      required: [true, 'Ticket type name is required'],
      trim: true,
      unique: true,
      index: true,
      minlength: [3, 'Ticket type name must be at least 3 characters'],
      maxlength: [50, 'Ticket type name cannot exceed 50 characters'],
      validate: {
        validator: function (v: string) {
          return /^[a-zA-Z0-9 \-]+$/.test(v);
        },
        message: 'Ticket type name can only contain letters, numbers, spaces and hyphens',
      },
    },
    description: {
      type: String,
      trim: true,
      maxlength: [200, 'Description cannot exceed 200 characters'],
      validate: {
        validator: function (v?: string) {
          return !v || v.trim().length > 0;
        },
        message: 'Description cannot be empty if provided',
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Static method implementation
ticketTypeSchema.statics.createWithValidation = async function (
  data: Partial<ITicketType>
): Promise<ITicketType> {
  try {
    const doc = new this(data);
    await doc.validate();
    return await doc.save();
  } catch (error: any) {
    if (error.code === 11000) {
      throw new Error('A ticket type with this name already exists');
    }
    throw error;
  }
};

// Text index for search with weights
ticketTypeSchema.index(
  { name: 'text', description: 'text' },
  { weights: { name: 3, description: 1 } }
);

// Pre-save hook for formatting
ticketTypeSchema.pre('save', function (next) {
  if (this.isModified('name')) {
    this.name = this.name.trim();
  }
  if (this.description) {
    this.description = this.description.trim();
  }
  next();
});

// Export with correct model typing
const TicketType = model<ITicketType, ITicketTypeModel>('TicketType', ticketTypeSchema);
export default TicketType;
