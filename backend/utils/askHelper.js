const axios = require('axios');

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const USER_AGENT = 'Mozilla/5.0 (compatible; NounPaddiAsk/1.0; +https://paddi.com.ng)';
const MAX_PAGE_SCAN_COUNT = 3;

function normalizeWhitespace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function decodeHtmlEntities(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x2F;/gi, '/')
    .replace(/&#x27;/gi, "'");
}

function extractCourseCode(query) {
  const match = String(query || '').toUpperCase().match(/\b([A-Z]{3})\s*[-/]?\s*(\d{3})\b/);
  if (!match) return null;
  return `${match[1]} ${match[2]}`;
}

function extractYear(query) {
  const match = String(query || '').match(/\b(20\d{2}|19\d{2})\b/);
  return match ? match[1] : null;
}

function classifyIntent(query) {
  const normalized = String(query || '').toLowerCase();

  if (/\bpast\s*question|\bpast\s*questions|\bexam\s*question|\bexam\s*paper|\bqp\b/.test(normalized)) {
    return 'past_question';
  }
  if (/\bmatriculation|\bmatric\b/.test(normalized)) {
    return 'matriculation';
  }
  if (/\btma\b|\btutor[-\s]*marked assignment\b/.test(normalized)) {
    return 'tma';
  }
  if (/\btimetable\b|\btime\s*table\b|\bexam schedule\b|\bexam timetable\b/.test(normalized)) {
    return 'timetable';
  }

  return 'general';
}

function buildClarification(intent, query) {
  if (intent !== 'past_question') return null;

  const courseCode = extractCourseCode(query);
  const year = extractYear(query);

  if (courseCode && year) return null;

  if (!courseCode && !year) {
    return {
      type: 'clarification',
      intent,
      title: 'I need the course code and year',
      answer: 'To find the right NOUN past question, send the course code and the year you want.',
      followUpQuestion: 'Reply with something like "GST 105 past question 2023" or "BIO 101 past question 2022".',
      suggestions: [
        'GST 105 past question 2023',
        'BIO 101 past question 2022',
        'CSC 202 past question 2021',
      ],
    };
  }

  if (!courseCode) {
    return {
      type: 'clarification',
      intent,
      title: 'I still need the course code',
      answer: 'Add the exact NOUN course code so I can search for the correct past question PDF.',
      followUpQuestion: `Include the course code with the year, for example "${year || '2023'}".`,
      suggestions: [
        `GST 105 past question ${year || '2023'}`,
        `BIO 101 past question ${year || '2023'}`,
        `CSC 202 past question ${year || '2023'}`,
      ],
    };
  }

  if (!year) {
    return {
      type: 'clarification',
      intent,
      title: 'I still need the year',
      answer: `I have the course code ${courseCode}. Now send the year so I can search for the right past question.`,
      followUpQuestion: `Reply with something like "${courseCode} past question 2023".`,
      suggestions: [
        `${courseCode} past question 2023`,
        `${courseCode} past question 2022`,
        `${courseCode} past question 2021`,
      ],
    };
  }

  return {
    type: 'clarification',
    intent,
    title: 'I need the course code and year',
    answer: 'Send the exact course code and year so I can find the correct NOUN past question PDF.',
    followUpQuestion: 'Reply with something like "GST 105 past question 2023".',
    suggestions: [
      'GST 105 past question 2023',
      'BIO 101 past question 2022',
      'CSC 202 past question 2023',
    ],
  };
}

function isPdfUrl(url = '') {
  const normalized = String(url || '').toLowerCase();
  return normalized.includes('.pdf') || normalized.includes('format=pdf');
}

function getGeminiApiKey() {
  const keysEnv = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '';
  return keysEnv.split(',').map((item) => item.trim()).find(Boolean) || '';
}

function tryParseJson(text) {
  const match = String(text || '').match(/\{[\s\S]*\}/);
  if (!match) return null;

  try {
    return JSON.parse(match[0]);
  } catch (error) {
    return null;
  }
}

function getCandidateText(candidate) {
  const parts = candidate?.content?.parts || [];
  return parts
    .map((part) => String(part?.text || '').trim())
    .filter(Boolean)
    .join('\n')
    .trim();
}

function extractGroundingSources(candidate) {
  const chunks = candidate?.groundingMetadata?.groundingChunks || [];
  const unique = new Map();

  for (const chunk of chunks) {
    const web = chunk?.web;
    if (!web?.uri) continue;
    const key = String(web.uri).trim();
    if (!key || unique.has(key)) continue;
    unique.set(key, {
      url: key,
      title: normalizeWhitespace(web.title || ''),
    });
  }

  return Array.from(unique.values());
}

async function runGeminiGroundedPrompt(prompt) {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error('Gemini API key is not configured.');
  }

  try {
    const response = await axios.post(
      GEMINI_ENDPOINT,
      {
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        tools: [
          {
            google_search: {},
          },
        ],
      },
      {
        headers: {
          'x-goog-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    const candidate = response.data?.candidates?.[0];
    const text = getCandidateText(candidate);

    return {
      text,
      parsed: tryParseJson(text),
      sources: extractGroundingSources(candidate),
      webSearchQueries: candidate?.groundingMetadata?.webSearchQueries || [],
    };
  } catch (error) {
    const status = error.response?.status;
    if (status === 400) {
      throw new Error('Gemini grounding request failed. Check your Gemini API configuration.');
    }
    if (status === 403) {
      throw new Error('Gemini search access was denied. Check that your API key can use Google Search grounding.');
    }
    if (status === 429) {
      throw new Error('Gemini is rate-limiting Ask right now. Please try again shortly.');
    }
    throw new Error('Gemini could not complete the grounded web search right now.');
  }
}

async function fetchPdfLinksFromPage(url) {
  const response = await axios.get(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    timeout: 15000,
  });

  const html = String(response.data || '');
  const matches = html.match(/href\s*=\s*["']([^"']+\.pdf(?:\?[^"']*)?)["']/gi) || [];
  const pdfLinks = [];

  for (const match of matches) {
    const hrefMatch = match.match(/href\s*=\s*["']([^"']+)["']/i);
    if (!hrefMatch?.[1]) continue;

    try {
      const absolute = new URL(decodeHtmlEntities(hrefMatch[1]), url).toString();
      if (!pdfLinks.includes(absolute)) {
        pdfLinks.push(absolute);
      }
    } catch (error) {
      // Ignore malformed URLs.
    }
  }

  return pdfLinks;
}

function scorePdfCandidate(candidate, query) {
  const haystack = `${candidate.title || ''} ${candidate.url || ''}`.toLowerCase();
  const courseCode = extractCourseCode(query);
  let score = 0;

  if (isPdfUrl(candidate.url)) score += 5;
  if (haystack.includes('past question')) score += 3;
  if (haystack.includes('noun')) score += 2;
  if (haystack.includes('exam')) score += 1;
  if (courseCode && haystack.includes(courseCode.toLowerCase())) score += 3;
  if (courseCode && haystack.includes(courseCode.toLowerCase().replace(/\s+/g, ''))) score += 2;

  return score;
}

async function findBestPastQuestionPdf(query, sources) {
  const directCandidates = sources
    .filter((source) => isPdfUrl(source.url))
    .map((source) => ({ ...source, direct: true }));

  const scannedCandidates = [];

  for (const source of sources.slice(0, MAX_PAGE_SCAN_COUNT)) {
    if (isPdfUrl(source.url)) continue;

    try {
      const pdfLinks = await fetchPdfLinksFromPage(source.url);
      for (const pdfUrl of pdfLinks) {
        scannedCandidates.push({
          url: pdfUrl,
          title: source.title,
          direct: false,
        });
      }
    } catch (error) {
      // Ignore individual page scan failures.
    }
  }

  return [...directCandidates, ...scannedCandidates]
    .sort((a, b) => scorePdfCandidate(b, query) - scorePdfCandidate(a, query))[0] || null;
}

function buildSuggestions(intent, query) {
  if (intent === 'past_question') {
    return [
      `${query} 2023`,
      `${query} first semester`,
      `${query} pdf`,
    ];
  }

  if (intent === 'matriculation') {
    return [
      'NOUN matriculation requirements',
      'Latest NOUN matriculation date',
      'Documents needed for NOUN matriculation',
    ];
  }

  if (intent === 'timetable') {
    return [
      'Latest NOUN timetable',
      'NOUN exam timetable for this semester',
      'NOUN rescheduled exam timetable',
    ];
  }

  if (intent === 'tma') {
    return [
      'How to submit NOUN TMA',
      'NOUN TMA deadline',
      'How NOUN TMA is graded',
    ];
  }

  return [
    'NOUN matriculation requirements',
    'Latest NOUN timetable',
    'Explain NOUN TMA submission',
  ];
}

async function buildPastQuestionResponse(query, grounded) {
  const parsed = grounded.parsed || {};
  const bestPdf = await findBestPastQuestionPdf(query, grounded.sources);

  if (!bestPdf) {
    return {
      type: 'information',
      intent: 'past_question',
      title: parsed.title || 'No past question PDF found',
      answer: parsed.answer || `Gemini searched the web but did not find a usable PDF for "${query}". Add a year, semester, or a more exact course title.`,
      sections: [
        {
          title: 'Try a narrower prompt',
          items: [
            'Add the year if you know it.',
            'Add first semester or second semester.',
            'Use the exact NOUN course code.',
          ],
        },
      ],
      suggestions: buildSuggestions('past_question', query),
    };
  }

  return {
    type: 'past_question_pdf',
    intent: 'past_question',
    title: parsed.title || bestPdf.title || 'NOUN past question',
    answer: parsed.answer || 'Gemini found a past question PDF that matches your request. It is ready to open below.',
    pdfUrl: bestPdf.url,
    fileName: (bestPdf.title || 'noun-past-question').replace(/[^\w\s.-]/g, '').trim() || 'noun-past-question.pdf',
    suggestions: parsed.suggestions || [
      'Find another year for this course',
      'Look for first semester version',
      'Search a different NOUN course past question',
    ],
  };
}

function buildInfoFallback(query, intent) {
  return {
    type: 'information',
    intent,
    title: 'No grounded NOUN answer found',
    answer: `Gemini could not produce a grounded NOUN-specific answer for "${query}" right now.`,
    sections: [],
    suggestions: buildSuggestions(intent, query),
  };
}

async function buildInformationResponse(query, intent, grounded) {
  const parsed = grounded.parsed;
  if (parsed && parsed.type === 'information') {
    return {
      ...parsed,
      suggestions: Array.isArray(parsed.suggestions) && parsed.suggestions.length > 0
        ? parsed.suggestions
        : buildSuggestions(intent, query),
    };
  }

  return buildInfoFallback(query, intent);
}

function buildGroundedPrompt(query, intent) {
  if (intent === 'past_question') {
    return `Use Google Search grounding to research this request about National Open University of Nigeria (NOUN): "${query}".

Find whether a real NOUN past-question PDF or page likely exists.

Return ONLY valid JSON in this exact shape:
{
  "type": "past_question_pdf",
  "title": "short result title",
  "answer": "one short student-friendly paragraph with no links, no URLs, and no citations",
  "suggestions": ["follow up 1", "follow up 2", "follow up 3"]
}

Rules:
- Focus only on NOUN-related results.
- Prefer actual past-question documents or pages that clearly point to past questions.
- Do not include links, URLs, source names, or citations in the answer.
- If you do not find a reliable match, make that clear in the answer.
- Keep the response compact and useful for a student.`;
  }

  return `Use Google Search grounding to answer this NOUN student request: "${query}".

Return ONLY valid JSON in this exact shape:
{
  "type": "information",
  "intent": "${intent}",
  "title": "short title",
  "answer": "short summary paragraph",
  "sections": [
    { "title": "section title", "items": ["bullet 1", "bullet 2"] }
  ],
  "suggestions": ["follow up 1", "follow up 2", "follow up 3"]
}

Rules:
- Focus only on National Open University of Nigeria (NOUN).
- Use exact dates when grounded results mention dates.
- If the information is uncertain or conflicting, say that clearly.
- Do not include links, URLs, source names, or citations in the answer.
- Keep it student-friendly and ready for UI presentation.`;
}

async function answerAskQuery(query) {
  const cleanQuery = normalizeWhitespace(query);
  if (!cleanQuery) {
    throw new Error('Please enter a question.');
  }

  const intent = classifyIntent(cleanQuery);
  const clarification = buildClarification(intent, cleanQuery);
  if (clarification) {
    return clarification;
  }

  const grounded = await runGeminiGroundedPrompt(buildGroundedPrompt(cleanQuery, intent));

  if (intent === 'past_question') {
    return buildPastQuestionResponse(cleanQuery, grounded);
  }

  return buildInformationResponse(cleanQuery, intent, grounded);
}

module.exports = {
  answerAskQuery,
};
