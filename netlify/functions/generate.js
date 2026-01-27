// netlify/generate.js (Using Native Fetch)

// REMOVED: const fetch = require('node-fetch'); 
const GEMINI_MODEL = "gemini-2.5-flash-preview-09-2025";

// Main handler for the serverless function
exports.handler = async (event, context) => {
    // 1. Check for API Key
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    if (!GEMINI_API_KEY) {
        // Log the environment error for Netlify logs
        console.error("GEMINI_API_KEY environment variable is missing."); 
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Server configuration error: API key not found." }),
        };
    }

    // 2. Ensure request is POST and has a body
    if (event.httpMethod !== 'POST' || !event.body) {
        return {
            statusCode: 405,
            body: "Method Not Allowed or Missing Body",
        };
    }

    try {
        // --- 3. Dynamic Key Selection Logic ---
        const { keySelection, customKey, model } = event.queryStringParameters;
        
        let finalApiKey = GEMINI_API_KEY; // Fallback to the hardcoded default key (e.g., from Netlify's GEMINI_API_KEY env)
        let selectedKeyName = "DEFAULT_FALLBACK"; // For logging/debugging

        // 1. Prioritize Custom Key if selected and provided
        if (keySelection === 'Custom' && customKey && customKey.length > 10) {
            finalApiKey = customKey;
            selectedKeyName = "CUSTOM_USER_KEY";
        } 
        // 2. Use the selected numbered API Key if available
        else if (keySelection && keySelection.startsWith('API_KEY_')) {
            const keyFromEnv = process.env[keySelection];
            if (keyFromEnv) {
                finalApiKey = keyFromEnv;
                selectedKeyName = keySelection;
            } else {
                // Log if the selected key is missing from environment variables
                console.warn(`Environment variable ${keySelection} is missing. Falling back to default.`);
            }
        }

        // Check if a usable model was passed, otherwise use the server default
        const modelToUse = model || GEMINI_MODEL;
        
        if (!finalApiKey || finalApiKey === "YOUR_GEMINI_API_KEY") {
             // If after all logic, the key is still missing/placeholder, throw error
             throw new Error("No valid API Key found after checking all sources (Custom, Env Pool, Fallback).");
        }

        // Log the successful key being used (do NOT log the key itself)
        console.log(`Using AI Model: ${modelToUse} | API Source: ${selectedKeyName}`);

        // Construct the final Google API URL with the chosen key and model
        const API_BASE_URL = `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${finalApiKey}`;

        // 4. Forward the request to the Gemini API using native fetch
        const response = await fetch(API_BASE_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: event.body, // Pass the raw JSON string received from the client
        });

        // 4. Handle API failure states
        const data = await response.json();

        if (!response.ok) {
            // Log the specific Google API error
            console.error("External API Error:", response.status, data.error?.message);
            
            return {
                statusCode: response.status,
                headers: { "Content-Type": "application/json" },
                // Return the error message from Google's API to the client
                body: JSON.stringify({ error: data.error?.message || `Google API returned status ${response.status}` }),
            };
        }

        // 5. Send the successful response back to the client
        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        };

    } catch (error) {
        // Log the specific error that caused the 500
        console.error('Function Proxy Fatal Error:', error.message, error.stack); 
        return {
            statusCode: 500,
            body: JSON.stringify({ error: `Internal Server Error: Failed to execute function. Check Netlify logs.` }),
        };
    }
};