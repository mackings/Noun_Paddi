const { GoogleGenerativeAI } = require('@google/generative-ai');
const { GoogleAIFileManager } = require('@google/generative-ai/server');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');
const APIUsage = require('../models/APIUsage');
const { cloudinary } = require('../config/cloudinary');
const { extractTextFromPDF } = require('./pdfHelper');

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

function isRateLimitError(error) {
  const message = `${error?.message || ''}`;
  return error?.status === 429 ||
    error?.response?.status === 429 ||
    message.includes('429') ||
    message.includes('Too Many Requests');
}

async function withGeminiClient(fn) {
  const clients = getGeminiClients();
  if (!clients.length) {
    throw new Error('No Gemini API keys configured');
  }

  let lastError;
  for (let i = 0; i < clients.length; i++) {
    const index = geminiClientIndex % clients.length;
    geminiClientIndex = (geminiClientIndex + 1) % clients.length;
    const client = clients[index];
    try {
      const result = await fn(client);
      return result;
    } catch (error) {
      lastError = error;
      if (isRateLimitError(error) && clients.length > 1) {
        continue;
      }
      throw error;
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

    // Trim very long inputs by 20% to reduce latency while keeping most content
    if (cleanedText.length > 0) {
      const trimmedLength = Math.floor(cleanedText.length * 0.8);
      if (trimmedLength < cleanedText.length) {
        console.log(`Trimming summary input from ${cleanedText.length} to ${trimmedLength} characters`);
        cleanedText = cleanedText.substring(0, trimmedLength);
      }
    }

    // Gemini 1.5 Flash can handle very long texts (up to 1M tokens)
    // No need to chunk - let it process the full document
    console.log(`Processing ${cleanedText.length} characters...`);

    // Create a detailed prompt for educational content
    const prompt = `You are an expert educational content summarizer. Please provide a comprehensive, well-formatted summary of the following course material.

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

Course Material:
${cleanedText}

Please provide a well-structured, comprehensive summary with proper bold headers, effective use of paragraphs and bullet points:`;

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

async function generateQuestions(text, pdfUrl = null, materialId = null, userId = null) {
  try {
    console.log('Starting question generation with Gemini...');

    // If we have a PDF URL, extract text and generate questions directly for speed
    if (pdfUrl) {
      try {
        const signedUrl = getCloudinarySignedUrl(pdfUrl);
        const extractedText = await extractTextFromPDF(signedUrl);
        return await generateQuestions(extractedText, null, materialId, userId);
      } catch (error) {
        console.error('PDF text extraction failed, falling back to File API:', error.message);
        return await generateQuestionsFromPDF(pdfUrl, materialId, userId);
      }
    }

    // Clean and prepare text
    let cleanedText = text
      .replace(/\s+/g, ' ')
      .trim();

    // Use reasonable amount of text for question generation
    const maxLength = 50000; // Increased since we're not chunking anymore
    const truncatedText = cleanedText.length > maxLength
      ? cleanedText.substring(0, maxLength)
      : cleanedText;

    console.log('Text length for question generation:', truncatedText.length);

    // Initialize Gemini model
    const prompt = `Based on the following educational content, generate 70 high-quality practice questions with a mix of different question types.

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
1. Generate 45 multiple-choice questions (4 options each) - distribute correct answers evenly
2. Generate 15 True/False questions (2 options: True, False) - balance True/False answers
3. Generate 10 multi-select questions (4 options with 2 correct answers marked)
4. Questions should test understanding of key concepts from different parts of the material
5. Include a brief explanation for each correct answer
6. Vary difficulty levels (easy, medium, hard) - mix them throughout
7. Cover a wide range of topics from the material

**Answer Randomization Strategy:**
- When creating multiple-choice questions, deliberately vary which option is correct
- Avoid patterns like "all answers are C" or "most answers are True"
- Ensure the distribution is RANDOM and BALANCED

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

Generate 70 questions (45 multiple-choice, 15 true-false, 10 multi-select) with RANDOMIZED and BALANCED correct answers:`;

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
async function generateQuestionsFromPDF(pdfUrl, materialId = null, userId = null) {
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
      return await model.generateContent([
        {
          fileData: {
            mimeType: uploadResult.file.mimeType,
            fileUri: uploadResult.file.uri
          }
        },
        {
          text: `Based on this PDF educational content, generate 70 high-quality practice questions with a mix of different question types.

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
1. Generate 45 multiple-choice questions (4 options each) - distribute correct answers evenly
2. Generate 15 True/False questions (2 options: True, False) - balance True/False answers
3. Generate 10 multi-select questions (4 options with 2 correct answers marked)
4. Questions should test understanding of key concepts from across the entire document
5. Include a brief explanation for each correct answer
6. Vary difficulty levels (easy, medium, hard) - distribute them evenly
7. Cover different sections and topics from the material
8. Ensure questions span from the beginning, middle, and end of the document

**Answer Randomization Strategy:**
- When creating multiple-choice questions, deliberately vary which option is correct
- Avoid patterns like "all answers are C" or "most answers are True"
- Ensure the distribution is RANDOM and BALANCED

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

Generate 70 questions (45 multiple-choice, 15 true-false, 10 multi-select) with RANDOMIZED and BALANCED correct answers:`
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
            // Match pattern: "Correct Answer: B" or "Correct Answer: B)"
            const match = correctAnswerLine.match(/:\s*([A-D])/);
            if (match && match[1]) {
              const letter = match[1];
              correctAnswer = letter.charCodeAt(0) - 65; // Convert A=0, B=1, C=2, D=3
              console.log(`Single answer: ${letter} -> index: ${correctAnswer}`);
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

module.exports = {
  summarizeText,
  generateQuestions,
  formatQuestionsToMCQ,
};

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
