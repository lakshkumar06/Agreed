# AI Layer Setup

## Features Implemented

1. **Contract File Processing**: Upload a TXT file when creating a contract
2. **AI Clause Extraction**: Automatically extracts and organizes contract clauses
3. **Deadline Extraction**: Extracts and displays all deadlines from the contract
4. **RAG Chatbot**: Ask questions about the contract using AI

## Setup Instructions

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Get Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Create a new API key
3. Copy the API key

### 3. Set Environment Variable

Create a `.env` file in the `backend` directory:

```bash
GEMINI_API_KEY=your_api_key_here
```

Or set it when running the server:

```bash
GEMINI_API_KEY=your_api_key_here npm start
```

### 4. Run the Server

```bash
cd backend
npm start
```

## Usage

1. **Create Contract with File**:
   - Click "New Contract"
   - Fill in title and description
   - Upload a TXT file containing the contract text
   - The AI will automatically process the file

2. **View Deadlines**:
   - Open any contract
   - Click on the "Deadlines" tab
   - See all extracted deadlines

3. **Chat with Contract**:
   - Open any contract
   - Click on the "AI Chat" tab
   - Ask questions about the contract
   - The AI will answer based on the contract content

## API Endpoints

- `POST /api/contracts/:id/process` - Process contract file with AI
- `GET /api/contracts/:id/clauses` - Get contract clauses
- `GET /api/contracts/:id/deadlines` - Get contract deadlines
- `POST /api/contracts/:id/chat` - Send message to chatbot
- `GET /api/contracts/:id/chat` - Get chat history

