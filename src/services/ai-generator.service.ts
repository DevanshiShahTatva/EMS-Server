import { GoogleGenerativeAI } from '@google/generative-ai';
import { appLogger } from '../helper/logger';

class AIGeneratorService {
    private log = appLogger.child({ service: 'AIGeneratorService' });
    private genAI: GoogleGenerativeAI;
    private modelConfig = { model: "gemini-2.0-flash" };

    constructor() {
        if (!process.env.GEMINI_API_KEY) {
            throw new Error('GEMINI_API_KEY is not defined in environment variables');
        }
        this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    }

    public async generateText(prompt: string): Promise<string> {
        // this.log.info({ prompt }, 'Generating AI text');

        try {
            const model = this.genAI.getGenerativeModel(this.modelConfig);
            const result = await model.generateContent(prompt);
            const response = await result.response;

            // this.log.info('AI text generation successful');
            return response.text();
        } catch (error) {
            this.log.error({ err: error }, 'AI text generation failed');
            throw new Error('Failed to generate text');
        }
    }
}

export default new AIGeneratorService();