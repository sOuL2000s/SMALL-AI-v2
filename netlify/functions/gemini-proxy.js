// This function runs on the server (Netlify's AWS Lambda)

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { contents, selectedModel, personalityName } = JSON.parse(event.body);

        if (!GEMINI_API_KEY) {
            return { statusCode: 500, body: JSON.stringify({ error: 'API Key is missing on the server.' }) };
        }
        
        // Construct the full URL using the model passed from the client
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${GEMINI_API_KEY}`;

        // The client-side logic already handles prepending the personality/custom prompt
        // so we just pass the contents array directly.
        const payload = {
            contents: contents
        };

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (!response.ok) {
             console.error('Gemini API Error:', result);
             return {
                statusCode: response.status,
                body: JSON.stringify({ error: result.error?.message || 'Gemini API call failed' })
            };
        }
        
        // Safely extract and return the generated text
        const responseText = result.candidates?.[0]?.content?.parts?.[0]?.text;

        if (responseText) {
            return {
                statusCode: 200,
                body: JSON.stringify({ responseText })
            };
        } else {
            return {
                statusCode: 500,
                body: JSON.stringify({ error: 'Failed to extract response text from Gemini.' })
            };
        }

    } catch (error) {
        console.error('Serverless Function Error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Internal Server Error during processing: ' + error.message })
        };
    }
};