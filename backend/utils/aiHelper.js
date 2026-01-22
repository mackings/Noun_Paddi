const { GoogleGenerativeAI } = require('@google/generative-ai');
const { GoogleAIFileManager } = require('@google/generative-ai/server');
// const Groq = require('groq-sdk'); // Commented out - using Gemini Tier 1 instead
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');
const APIUsage = require('../models/APIUsage');
const { cloudinary } = require('../config/cloudinary');
const { extractTextFromPDF, extractTextFromBuffer } = require('./pdfHelper');

// ============================================
// GROQ CLIENT SETUP - COMMENTED OUT
// Using Gemini 2.5 Flash on Tier 1 instead (better rate limits: 300 RPM, 2M TPM)
// ============================================
// let groqClient = null;
//
// function getGroqClient() {
//   if (groqClient) return groqClient;
//   const apiKey = process.env.GROQ_API_KEY;
//   if (!apiKey) {
//     console.log('GROQ_API_KEY not configured, will use Gemini');
//     return null;
//   }
//   groqClient = new Groq({ apiKey });
//   return groqClient;
// }

function isGroqAvailable() {
  // Always return false to use Gemini instead
  return false;
}

// function getGroqModel() {
//   return 'llama-3.3-70b-versatile';
// }

// ============================================
// GEMINI CLIENT SETUP (Primary - Tier 1)
// Tier 1 limits: 300 RPM, 2M TPM, 1500 RPD
// ============================================
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

// Get a specific client by index (for parallel operations)
function getClientByIndex(index) {
  const clients = getGeminiClients();
  if (!clients.length) {
    throw new Error('No Gemini API keys configured');
  }
  return clients[index % clients.length];
}

// Get total number of available API keys (Gemini)
function getClientCount() {
  return getGeminiClients().length;
}

// Download PDF once and cache the buffer for reuse
async function downloadPDFBuffer(pdfUrl) {
  const signedUrl = getCloudinarySignedUrl(pdfUrl);
  console.log('Downloading PDF from:', signedUrl);
  const response = await axios.get(signedUrl, { responseType: 'arraybuffer' });
  const buffer = Buffer.from(response.data);
  console.log('PDF downloaded, size:', buffer.length, 'bytes');
  return buffer;
}

function isRateLimitError(error) {
  const message = `${error?.message || ''}`;
  return error?.status === 429 ||
    error?.response?.status === 429 ||
    message.includes('429') ||
    message.includes('Too Many Requests');
}

function isOverloadedError(error) {
  const message = `${error?.message || ''}`;
  return error?.status === 503 ||
    error?.response?.status === 503 ||
    message.includes('503') ||
    message.toLowerCase().includes('overloaded');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withGeminiClient(fn) {
  const clients = getGeminiClients();
  if (!clients.length) {
    throw new Error('No Gemini API keys configured');
  }

  let lastError;
  const maxAttemptsPerKey = 2;
  for (let i = 0; i < clients.length; i++) {
    const index = geminiClientIndex % clients.length;
    geminiClientIndex = (geminiClientIndex + 1) % clients.length;
    const client = clients[index];

    for (let attempt = 0; attempt < maxAttemptsPerKey; attempt++) {
      try {
        const result = await fn(client);
        return result;
      } catch (error) {
        lastError = error;
        const retryable = isRateLimitError(error) || isOverloadedError(error);
        const shouldRotate = (isRateLimitError(error) || isOverloadedError(error)) && clients.length > 1;
        if (!retryable) {
          throw error;
        }
        const backoffMs = 500 * Math.pow(2, attempt) + Math.floor(Math.random() * 250);
        await sleep(backoffMs);
        if (shouldRotate) {
          break;
        }
      }
    }
  }

  throw lastError || new Error('All Gemini API keys failed');
}

// Helper function to track API usage
async function trackAPIUsage(operationType, result, materialId = null, userId = null, success = true, errorMessage = null) {
  try {
    const usageMetadata = result?.response?.usageMetadata || {};

    await APIUsage.create({
      operationType,
      model: 'gemini-2.5-flash',
      materialId,
      userId,
      inputTokens: usageMetadata.promptTokenCount || 0,
      outputTokens: usageMetadata.candidatesTokenCount || 0,
      totalTokens: usageMetadata.totalTokenCount || 0,
      success,
      errorMessage,
    });
  } catch (error) {
    console.error('Error tracking API usage:', error.message);
    // Don't throw - tracking shouldn't break the main flow
  }
}

async function summarizeText(text, pdfUrl = null, materialId = null, userId = null) {
  try {
    console.log('Starting text summarization with Gemini...');

    // If we have a PDF URL, extract text and summarize directly for speed
    if (pdfUrl) {
      try {
        const signedUrl = getCloudinarySignedUrl(pdfUrl);
        const extractedText = await extractTextFromPDF(signedUrl);
        text = extractedText;
      } catch (error) {
        console.error('PDF text extraction failed, falling back to File API:', error.message);
        return await summarizePDFDirectly(pdfUrl, materialId, userId);
      }
    }

    console.log('Original text length:', text.length);

    // Clean and prepare text
    let cleanedText = text
      .replace(/\s+/g, ' ')
      .trim();

    console.log('Cleaned text length:', cleanedText.length);

    // Ensure we have enough text to summarize
    if (cleanedText.length < 200) {
      throw new Error('Text is too short to summarize. Need at least 200 characters.');
    }

    // Trim very long inputs by 15% to reduce latency while keeping more detail
    if (cleanedText.length > 0) {
      const trimmedLength = Math.floor(cleanedText.length * 0.85);
      if (trimmedLength < cleanedText.length) {
        console.log(`Trimming summary input from ${cleanedText.length} to ${trimmedLength} characters`);
        cleanedText = cleanedText.substring(0, trimmedLength);
      }
    }

    // Gemini 1.5 Flash can handle very long texts (up to 1M tokens)
    // No need to chunk - let it process the full document
    console.log(`Processing ${cleanedText.length} characters...`);

    // Create a detailed prompt for educational content
    const prompt = `You are an expert educational content summarizer. Please provide a comprehensive, well-formatted summary of the following course material. The summary should be longer and more explanatory, breaking down complex ideas into simpler meanings.

**CRITICAL FORMATTING REQUIREMENTS:**

1. **Module Headers:** Format as **Module X: Module Title** (bold, with "Module" capitalized)
2. **Unit Headers:** Format as **Unit X: Unit Title** (bold, with "Unit" capitalized)
3. **Section Headers:** Use ### for main sections within units
4. **Key Terms:** Bold important terms like **Coaxial Cable:**, **LAN:**, **TCP/IP:**, etc.

**Content Structure:**
- Start each module/unit with its bold header on its own line
- Follow with a brief introductory paragraph explaining the main topic
- Use bullet points (•) ONLY for lists of related items or characteristics
- Use numbered lists for steps or sequences
- Write detailed explanations in paragraph form, not as bullet points
- Indent sub-bullets properly when showing hierarchical information
- After complex concepts, add a short plain-language explanation sentence

**Bullet Point Usage:**
- Use bullets for listing types, components, or characteristics
- Format: **Term Name:** Description with details
- Example:
  **Types of Network Cables:**
  • **Twisted Pair Cable:** Used in telephone networks and LANs. Consists of pairs of insulated copper wires twisted together. Speeds of 10 Mbps to 1 Gbps.
  • **Coaxial Cable:** Used for cable TV and LANs. Consists of copper wire with insulating layer and conductive shield. Speeds from 200-500 Mbps.

- For sub-categories, indent properly:
  **Wireless Technologies:**
  • **Terrestrial Microwave:** Uses Earth-based transmitters for line-of-sight communication
  • **Cellular Systems:** Uses radio communication divided into geographic cells
    - Low-power transmitters in each cell
    - Seamless handoff between cells

**Paragraph Usage:**
- Use paragraphs for explanations, descriptions, and concepts
- Example: "A Local Area Network (LAN) connects computers in a limited geographical area such as a home, school, or office building. LANs are characterized by high data transfer rates, smaller coverage range, and do not require leased telecommunication lines."

**Summary Requirements:**
1. Capture all key concepts from the material
2. Break down complex technical terms into simpler language
3. Use bold formatting for ALL module headers, unit headers, and key terms
4. Organize with clear hierarchical structure (Module → Unit → Sections)
5. Mix paragraphs (for explanations) with bullet points (for lists) appropriately
6. Ensure proper indentation for sub-bullets
7. Make it highly readable and student-friendly
8. Include short "In simple terms," explanations where helpful
9. Favor clarity over brevity; explain key ideas thoroughly

Course Material:
${cleanedText}

Please provide a well-structured, comprehensive summary with proper bold headers, effective use of paragraphs and bullet points. Make it detailed and easy to understand:`;

    const result = await withGeminiClient(async ({ genAI }) => {
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
      return await model.generateContent(prompt);
    });
    const response = result.response;
    const summary = response.text();

    console.log('Summarization successful');
    console.log('Summary length:', summary.length);

    // Track API usage
    await trackAPIUsage('summarize', result, materialId, userId, true);

    return summary;
  } catch (error) {
    console.error('Summarization error:', error);
    console.error('Error details:', error.message);

    // Track failed API usage
    await trackAPIUsage('summarize', null, materialId, userId, false, error.message);

    throw new Error(error.message || 'Failed to generate summary');
  }
}

// New function to handle PDF summarization using File API
async function summarizePDFDirectly(pdfUrl, materialId = null, userId = null) {
  let tempFilePath = null;

  try {
    console.log('Using Gemini File API for PDF summarization...');
    const signedUrl = getCloudinarySignedUrl(pdfUrl);
    console.log('Downloading PDF from:', signedUrl);

    // Download PDF to temporary file
    const response = await axios.get(signedUrl, {
      responseType: 'arraybuffer',
    });

    const pdfBuffer = Buffer.from(response.data);
    console.log('PDF downloaded, size:', pdfBuffer.length, 'bytes');

    // Save to temp file
    tempFilePath = path.join(os.tmpdir(), `material-${Date.now()}.pdf`);
    fs.writeFileSync(tempFilePath, pdfBuffer);
    console.log('Saved to temp file:', tempFilePath);

    const result = await withGeminiClient(async ({ genAI, fileManager }) => {
      // Upload to Gemini File API
      console.log('Uploading PDF to Gemini...');
      const uploadResult = await fileManager.uploadFile(tempFilePath, {
        mimeType: 'application/pdf',
        displayName: 'Study Material',
      });

      console.log('File uploaded:', uploadResult.file.uri);

      // Initialize model
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

      // Generate summary from PDF
      console.log('Generating summary from PDF...');
      return await model.generateContent([
        {
          fileData: {
            mimeType: uploadResult.file.mimeType,
            fileUri: uploadResult.file.uri
          }
        },
        {
          text: `You are an expert educational content summarizer. Please provide a comprehensive, well-formatted summary of this PDF course material.

**CRITICAL FORMATTING REQUIREMENTS:**

1. **Module Headers:** Format as **Module X: Module Title** (bold, with "Module" capitalized)
2. **Unit Headers:** Format as **Unit X: Unit Title** (bold, with "Unit" capitalized)
3. **Section Headers:** Use ### for main sections within units
4. **Key Terms:** Bold important terms like **Coaxial Cable:**, **Optical Fiber:**, **LAN:**, etc.

**Content Structure:**
- Start each module/unit with its bold header on its own line
- Follow with a brief introductory paragraph explaining the main topic
- Use bullet points (•) ONLY for lists of related items or characteristics
- Use numbered lists for steps or sequences
- Write detailed explanations in paragraph form, not as bullet points
- Indent sub-bullets properly when showing hierarchical information

**Bullet Point Usage:**
- Use bullets for listing types, components, or characteristics
- Format: **Term Name:** Description with details
- Example of GOOD bullet usage:
  **Types of Network Cables:**
  • **Twisted Pair Cable:** Used in telephone networks and LANs. Consists of pairs of insulated copper wires twisted together. Common speeds of 10 Mbps to 1 Gbps.
  • **Coaxial Cable:** Used for cable TV and LANs. Consists of copper wire with insulating layer and conductive shield. Speeds from 200-500 Mbps.
  • **Optical Fiber Cable:** Transmits light through glass fibers. Not affected by electromagnetic radiation. Speeds reach trillions of bits per second (Gbps).

- For sub-categories, indent with spaces:
  **Wireless Technologies:**
  • **Terrestrial Microwave:** Uses Earth-based transmitters for line-of-sight communication over short distances
  • **Communications Satellites:** Uses microwave radio stationed in space to relay voice, data, and TV signals
    - Positioned in geostationary orbit
    - Covers large geographic areas
  • **Cellular Systems:** Uses radio communication divided into geographic cells with low-power transmitters

**Paragraph Usage:**
- Use paragraphs for explanations, descriptions, and concepts
- Example: "A Local Area Network (LAN) connects computers in a limited geographical area such as a home, school, or office building. LANs are characterized by high data transfer rates, smaller coverage range, and do not require leased telecommunication lines. Ethernet is the most common LAN technology, supporting speeds up to 10 Gbps."

**Summary Requirements:**
1. Capture all key concepts from the entire document
2. Break down complex technical terms into simpler language
3. Use bold formatting for ALL module headers, unit headers, and key terms
4. Organize with clear hierarchical structure (Module → Unit → Sections)
5. Mix paragraphs (for explanations) with bullet points (for lists) appropriately
6. Ensure proper indentation for sub-bullets
7. Make it highly readable and student-friendly
8. Cover content from beginning, middle, and end of document

Please provide a well-structured, comprehensive summary with proper bold headers, effective use of paragraphs and bullet points:`
        },
      ]);
    });

    const summary = result.response.text();
    console.log('Summary generated successfully');
    console.log('Summary length:', summary.length);

    // Track API usage
    await trackAPIUsage('summarize', result, materialId, userId, true);

    // Clean up temp file
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
      console.log('Temp file cleaned up');
    }

    return summary;

  } catch (error) {
    console.error('PDF summarization error:', error);
    console.error('Error details:', error.message);

    // Track failed API usage
    await trackAPIUsage('summarize', null, materialId, userId, false, error.message);

    // Clean up temp file on error
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (cleanupError) {
        console.error('Error cleaning up temp file:', cleanupError);
      }
    }

    throw new Error(error.message || 'Failed to generate summary from PDF');
  }
}

async function generateQuestions(text, pdfUrl = null, materialId = null, userId = null, totalQuestions = 70, excludeQuestions = []) {
  try {
    console.log('Starting question generation with Gemini...');

    // If we have a PDF URL, extract text and generate questions directly for speed
    if (pdfUrl) {
      try {
        const signedUrl = getCloudinarySignedUrl(pdfUrl);
        const extractedText = await extractTextFromPDF(signedUrl);
        return await generateQuestions(extractedText, null, materialId, userId, totalQuestions, excludeQuestions);
      } catch (error) {
        console.error('PDF text extraction failed, falling back to File API:', error.message);
        return await generateQuestionsFromPDF(pdfUrl, materialId, userId, totalQuestions, excludeQuestions);
      }
    }

    // Clean and prepare text
    let cleanedText = text
      .replace(/\s+/g, ' ')
      .trim();

    // Use reasonable amount of text for question generation
    const maxLength = 50000;
    const truncatedText = cleanedText.length > maxLength
      ? cleanedText.substring(0, maxLength)
      : cleanedText;

    console.log('Text length for question generation:', truncatedText.length);

    const getMixCounts = (total) => {
      if (total === 70) {
        return { total, mcq: 45, tf: 15, ms: 10 };
      }
      if (total === 10) {
        return { total, mcq: 6, tf: 2, ms: 2 };
      }
      const mcq = Math.max(1, Math.round(total * 0.64));
      const tf = Math.max(1, Math.round(total * 0.21));
      let ms = total - mcq - tf;
      if (ms < 1) {
        ms = 1;
      }
      const adjustedTotal = mcq + tf + ms;
      if (adjustedTotal !== total) {
        const diff = total - adjustedTotal;
        return { total, mcq: mcq + diff, tf, ms };
      }
      return { total, mcq, tf, ms };
    };

    const counts = getMixCounts(totalQuestions);
    const excludeText = Array.isArray(excludeQuestions) && excludeQuestions.length > 0
      ? `\n\nDo NOT repeat any of these questions:\n${excludeQuestions.map((q, idx) => `${idx + 1}. ${q}`).join('\n')}\n`
      : '';

    const prompt = `Based on the following educational content, generate ${counts.total} high-quality practice questions with a mix of different question types.

**CRITICAL REQUIREMENTS - RANDOMIZATION:**
1. For multiple-choice questions: RANDOMLY distribute correct answers across ALL options (A, B, C, D)
   - Approximately 25% of correct answers should be A
   - Approximately 25% of correct answers should be B
   - Approximately 25% of correct answers should be C
   - Approximately 25% of correct answers should be D
   - DO NOT favor option C or any single option
2. For true/false questions: BALANCE the correct answers - aim for 50% True and 50% False
   - DO NOT make all or most answers True
   - Mix True and False answers evenly throughout

**Question Mix:**
1. Generate ${counts.mcq} multiple-choice questions (4 options each) - distribute correct answers evenly
2. Generate ${counts.tf} True/False questions (2 options: True, False) - balance True/False answers
3. Generate ${counts.ms} multi-select questions (4 options with 2 correct answers marked)
4. Questions should test understanding of key concepts from different parts of the material
5. Include a brief explanation for each correct answer
6. Vary difficulty levels (easy, medium, hard) - mix them throughout
7. Cover a wide range of topics from the material

**Answer Randomization Strategy:**
- When creating multiple-choice questions, deliberately vary which option is correct
- Avoid patterns like "all answers are C" or "most answers are True"
- Ensure the distribution is RANDOM and BALANCED

Return ONLY the questions. Do not add introductions or explanations outside the question blocks. Start directly with "Q1:".

Format each question as:

For Multiple Choice:
Q[number]: [Question text]
Type: multiple-choice
A) [Option A]
B) [Option B]
C) [Option C]
D) [Option D]
Correct Answer: [Letter] (Remember to vary - use A, B, C, and D equally!)
Explanation: [Brief explanation]
Difficulty: [easy/medium/hard]

For True/False:
Q[number]: [Question text]
Type: true-false
A) True
B) False
Correct Answer: [Letter] (Balance between A for True and B for False!)
Explanation: [Brief explanation]
Difficulty: [easy/medium/hard]

For Multi-Select (multiple correct answers):
Q[number]: [Question text]
Type: multi-select
A) [Option A]
B) [Option B]
C) [Option C]
D) [Option D]
Correct Answers: [Letters separated by comma, e.g., A, C]
Explanation: [Brief explanation]
Difficulty: [easy/medium/hard]

---

Educational Content:
${truncatedText}
${excludeText}

Generate ${counts.total} questions (${counts.mcq} multiple-choice, ${counts.tf} true-false, ${counts.ms} multi-select) with RANDOMIZED and BALANCED correct answers:`;
    const result = await withGeminiClient(async ({ genAI }) => {
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
      return await model.generateContent(prompt);
    });
    const response = result.response;
    const questionsText = response.text();

    console.log('Question generation successful');

    // Track API usage
    await trackAPIUsage('generate_questions', result, materialId, userId, true);

    // Return the generated text - it will be parsed by formatQuestionsToMCQ
    return { generated_text: questionsText };
  } catch (error) {
    console.error('Question generation error:', error);
    console.error('Error details:', error.message);

    // Track failed API usage
    await trackAPIUsage('generate_questions', null, materialId, userId, false, error.message);

    // Fallback to simple questions
    console.log('Falling back to simple question extraction...');
    return generateSimpleQuestions(text);
  }
}

// New function to generate questions from PDF using File API
async function generateQuestionsFromPDF(pdfUrl, materialId = null, userId = null, totalQuestions = 70, excludeQuestions = []) {
  let tempFilePath = null;

  try {
    console.log('Using Gemini File API for question generation...');
    const signedUrl = getCloudinarySignedUrl(pdfUrl);
    console.log('Downloading PDF from:', signedUrl);

    // Download PDF to temporary file
    const response = await axios.get(signedUrl, {
      responseType: 'arraybuffer',
    });

    const pdfBuffer = Buffer.from(response.data);
    tempFilePath = path.join(os.tmpdir(), `material-${Date.now()}.pdf`);
    fs.writeFileSync(tempFilePath, pdfBuffer);

    const result = await withGeminiClient(async ({ genAI, fileManager }) => {
      // Upload to Gemini File API
      console.log('Uploading PDF to Gemini...');
      const uploadResult = await fileManager.uploadFile(tempFilePath, {
        mimeType: 'application/pdf',
        displayName: 'Study Material',
      });

      console.log('File uploaded:', uploadResult.file.uri);

      // Initialize model
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

      // Generate questions from PDF
      console.log('Generating questions from PDF...');
      const counts = totalQuestions === 70
        ? { total: 70, mcq: 45, tf: 15, ms: 10 }
        : totalQuestions === 10
        ? { total: 10, mcq: 6, tf: 2, ms: 2 }
        : { total: totalQuestions, mcq: Math.max(1, Math.round(totalQuestions * 0.64)), tf: Math.max(1, Math.round(totalQuestions * 0.21)), ms: Math.max(1, totalQuestions - Math.max(1, Math.round(totalQuestions * 0.64)) - Math.max(1, Math.round(totalQuestions * 0.21))) };
      const excludeText = Array.isArray(excludeQuestions) && excludeQuestions.length > 0
        ? `\n\nDo NOT repeat any of these questions:\n${excludeQuestions.map((q, idx) => `${idx + 1}. ${q}`).join('\n')}\n`
        : '';
      return await model.generateContent([
        {
          fileData: {
            mimeType: uploadResult.file.mimeType,
            fileUri: uploadResult.file.uri
          }
        },
        {
          text: `Based on this PDF educational content, generate ${counts.total} high-quality practice questions with a mix of different question types.

**CRITICAL REQUIREMENTS - RANDOMIZATION:**
1. For multiple-choice questions: RANDOMLY distribute correct answers across ALL options (A, B, C, D)
   - Approximately 25% of correct answers should be A
   - Approximately 25% of correct answers should be B
   - Approximately 25% of correct answers should be C
   - Approximately 25% of correct answers should be D
   - DO NOT favor option C or any single option
2. For true/false questions: BALANCE the correct answers - aim for 50% True and 50% False
   - DO NOT make all or most answers True
   - Mix True and False answers evenly throughout

**Question Mix:**
1. Generate ${counts.mcq} multiple-choice questions (4 options each) - distribute correct answers evenly
2. Generate ${counts.tf} True/False questions (2 options: True, False) - balance True/False answers
3. Generate ${counts.ms} multi-select questions (4 options with 2 correct answers marked)
4. Questions should test understanding of key concepts from across the entire document
5. Include a brief explanation for each correct answer
6. Vary difficulty levels (easy, medium, hard) - distribute them evenly
7. Cover different sections and topics from the material
8. Ensure questions span from the beginning, middle, and end of the document

**Answer Randomization Strategy:**
- When creating multiple-choice questions, deliberately vary which option is correct
- Avoid patterns like "all answers are C" or "most answers are True"
- Ensure the distribution is RANDOM and BALANCED

Return ONLY the questions. Do not add introductions or explanations outside the question blocks. Start directly with "Q1:".

Format each question as:

For Multiple Choice:
Q[number]: [Question text]
Type: multiple-choice
A) [Option A]
B) [Option B]
C) [Option C]
D) [Option D]
Correct Answer: [Letter] (Remember to vary - use A, B, C, and D equally!)
Explanation: [Brief explanation]
Difficulty: [easy/medium/hard]

For True/False:
Q[number]: [Question text]
Type: true-false
A) True
B) False
Correct Answer: [Letter] (Balance between A for True and B for False!)
Explanation: [Brief explanation]
Difficulty: [easy/medium/hard]

For Multi-Select (multiple correct answers):
Q[number]: [Question text]
Type: multi-select
A) [Option A]
B) [Option B]
C) [Option C]
D) [Option D]
Correct Answers: [Letters separated by comma, e.g., A, C]
Explanation: [Brief explanation]
Difficulty: [easy/medium/hard]

---

${excludeText}

Generate ${counts.total} questions (${counts.mcq} multiple-choice, ${counts.tf} true-false, ${counts.ms} multi-select) with RANDOMIZED and BALANCED correct answers:`
        },
      ]);
    });

    const questionsText = result.response.text();
    console.log('Question generation successful');

    // Track API usage
    await trackAPIUsage('generate_questions', result, materialId, userId, true);

    // Clean up temp file
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }

    return { generated_text: questionsText };

  } catch (error) {
    console.error('PDF question generation error:', error);

    // Track failed API usage
    await trackAPIUsage('generate_questions', null, materialId, userId, false, error.message);

    // Clean up temp file on error
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (cleanupError) {
        console.error('Error cleaning up temp file:', cleanupError);
      }
    }

    throw error;
  }
}

// Fallback function to generate simple questions
function generateSimpleQuestions(text) {
  const sentences = text.match(/[^\.!\?]+[\.!\?]+/g) || [];
  const questions = [];

  // Take first 10 sentences and convert them to questions
  for (let i = 0; i < Math.min(10, sentences.length); i++) {
    const sentence = sentences[i].trim();
    if (sentence.length > 20) {
      questions.push({
        generated_text: `What is the main concept discussed in: "${sentence.substring(0, 150)}..."?`
      });
    }
  }

  return questions;
}

// Helper function to parse Gemini-generated questions into MCQ format
function formatQuestionsToMCQ(generatedQuestions, originalText) {
  const questions = [];

  if (generatedQuestions && generatedQuestions.generated_text) {
    const questionText = generatedQuestions.generated_text;

    // Try to parse structured questions from Gemini output
    const questionBlocks = questionText.split(/Q\d+:/g).filter(block => block.trim());

    questionBlocks.forEach((block, index) => {
      try {
        const lines = block.split('\n').filter(line => line.trim());

        // Extract question
        const questionLine = lines[0]?.trim();
        if (!questionLine) return;

        console.log(`\n--- Processing Question ${index + 1} ---`);
        console.log(`Question: ${questionLine.substring(0, 80)}...`);

        // Extract question type
        const typeLine = lines.find(line => line.includes('Type:'));
        let questionType = 'multiple-choice'; // default
        if (typeLine) {
          if (typeLine.includes('true-false')) questionType = 'true-false';
          else if (typeLine.includes('multi-select')) questionType = 'multi-select';
        }
        console.log(`Question type: ${questionType}`);

        // Extract options
        const options = [];
        const optionPattern = /^[A-D]\)/;

        lines.forEach(line => {
          if (optionPattern.test(line.trim())) {
            options.push(line.replace(optionPattern, '').trim());
          }
        });

        // Extract correct answer(s)
        let correctAnswer;
        const correctAnswerLine = lines.find(line =>
          line.includes('Correct Answer:') || line.includes('Correct Answers:')
        );

        if (correctAnswerLine) {
          console.log(`Parsing correct answer from: "${correctAnswerLine}"`);

          if (questionType === 'multi-select') {
            // For multi-select, extract multiple letters AFTER the colon (e.g., "Correct Answers: A, C")
            const afterColon = correctAnswerLine.split(':')[1];
            if (afterColon) {
              const matches = afterColon.match(/[A-D]/g);
              if (matches && matches.length > 0) {
                correctAnswer = matches.map(letter => letter.charCodeAt(0) - 65);
                console.log(`Multi-select correct answers: ${matches.join(', ')} -> indices: ${correctAnswer.join(', ')}`);
              } else {
                console.warn('Failed to parse multi-select answer, using fallback [0]');
                correctAnswer = [0]; // fallback
              }
            } else {
              console.warn('Failed to find colon in multi-select answer line');
              correctAnswer = [0]; // fallback
            }
          } else {
            // For single answer questions - extract the letter AFTER the colon
            // Match pattern: "Correct Answer: B" or "Correct Answer: B)" or "Correct Answer: True/False"
            const match = correctAnswerLine.match(/:\s*([A-D])/);
            if (match && match[1]) {
              const letter = match[1];
              correctAnswer = letter.charCodeAt(0) - 65; // Convert A=0, B=1, C=2, D=3
              console.log(`Single answer: ${letter} -> index: ${correctAnswer}`);
            } else if (questionType === 'true-false') {
              // Handle True/False text answers from Groq
              const lowerLine = correctAnswerLine.toLowerCase();
              if (lowerLine.includes('true') && !lowerLine.includes('false')) {
                correctAnswer = 0; // True is option A (index 0)
                console.log('True/False answer: True -> index: 0');
              } else if (lowerLine.includes('false')) {
                correctAnswer = 1; // False is option B (index 1)
                console.log('True/False answer: False -> index: 1');
              } else {
                console.warn(`Failed to parse T/F answer from: "${correctAnswerLine}", using fallback 0`);
                correctAnswer = 0;
              }
            } else {
              console.warn(`Failed to parse answer from: "${correctAnswerLine}", using fallback 0`);
              correctAnswer = 0; // fallback
            }
          }
        } else {
          console.warn('No "Correct Answer" line found, using default');
          correctAnswer = questionType === 'multi-select' ? [0] : 0;
        }

        // Extract explanation
        const explanationLine = lines.find(line => line.includes('Explanation:'));
        let explanation = '';
        if (explanationLine) {
          explanation = explanationLine.replace(/Explanation:/i, '').trim();
        }

        // Extract difficulty
        const difficultyLine = lines.find(line => line.includes('Difficulty:'));
        let difficulty = 'medium';
        if (difficultyLine) {
          if (difficultyLine.includes('easy')) difficulty = 'easy';
          else if (difficultyLine.includes('hard')) difficulty = 'hard';
        }

        // Validate options based on question type
        const requiredOptions = questionType === 'true-false' ? 2 : 4;
        if (options.length >= requiredOptions) {
          questions.push({
            questionText: questionLine,
            questionType: questionType,
            options: options.slice(0, requiredOptions),
            correctAnswer: correctAnswer,
            explanation: explanation,
            difficulty: difficulty,
          });
        }
      } catch (parseError) {
        console.error('Error parsing question block:', parseError.message);
      }
    });

    // If parsing failed, create simple questions
    if (questions.length === 0) {
      console.log('Parsed questions failed, creating simple questions');
      const words = originalText.split(' ').filter(word => word.length > 3);

      for (let i = 0; i < Math.min(5, words.length / 10); i++) {
        const randomWords = [];
        for (let j = 0; j < 4; j++) {
          const randomIndex = Math.floor(Math.random() * words.length);
          randomWords.push(words[randomIndex]);
        }

        questions.push({
          questionText: `Which of the following concepts is discussed in this material?`,
          questionType: 'multiple-choice',
          options: randomWords,
          correctAnswer: 0,
          explanation: 'This is a generated question based on the material content.',
          difficulty: 'medium',
        });
      }
    }
  }

  return questions;
}

// ============================================
// GROQ-BASED GENERATION - COMMENTED OUT
// Using Gemini Tier 1 instead for better rate limits
// ============================================

// async function summarizeWithGroq(text, materialId = null, userId = null) {
//   // Groq implementation commented out - using Gemini instead
// }

// async function generateQuestionsWithGroq(text, totalQuestions, excludeQuestions = [], materialId = null, userId = null) {
//   // Groq implementation commented out - using Gemini instead
// }

// ============================================
// GEMINI-BASED GENERATION (Primary - Tier 1)
// ============================================

// Generate questions using a specific client, with automatic retry on other keys
async function generateQuestionsWithClient(clientIndex, text, totalQuestions, excludeQuestions = [], materialId = null, userId = null) {
  const clientCount = getClientCount();

  const cleanedText = text.replace(/\s+/g, ' ').trim();
  const maxLength = 50000;
  const truncatedText = cleanedText.length > maxLength ? cleanedText.substring(0, maxLength) : cleanedText;

  const getMixCounts = (total) => {
    if (total <= 5) {
      return { total, mcq: Math.max(1, Math.ceil(total * 0.6)), tf: Math.max(1, Math.floor(total * 0.2)), ms: Math.max(0, total - Math.ceil(total * 0.6) - Math.floor(total * 0.2)) };
    }
    const mcq = Math.max(1, Math.round(total * 0.64));
    const tf = Math.max(1, Math.round(total * 0.21));
    let ms = total - mcq - tf;
    if (ms < 1) ms = 1;
    return { total, mcq, tf, ms };
  };

  const counts = getMixCounts(totalQuestions);
  const excludeText = excludeQuestions.length > 0
    ? `\n\nDo NOT repeat any of these questions:\n${excludeQuestions.slice(0, 20).map((q, idx) => `${idx + 1}. ${q}`).join('\n')}\n`
    : '';

  const prompt = `Based on the following educational content, generate ${counts.total} high-quality practice questions.

**CRITICAL REQUIREMENTS - RANDOMIZATION:**
1. For multiple-choice: RANDOMLY distribute correct answers across A, B, C, D (25% each)
2. For true/false: BALANCE 50% True and 50% False

**Question Mix:**
- ${counts.mcq} multiple-choice (4 options)
- ${counts.tf} True/False
- ${counts.ms} multi-select (2 correct answers)

Return ONLY questions. Start directly with "Q1:".

Format:
Q[number]: [Question text]
Type: multiple-choice|true-false|multi-select
A) [Option A]
B) [Option B]
C) [Option C]
D) [Option D]
Correct Answer: [Letter] or Correct Answers: [Letters]
Explanation: [Brief explanation]
Difficulty: [easy/medium/hard]

---
Educational Content:
${truncatedText}
${excludeText}

Generate ${counts.total} questions with RANDOMIZED answers:`;

  // Try each key until one works
  let lastError;
  for (let attempt = 0; attempt < clientCount; attempt++) {
    const keyIdx = (clientIndex + attempt) % clientCount;
    const client = getClientByIndex(keyIdx);

    try {
      console.log(`Trying questions with API key ${keyIdx + 1}...`);
      const model = client.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
      const result = await model.generateContent(prompt);
      const questionsText = result.response.text();

      await trackAPIUsage('generate_questions', result, materialId, userId, true);
      return { generated_text: questionsText };
    } catch (error) {
      lastError = error;
      console.error(`Questions failed on key ${keyIdx + 1}:`, error.message?.substring(0, 100));

      // If rate limited, try next key
      if (error.message?.includes('429') || error.message?.includes('quota')) {
        console.log(`Key ${keyIdx + 1} rate limited, trying next key...`);
        continue;
      }
      // For other errors, throw immediately
      throw error;
    }
  }

  // All keys failed
  await trackAPIUsage('generate_questions', null, materialId, userId, false, lastError?.message);
  throw lastError || new Error('All API keys exhausted');
}

// Generate summary using a specific client, with automatic retry on other keys
async function summarizeWithClient(clientIndex, text, materialId = null, userId = null) {
  const clientCount = getClientCount();

  let cleanedText = text.replace(/\s+/g, ' ').trim();
  if (cleanedText.length < 200) {
    throw new Error('Text is too short to summarize');
  }

  // Trim to 85% for speed while keeping more detail
  const trimmedLength = Math.floor(cleanedText.length * 0.85);
  if (trimmedLength < cleanedText.length) {
    cleanedText = cleanedText.substring(0, trimmedLength);
  }

  const prompt = `You are an expert educational content summarizer. Provide a comprehensive, well-formatted summary.

**FORMATTING:**
1. **Module Headers:** **Module X: Title**
2. **Unit Headers:** **Unit X: Title**
3. **Key Terms:** Bold important terms
4. Use bullet points for lists, paragraphs for explanations

Course Material:
${cleanedText}

Provide a well-structured, comprehensive summary:`;

  // Try each key until one works
  let lastError;
  for (let attempt = 0; attempt < clientCount; attempt++) {
    const keyIdx = (clientIndex + attempt) % clientCount;
    const client = getClientByIndex(keyIdx);

    try {
      console.log(`Trying summary with API key ${keyIdx + 1}...`);
      const model = client.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
      const result = await model.generateContent(prompt);
      const summary = result.response.text();

      await trackAPIUsage('summarize', result, materialId, userId, true);
      return summary;
    } catch (error) {
      lastError = error;
      console.error(`Summary failed on key ${keyIdx + 1}:`, error.message?.substring(0, 100));

      // If rate limited, try next key
      if (error.message?.includes('429') || error.message?.includes('quota')) {
        console.log(`Key ${keyIdx + 1} rate limited, trying next key...`);
        continue;
      }
      // For other errors, throw immediately
      throw error;
    }
  }

  // All keys failed
  await trackAPIUsage('summarize', null, materialId, userId, false, lastError?.message);
  throw lastError || new Error('All API keys exhausted');
}

// FAST: Generate summary and initial questions - optimized for speed
// Uses Gemini 2.5 Flash on Tier 1 (300 RPM, 2M TPM, 1500 RPD)
async function generateSummaryAndQuestionsParallel(pdfUrl, materialId = null, userId = null) {
  const startTime = Date.now();
  console.log('Starting OPTIMIZED summary + questions generation...');
  console.log('Provider: Gemini 2.5 Flash (Tier 1)');

  // Step 1: Download PDF once
  console.log('Step 1: Downloading PDF...');
  const downloadStart = Date.now();
  const pdfBuffer = await downloadPDFBuffer(pdfUrl);
  console.log(`PDF downloaded in ${Date.now() - downloadStart}ms`);

  // Step 2: Extract text once
  console.log('Step 2: Extracting text...');
  const extractStart = Date.now();
  let extractedText;
  try {
    extractedText = await extractTextFromBuffer(pdfBuffer);
    console.log(`Text extracted in ${Date.now() - extractStart}ms (${extractedText.length} chars)`);
  } catch (error) {
    console.error('Text extraction failed, using File API fallback');
    // Save buffer to temp file for File API
    const tempPath = path.join(os.tmpdir(), `material-${Date.now()}.pdf`);
    fs.writeFileSync(tempPath, pdfBuffer);
    try {
      const summary = await summarizePDFDirectlyFromFile(tempPath, materialId, userId);
      const questions = await generateQuestionsFromFile(tempPath, materialId, userId, 10, []);
      return { summary, questions: formatQuestionsToMCQ(questions, '') };
    } finally {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    }
  }

  let summary, questions;

  // Step 3: Generate summary with Gemini
  console.log('Step 3: Generating summary...');
  const summaryStart = Date.now();
  summary = await summarizeWithClient(0, extractedText, materialId, userId);
  console.log(`Summary generated with Gemini in ${Date.now() - summaryStart}ms`);

  // Step 4: Generate questions with Gemini
  console.log('Step 4: Generating 10 questions...');
  const questionsStart = Date.now();
  const questionsRaw = await generateQuestionsWithClient(0, extractedText, 10, [], materialId, userId);
  questions = formatQuestionsToMCQ(questionsRaw, extractedText);
  console.log(`Questions generated with Gemini in ${Date.now() - questionsStart}ms (${questions.length} questions)`);

  // Top up if the model returned fewer than 10
  if (questions.length < 10) {
    const missing = 10 - questions.length;
    console.warn(`Only ${questions.length} questions generated. Topping up ${missing} more...`);
    const excludeTexts = questions.map(q => q.questionText).filter(Boolean);
    const topUpRaw = await generateQuestionsWithClient(0, extractedText, missing, excludeTexts, materialId, userId);
    const topUp = formatQuestionsToMCQ(topUpRaw, extractedText);
    questions = [...questions, ...topUp].slice(0, 10);
    console.log(`Top-up complete. Total initial questions: ${questions.length}`);
  }

  const totalTime = Date.now() - startTime;
  console.log(`Total time: ${totalTime}ms (${(totalTime / 1000).toFixed(1)}s)`);

  return { summary, questions };
}

// Helper: Summarize from already-downloaded temp file
async function summarizePDFDirectlyFromFile(tempFilePath, materialId = null, userId = null) {
  const result = await withGeminiClient(async ({ genAI, fileManager }) => {
    const uploadResult = await fileManager.uploadFile(tempFilePath, {
      mimeType: 'application/pdf',
      displayName: 'Study Material',
    });

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    return await model.generateContent([
      { fileData: { mimeType: uploadResult.file.mimeType, fileUri: uploadResult.file.uri } },
      { text: 'Provide a comprehensive, well-formatted summary of this PDF. Use bold headers for modules/units, bullet points for lists, and paragraphs for explanations.' }
    ]);
  });

  await trackAPIUsage('summarize', result, materialId, userId, true);
  return result.response.text();
}

// Helper: Generate questions from already-downloaded temp file
async function generateQuestionsFromFile(tempFilePath, materialId = null, userId = null, totalQuestions = 10, excludeQuestions = []) {
  const result = await withGeminiClient(async ({ genAI, fileManager }) => {
    const uploadResult = await fileManager.uploadFile(tempFilePath, {
      mimeType: 'application/pdf',
      displayName: 'Study Material',
    });

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    return await model.generateContent([
      { fileData: { mimeType: uploadResult.file.mimeType, fileUri: uploadResult.file.uri } },
      { text: `Generate ${totalQuestions} practice questions. Mix: 60% multiple-choice, 20% true/false, 20% multi-select. Format each as: Q[n]: [question] Type: [type] A) B) C) D) Correct Answer: [letter] Explanation: [brief] Difficulty: [easy/medium/hard]` }
    ]);
  });

  await trackAPIUsage('generate_questions', result, materialId, userId, true);
  return { generated_text: result.response.text() };
}

// Generate remaining questions - uses Gemini 2.5 Flash (Tier 1)
// Tier 1 limits: 300 RPM, 2M TPM - can handle batches quickly
async function generateQuestionsParallel(pdfUrl, materialId, userId, targetCount, existingQuestions = []) {
  const startTime = Date.now();
  console.log(`Generating ${targetCount} questions with Gemini 2.5 Flash (Tier 1)...`);

  // Download and extract text once
  console.log('Downloading PDF...');
  const pdfBuffer = await downloadPDFBuffer(pdfUrl);

  let extractedText;
  try {
    extractedText = await extractTextFromBuffer(pdfBuffer);
    console.log(`Text extracted (${extractedText.length} chars)`);
  } catch (error) {
    console.error('Text extraction failed, using File API');
    const tempPath = path.join(os.tmpdir(), `material-${Date.now()}.pdf`);
    fs.writeFileSync(tempPath, pdfBuffer);
    try {
      const result = await generateQuestionsFromFile(tempPath, materialId, userId, targetCount, existingQuestions);
      return formatQuestionsToMCQ(result, '');
    } finally {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    }
  }

  const excludeTexts = existingQuestions.map(q => q.questionText || q).filter(Boolean);
  const allQuestions = [];

  // Generate in batches - Gemini Tier 1 can handle 20 questions per batch
  const batchSize = 20;
  let remaining = targetCount;
  let batchNum = 0;
  let consecutiveFailures = 0;

  while (remaining > 0 && batchNum < 10 && consecutiveFailures < 3) {
    batchNum++;
    const size = Math.min(batchSize, remaining);
    const currentExclude = [...excludeTexts, ...allQuestions.map(q => q.questionText)].slice(-20);

    console.log(`Batch ${batchNum}: Generating ${size} questions...`);
    const batchStart = Date.now();

    try {
      const result = await generateQuestionsWithClient(0, extractedText, size, currentExclude, materialId, userId);
      const questions = formatQuestionsToMCQ(result, extractedText);
      allQuestions.push(...questions);
      console.log(`Batch ${batchNum} done in ${Date.now() - batchStart}ms (got ${questions.length} questions)`);
      remaining -= questions.length;
      consecutiveFailures = 0; // Reset on success
    } catch (error) {
      console.error(`Batch ${batchNum} failed:`, error.message);
      consecutiveFailures++;

      // If rate limited, wait before retry (shouldn't happen often on Tier 1)
      if (error.message?.includes('429') || error.message?.includes('quota') || error.message?.includes('rate')) {
        console.log('Rate limited, waiting 3 seconds...');
        await sleep(3000);
      } else {
        remaining -= size; // Skip this batch on other errors
      }
    }

    // Small delay between batches to be safe
    if (remaining > 0) {
      await sleep(500);
    }
  }

  const totalTime = Date.now() - startTime;
  console.log(`Generated ${allQuestions.length} questions in ${(totalTime / 1000).toFixed(1)}s`);

  return allQuestions;
}

module.exports = {
  summarizeText,
  generateQuestions,
  formatQuestionsToMCQ,
  gradePopAnswers,
  generatePopPaper,
  generateProjectTopics,
  // New parallel functions
  generateSummaryAndQuestionsParallel,
  generateQuestionsParallel,
  getClientCount,
};

async function gradePopAnswers(qaItems, defaultMaxScore = 10) {
  if (!Array.isArray(qaItems) || qaItems.length === 0) {
    return { items: [], totalScore: 0, maxTotal: 0 };
  }

  const normalized = qaItems.map((item) => ({
    question: item.question,
    answer: item.answer,
    maxScore: typeof item.maxScore === 'number' ? item.maxScore : defaultMaxScore,
  }));

  const batchSize = 8;
  const batches = [];
  for (let i = 0; i < normalized.length; i += batchSize) {
    batches.push(normalized.slice(i, i + batchSize));
  }

  const results = [];
  for (const batch of batches) {
    const prompt = `You are grading short-answer exam responses. Score each answer from 0 to its Max Score based on correctness and completeness. Provide a concise model answer for each question.

Return ONLY valid JSON in this format:
{
  "items": [
    { "index": 0, "score": number, "feedback": "short feedback", "modelAnswer": "ideal answer" }
  ]
}

Questions and answers:
${batch.map((item, idx) => `Index ${idx}: Max Score ${item.maxScore} | Q: ${item.question}\nA: ${item.answer}`).join('\n\n')}
`;

    const response = await withGeminiClient(async ({ genAI }) => {
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
      return await model.generateContent(prompt);
    });

    const text = response.response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      // Fallback: mark all as 0 if parsing fails
      batch.forEach((_, idx) => {
        results.push({ score: 0, feedback: 'Unable to grade automatically.' });
      });
      continue;
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch (error) {
      batch.forEach((_, idx) => {
        results.push({ score: 0, feedback: 'Unable to grade automatically.' });
      });
      continue;
    }

    const items = Array.isArray(parsed.items) ? parsed.items : [];
    batch.forEach((item, idx) => {
      const graded = items.find((item) => item.index === idx);
      results.push({
        score: graded && typeof graded.score === 'number' ? graded.score : 0,
        feedback: graded && graded.feedback ? graded.feedback : 'No feedback provided.',
        modelAnswer: graded && graded.modelAnswer ? graded.modelAnswer : 'No model answer provided.',
        maxScore: item.maxScore,
      });
    });
  }

  const totalScore = results.reduce((sum, item) => sum + item.score, 0);
  const maxTotal = normalized.reduce((sum, item) => sum + item.maxScore, 0);
  return { items: results, totalScore, maxTotal };
}

async function generatePopPaper(sourceQuestions, totalQuestions = 5) {
  const items = Array.isArray(sourceQuestions) ? sourceQuestions : [];
  const prompt = `You are creating a POP-style exam paper. Use the provided question pool to generate an exam with ${totalQuestions} main questions. Each main question must have 2–4 sub-parts labeled (a), (b), (c), (d) where applicable. Assign marks to each part so the total per main question is between 10 and 20 marks. Use clear, academic phrasing. Return ONLY valid JSON in this format:
{
  "instructions": "Answer question 1 and any other three questions",
  "questions": [
    {
      "number": 1,
      "parts": [
        { "label": "a", "text": "Question text", "marks": 10 }
      ]
    }
  ]
}

Question pool:
${items.map((q, index) => `${index + 1}. ${q}`).join('\n')}
`;

  const response = await withGeminiClient(async ({ genAI }) => {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    return await model.generateContent(prompt);
  });

  const text = response.response.text();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Failed to parse POP paper response');
  }

  return JSON.parse(jsonMatch[0]);
}

async function generateProjectTopics(courseLabel, keywords, count = 5) {
  const cleanKeywords = Array.isArray(keywords)
    ? keywords.map((item) => String(item).trim()).filter(Boolean)
    : [];
  const topicCount = Number.isInteger(count) && count > 0 ? count : 5;
  const courseText = courseLabel ? String(courseLabel).trim() : 'the course';
  const keywordText = cleanKeywords.length > 0 ? cleanKeywords.join(', ') : 'relevant academic themes';

  const prompt = `You generate project topic ideas for students. Provide ${topicCount} distinct project topics.

Course: ${courseText}
Keywords: ${keywordText}

Requirements:
- Make each topic specific and academically suitable.
- Avoid repeating the same phrasing.
- Keep each topic under 20 words.

Return ONLY valid JSON in this format:
{
  "topics": [
    "Topic 1",
    "Topic 2"
  ]
}`;

  const response = await withGeminiClient(async ({ genAI }) => {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    return await model.generateContent(prompt);
  });

  const text = response.response.text();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Failed to parse project topics response');
  }

  const parsed = JSON.parse(jsonMatch[0]);
  if (!parsed || !Array.isArray(parsed.topics)) {
    throw new Error('Invalid project topics format');
  }

  return parsed.topics.slice(0, topicCount);
}

function getCloudinarySignedUrl(fileUrl) {
  try {
    if (!fileUrl || !fileUrl.includes('res.cloudinary.com')) {
      return fileUrl;
    }

    const match = fileUrl.match(/\/raw\/upload\/(?:v\d+\/)?(.+)$/);
    if (!match || !match[1]) {
      return fileUrl;
    }

    const publicIdWithExt = decodeURIComponent(match[1]).replace(/\?.*$/, '');
    return cloudinary.utils.private_download_url(publicIdWithExt, '', {
      resource_type: 'raw',
      type: 'upload',
    });
  } catch (error) {
    console.error('Error generating Cloudinary signed URL:', error.message);
    return fileUrl;
  }
}
