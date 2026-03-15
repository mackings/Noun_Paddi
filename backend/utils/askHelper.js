const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const ASK_SEARCH_ENDPOINT = 'https://html.duckduckgo.com/html/';
const MAX_SEARCH_RESULTS = 8;
const MAX_EVIDENCE_PAGES = 3;
const MAX_EVIDENCE_CHARS = 12000;
const USER_AGENT = 'Mozilla/5.0 (compatible; NounPaddiAsk/1.0; +https://paddi.com.ng)';

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

function stripHtml(value) {
  return normalizeWhitespace(
    decodeHtmlEntities(
      String(value || '')
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
    )
  );
}

function extractHostname(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch (error) {
    return '';
  }
}

function isPdfUrl(url = '') {
  const normalized = String(url || '').toLowerCase();
  return normalized.includes('.pdf') || normalized.includes('format=pdf');
}

function decodeDuckDuckGoUrl(url) {
  try {
    const absolute = url.startsWith('http') ? url : `https:${url}`;
    const parsed = new URL(absolute);
    const redirected = parsed.searchParams.get('uddg');
    return redirected ? decodeURIComponent(redirected) : absolute;
  } catch (error) {
    return url;
  }
}

function getGeminiClient() {
  const keysEnv = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '';
  const key = keysEnv.split(',').map((item) => item.trim()).find(Boolean);
  if (!key) return null;
  return new GoogleGenerativeAI(key);
}

function extractCourseCode(query) {
  const match = String(query || '').toUpperCase().match(/\b([A-Z]{3})\s*[-/]?\s*(\d{3})\b/);
  if (!match) return null;
  return `${match[1]} ${match[2]}`;
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

function buildSearchQuery(query, intent) {
  const cleanQuery = normalizeWhitespace(query);

  if (intent === 'past_question') {
    return `${cleanQuery} NOUN past questions pdf`;
  }
  if (intent === 'matriculation') {
    return `${cleanQuery} NOUN matriculation nou.edu.ng nounonline.edu.ng`;
  }
  if (intent === 'tma') {
    return `${cleanQuery} NOUN TMA nounonline.edu.ng nou.edu.ng`;
  }
  if (intent === 'timetable') {
    return `${cleanQuery} NOUN timetable exam schedule nounonline.edu.ng nou.edu.ng`;
  }

  return `${cleanQuery} National Open University of Nigeria NOUN`;
}

function buildClarification(intent, query) {
  if (intent !== 'past_question') return null;

  const courseCode = extractCourseCode(query);
  const normalized = String(query || '').toLowerCase();
  const hasCourseHint = courseCode || normalized.split(' ').length >= 4;

  if (hasCourseHint) return null;

  return {
    type: 'clarification',
    intent,
    title: 'Which past question do you need?',
    answer: 'Tell me the course code or title so I can look for the correct NOUN past question PDF.',
    followUpQuestion: 'Send something like "GST 105 past question", "BIO 101 past question", or include the semester/year if you know it.',
    suggestions: [
      'GST 105 past question',
      'BIO 101 past question',
      'CSC 202 past question 2023',
    ],
  };
}

async function searchDuckDuckGo(query) {
  const response = await axios.get(ASK_SEARCH_ENDPOINT, {
    params: { q: query },
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml',
    },
    timeout: 15000,
  });

  const html = String(response.data || '');
  const resultRegex = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  const snippetRegex = /<a[^>]*class="result__snippet"[^>]*>|<div[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/div>/gi;
  const snippets = [];
  let snippetMatch;

  while ((snippetMatch = snippetRegex.exec(html)) !== null) {
    const snippetValue = stripHtml(snippetMatch[1] || '');
    if (snippetValue) {
      snippets.push(snippetValue);
    }
  }

  const results = [];
  let match;
  let snippetIndex = 0;

  while ((match = resultRegex.exec(html)) !== null && results.length < MAX_SEARCH_RESULTS) {
    const url = decodeDuckDuckGoUrl(decodeHtmlEntities(match[1]));
    const title = stripHtml(match[2]);

    if (!url || !title) continue;
    if (!/^https?:\/\//i.test(url)) continue;

    results.push({
      title,
      url,
      snippet: snippets[snippetIndex] || '',
      isPdf: isPdfUrl(url) || /\.pdf\b/i.test(title),
      hostname: extractHostname(url),
    });
    snippetIndex += 1;
  }

  return results;
}

function scorePastQuestionResult(result, query) {
  const haystack = `${result.title} ${result.snippet} ${result.url}`.toLowerCase();
  const courseCode = extractCourseCode(query);
  let score = 0;

  if (result.isPdf) score += 5;
  if (haystack.includes('past question')) score += 3;
  if (haystack.includes('noun')) score += 2;
  if (haystack.includes('exam')) score += 1;
  if (courseCode && haystack.includes(courseCode.toLowerCase().replace(/\s+/g, ''))) score += 2;
  if (courseCode && haystack.includes(courseCode.toLowerCase())) score += 2;

  return score;
}

async function fetchPageText(url) {
  const response = await axios.get(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml',
    },
    timeout: 15000,
  });

  const text = stripHtml(response.data);
  return text.slice(0, MAX_EVIDENCE_CHARS);
}

async function collectEvidence(results) {
  const evidence = [];

  for (const result of results) {
    if (result.isPdf) continue;
    try {
      const text = await fetchPageText(result.url);
      if (!text || text.length < 200) continue;

      evidence.push({
        title: result.title,
        url: result.url,
        hostname: result.hostname,
        text,
      });
    } catch (error) {
      // Ignore individual page fetch failures.
    }

    if (evidence.length >= MAX_EVIDENCE_PAGES) {
      break;
    }
  }

  return evidence;
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

function buildFallbackInfo(query, intent, evidence) {
  const titleMap = {
    matriculation: 'Matriculation update',
    timetable: 'Timetable update',
    tma: 'TMA update',
    general: 'NOUN update',
  };

  const sentences = evidence
    .map((item) => item.text)
    .join(' ')
    .split(/(?<=[.!?])\s+/)
    .map((item) => normalizeWhitespace(item))
    .filter((item) => item.length > 40)
    .slice(0, 5);

  return {
    type: 'information',
    intent,
    title: titleMap[intent] || 'NOUN update',
    answer: sentences[0] || `I found NOUN-related information for "${query}", but I could not structure it cleanly.`,
    sections: [
      {
        title: 'Details',
        items: sentences.slice(1, 5),
      },
    ],
    suggestions: [
      'Show the current NOUN timetable',
      'Explain NOUN matriculation requirements',
      'How does NOUN TMA work?',
    ],
  };
}

async function structureInfoAnswer(query, intent, results, evidence) {
  if (!evidence.length) {
    return {
      type: 'information',
      intent,
      title: 'No matching update found',
      answer: 'I could not find enough NOUN-specific web information for that request right now.',
      sections: [],
      suggestions: [
        'NOUN matriculation requirements',
        'NOUN TMA submission guide',
        'NOUN exam timetable',
      ],
    };
  }

  const gemini = getGeminiClient();
  if (!gemini) {
    return buildFallbackInfo(query, intent, evidence);
  }

  const prompt = `You are preparing a NOUN student-facing answer using web evidence gathered by the server.

Rules:
- Return ONLY valid JSON.
- Do not include URLs, source names, citations, or any reference list.
- Keep the answer focused on National Open University of Nigeria (NOUN).
- Use exact dates if the evidence includes dates.
- If the evidence is uncertain or mixed, say that clearly.
- Keep the tone direct and student-friendly.

Return JSON in this exact shape:
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

User query: ${query}

Search result hints:
${results.slice(0, 5).map((item, index) => `${index + 1}. ${item.title} | ${item.snippet}`).join('\n')}

Evidence:
${evidence.map((item, index) => `Evidence ${index + 1}\nTitle: ${item.title}\nContent: ${item.text}`).join('\n\n')}
`;

  try {
    const model = gemini.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const response = await model.generateContent(prompt);
    const parsed = tryParseJson(response.response.text());
    if (parsed && parsed.type === 'information') {
      return parsed;
    }
  } catch (error) {
    // Fall back below.
  }

  return buildFallbackInfo(query, intent, evidence);
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

  const searchQuery = buildSearchQuery(cleanQuery, intent);
  const results = await searchDuckDuckGo(searchQuery);

  if (intent === 'past_question') {
    const bestPdf = [...results]
      .sort((a, b) => scorePastQuestionResult(b, cleanQuery) - scorePastQuestionResult(a, cleanQuery))
      .find((item) => item.isPdf);

    if (!bestPdf) {
      return {
        type: 'information',
        intent,
        title: 'No past question PDF found',
        answer: `I could not find a clean PDF result for "${cleanQuery}" right now. Try adding the course code, semester, or year.`,
        sections: [],
        suggestions: [
          `${cleanQuery} 2023`,
          `${cleanQuery} first semester`,
          `${cleanQuery} NOUN PDF`,
        ],
      };
    }

    return {
      type: 'past_question_pdf',
      intent,
      title: bestPdf.title,
      answer: 'I found a past question PDF that matches your request. It is ready to open below.',
      pdfUrl: bestPdf.url,
      fileName: bestPdf.title.replace(/[^\w\s.-]/g, '').trim() || 'noun-past-question.pdf',
      suggestions: [
        'Find another year for this course',
        'Look for first semester version',
        'Search a different NOUN course past question',
      ],
    };
  }

  const evidence = await collectEvidence(results);
  return structureInfoAnswer(cleanQuery, intent, results, evidence);
}

module.exports = {
  answerAskQuery,
};
