import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn('Warning: GEMINI_API_KEY not set. AI features will not work.');
}

const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

export async function processContractFile(fileContent) {
  if (!genAI) {
    throw new Error('Gemini API key not configured. Please set GEMINI_API_KEY environment variable.');
  }
  
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });

    // Extract clauses
    const clausePrompt = `Extract all clauses from this contract and format them as a JSON array. Each clause should have:
- title: A brief title for the clause
- content: The full text of the clause
- category: The type of clause (e.g., "Payment", "Termination", "Confidentiality", "Liability", etc.)

Contract text:
${fileContent}

Return ONLY valid JSON array format, no markdown or extra text.`;

    const clauseResult = await model.generateContent(clausePrompt);
    const clauseResponse = clauseResult.response;
    const clauseText = clauseResponse.text();
    
    // Extract JSON from response
    const jsonMatch = clauseText.match(/\[[\s\S]*\]/);
    const clauses = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

    // Extract deadlines
    const deadlinePrompt = `Extract all deadlines, dates, and time-sensitive items from this contract. Format as JSON array with:
- description: What the deadline is for
- date: The deadline date (format: YYYY-MM-DD if available, otherwise "TBD" or description)
- clause_reference: Which clause this deadline relates to

Contract text:
${fileContent}

Return ONLY valid JSON array format, no markdown or extra text.`;

    const deadlineResult = await model.generateContent(deadlinePrompt);
    const deadlineResponse = deadlineResult.response;
    const deadlineText = deadlineResponse.text();
    
    const deadlineJsonMatch = deadlineText.match(/\[[\s\S]*\]/);
    const deadlines = deadlineJsonMatch ? JSON.parse(deadlineJsonMatch[0]) : [];

    return {
      clauses,
      deadlines
    };
  } catch (error) {
    console.error('Error processing contract with AI:', error);
    throw error;
  }
}

export async function chatWithContract(question, contractContent, chatHistory = []) {
  if (!genAI) {
    throw new Error('Gemini API key not configured. Please set GEMINI_API_KEY environment variable.');
  }
  
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });

    let context = `Contract Content:\n${contractContent}\n\n`;
    
    if (chatHistory.length > 0) {
      context += 'Previous conversation:\n';
      chatHistory.forEach(msg => {
        context += `${msg.role}: ${msg.content}\n`;
      });
      context += '\n';
    }

    const prompt = `${context}User Question: ${question}\n\nAnswer the question based on the contract content above. Be concise and accurate.`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    return response.text();
  } catch (error) {
    console.error('Error in chat:', error);
    throw error;
  }
}

