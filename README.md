# Genkit Azure Function with Azure OpenAI

An Azure Function powered by [Firebase Genkit](https://genkit.dev/) and the [Azure OpenAI plugin](https://github.com/BloomLabsInc/genkit-plugins/tree/main/plugins/azure-openai) for AI-powered story generation.

## Prerequisites

- Node.js 20 or later
- Azure Account with:
  - Azure CLI configured
  - Azure OpenAI resource deployed
  - Access to GPT-4o or other Azure OpenAI models
- Azure Functions Core Tools v4
- Azure credentials configured

## Installation

1. Clone and install dependencies:

```bash
npm install
```

2. Install Genkit CLI globally:

```bash
npm install -g genkit-cli
```

3. Install Azure Functions Core Tools (if not already installed):

```bash
npm install -g azure-functions-core-tools@4
```

## Configuration

### Azure OpenAI Setup

1. Create an Azure OpenAI resource in the [Azure Portal](https://portal.azure.com)
2. Deploy a GPT-4o model (or another supported model)
3. Get your endpoint and API key from the "Keys and Endpoint" section

### Environment Variables

Create a `.env` file in the root directory:

**`.env` file** (for running `npm run genkit:ui`):

```env
AZURE_OPENAI_ENDPOINT=https://your-resource-name.openai.azure.com/
AZURE_OPENAI_API_KEY=your-api-key-here
OPENAI_API_VERSION=2024-10-21
```

For production deployment, set these as Application Settings in your Azure Function App.

## Local Development

### Run with Azure Functions Core Tools (Recommended)

The best way to test the Azure Function locally with a real HTTP endpoint:

```bash
npm run func:start
```

This starts a local server at `http://localhost:7071` that mimics the Azure Functions runtime. Test it with:

```bash
curl -X POST http://localhost:7071/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "a robot learning to feel emotions",
    "style": "sci-fi",
    "length": "medium"
  }'
```

### Run with Genkit Dev UI

For testing and debugging the Genkit flow with visual traces:

```bash
npm run genkit:ui
```

This starts the Genkit Developer UI at `http://localhost:4000`. You can:

- Test the `storyGeneratorFlow` with different inputs
- View detailed traces of AI generation
- Debug and optimize your prompts

## Usage Examples

### Request Format

```json
{
  "topic": "a time traveler discovering an ancient civilization",
  "style": "mystery",
  "length": "short"
}
```

Parameters:

- `topic` (required): The main theme or topic for the story
- `style` (optional): Writing style (e.g., "adventure", "mystery", "sci-fi", "romance")
- `length` (optional): Story length - `"short"` (200-300 words), `"medium"` (500-700 words), or `"long"` (1000-1500 words)

### Response Format

```json
{
  "success": true,
  "data": {
    "title": "Echoes of Atlantis",
    "genre": "Mystery",
    "story": "The full story text...",
    "wordCount": 287,
    "themes": ["time travel", "ancient mysteries", "discovery"]
  }
}
```

## Deployment

### Prerequisites for Deployment

1. Install Azure CLI:

```bash
# macOS
brew install azure-cli

# Or download from https://docs.microsoft.com/cli/azure/install-azure-cli
```

2. Login to Azure:

```bash
az login
```

3. Create a Function App (if you haven't already):

```bash
# Create a resource group
az group create --name myResourceGroup --location eastus

# Create a storage account
az storage account create --name mystorageaccount --location eastus --resource-group myResourceGroup --sku Standard_LRS

# Create a function app
az functionapp create --resource-group myResourceGroup --consumption-plan-location eastus \
  --runtime node --runtime-version 20 --functions-version 4 \
  --name myFunctionAppName --storage-account mystorageaccount
```

### Configure Environment Variables in Azure

```bash
az functionapp config appsettings set --name myFunctionAppName --resource-group myResourceGroup \
  --settings \
    AZURE_OPENAI_ENDPOINT="https://your-resource-name.openai.azure.com/" \
    AZURE_OPENAI_API_KEY="your-api-key-here" \
    OPENAI_API_VERSION="2024-10-21"
```

### Deploy to Azure

**Important:** This project requires remote build to install Node.js dependencies on Azure.

1. Update the `deploy` script in `package.json` with your function app name:

```json
"deploy": "func azure functionapp publish <YOUR_FUNCTION_APP_NAME> --build remote"
```

2. Build the project locally:

```bash
npm run build
```

3. Deploy with remote build (this installs dependencies on Azure):

```bash
npm run deploy
```

The `--build remote` flag tells Azure to:
- Install all npm dependencies from `package.json`
- Run the `postinstall` script which builds the TypeScript
- Set up the function app correctly

After deployment, you'll see output like:

```
Functions in myFunctionAppName:
    storyGenerator - [httpTrigger]
        Invoke url: https://myfunctionappname.azurewebsites.net/api/generate
```

**Note:** The first deployment with remote build may take 3-5 minutes as Azure installs all dependencies.

### Test the Deployed Function

```bash
curl -X POST https://myfunctionappname.azurewebsites.net/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "a robot learning to feel emotions",
    "style": "sci-fi",
    "length": "medium"
  }'
```

## Project Structure

```
.
├── src/
│   └── index.ts          # Main Azure Function handler with Genkit flow
├── dist/                 # Compiled JavaScript (generated by TypeScript)
├── host.json             # Azure Functions host configuration
├── local.settings.json   # Local config
├── .env                  # Environment variables
├── .funcignore           # Files to exclude from deployment
├── .deployment           # Azure deployment configuration
├── tsconfig.json         # TypeScript configuration
├── package.json          # Dependencies and scripts
└── README.md             # This file
```

## Configuration

### Switching Azure OpenAI Models

Edit `src/index.ts` to use different Azure OpenAI models:

```typescript
import { azureOpenAI, gpt4o, gpt35Turbo } from 'genkitx-azure-openai';

const ai = genkit({
  plugins: [azureOpenAI()],
  model: gpt35Turbo, // Change model here
});
```

### Adjusting Function Resources

Edit the Function App settings in Azure Portal or using Azure CLI to change memory and timeout:

```bash
az functionapp config appsettings set --name myFunctionAppName --resource-group myResourceGroup \
  --settings FUNCTIONS_WORKER_PROCESS_COUNT=1
```

## Available Scripts

- `npm run build` - Compile TypeScript to JavaScript
- `npm start` - Run the Genkit flow standalone
- `npm run genkit:ui` - Start Genkit Developer UI
- `npm run func:start` - Start local Azure Functions runtime (requires `local.settings.json`)
- `npm run deploy` - Deploy to Azure with remote build
- `npm run deploy` - Deploy to Azure (update with your function app name)

## Troubleshooting

### "Authentication Failed" Error

Ensure your Azure OpenAI credentials are correctly set:
- Check `AZURE_OPENAI_ENDPOINT` is correct
- Verify `AZURE_OPENAI_API_KEY` is valid
- Confirm `OPENAI_API_VERSION` matches your deployment

### TypeScript Errors

Run `npm install` to ensure all dependencies are installed, including type definitions.

### Function Not Starting Locally

Make sure you have:
- Installed Azure Functions Core Tools v4
- Created `.env` file with required environment variables
- Built the TypeScript code with `npm run build`

### Deployment Issues

**"Skipping build" error in Azure logs:**
- Make sure you're using `--build remote` flag in the deploy command
- Check `.funcignore` doesn't exclude TypeScript files
- Verify `.deployment` file exists with build configuration

**"Not enough space on disk" during deployment:**
- Ensure `.funcignore` excludes `node_modules` directory
- The deployment package should be ~67KB, not 600MB+
- Azure will install dependencies via remote build

**Function not showing in Azure:**
- Wait 3-5 minutes after deployment for remote build to complete
- Check Azure Portal → Deployment Center for build logs
- Verify environment variables are set in Application Settings

## Using Azure Managed Identity (Optional)

For production, you can use Azure Managed Identity instead of API keys:

1. Enable Managed Identity on your Function App
2. Grant access to Azure OpenAI
3. Update `src/index.ts`:

```typescript
import { DefaultAzureCredential, getBearerTokenProvider } from '@azure/identity';

const credential = new DefaultAzureCredential();
const scope = 'https://cognitiveservices.azure.com/.default';
const azureADTokenProvider = getBearerTokenProvider(credential, scope);

const ai = genkit({
  plugins: [
    azureOpenAI({
      azureADTokenProvider,
      endpoint: process.env.AZURE_OPENAI_ENDPOINT!,
      apiVersion: process.env.OPENAI_API_VERSION!,
    }),
  ],
  model: gpt4o,
});
```

## Learn More

- [Firebase Genkit Documentation](https://genkit.dev/docs/)
- [Azure OpenAI Plugin](https://github.com/BloomLabsInc/genkit-plugins/tree/main/plugins/azure-openai)
- [Azure Functions Documentation](https://docs.microsoft.com/azure/azure-functions/)
- [Azure OpenAI Service](https://azure.microsoft.com/services/cognitive-services/openai-service/)

## License

Apache-2.0
