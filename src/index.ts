import { genkit, z } from 'genkit';
import {
  azureOpenAI,
  gpt4o,
  onCallGenkit,
  requireApiKey,
} from 'genkitx-azure-openai';
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
const storyGeneratorFlow = ai.defineFlow(
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

// Register the story generator flow as an Azure Function HTTP trigger using onCallGenkit
export const storyGeneratorHandler = onCallGenkit(
  {
    cors: { origin: '*' },
    debug: process.env.NODE_ENV !== 'production',
  },
  storyGeneratorFlow
);

// Define a joke flow
const JokeInputSchema = z.object({
  subject: z.string().describe('The subject for the joke'),
});

const JokeOutputSchema = z.object({
  joke: z.string(),
});

const jokeFlow = ai.defineFlow(
  {
    name: 'jokeFlow',
    inputSchema: JokeInputSchema,
    outputSchema: JokeOutputSchema,
  },
  async (input) => {
    const { output } = await ai.generate({
      prompt: `Tell me a funny joke about ${input.subject}`,
      output: { schema: JokeOutputSchema },
    });

    if (!output) {
      throw new Error('Failed to generate joke');
    }

    return output;
  }
);

// Register the joke flow as an Azure Function (simplest form)
export const jokeHandler = onCallGenkit(jokeFlow);

// Define a streaming joke flow
const jokeStreamingFlow = ai.defineFlow(
  {
    name: 'jokeStreamingFlow',
    inputSchema: JokeInputSchema,
    outputSchema: JokeOutputSchema,
    streamSchema: z.string(),
  },
  async (input, { sendChunk }) => {
    const { stream, response } = await ai.generateStream({
      prompt: `Tell me a long and funny joke about ${input.subject}`,
    });

    for await (const chunk of stream) {
      sendChunk(chunk.text);
    }

    const result = await response;
    return { joke: result.text };
  }
);

// Register the streaming joke flow with SSE support
export const jokeStreamHandler = onCallGenkit(
  { streaming: true, cors: { origin: '*' } },
  jokeStreamingFlow
);

// Define a protected summary flow with API key authentication
const SummaryInputSchema = z.object({
  text: z.string().describe('Text to summarize'),
  maxLength: z.number().optional().describe('Maximum summary length in words'),
});

const SummaryOutputSchema = z.object({
  summary: z.string(),
  originalLength: z.number(),
  summaryLength: z.number(),
});

const protectedSummaryFlow = ai.defineFlow(
  {
    name: 'protectedSummaryFlow',
    inputSchema: SummaryInputSchema,
    outputSchema: SummaryOutputSchema,
  },
  async (input) => {
    const maxLen = input.maxLength || 100;
    const { output } = await ai.generate({
      prompt: `Summarize the following text in at most ${maxLen} words:\n\n${input.text}`,
      output: { schema: SummaryOutputSchema },
    });

    if (!output) {
      throw new Error('Failed to generate summary');
    }

    return output;
  }
);

// Register the protected summary flow with API key authentication
export const protectedHandler = onCallGenkit(
  {
    contextProvider: requireApiKey(
      'X-API-Key',
      process.env.API_KEY || 'demo-api-key'
    ),
    cors: {
      origin: ['https://myapp.com', 'http://localhost:3000'],
      credentials: true,
    },
    onError: async (error) => ({
      statusCode: error.message.includes('Unauthorized') ? 401 : 500,
      message: error.message,
    }),
  },
  protectedSummaryFlow
);
