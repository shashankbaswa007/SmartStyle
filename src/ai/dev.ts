import { config } from 'dotenv';
config();

import '@/ai/flows/analyze-current-outfit-and-provide-feedback.ts';
import '@/ai/flows/analyze-image-and-provide-recommendations.ts';
import '@/ai/flows/extract-colors-from-image.ts';
