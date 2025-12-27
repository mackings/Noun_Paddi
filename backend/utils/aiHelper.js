const { GoogleGenerativeAI } = require('@google/generative-ai');
const { GoogleAIFileManager } = require('@google/generative-ai/server');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');
const APIUsage = require('../models/APIUsage');

// Initialize Google Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY);

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

    // If we have a PDF URL, use the File API for better results
    if (pdfUrl) {
      return await summarizePDFDirectly(pdfUrl, materialId, userId);
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

    // Initialize Gemini model
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    // Gemini 1.5 Flash can handle very long texts (up to 1M tokens)
    // No need to chunk - let it process the full document
    console.log(`Processing ${cleanedText.length} characters...`);

    // Create a detailed prompt for educational content
    const prompt = `You are an expert educational content summarizer. Please provide a comprehensive summary of the following course material.

Requirements:
1. Create a detailed summary that captures all key concepts and topics
2. Break down complex technical terms into simpler language
3. Organize the summary with clear sections
4. Include important definitions and explanations
5. Make it suitable for students studying this material

Course Material:
${cleanedText}

Please provide a well-structured summary:`;

    const result = await model.generateContent(prompt);
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
    console.log('Downloading PDF from:', pdfUrl);

    // Download PDF to temporary file
    const response = await axios.get(pdfUrl, {
      responseType: 'arraybuffer',
    });

    const pdfBuffer = Buffer.from(response.data);
    console.log('PDF downloaded, size:', pdfBuffer.length, 'bytes');

    // Save to temp file
    tempFilePath = path.join(os.tmpdir(), `material-${Date.now()}.pdf`);
    fs.writeFileSync(tempFilePath, pdfBuffer);
    console.log('Saved to temp file:', tempFilePath);

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
    const result = await model.generateContent([
      {
        fileData: {
          mimeType: uploadResult.file.mimeType,
          fileUri: uploadResult.file.uri
        }
      },
      {
        text: `You are an expert educational content summarizer. Please provide a comprehensive summary of this PDF course material.

Requirements:
1. Create a detailed summary that captures all key concepts and topics from the entire document
2. Break down complex technical terms into simpler language that students can understand
3. Organize the summary with clear sections and headings
4. Include important definitions and explanations
5. Make it suitable for students studying this material
6. Cover content from the entire document, not just the beginning

Please provide a well-structured, comprehensive summary:`
      },
    ]);

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

    // If we have a PDF URL, use the File API
    if (pdfUrl) {
      return await generateQuestionsFromPDF(pdfUrl, materialId, userId);
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
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `Based on the following educational content, generate 50 high-quality multiple-choice questions.

Requirements for each question:
1. Question should test understanding of key concepts from different parts of the material
2. Provide 4 options (A, B, C, D)
3. Indicate the correct answer
4. Include a brief explanation for the correct answer
5. Vary difficulty levels (easy, medium, hard) - mix them throughout
6. Cover a wide range of topics from the material

Format each question as:
Q[number]: [Question text]
A) [Option A]
B) [Option B]
C) [Option C]
D) [Option D]
Correct Answer: [Letter]
Explanation: [Brief explanation]
Difficulty: [easy/medium/hard]

---

Educational Content:
${truncatedText}

Generate 50 questions:`;

    const result = await model.generateContent(prompt);
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
    console.log('Downloading PDF from:', pdfUrl);

    // Download PDF to temporary file
    const response = await axios.get(pdfUrl, {
      responseType: 'arraybuffer',
    });

    const pdfBuffer = Buffer.from(response.data);
    tempFilePath = path.join(os.tmpdir(), `material-${Date.now()}.pdf`);
    fs.writeFileSync(tempFilePath, pdfBuffer);

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
    const result = await model.generateContent([
      {
        fileData: {
          mimeType: uploadResult.file.mimeType,
          fileUri: uploadResult.file.uri
        }
      },
      {
        text: `Based on this PDF educational content, generate 50 high-quality multiple-choice questions.

Requirements for each question:
1. Question should test understanding of key concepts from across the entire document
2. Provide 4 options (A, B, C, D)
3. Indicate the correct answer
4. Include a brief explanation for the correct answer
5. Vary difficulty levels (easy, medium, hard) - distribute them evenly
6. Cover different sections and topics from the material
7. Ensure questions span from the beginning, middle, and end of the document

Format each question as:
Q[number]: [Question text]
A) [Option A]
B) [Option B]
C) [Option C]
D) [Option D]
Correct Answer: [Letter]
Explanation: [Brief explanation]
Difficulty: [easy/medium/hard]

---

Generate 50 questions:`
      },
    ]);

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

        // Extract options
        const options = [];
        const optionPattern = /^[A-D]\)/;

        lines.forEach(line => {
          if (optionPattern.test(line.trim())) {
            options.push(line.replace(optionPattern, '').trim());
          }
        });

        // Extract correct answer
        const correctAnswerLine = lines.find(line => line.includes('Correct Answer:'));
        let correctAnswer = 0;
        if (correctAnswerLine) {
          const match = correctAnswerLine.match(/[A-D]/);
          if (match) {
            correctAnswer = match[0].charCodeAt(0) - 65; // Convert A=0, B=1, C=2, D=3
          }
        }

        // Extract difficulty
        const difficultyLine = lines.find(line => line.includes('Difficulty:'));
        let difficulty = 'medium';
        if (difficultyLine) {
          if (difficultyLine.includes('easy')) difficulty = 'easy';
          else if (difficultyLine.includes('hard')) difficulty = 'hard';
        }

        // Only add if we have valid options
        if (options.length >= 4) {
          questions.push({
            questionText: questionLine,
            options: options.slice(0, 4),
            correctAnswer: correctAnswer,
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
          options: randomWords,
          correctAnswer: 0,
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
