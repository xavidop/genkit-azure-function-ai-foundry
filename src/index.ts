import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { genkit, z } from 'genkit';
import { azureOpenAI, gpt4o } from 'genkitx-azure-openai';
import * as dotenv from 'dotenv';

// Load environment variables from .env file (for local development)
dotenv.config();

// Initialize Genkit with Azure OpenAI plugin
const ai = genkit({
  plugins: [
    azureOpenAI({
      // These will be read from environment variables:
      // AZURE_OPENAI_ENDPOINT
      // AZURE_OPENAI_API_KEY
      // OPENAI_API_VERSION
    }),
  ],
  model: gpt4o,
});

// Define input schema for the story generator
const StoryInputSchema = z.object({
  topic: z.string().describe('The main topic or theme for the story'),
  style: z.string().optional().describe('Writing style (e.g., adventure, mystery, sci-fi)'),
  length: z.enum(['short', 'medium', 'long']).default('medium'),
});

// Define output schema for the generated story
const StorySchema = z.object({
  title: z.string(),
  genre: z.string(),
  story: z.string(),
  wordCount: z.number(),
  themes: z.array(z.string()),
});

// Define a story generator flow
export const storyGeneratorFlow = ai.defineFlow(
  {
    name: 'storyGeneratorFlow',
    inputSchema: StoryInputSchema,
    outputSchema: StorySchema,
  },
  async (input) => {
    // Determine word count based on length
    const lengthMap = {
      short: '200-300',
      medium: '500-700',
      long: '1000-1500',
    };

    const wordCount = lengthMap[input.length];

    // Create a prompt based on the input
    const prompt = `Create a creative ${input.style || 'fictional'} story with the following requirements:
      Topic: ${input.topic}
      Length: ${wordCount} words
      
      Please provide a captivating story with a clear beginning, middle, and end.
      Include rich descriptions and engaging characters.`;

    // Generate structured story data
    const { output } = await ai.generate({
      prompt,
      output: { schema: StorySchema },
    });

    if (!output) {
      throw new Error('Failed to generate story');
    }

    return output;
  }
);

// Azure Function HTTP trigger handler
export async function httpTrigger(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('HTTP trigger function processed a request.');
  context.log('Request:', {
    url: request.url,
    method: request.method,
  });

  try {
    // Parse request body
    const body = await request.json().catch(() => ({})) as any;

    // Validate and set defaults
    const input = {
      topic: body.topic || 'a brave explorer on an alien planet',
      style: body.style || 'adventure',
      length: (body.length as 'short' | 'medium' | 'long') || 'medium',
    };

    context.log('Generating story with input:', input);

    // Call the Genkit flow
    const story = await storyGeneratorFlow(input);

    context.log('Story generated successfully');

    // Return success response
    return {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      jsonBody: {
        success: true,
        data: story,
      },
    };
  } catch (error) {
    context.error('Error generating story:', error);

    return {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      jsonBody: {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      },
    };
  }
}

// Register the HTTP trigger
app.http('storyGenerator', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'generate',
  handler: httpTrigger,
});
