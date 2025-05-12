import { Schema, model, Document, Model } from 'mongoose';

interface ICloudinaryImage {
    url: string;
    imageId: string;
}

export interface ITicketCategory extends Document {
    name: string;
    isActive: boolean;
    color: string;
    bgColor: string;
    icon?: ICloudinaryImage;
    createdAt?: Date;
    updatedAt?: Date;
}

interface ITicketCategoryModel extends Model<ITicketCategory> {
    createWithValidation(data: Partial<ITicketCategory>): Promise<ITicketCategory>;
}

const ticketCategorySchema = new Schema<ITicketCategory, ITicketCategoryModel>(
    {
        name: {
            type: String,
            required: [true, 'Ticket category name is required'],
            trim: true,
            unique: true,
            index: true,
            minlength: [3, 'Ticket category name must be at least 3 characters'],
            maxlength: [50, 'Ticket category name cannot exceed 50 characters'],
            // validate: {
            //     validator: function (v: string) {
            //         return /^[a-zA-Z0-9 \-]+$/.test(v);
            //     },
            //     message: 'Ticket category name can only contain letters, numbers, spaces, and hyphens',
            // },
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        color: {
            type: String,
            required: [true, 'Text color is required'],
            default: '#000000',
            // validate: {
            //     validator: function (v: string) {
            //         return /^#([0-9A-F]{3}){1,2}$/i.test(v);
            //     },
            //     message: 'Color must be a valid hex code (e.g., #000000)',
            // },
        },
        bgColor: {
            type: String,
            required: [true, 'Background color is required'],
            default: '#ffffff',
            // validate: {
            //     validator: function (v: string) {
            //         return /^#([0-9A-F]{3}){1,2}$/i.test(v);
            //     },
            //     message: 'Background color must be a valid hex code (e.g., #ffffff)',
            // },
        },
        icon: {
            type: {
                url: {
                    type: String,
                    // required: [true, 'Icon URL is required'],
                    // trim: true,
                    // validate: {
                    //     validator: function (v: string) {
                    //         return /^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/.test(v);
                    //     },
                    //     message: 'Icon URL must be a valid URL',
                    // },
                },
                imageId: {
                    type: String,
                    // required: [true, 'Cloudinary image ID is required'],
                    // trim: true,
                },
            },
            _id: false,
        },
    },
    {
        timestamps: true,
    }
);

ticketCategorySchema.statics.createWithValidation = async function (
    data: Partial<ITicketCategory>
): Promise<ITicketCategory> {
    try {
        const doc = new this(data);
        await doc.validate();
        return await doc.save();
    } catch (error: any) {
        if (error.code === 11000) {
            throw new Error('A ticket category with this name already exists');
        }
        throw error;
    }
};

ticketCategorySchema.index({ name: 'text' });

ticketCategorySchema.pre('save', function (next) {
    if (this.isModified('name')) {
        this.name = this.name.trim();
    }
    next();
});

export default model<ITicketCategory, ITicketCategoryModel>(
    'TicketCategory',
    ticketCategorySchema
);