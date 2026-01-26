const { GoogleGenerativeAI } = require('@google/generative-ai');
const { GoogleAIFileManager } = require('@google/generative-ai/server');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');

let geminiClients = null;
let geminiClientIndex = 0;

function getGeminiClients() {
  if (geminiClients) return geminiClients;

  const keysEnv = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '';
  const keys = keysEnv.split(',').map(k => k.trim()).filter(Boolean);

  geminiClients = keys.map((key) => ({
    key,
    genAI: new GoogleGenerativeAI(key),
    fileManager: new GoogleAIFileManager(key),
  }));

  return geminiClients;
}

function isRetryableError(error) {
  const message = `${error?.message || ''}`;
  const status = error?.status || error?.response?.status;

  // Retry on rate limit (429), overload (503), or temporary errors (500, 502, 504)
  return status === 429 ||
    status === 503 ||
    status === 500 ||
    status === 502 ||
    status === 504 ||
    message.includes('429') ||
    message.includes('503') ||
    message.includes('Too Many Requests') ||
    message.includes('overloaded') ||
    message.includes('Service Unavailable');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function withGeminiClient(fn, maxRetries = 3) {
  const clients = getGeminiClients();
  if (!clients.length) {
    throw new Error('No Gemini API keys configured');
  }

  let lastError;

  for (let retry = 0; retry < maxRetries; retry++) {
    for (let i = 0; i < clients.length; i++) {
      const index = geminiClientIndex % clients.length;
      geminiClientIndex = (geminiClientIndex + 1) % clients.length;
      const client = clients[index];

      try {
        const result = await fn(client);
        return result;
      } catch (error) {
        lastError = error;
        console.log(`Gemini API error (attempt ${retry + 1}/${maxRetries}):`, error.message);

        if (isRetryableError(error)) {
          // Exponential backoff: 2s, 4s, 8s
          const delay = Math.pow(2, retry + 1) * 1000;
          console.log(`Retryable error, waiting ${delay}ms before retry...`);
          await sleep(delay);
          break; // Break inner loop to retry with same or next client
        }

        // Non-retryable error, throw immediately
        throw error;
      }
    }
  }

  throw lastError || new Error('All Gemini API attempts failed');
}

/**
 * Extract text from a PDF file URL
 */
async function extractTextFromPDF(fileUrl) {
  let tempFilePath = null;

  try {
    console.log('Extracting text from PDF:', fileUrl);

    // Download the PDF
    const response = await axios.get(fileUrl, {
      responseType: 'arraybuffer',
      timeout: 30000,
    });

    const pdfBuffer = Buffer.from(response.data);

    // Save to temp file
    tempFilePath = path.join(os.tmpdir(), `project-${Date.now()}.pdf`);
    fs.writeFileSync(tempFilePath, pdfBuffer);

    // Use pdf-parse to extract text
    const pdfParse = require('pdf-parse');
    const data = await pdfParse(pdfBuffer);

    // Clean up temp file
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }

    console.log('Extracted text length:', data.text.length);
    return data.text;

  } catch (error) {
    console.error('PDF extraction error:', error.message);

    // Clean up on error
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try { fs.unlinkSync(tempFilePath); } catch (e) {}
    }

    throw new Error('Failed to extract text from PDF: ' + error.message);
  }
}

/**
 * Extract text from a Word document URL
 */
async function extractTextFromWord(fileUrl) {
  try {
    console.log('Extracting text from Word document:', fileUrl);

    // Download the document
    const response = await axios.get(fileUrl, {
      responseType: 'arraybuffer',
      timeout: 30000,
    });

    const docBuffer = Buffer.from(response.data);

    // Use mammoth to extract text
    const mammoth = require('mammoth');
    const result = await mammoth.extractRawText({ buffer: docBuffer });

    console.log('Extracted text length:', result.value.length);
    return result.value;

  } catch (error) {
    console.error('Word extraction error:', error.message);
    throw new Error('Failed to extract text from Word document: ' + error.message);
  }
}

/**
 * Extract text based on file type
 */
async function extractText(fileUrl, fileType) {
  if (fileType === 'pdf') {
    return await extractTextFromPDF(fileUrl);
  } else if (fileType === 'doc' || fileType === 'docx') {
    return await extractTextFromWord(fileUrl);
  } else {
    throw new Error('Unsupported file type: ' + fileType);
  }
}

/**
 * Check content for AI-generated patterns using Gemini
 */
async function checkAIContent(text) {
  try {
    console.log('Checking for AI-generated content...');

    // Truncate text if too long (Gemini has token limits)
    const maxLength = 30000;
    const truncatedText = text.length > maxLength ? text.substring(0, maxLength) : text;

    const prompt = `You are an expert AI content detector. Analyze the following text for indicators that it may have been generated by AI (like ChatGPT, Claude, Gemini, etc.).

**Analyze for these specific indicators:**

1. **Sentence Structure Uniformity**: AI tends to produce sentences of similar length and structure
2. **Vocabulary Patterns**: Overuse of certain transition words, formal academic phrases
3. **Lack of Personal Voice**: Absence of personal anecdotes, opinions, or unique perspectives
4. **Overly Polished Writing**: Perfect grammar, no colloquialisms, unnaturally smooth flow
5. **Generic Phrasing**: Use of broad, safe statements without specific details
6. **Repetitive Patterns**: Similar sentence starters, repeated transitional phrases
7. **Lack of Errors**: Human writing typically has minor inconsistencies
8. **Unusual Coherence**: Perfectly structured arguments without natural tangents

**Text to analyze:**
${truncatedText}

**Return your analysis in this exact JSON format:**
{
  "isAiGenerated": boolean (true if likely AI-generated, false if likely human-written),
  "confidence": number (0-100, how confident you are in your assessment),
  "aiScore": number (0-100, percentage likelihood of AI generation),
  "indicators": [
    "Specific indicator found in the text"
  ],
  "details": "Detailed explanation of your analysis, including specific examples from the text that support your conclusion"
}

Be thorough but fair - not all well-written content is AI-generated. Look for the combination of multiple indicators.`;

    const result = await withGeminiClient(async ({ genAI }) => {
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
      return await model.generateContent(prompt);
    });
    const responseText = result.response.text();

    // Parse the JSON response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const aiAnalysis = JSON.parse(jsonMatch[0]);
      console.log('AI detection complete. Score:', aiAnalysis.aiScore);
      return aiAnalysis;
    }

    // Fallback if JSON parsing fails
    return {
      isAiGenerated: false,
      confidence: 50,
      aiScore: 50,
      indicators: ['Analysis inconclusive'],
      details: responseText,
    };

  } catch (error) {
    console.error('AI content check error:', error.message);
    return {
      isAiGenerated: false,
      confidence: 0,
      aiScore: 0,
      indicators: ['Error during analysis'],
      details: 'Could not complete AI detection: ' + error.message,
    };
  }
}

/**
 * Search web for matching content
 * Uses Gemini to find potential plagiarism sources
 */
async function searchWebForMatches(text) {
  try {
    console.log('Searching for web matches...');

    // Extract key phrases for searching
    const maxLength = 20000;
    const truncatedText = text.length > maxLength ? text.substring(0, maxLength) : text;

    const prompt = `You are a plagiarism detection expert. Analyze the following text and identify any content that appears to be copied or heavily borrowed from common sources.

**Tasks:**
1. Identify any passages that appear to be directly copied from well-known sources (Wikipedia, academic papers, textbooks, websites)
2. Look for content that matches common educational resources
3. Identify any highly generic passages that are likely found in multiple sources
4. Check for inconsistencies in writing style that might indicate copied sections

**Text to analyze:**
${truncatedText}

**Return your analysis in this exact JSON format (up to 5 matches):**
{
  "webMatchScore": number (0-100, overall percentage of content that appears to be from external sources),
  "matches": [
    {
      "matchedText": "The exact or paraphrased text that appears copied (first 200 characters)",
      "sourceUrl": "https://likely-source.com or 'Common academic source' or 'Wikipedia-style content'",
      "sourceTitle": "Name or description of the likely source",
      "matchPercentage": number (0-100, how closely this matches the suspected source),
      "matchType": "exact" or "paraphrase" or "similar"
    }
  ],
  "analysis": "Brief explanation of findings"
}

Be thorough but balanced - flag passages that read like copied or heavily paraphrased source text without over-penalizing common knowledge.

If the content appears to be mostly original, return a low webMatchScore and empty matches array.`;

    const result = await withGeminiClient(async ({ genAI }) => {
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
      return await model.generateContent(prompt);
    });
    const responseText = result.response.text();

    // Parse the JSON response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const webAnalysis = JSON.parse(jsonMatch[0]);
      console.log('Web match detection complete. Score:', webAnalysis.webMatchScore);
      return webAnalysis;
    }

    // Fallback
    return {
      webMatchScore: 0,
      matches: [],
      analysis: 'Unable to parse web match results',
    };

  } catch (error) {
    console.error('Web match search error:', error.message);
    return {
      webMatchScore: 0,
      matches: [],
      analysis: 'Error searching for web matches: ' + error.message,
    };
  }
}

/**
 * Calculate overall plagiarism score
 */
function calculatePlagiarismScore(aiResult, webResult) {
  // Overall originality = 100 - (weighted average of AI score and web match score)
  // AI detection weight: 42%
  // Web match weight: 58% (slightly stricter than before)

  const aiScore = aiResult.aiScore || 0;
  const webScore = webResult.webMatchScore || 0;

  // Calculate plagiarism percentage
  const basePercentage = (aiScore * 0.42) + (webScore * 0.58);
  const strictnessBump = (aiScore > 40 || webScore > 40) ? 2 : 0;
  const plagiarismPercentage = Math.min(100, basePercentage + strictnessBump);

  // Originality score is inverse of plagiarism
  const overallScore = Math.max(0, Math.min(100, 100 - plagiarismPercentage));

  return Math.round(overallScore);
}

/**
 * Generate improvement suggestions based on results
 */
function generateSuggestions(aiResult, webResult, overallScore) {
  const suggestions = [];

  // AI-related suggestions
  if (aiResult.aiScore > 70) {
    suggestions.push('Your writing shows strong indicators of AI generation. Consider rewriting in your own words and adding personal insights.');
    suggestions.push('Include specific examples from your own experience or research to make the content more authentic.');
    suggestions.push('Vary your sentence structure and length to create a more natural writing flow.');
  } else if (aiResult.aiScore > 40) {
    suggestions.push('Some sections of your work may appear AI-generated. Review and personalize these areas.');
    suggestions.push('Add more personal voice and unique perspectives to strengthen originality.');
  }

  // Web match suggestions
  if (webResult.webMatchScore > 50) {
    suggestions.push('Significant portions of your text match existing online sources. Paraphrase these sections and add proper citations.');
    suggestions.push('Use quotation marks for direct quotes and include proper references.');
  } else if (webResult.webMatchScore > 20) {
    suggestions.push('Some content matches online sources. Ensure all borrowed ideas are properly cited.');
  }

  // Specific match suggestions
  if (webResult.matches && webResult.matches.length > 0) {
    suggestions.push(`Found ${webResult.matches.length} potential source match(es). Review these sections and add citations or rewrite.`);
  }

  // General suggestions based on overall score
  if (overallScore >= 80) {
    suggestions.push('Great job! Your work appears to be mostly original. Continue to cite any sources used.');
  } else if (overallScore >= 60) {
    suggestions.push('Your work has moderate originality. Focus on the highlighted areas to improve.');
  } else if (overallScore < 60) {
    suggestions.push('Your work needs significant revision. Consider rewriting major portions in your own words.');
    suggestions.push('Review academic integrity guidelines and ensure proper citation practices.');
  }

  return suggestions;
}

/**
 * Run complete plagiarism check
 */
async function runPlagiarismCheck(fileUrl, fileType) {
  try {
    console.log('Starting plagiarism check...');
    console.log('File URL:', fileUrl);
    console.log('File Type:', fileType);

    // Step 1: Extract text from document
    const extractedText = await extractText(fileUrl, fileType);
    const wordCount = extractedText.split(/\s+/).filter(word => word.length > 0).length;

    console.log('Word count:', wordCount);

    if (wordCount < 50) {
      throw new Error('Document is too short. Please submit a document with at least 50 words.');
    }

    // Step 2: Check for AI-generated content
    const aiResult = await checkAIContent(extractedText);

    // Step 3: Search for web matches
    const webResult = await searchWebForMatches(extractedText);

    // Step 4: Calculate overall score
    const overallScore = calculatePlagiarismScore(aiResult, webResult);

    // Step 5: Generate suggestions
    const suggestions = generateSuggestions(aiResult, webResult, overallScore);

    // Compile results
    const report = {
      overallScore,
      aiScore: aiResult.aiScore || 0,
      webMatchScore: webResult.webMatchScore || 0,

      aiAnalysis: {
        isAiGenerated: aiResult.isAiGenerated || false,
        confidence: aiResult.confidence || 0,
        indicators: aiResult.indicators || [],
        details: aiResult.details || '',
      },

      webMatches: (webResult.matches || []).map(match => ({
        matchedText: match.matchedText || '',
        sourceUrl: match.sourceUrl || '',
        sourceTitle: match.sourceTitle || 'Unknown Source',
        matchPercentage: match.matchPercentage || 0,
        matchType: match.matchType || 'similar',
      })),

      suggestions,
      checkedAt: new Date(),
    };

    console.log('Plagiarism check complete. Overall score:', overallScore);

    return {
      success: true,
      report,
      wordCount,
      extractedText,
    };

  } catch (error) {
    console.error('Plagiarism check error:', error.message);
    throw error;
  }
}

module.exports = {
  extractText,
  extractTextFromPDF,
  extractTextFromWord,
  checkAIContent,
  searchWebForMatches,
  calculatePlagiarismScore,
  generateSuggestions,
  runPlagiarismCheck,
};
