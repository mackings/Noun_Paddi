const axios = require('axios');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const MIN_EXTRACTED_TEXT_LENGTH = 500;
const MAX_DOWNLOAD_BYTES = 80 * 1024 * 1024;
const GEMINI_TMA_MODEL = process.env.GEMINI_TMA_MODEL || process.env.GEMINI_SUMMARY_MODEL || 'gemini-2.5-pro';
const DEFAULT_GEMINI_EMBEDDING_MODEL = 'gemini-embedding-001';

function normalizeGeminiModelName(value, fallback) {
  let model = String(value || fallback || '').trim().replace(/^['"]|['"]$/g, '');

  if (model.includes('=')) {
    model = model.split('=').pop().trim();
  }

  model = model.replace(/^models\//, '').trim();
  return model || fallback;
}

const GEMINI_EMBEDDING_MODEL = normalizeGeminiModelName(
  process.env.GEMINI_EMBEDDING_MODEL,
  DEFAULT_GEMINI_EMBEDDING_MODEL
);
let activeEmbeddingModel = GEMINI_EMBEDDING_MODEL;

const SOURCE_QUALITY = {
  course_material: 1,
  tma_1: 0.74,
  tma_2: 0.74,
  tma_3: 0.74,
  past_question: 0.68,
  other: 0.45,
};

function normalizeText(value) {
  return String(value || '')
    .replace(/\u0000/g, ' ')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function compactText(value) {
  return normalizeText(value).replace(/\s+/g, ' ').trim();
}

function getGeminiApiKey() {
  const keysEnv = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '';
  return keysEnv.split(',').map((item) => item.trim()).find(Boolean) || '';
}

async function downloadDocumentBuffer(url) {
  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: Number(process.env.TMA_DOWNLOAD_TIMEOUT_MS || 180000),
    maxContentLength: MAX_DOWNLOAD_BYTES,
    signal: AbortSignal.timeout(Number(process.env.TMA_DOWNLOAD_TIMEOUT_MS || 180000)),
  });

  const buffer = Buffer.from(response.data);
  if (!buffer.length) {
    throw new Error('Uploaded file could not be read.');
  }
  return buffer;
}

async function extractPdf(buffer) {
  if (buffer.slice(0, 4).toString() !== '%PDF') {
    throw new Error('Uploaded file is not a valid PDF.');
  }

  const data = await pdfParse(buffer);
  const text = compactText(data.text);
  const pageCount = Number(data.numpages || 0);

  if (!pageCount) {
    throw new Error('The PDF pages could not be counted.');
  }
  if (text.length < MIN_EXTRACTED_TEXT_LENGTH) {
    throw new Error('The PDF was read, but too little text was extracted. Upload a clearer text-based PDF.');
  }

  return {
    text,
    pageCount,
  };
}

async function extractWord(buffer) {
  const result = await mammoth.extractRawText({ buffer });
  const text = compactText(result.value);
  if (text.length < MIN_EXTRACTED_TEXT_LENGTH) {
    throw new Error('The document was read, but too little text was extracted.');
  }
  return {
    text,
    pageCount: 0,
  };
}

function extractPlainText(buffer) {
  const text = compactText(buffer.toString('utf8'));
  if (text.length < MIN_EXTRACTED_TEXT_LENGTH) {
    throw new Error('The text file is too short to use as a reliable TMA source.');
  }
  return {
    text,
    pageCount: 0,
  };
}

async function extractDocumentText({ url, mimeType = '', filename = '' }) {
  const buffer = await downloadDocumentBuffer(url);
  return extractDocumentBuffer({ buffer, mimeType, filename });
}

async function extractDocumentBuffer({ buffer, mimeType = '', filename = '' }) {
  const normalizedType = String(mimeType || '').toLowerCase();
  const normalizedName = String(filename || '').toLowerCase();

  if (normalizedType.includes('pdf') || normalizedName.endsWith('.pdf')) {
    return extractPdf(buffer);
  }

  if (
    normalizedType.includes('word') ||
    normalizedType.includes('officedocument') ||
    normalizedName.endsWith('.doc') ||
    normalizedName.endsWith('.docx')
  ) {
    return extractWord(buffer);
  }

  if (normalizedType.includes('text') || normalizedName.endsWith('.txt')) {
    return extractPlainText(buffer);
  }

  throw new Error('Only PDF, DOC, DOCX, and TXT sources are supported.');
}

function detectCourseMetadata(text, title = '') {
  const combined = `${title}\n${text.slice(0, 8000)}`;
  const codeMatch = combined.toUpperCase().match(/\b([A-Z]{3})\s*[-/]?\s*(\d{3})\b/);
  const detectedCourseCode = codeMatch ? `${codeMatch[1]} ${codeMatch[2]}` : '';

  const lines = normalizeText(combined)
    .split(/\n|(?<=\.)\s+/)
    .map((line) => line.trim())
    .filter((line) => line.length >= 8 && line.length <= 120);

  const nameLine = lines.find((line) => {
    const normalized = line.toUpperCase();
    return detectedCourseCode && normalized.includes(detectedCourseCode.replace(/\s+/g, ' '));
  }) || lines.find((line) => /course\s+title|course\s+guide|module/i.test(line)) || '';

  const detectedCourseName = detectedCourseCode
    ? nameLine.replace(new RegExp(detectedCourseCode, 'i'), '').replace(/course\s+title\s*:?\s*/i, '').trim()
    : nameLine.replace(/course\s+title\s*:?\s*/i, '').trim();

  return {
    detectedCourseCode,
    detectedCourseName,
  };
}

function chunkText(text, chunkSize = 1800, overlap = 220) {
  const clean = compactText(text);
  const chunks = [];
  let start = 0;

  while (start < clean.length) {
    const hardEnd = Math.min(start + chunkSize, clean.length);
    let end = hardEnd;
    if (hardEnd < clean.length) {
      const sentenceBreak = clean.lastIndexOf('. ', hardEnd);
      if (sentenceBreak > start + chunkSize * 0.55) {
        end = sentenceBreak + 1;
      }
    }

    const chunk = clean.slice(start, end).trim();
    if (chunk.length > 200) {
      chunks.push(chunk);
    }

    if (end >= clean.length) break;
    start = Math.max(end - overlap, start + 1);
  }

  return chunks;
}

function getSourceQuality(sourceType = 'other') {
  return SOURCE_QUALITY[sourceType] || SOURCE_QUALITY.other;
}

function inferChunkMetadata(text, index = 0, approximateCharsPerPage = 2400) {
  const value = String(text || '');
  const moduleMatch = value.match(/\bModule\s+(\d+|[IVX]+)\s*:?\s*([^.\n]{0,90})/i);
  const unitMatch = value.match(/\bUnit\s+(\d+|[IVX]+)\s*:?\s*([^.\n]{0,90})/i);

  const cleanTitle = (match, label) => {
    if (!match) return '';
    const suffix = String(match[2] || '').trim();
    return suffix ? `${label} ${match[1]}: ${suffix}` : `${label} ${match[1]}`;
  };

  return {
    moduleTitle: cleanTitle(moduleMatch, 'Module'),
    unitTitle: cleanTitle(unitMatch, 'Unit'),
    pageNumber: Math.max(1, Math.floor((index * 1800) / approximateCharsPerPage) + 1),
  };
}

function tokenize(value) {
  const stopWords = new Set([
    'the', 'and', 'for', 'with', 'that', 'this', 'from', 'what', 'which', 'when', 'where',
    'are', 'was', 'were', 'has', 'have', 'into', 'their', 'there', 'then', 'than', 'about',
    'answer', 'question', 'option', 'following', 'noun', 'tma',
  ]);
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !stopWords.has(word));
}

function scoreChunk(chunk, queryTerms) {
  const text = chunk.normalizedText || '';
  let score = 0;
  for (const term of queryTerms) {
    if (text.includes(term)) score += 1;
  }
  if (chunk.sourceType === 'course_material') score += 1.5;
  if (['tma_1', 'tma_2', 'tma_3', 'past_question'].includes(chunk.sourceType)) score += 0.75;
  return score;
}

function detectQuestionType(question, options = []) {
  const normalized = String(question || '').toLowerCase();
  const cleanOptions = Array.isArray(options)
    ? options.map((item) => String(item || '').trim().toLowerCase())
    : [];

  if (
    normalized.includes('_____') ||
    normalized.includes('________') ||
    normalized.includes('fill in') ||
    normalized.includes('fill-in') ||
    normalized.includes('blank space') ||
    normalized.includes('gap')
  ) {
    return 'fill_gap';
  }

  const hasTrueFalseOptions = cleanOptions.length === 2 &&
    cleanOptions.includes('true') &&
    cleanOptions.includes('false');

  if (
    hasTrueFalseOptions ||
    /\btrue\s+or\s+false\b/i.test(question) ||
    /\btrue\/false\b/i.test(question)
  ) {
    return 'true_false';
  }

  if (options.length > 0) {
    return 'multiple_choice';
  }

  return 'short_answer';
}

function cosineSimilarity(a = [], b = []) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length === 0 || b.length === 0 || a.length !== b.length) {
    return 0;
  }

  let dot = 0;
  let aMagnitude = 0;
  let bMagnitude = 0;

  for (let index = 0; index < a.length; index++) {
    const av = Number(a[index] || 0);
    const bv = Number(b[index] || 0);
    dot += av * bv;
    aMagnitude += av * av;
    bMagnitude += bv * bv;
  }

  if (!aMagnitude || !bMagnitude) return 0;
  return dot / (Math.sqrt(aMagnitude) * Math.sqrt(bMagnitude));
}

async function generateEmbedding(text) {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error('Gemini API key is not configured.');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const candidates = [...new Set([
    normalizeGeminiModelName(GEMINI_EMBEDDING_MODEL, DEFAULT_GEMINI_EMBEDDING_MODEL),
    DEFAULT_GEMINI_EMBEDDING_MODEL,
    'embedding-001',
  ].filter(Boolean))];
  let lastError;

  for (const modelName of candidates) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.embedContent(compactText(text).slice(0, 8000));
      const values = result?.embedding?.values;

      if (!Array.isArray(values) || values.length === 0) {
        throw new Error('Embedding model returned no vector.');
      }

      activeEmbeddingModel = modelName;
      return values.map((value) => Number(value));
    } catch (error) {
      lastError = error;
      const message = String(error?.message || '');
      const canFallback = modelName !== DEFAULT_GEMINI_EMBEDDING_MODEL &&
        (message.includes('404') || message.includes('not found') || message.includes('not supported'));
      if (!canFallback) {
        throw error;
      }
    }
  }

  throw lastError || new Error('Embedding generation failed.');
}

function getActiveEmbeddingModel() {
  return activeEmbeddingModel || GEMINI_EMBEDDING_MODEL;
}

async function embedTexts(texts = []) {
  const concurrency = Math.max(1, Math.min(8, Number(process.env.TMA_EMBEDDING_CONCURRENCY || 4)));
  const results = new Array(texts.length);
  let cursor = 0;

  async function worker() {
    while (cursor < texts.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await generateEmbedding(texts[index]);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, texts.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

function buildEvidenceText(evidence = []) {
  return evidence.map((item, index) => {
    const priority = item.sourceType === 'course_material'
      ? 'PRIMARY SOURCE'
      : 'SUPPORTING SOURCE';
    const location = [item.moduleTitle, item.unitTitle, item.pageNumber ? `Page ${item.pageNumber}` : '']
      .filter(Boolean)
      .join(' | ');
    return `SOURCE ${index + 1} (${priority}, ${item.sourceType}, ${item.title}${location ? `, ${location}` : ''})\n${item.text}`;
  }).join('\n\n---\n\n');
}

async function answerAndVerifyWithGeminiPro({ question, options = [], evidence = [], questionType = 'short_answer' }) {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error('Gemini API key is not configured.');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: GEMINI_TMA_MODEL });
  const evidenceText = buildEvidenceText(evidence);
  const optionsText = options.length
    ? options.map((option, index) => `${String.fromCharCode(65 + index)}. ${option}`).join('\n')
    : 'No options provided';

  const prompt = `You are a precise NOUN TMA study assistant. Answer the question from the evidence in two internal passes, then return a single JSON.

PASS 1 — Answer: Read all evidence and determine the best answer.
PASS 2 — Verify: Re-read the evidence critically. Correct the answer if needed. PRIMARY SOURCE (course_material) always wins over SUPPORTING SOURCE (tma/past_question/other). If they conflict, trust course material.

Strict rules:
- Use ONLY the evidence below. No outside knowledge.
- For multiple_choice: return the option letter AND the full option text (e.g. "A. Photosynthesis").
- For fill_gap: return the exact missing word or phrase first, then a brief explanation.
- For true_false: return exactly "True" or "False" first, then a brief explanation.
- For short_answer: return the most precise answer the evidence supports.
- Set needsReview to true only when evidence is genuinely ambiguous or contradictory.

Question type: ${questionType}

Question:
${question}

Options:
${optionsText}

Evidence (ranked by relevance — PRIMARY SOURCE outranks all):
${evidenceText}

Return ONLY valid JSON with no markdown or extra text:
{
  "answer": "best answer from first pass",
  "confidence": 0,
  "explanation": "brief explanation citing source numbers",
  "evidenceUsed": [1, 2],
  "finalAnswer": "verified or corrected answer after second pass",
  "finalConfidence": 0,
  "finalExplanation": "final explanation grounded in PRIMARY SOURCE where available",
  "finalEvidenceUsed": [1, 2],
  "isSupported": true,
  "conflictNotes": "",
  "needsReview": false
}`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Gemini Pro did not return a parseable answer.');
  }

  const parsed = JSON.parse(jsonMatch[0]);
  const answer = String(parsed.answer || '').trim();
  const explanation = String(parsed.explanation || '').trim();

  return {
    answer,
    confidence: Math.max(0, Math.min(100, Number(parsed.confidence || 0))),
    explanation,
    evidenceUsed: Array.isArray(parsed.evidenceUsed) ? parsed.evidenceUsed : [],
    finalAnswer: String(parsed.finalAnswer || answer).trim(),
    finalConfidence: Math.max(0, Math.min(100, Number(parsed.finalConfidence || parsed.confidence || 0))),
    finalExplanation: String(parsed.finalExplanation || explanation).trim(),
    finalEvidenceUsed: Array.isArray(parsed.finalEvidenceUsed) ? parsed.finalEvidenceUsed : [],
    isSupported: Boolean(parsed.isSupported),
    conflictNotes: String(parsed.conflictNotes || '').trim(),
    needsReview: Boolean(parsed.needsReview),
    model: GEMINI_TMA_MODEL,
  };
}

async function answerWithGeminiPro({ question, options = [], evidence = [], questionType = 'short_answer' }) {
  const result = await answerAndVerifyWithGeminiPro({ question, options, evidence, questionType });
  return result;
}

async function verifyAnswerWithGeminiPro() {
  return null;
}

module.exports = {
  answerAndVerifyWithGeminiPro,
  answerWithGeminiPro,
  chunkText,
  compactText,
  detectCourseMetadata,
  detectQuestionType,
  downloadDocumentBuffer,
  embedTexts,
  extractDocumentBuffer,
  extractDocumentText,
  generateEmbedding,
  getActiveEmbeddingModel,
  getSourceQuality,
  inferChunkMetadata,
  scoreChunk,
  cosineSimilarity,
  tokenize,
  verifyAnswerWithGeminiPro,
  GEMINI_TMA_MODEL,
  GEMINI_EMBEDDING_MODEL,
};
