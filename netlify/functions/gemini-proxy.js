// netlify/functions/generateContent.js

const { GoogleGenAI } = require("@google/genai");

// Retrieve API key securely from environment variables
const apiKey = process.env.GEMINI_API_KEY; 

// Initialize the GoogleGenAI client
// Note: This library handles the HTTP requests and model integration
if (!apiKey) {
    console.error("GEMINI_API_KEY is not set in Netlify environment variables.");
}
const ai = new GoogleGenAI(apiKey);

// Helper function for delayed retry
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

exports.handler = async (event) => {
    // 1. Basic Security Check (optional but recommended)
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: JSON.stringify({ message: "Method Not Allowed" }) };
    }

    if (!apiKey) {
        return { statusCode: 500, body: JSON.stringify({ message: "Server configuration error: API Key missing." }) };
    }

    let payload;
    try {
        payload = JSON.parse(event.body);
    } catch (e) {
        return { statusCode: 400, body: JSON.stringify({ message: "Invalid JSON format in request body." }) };
    }

    const { contents, model } = payload;

    if (!contents || !model) {
        return { statusCode: 400, body: JSON.stringify({ message: "Missing 'contents' or 'model' in payload." }) };
    }

    let responseText = null;
    let retryCount = 0;
    const maxRetries = 3;
    let delay = 1000; // Start delay at 1 second

    // 2. Robust Retry Loop with Exponential Backoff (for mitigation)
    while (retryCount < maxRetries) {
        try {
            console.log(`Attempt ${retryCount + 1}: Calling Gemini API with model ${model}`);
            
            const response = await ai.models.generateContent({
                model: model,
                contents: contents
            });

            // 3. Success check and response extraction
            if (response.candidates && response.candidates.length > 0 &&
                response.candidates[0].content && response.candidates[0].content.parts &&
                response.candidates[0].content.parts.length > 0) {
                
                responseText = response.candidates[0].content.parts[0].text;
                break; // Success, exit the loop
            } else {
                // Handle cases where the API returns an empty response (safety check)
                throw new Error("API returned empty content or no candidates.");
            }

        } catch (error) {
            retryCount++;
            
            // Log the error details
            console.error(`Gemini API Error on attempt ${retryCount}:`, error.message);
            
            // Check for specific retry-worthy errors (Rate Limit/Server Errors)
            const isRetryable = error.message.includes('429') || 
                                 error.message.includes('500') ||
                                 error.message.includes('503');

            if (isRetryable && retryCount < maxRetries) {
                console.warn(`Retryable error detected. Waiting ${delay / 1000}s...`);
                await sleep(delay);
                delay *= 2; // Exponential backoff
            } else {
                // Non-retryable error (like a 400 Bad Request, or max retries reached)
                const errorMessage = `Failed to get a response after ${retryCount} attempts. Error: ${error.message}`;
                return {
                    statusCode: 500,
                    body: JSON.stringify({ message: errorMessage }),
                };
            }
        }
    }

    if (responseText) {
        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: responseText }),
        };
    } else {
        return {
            statusCode: 500,
            body: JSON.stringify({ message: "AI response processing failed after all retries." }),
        };
    }
};
