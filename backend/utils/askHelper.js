const axios = require('axios');

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const USER_AGENT = 'Mozilla/5.0 (compatible; NounPaddiAsk/1.0; +https://paddi.com.ng)';
const MAX_PAGE_SCAN_COUNT = 6;
const MAX_FILE_CANDIDATES_TO_VERIFY = 8;
const WHATSAPP_GROUP_URL = 'https://chat.whatsapp.com/Ezx0OmcT1bs1BSymYT1f4G';
const PUREDU_PAST_QUESTIONS_ENDPOINT = 'https://puredu.net/Past-Questions.php';
const PUREDU_TMA_ENDPOINT = 'https://puredu.net/TMAs.php';
const PUREDU_ECOURSEWARE_ENDPOINT = 'https://puredu.net/e-courseware/search';
const BBCNOUN_PAST_QUESTIONS_ENDPOINT = 'https://bbcnoun.com.ng/wp-admin/admin-ajax.php';
const BBCNOUN_PAST_QUESTIONS_NONCE = '3c02b73c95';
const PRIORITY_DOMAINS = ['nou.edu.ng', 'noungeeks.com', 'puredu.net', 'bbcnoun.com.ng'];
const SITE_SEED_URLS = {
  
  past_question: [
    { url: 'https://noungeeks.com/noun-past-questions/', title: 'NounGeeks Past Questions' },
    { url: 'https://puredu.net/noun-past-questions', title: 'PurEdu Past Questions' },
    { url: 'https://bbcnoun.com.ng/', title: 'BBCNOUN Home' },
  ],
  tma: [
    { url: 'https://noungeeks.com/category/noun-tma-past-questions-and-answers/', title: 'NounGeeks TMA Past Questions' },
    { url: 'https://puredu.net/noun-tma-questions-and-answers-box', title: 'PurEdu TMA Questions and Answers' },
    { url: 'https://bbcnoun.com.ng/', title: 'BBCNOUN Home' },
  ],
  timetable: [
    { url: 'https://noungeeks.com/', title: 'NounGeeks Home' },
    { url: 'https://puredu.net/noun-personalised-exam-table', title: 'PurEdu Exam Table' },
    { url: 'https://bbcnoun.com.ng/', title: 'BBCNOUN Home' },
  ],
};

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

function getHostname(url = '') {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch (error) {
    return '';
  }
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

function extractFileExtension(url = '') {
  const match = String(url || '').toLowerCase().match(/\.([a-z0-9]{2,5})(?:[\?#]|$)/);
  return match ? match[1] : '';
}

function buildSafeFileName(url = '', fallback = 'noun-file') {
  try {
    const pathname = new URL(url).pathname;
    const raw = decodeURIComponent(pathname.split('/').pop() || '').trim();
    const cleaned = raw.replace(/[^\w.\- ]/g, '').trim();
    if (cleaned) return cleaned;
  } catch (error) {
    // Ignore parsing issues.
  }

  return fallback;
}

function buildCourseCodeVariants(courseCode = '') {
  const compact = String(courseCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!compact) return [];

  const alpha = compact.replace(/\d+/g, '');
  const digits = compact.replace(/[A-Z]+/g, '');
  const spaced = alpha && digits ? `${alpha} ${digits}` : compact;

  return [compact, spaced].filter(Boolean);
}

function classifyIntent(query) {
  const normalized = String(query || '').toLowerCase();
  const courseCode = extractCourseCode(query);

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
  if (courseCode) {
    return 'past_question';
  }

  return 'general';
}

function buildClarification(intent, query) {
  if (intent === 'course_material') {
    const courseCode = extractCourseCode(query);
    if (courseCode) return null;

    return {
      type: 'clarification',
      intent,
      title: 'I need the course code',
      answer: 'Send the exact course code so I can search for the course material (course guide, lecture notes, or textbook PDF) for that course.',
      followUpQuestion: 'Reply with something like "GST 105 course material" or "BIO 101 course material".',
      suggestions: [
        'GST 105 course material',
        'BIO 101 course material',
        'CSC 202 course material',
      ],
    };
  }

  if (intent !== 'past_question') return null;

  const courseCode = extractCourseCode(query);
  if (courseCode) return null;

  return {
    type: 'clarification',
    intent,
    title: 'I need the course code',
    answer: 'Send the exact course code so I can search the available past-question files for that course.',
    followUpQuestion: 'Reply with something like "GST 105 past question" or "BIO 101 past question".',
    suggestions: [
      'GST 105 past question',
      'BIO 101 past question',
      'CSC 202 past question',
    ],
  };
}

function withWhatsAppGroup(payload = {}) {
  return {
    ...payload,
    whatsappGroup: {
      label: 'Join NOUN WhatsApp Group',
      url: WHATSAPP_GROUP_URL,
    },
  };
}

async function searchPureduFiles(endpoint, courseCode) {
  const normalizedCode = String(courseCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!normalizedCode) return [];

  try {
    const response = await axios.post(
      endpoint,
      new URLSearchParams({ input: normalizedCode }).toString(),
      {
        headers: {
          'User-Agent': USER_AGENT,
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest',
          Origin: 'https://puredu.net',
          Referer: 'https://puredu.net/noun-past-questions',
        },
        timeout: 20000,
      }
    );

    const html = String(response.data || '');
    const rowRegex = /<tr>([\s\S]*?)<\/tr>/gi;
    const rows = [];
    let rowMatch;

    while ((rowMatch = rowRegex.exec(html)) !== null) {
      const rowHtml = rowMatch[1];
      const cells = [...rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((match) =>
        normalizeWhitespace(decodeHtmlEntities(String(match[1] || '').replace(/<[^>]+>/g, ' ')))
      );
      const hrefMatch = rowHtml.match(/href="([^"]+)"/i);
      if (!hrefMatch?.[1] || cells.length < 2) continue;

      const absoluteUrl = normalizePotentialFileUrl(new URL(hrefMatch[1], 'https://puredu.net/').toString());
      const label = cells[1] || normalizedCode;
      const extension = extractFileExtension(absoluteUrl);

      rows.push({
        label,
        url: absoluteUrl,
        fileName: buildSafeFileName(absoluteUrl, `${label}.${extension || 'file'}`),
        extension,
      });
    }

    return rows;
  } catch (error) {
    return [];
  }
}

async function searchBbcnounFiles(courseCode) {
  const variants = buildCourseCodeVariants(courseCode);
  const compactCode = variants[0] || '';
  if (!compactCode) return [];

  try {
    const response = await axios.post(
      BBCNOUN_PAST_QUESTIONS_ENDPOINT,
      new URLSearchParams({
        action: 'dlp_folder_search',
        nonce: BBCNOUN_PAST_QUESTIONS_NONCE,
        search: compactCode,
      }).toString(),
      {
        headers: {
          'User-Agent': USER_AGENT,
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest',
          Origin: 'https://bbcnoun.com.ng',
          Referer: 'https://bbcnoun.com.ng/noun-past-questions/',
        },
        timeout: 25000,
      }
    );

    const payload = response.data;
    const html = typeof payload === 'string'
      ? payload
      : String(payload?.html || '');

    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    const rows = [];
    let rowMatch;

    while ((rowMatch = rowRegex.exec(html)) !== null) {
      const rowHtml = rowMatch[1];
      const cells = [...rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((match) =>
        normalizeWhitespace(decodeHtmlEntities(String(match[1] || '').replace(/<[^>]+>/g, ' ')))
      );
      const hrefMatch = rowHtml.match(/href="([^"]+)"/i);
      if (!hrefMatch?.[1] || cells.length < 3) continue;

      const codeCell = cells[0] || '';
      const normalizedCell = codeCell.toUpperCase().replace(/[^A-Z0-9]/g, '');
      const isMatch = variants.some((variant) => normalizedCell.includes(variant.replace(/[^A-Z0-9]/g, '')));
      if (!isMatch) continue;

      const absoluteUrl = normalizePotentialFileUrl(new URL(hrefMatch[1], 'https://bbcnoun.com.ng/').toString());
      const extension = extractFileExtension(absoluteUrl);
      const semester = cells[2] || '';
      const label = semester ? `${codeCell} - ${semester}` : codeCell;

      rows.push({
        label,
        url: absoluteUrl,
        fileName: buildSafeFileName(absoluteUrl, `${codeCell}.${extension || 'file'}`),
        extension,
      });
    }

    return rows;
  } catch (error) {
    return [];
  }
}

// PurEdu's e-courseware search is a clean JSON API (GET .../search?code=GST101 ->
// { matches: [{ code, title, filename, url, size }], total }) — unlike the past-question
// and TMA endpoints above, there's no HTML to parse and no request body/nonce to forge.
// Verified directly: the returned `url` is a real, directly downloadable PDF (confirmed
// via a HEAD-equivalent GET returning Content-Type: application/pdf), so these results
// are trusted as direct downloads without needing the generic verifyPdfCandidate step.
async function searchPureduCourseMaterial(courseCode) {
  const compactCode = String(courseCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!compactCode) return [];

  try {
    const response = await axios.get(PUREDU_ECOURSEWARE_ENDPOINT, {
      params: { code: compactCode },
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
      },
      timeout: 20000,
    });

    const matches = Array.isArray(response.data?.matches) ? response.data.matches : [];

    return matches.map((match) => {
      const absoluteUrl = normalizePotentialFileUrl(match.url);
      const extension = extractFileExtension(absoluteUrl) || 'pdf';
      const label = match.title ? `${match.code} - ${match.title}` : match.code;

      return {
        label,
        url: absoluteUrl,
        fileName: match.filename || buildSafeFileName(absoluteUrl, `${match.code}.${extension}`),
        extension,
      };
    });
  } catch (error) {
    return [];
  }
}

async function getDirectSiteFiles(query, intent) {
  const courseCode = extractCourseCode(query);
  if (!courseCode) return [];

  if (intent === 'past_question') {
    const [pureduFiles, bbcnounFiles] = await Promise.all([
      searchPureduFiles(PUREDU_PAST_QUESTIONS_ENDPOINT, courseCode),
      searchBbcnounFiles(courseCode),
    ]);

    const deduped = [];
    const seen = new Set();

    for (const file of [...pureduFiles, ...bbcnounFiles]) {
      const key = String(file.url || '').toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      deduped.push(file);
    }

    return deduped;
  }

  if (intent === 'tma') {
    return searchPureduFiles(PUREDU_TMA_ENDPOINT, courseCode);
  }

  if (intent === 'course_material') {
    return searchPureduCourseMaterial(courseCode);
  }

  return [];
}

function isPdfUrl(url = '') {
  const normalized = String(url || '').toLowerCase();
  return normalized.includes('.pdf') || normalized.includes('format=pdf');
}

function isLikelyDownloadUrl(url = '') {
  const normalized = String(url || '').toLowerCase();
  return (
    isPdfUrl(normalized) ||
    normalized.includes('drive.google.com') ||
    normalized.includes('docs.google.com') ||
    normalized.includes('dropbox.com') ||
    normalized.includes('onedrive.live.com') ||
    normalized.includes('1drv.ms') ||
    normalized.includes('mediafire.com') ||
    normalized.includes('download') ||
    normalized.includes('export=download')
  );
}

function normalizePotentialFileUrl(url = '') {
  const raw = String(url || '').trim();
  if (!raw) return raw;

  try {
    const parsed = new URL(raw);
    const hostname = parsed.hostname.toLowerCase();

    if (hostname.includes('drive.google.com')) {
      const fileMatch = parsed.pathname.match(/\/file\/d\/([^/]+)/i);
      if (fileMatch?.[1]) {
        return `https://drive.google.com/uc?export=download&id=${fileMatch[1]}`;
      }

      const id = parsed.searchParams.get('id');
      if (id) {
        return `https://drive.google.com/uc?export=download&id=${id}`;
      }
    }

    if (hostname.includes('dropbox.com')) {
      parsed.searchParams.set('dl', '1');
      return parsed.toString();
    }

    return parsed.toString();
  } catch (error) {
    return raw;
  }
}

function getSeedSources(intent) {
  return SITE_SEED_URLS[intent] || [];
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

function extractUrlsFromText(text) {
  const matches = String(text || '').match(/https?:\/\/[^\s)>\]"]+/gi) || [];
  const unique = [];
  const seen = new Set();

  for (const match of matches) {
    const normalized = normalizePotentialFileUrl(match.replace(/[.,;]+$/g, ''));
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    unique.push(normalized);
  }

  return unique;
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
        // 30s was too tight — verified directly that Gemini sometimes runs a dozen-plus
        // internal search-query variations within one grounded call (especially for
        // course_material's more exploratory prompt) and can legitimately take longer
        // than that to respond, which was surfacing as a generic "could not complete"
        // error even though the request would have succeeded given more time.
        timeout: 55000,
      }
    );

    const candidate = response.data?.candidates?.[0];
    const text = getCandidateText(candidate);

    return {
      text,
      parsed: tryParseJson(text),
      sources: extractGroundingSources(candidate),
      extractedUrls: extractUrlsFromText(text),
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

async function extractFileCandidatesFromPage(url) {
  const response = await axios.get(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    timeout: 15000,
  });

  const html = String(response.data || '');
  const linkRegex = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const candidates = [];
  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    const href = decodeHtmlEntities(match[1] || '');
    const anchorText = normalizeWhitespace(
      decodeHtmlEntities(String(match[2] || '').replace(/<[^>]+>/g, ' '))
    );

    if (!href) continue;

    try {
      const absolute = normalizePotentialFileUrl(new URL(href, url).toString());
      const combinedText = `${absolute} ${anchorText}`.toLowerCase();
      if (
        isLikelyDownloadUrl(absolute) ||
        combinedText.includes('pdf') ||
        combinedText.includes('download') ||
        combinedText.includes('past question')
      ) {
        candidates.push({
          url: absolute,
          title: anchorText,
        });
      }
    } catch (error) {
      // Ignore malformed URLs.
    }
  }

  const rawUrlMatches = html.match(/https?:\/\/[^"'()\s<>]+(?:\.pdf(?:\?[^"'()\s<>]*)?)/gi) || [];
  for (const rawUrl of rawUrlMatches) {
    const normalized = normalizePotentialFileUrl(decodeHtmlEntities(rawUrl));
    if (!normalized) continue;
    candidates.push({
      url: normalized,
      title: '',
    });
  }

  return candidates;
}

async function verifyPdfCandidate(candidate) {
  try {
    const response = await axios.get(candidate.url, {
      responseType: 'stream',
      timeout: 20000,
      maxRedirects: 5,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/pdf,application/octet-stream,text/html;q=0.8,*/*;q=0.5',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      validateStatus: (status) => status >= 200 && status < 400,
    });

    const contentType = String(response.headers['content-type'] || '').toLowerCase();
    const disposition = String(response.headers['content-disposition'] || '').toLowerCase();
    const finalUrl = normalizePotentialFileUrl(
      response.request?.res?.responseUrl || candidate.url
    );

    response.data.destroy();

    const isPdf =
      contentType.includes('application/pdf') ||
      (contentType.includes('application/octet-stream') && disposition.includes('.pdf')) ||
      disposition.includes('.pdf') ||
      isPdfUrl(finalUrl);

    if (!isPdf) {
      return null;
    }

    return {
      ...candidate,
      url: finalUrl,
    };
  } catch (error) {
    return null;
  }
}

function scorePdfCandidate(candidate, query, intent = 'past_question') {
  const haystack = `${candidate.title || ''} ${candidate.url || ''}`.toLowerCase();
  const courseCode = extractCourseCode(query);
  const year = extractYear(query);
  const hostname = getHostname(candidate.url);
  let score = 0;

  if (isPdfUrl(candidate.url)) score += 5;
  if (isLikelyDownloadUrl(candidate.url)) score += 2;
  if (intent === 'past_question' && haystack.includes('past question')) score += 3;
  if (intent === 'timetable' && (haystack.includes('timetable') || haystack.includes('schedule'))) score += 4;
  if (intent === 'course_material') {
    if (/course\s*guide|course\s*material|lecture\s*note|study\s*material|textbook|module/.test(haystack)) score += 4;
    if (hostname === 'nou.edu.ng' || hostname.endsWith('.nou.edu.ng')) score += 4;
    if (/past\s*question|exam\s*paper|\bqp\b/.test(haystack)) score -= 5;
    if (/\bsummary\b|\bsummarized\b|\bstudy\s*guide\b/.test(haystack)) score -= 5;
  }
  if (haystack.includes('noun')) score += 2;
  if (haystack.includes('exam')) score += 1;
  if (courseCode && haystack.includes(courseCode.toLowerCase())) score += 3;
  if (courseCode && haystack.includes(courseCode.toLowerCase().replace(/\s+/g, ''))) score += 2;
  if (year && haystack.includes(year)) score += 2;
  if (haystack.includes('first semester')) score += 1;
  if (haystack.includes('second semester')) score += 1;
  if (haystack.includes('2025') || haystack.includes('2026')) score += intent === 'timetable' ? 1 : 0;
  // The URL's own hostname only reflects a priority domain once a redirect has been
  // resolved — at scoring time, many candidates are still opaque
  // vertexaisearch.cloud.google.com grounding redirects, so also check the grounding
  // chunk's title (isPriorityGroundingSource), which carries the real hostname Google
  // indexed (e.g. "nou.edu.ng") before that resolution happens.
  if (
    PRIORITY_DOMAINS.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`)) ||
    isPriorityGroundingSource(candidate)
  ) {
    score += 3;
  }

  return score;
}

// Grounding chunk titles are the hostname Google actually indexed (e.g. "nou.edu.ng"),
// even though the chunk's own `url` is an opaque vertexaisearch.cloud.google.com redirect
// that only resolves to the real domain once fetched. Checking the title here — not just
// the URL's own hostname — is what lets an official-domain result get priority scanning
// even before that redirect has been followed.
function isPriorityGroundingSource(candidate) {
  const haystack = `${candidate?.title || ''} ${candidate?.url || ''}`.toLowerCase();
  return PRIORITY_DOMAINS.some((domain) => haystack.includes(domain));
}

async function findBestPdfFile(query, sources, intent = 'past_question') {
  const seededSources = getSeedSources(intent);
  const directCandidates = sources
    .filter((source) => isLikelyDownloadUrl(source.url))
    .map((source) => ({
      ...source,
      url: normalizePotentialFileUrl(source.url),
      direct: true,
    }));

  const scannedCandidates = [];

  // Keep whichever duplicate has a title — candidate pools are built by concatenating a
  // title-less de-duped list with the raw, title-preserving grounding sources, so the
  // same URL often appears twice with only the second copy carrying its real title (e.g.
  // "nou.edu.ng"). A naive first-seen dedup would silently keep the title-less copy and
  // defeat isPriorityGroundingSource's title check below.
  const explorationByUrl = new Map();
  for (const source of [...sources, ...seededSources]) {
    const key = String(source?.url || '').trim();
    if (!key) continue;
    const existing = explorationByUrl.get(key);
    if (!existing || (!existing.title && source?.title)) {
      explorationByUrl.set(key, source);
    }
  }
  const dedupedExplorationSources = Array.from(explorationByUrl.values());

  // Verified/priority-domain sources (Gemini's actual grounded search hits, especially
  // nou.edu.ng) get scanned before Gemini's own text-derived candidateUrls guesses — a
  // real case showed Gemini finding nou.edu.ng via grounding but then omitting it from
  // its own JSON candidateUrls, reasoning (incorrectly) that NOUN doesn't expose direct
  // PDFs. Without this, that source would fall outside the limited scan budget below.
  const explorationSources = [...dedupedExplorationSources].sort((a, b) => (
    (isPriorityGroundingSource(b) ? 1 : 0) - (isPriorityGroundingSource(a) ? 1 : 0)
  ));

  for (const source of explorationSources.slice(0, Math.max(MAX_PAGE_SCAN_COUNT, seededSources.length + MAX_PAGE_SCAN_COUNT))) {
    if (isLikelyDownloadUrl(source.url)) continue;

    // Some grounding sources are opaque redirect URLs (e.g. Gemini's
    // vertexaisearch.cloud.google.com/grounding-api-redirect/... chunks) that resolve
    // directly to the file itself rather than to an HTML page containing a link to it.
    // Queuing the source URL as its own candidate lets verifyPdfCandidate's redirect
    // handling catch that case; the HTML-link scan below still handles the other case,
    // where the resolved page merely links out to the real file.
    scannedCandidates.push({
      url: source.url,
      title: source.title,
      direct: false,
    });

    try {
      const pdfLinks = await fetchPdfLinksFromPage(source.url);
      for (const pdfUrl of pdfLinks) {
        scannedCandidates.push({
          url: normalizePotentialFileUrl(pdfUrl),
          title: source.title,
          direct: false,
        });
      }

      const fileCandidates = await extractFileCandidatesFromPage(source.url);
      for (const candidate of fileCandidates) {
        scannedCandidates.push({
          url: candidate.url,
          title: candidate.title || source.title,
          direct: false,
        });
      }
    } catch (error) {
      // Ignore individual page scan failures.
    }
  }

  const uniqueCandidates = [];
  const seen = new Set();

  for (const candidate of [...directCandidates, ...scannedCandidates]) {
    const key = normalizePotentialFileUrl(candidate.url);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    uniqueCandidates.push({
      ...candidate,
      url: key,
    });
  }

  const ranked = uniqueCandidates
    .sort((a, b) => scorePdfCandidate(b, query, intent) - scorePdfCandidate(a, query, intent))
    .slice(0, MAX_FILE_CANDIDATES_TO_VERIFY);

  for (const candidate of ranked) {
    const verified = await verifyPdfCandidate(candidate);
    if (verified) {
      return verified;
    }
  }

  return null;
}

function buildPastQuestionCandidateList(grounded) {
  const parsedCandidates = Array.isArray(grounded?.parsed?.candidateUrls)
    ? grounded.parsed.candidateUrls
    : [];

  const groundedSourceUrls = Array.isArray(grounded?.sources)
    ? grounded.sources.map((item) => item.url)
    : [];

  const extractedUrls = Array.isArray(grounded?.extractedUrls)
    ? grounded.extractedUrls
    : [];

  const all = [...parsedCandidates, ...extractedUrls, ...groundedSourceUrls];
  const unique = [];
  const seen = new Set();

  for (const item of all) {
    const normalized = normalizePotentialFileUrl(item);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    unique.push({
      url: normalized,
      title: '',
    });
  }

  return unique;
}

function buildFileCandidateList(grounded) {
  return buildPastQuestionCandidateList(grounded);
}

function buildSuggestions(intent, query) {
  if (intent === 'course_material') {
    return [
      `${extractCourseCode(query) || 'GST 105'} course material`,
      `${extractCourseCode(query) || 'GST 105'} course guide`,
      `${extractCourseCode(query) || 'GST 105'} lecture notes`,
    ];
  }

  if (intent === 'past_question') {
    return [
      `${extractCourseCode(query) || 'GST 105'} past question`,
      `${extractCourseCode(query) || 'GST 105'} first semester past question`,
      `${extractCourseCode(query) || 'GST 105'} TMA`,
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
      `${extractCourseCode(query) || 'GST 105'} TMA`,
      `${extractCourseCode(query) || 'GST 105'} TMA 1`,
      `${extractCourseCode(query) || 'GST 105'} TMA answers`,
    ];
  }

  return [
    'NOUN matriculation requirements',
    'Latest NOUN timetable',
    'Explain NOUN TMA submission',
  ];
}

async function buildPastQuestionResponse(query, grounded) {
  const directFiles = await getDirectSiteFiles(query, 'past_question');
  if (directFiles.length > 0) {
    return withWhatsAppGroup({
      type: 'file_list',
      intent: 'past_question',
      title: `Found ${directFiles.length} file${directFiles.length === 1 ? '' : 's'} for ${extractCourseCode(query) || 'this course'}`,
      answer: 'I found matching past-question and related files. Open or download any one below.',
      files: directFiles,
      suggestions: buildSuggestions('past_question', query),
    });
  }

  const parsed = grounded.parsed || {};
  const candidatePool = [
    ...buildFileCandidateList(grounded),
    ...(grounded.sources || []),
  ];
  const bestPdf = await findBestPdfFile(query, candidatePool, 'past_question');

  if (!bestPdf) {
    return withWhatsAppGroup({
      type: 'information',
      intent: 'past_question',
      title: parsed.title || 'No past question PDF found',
      answer: parsed.answer || `Gemini searched the web but did not find a usable PDF for "${query}". Add a year, semester, or a more exact course title.`,
      sections: [
        {
          title: 'No verified file found yet',
          items: [
            'A grounded result was found, but no direct downloadable PDF could be verified.',
            'Some sites expose files behind a viewer, redirect, login, or anti-bot step.',
            'Try a slightly different wording for the same course and year.',
          ],
        },
      ],
      suggestions: buildSuggestions('past_question', query),
    });
  }

  return withWhatsAppGroup({
    type: 'past_question_pdf',
    intent: 'past_question',
    title: parsed.title || bestPdf.title || 'NOUN past question',
    answer: parsed.answer || 'Gemini found a past question PDF that matches your request. It is ready to open below.',
    pdfUrl: bestPdf.url,
    fileName: (parsed.title || bestPdf.title || 'noun-past-question').replace(/[^\w\s.-]/g, '').trim() || 'noun-past-question.pdf',
    suggestions: parsed.suggestions || [
      'Find another year for this course',
      'Look for first semester version',
      'Search a different NOUN course past question',
    ],
  });
}

async function buildCourseMaterialResponse(query, grounded) {
  const parsed = grounded.parsed || {};
  const candidatePool = [
    ...buildFileCandidateList(grounded),
    ...(grounded.sources || []),
  ];
  const bestPdf = await findBestPdfFile(query, candidatePool, 'course_material');

  if (!bestPdf) {
    return withWhatsAppGroup({
      type: 'information',
      intent: 'course_material',
      title: parsed.title || 'No course material PDF found',
      answer: parsed.answer || `Gemini searched the web but did not find a usable course material PDF for "${query}". Add the exact course code, or the course title, and try again.`,
      sections: [
        {
          title: 'No verified file found yet',
          items: [
            'A grounded result was found, but no direct downloadable course material PDF could be verified.',
            'The NOUN portal may require login for this particular course, or the file may be behind a viewer.',
            'Try a slightly different wording, or just the exact course code.',
          ],
        },
      ],
      suggestions: buildSuggestions('course_material', query),
    });
  }

  return withWhatsAppGroup({
    type: 'course_material_pdf',
    intent: 'course_material',
    title: parsed.title || bestPdf.title || 'NOUN course material',
    answer: parsed.answer || 'Gemini found a course material PDF that matches your request. It is ready to open below.',
    pdfUrl: bestPdf.url,
    fileName: (parsed.title || bestPdf.title || 'noun-course-material').replace(/[^\w\s.-]/g, '').trim() || 'noun-course-material.pdf',
    suggestions: parsed.suggestions || [
      'Find the course guide instead',
      'Search a different NOUN course material',
      'Look for the latest edition',
    ],
  });
}

function buildInfoFallback(query, intent) {
  return withWhatsAppGroup({
    type: 'information',
    intent,
    title: 'No grounded NOUN answer found',
    answer: `Gemini could not produce a grounded NOUN-specific answer for "${query}" right now.`,
    sections: [],
    suggestions: buildSuggestions(intent, query),
  });
}

async function buildTimetableResponse(query, grounded) {
  const parsed = grounded.parsed || {};
  const candidatePool = [
    ...buildFileCandidateList(grounded),
    ...(grounded.sources || []),
  ];
  const bestPdf = await findBestPdfFile(query, candidatePool, 'timetable');

  if (!bestPdf) {
    return withWhatsAppGroup({
      type: 'information',
      intent: 'timetable',
      title: parsed.title || 'Timetable update',
      answer: parsed.answer || 'I found timetable information, but I could not verify a downloadable timetable file right now.',
      sections: Array.isArray(parsed.sections) ? parsed.sections : [
        {
          title: 'Timetable note',
          items: [
            'If the newest timetable is not publicly downloadable yet, Ask can still show older verified timetable files when available.',
            'Try adding a semester, session, or exam type to narrow the result.',
          ],
        },
      ],
      suggestions: Array.isArray(parsed.suggestions) && parsed.suggestions.length > 0
        ? parsed.suggestions
        : buildSuggestions('timetable', query),
    });
  }

  return withWhatsAppGroup({
    type: 'timetable_pdf',
    intent: 'timetable',
    title: parsed.title || bestPdf.title || 'NOUN timetable',
    answer: parsed.answer || 'I found a downloadable timetable document. If a newer one is not public yet, this may be the latest verified file I could open.',
    sections: Array.isArray(parsed.sections) ? parsed.sections : [],
    pdfUrl: bestPdf.url,
    fileName: (parsed.title || bestPdf.title || 'noun-timetable').replace(/[^\w\s.-]/g, '').trim() || 'noun-timetable.pdf',
    suggestions: Array.isArray(parsed.suggestions) && parsed.suggestions.length > 0
      ? parsed.suggestions
      : buildSuggestions('timetable', query),
  });
}

async function buildInformationResponse(query, intent, grounded) {
  if (intent === 'tma') {
    const directFiles = await getDirectSiteFiles(query, 'tma');
    if (directFiles.length > 0) {
      return withWhatsAppGroup({
        type: 'file_list',
        intent: 'tma',
        title: `Found ${directFiles.length} TMA file${directFiles.length === 1 ? '' : 's'}`,
        answer: 'I found matching TMA files for this course. Open or download any one below.',
        files: directFiles,
        suggestions: buildSuggestions('tma', query),
      });
    }
  }

  if (intent === 'timetable') {
    return buildTimetableResponse(query, grounded);
  }

  const parsed = grounded.parsed;
  if (parsed && parsed.type === 'information') {
    return withWhatsAppGroup({
      ...parsed,
      suggestions: Array.isArray(parsed.suggestions) && parsed.suggestions.length > 0
        ? parsed.suggestions
        : buildSuggestions(intent, query),
    });
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
  "candidateUrls": ["https://example.com/file.pdf", "https://example.com/page-with-file"],
  "suggestions": ["follow up 1", "follow up 2", "follow up 3"]
}

Rules:
- Focus only on NOUN-related results.
- Prefer actual past-question documents or pages that clearly point to past questions.
- Prioritize these websites when relevant: noungeeks.com, puredu.net, bbcnoun.com.ng.
- Include up to 6 candidate URLs that are the most likely direct PDF links or page links that lead to the file.
- Do not include links, URLs, source names, or citations in the answer.
- If you do not find a reliable match, make that clear in the answer.
- Keep the response compact and useful for a student.`;
  }

  if (intent === 'course_material') {
    return `Use Google Search grounding to research this request about a National Open University of Nigeria (NOUN) course: "${query}".

Find the actual COURSE MATERIAL for this course — the full course guide, lecture notes/units, or textbook PDF that NOUN or a NOUN-related site provides for studying the course. This is NOT a past exam question paper and NOT a short summary or study guide — it must be the real, complete course document.

Return ONLY valid JSON in this exact shape:
{
  "type": "course_material_pdf",
  "title": "short result title",
  "answer": "one short student-friendly paragraph with no links, no URLs, and no citations",
  "candidateUrls": ["https://example.com/file.pdf", "https://example.com/page-with-file"],
  "suggestions": ["follow up 1", "follow up 2", "follow up 3"]
}

Rules:
- Focus only on NOUN-related results.
- The single most important source is NOUN's own official website (nou.edu.ng) — search there first.
- If nothing official is found, search the wider web (Google) for the course guide or course material PDF hosted anywhere legitimate.
- Only after that, consider these community sites if relevant: noungeeks.com, puredu.net, bbcnoun.com.ng.
- Do NOT return past-question papers, exam question papers, or short AI-style summaries — only the actual course material/guide/lecture notes.
- Include up to 6 candidate URLs that are the most likely direct PDF links or page links that lead to the real course material file.
- Do not include links, URLs, source names, or citations in the answer.
- If you do not find a reliable match, make that clear in the answer.
- Keep the response compact and useful for a student.`;
  }

  if (intent === 'tma') {
    return `Use Google Search grounding to answer this NOUN TMA request: "${query}".

Return ONLY valid JSON in this exact shape:
{
  "type": "information",
  "intent": "tma",
  "title": "short title",
  "answer": "short summary paragraph",
  "sections": [
    { "title": "section title", "items": ["bullet 1", "bullet 2"] }
  ],
  "candidateUrls": ["https://example.com/tma-page", "https://example.com/file.pdf"],
  "suggestions": ["follow up 1", "follow up 2", "follow up 3"]
}

Rules:
- Focus only on National Open University of Nigeria (NOUN).
- Prioritize these websites when relevant: noungeeks.com, puredu.net, bbcnoun.com.ng.
- Include up to 6 candidate URLs that are most likely to contain TMA past questions, TMA answers, or downloadable TMA files.
- Do not include links, URLs, source names, or citations in the answer.
- Keep it student-friendly and ready for UI presentation.`;
  }

  if (intent === 'timetable') {
    return `Use Google Search grounding to answer this NOUN timetable request: "${query}".

Return ONLY valid JSON in this exact shape:
{
  "type": "information",
  "intent": "timetable",
  "title": "short title",
  "answer": "short summary paragraph",
  "sections": [
    { "title": "section title", "items": ["bullet 1", "bullet 2"] }
  ],
  "candidateUrls": ["https://example.com/timetable.pdf", "https://example.com/page-with-timetable-file"],
  "suggestions": ["follow up 1", "follow up 2", "follow up 3"]
}

Rules:
- Focus only on National Open University of Nigeria (NOUN).
- Prefer the latest timetable information, but if no new downloadable file is found, include candidate URLs for older verified timetable documents.
- Prioritize these websites when relevant: noungeeks.com, puredu.net, bbcnoun.com.ng.
- Use exact dates when grounded results mention dates.
- Do not include links, URLs, source names, or citations in the answer.
- Keep it student-friendly and ready for UI presentation.`;
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
- Prioritize these websites when relevant: noungeeks.com, puredu.net, bbcnoun.com.ng.
- Use exact dates when grounded results mention dates.
- If the information is uncertain or conflicting, say that clearly.
- Do not include links, URLs, source names, or citations in the answer.
- Keep it student-friendly and ready for UI presentation.`;
}

async function answerAskQuery(query, mode) {
  const cleanQuery = normalizeWhitespace(query);
  if (!cleanQuery) {
    throw new Error('Please enter a question.');
  }

  // `mode` lets a caller (e.g. the Course Material page) pin the intent explicitly
  // instead of relying on free-text classification, since that page's search box is
  // scoped to one kind of request rather than the general Ask/Past Questions chat.
  const intent = mode === 'course_material' ? 'course_material' : classifyIntent(cleanQuery);
  const clarification = buildClarification(intent, cleanQuery);
  if (clarification) {
    return clarification;
  }

  if (intent === 'course_material') {
    // PurEdu's e-courseware search is a fast, direct catalog lookup (verified reliable —
    // a real JSON API, not a live web search) — checked before the much slower Gemini
    // grounding fallback, since it resolves the common case in ~1s instead of 20-50s and
    // doesn't depend on Google Search happening to surface the right page that call.
    const directFiles = await getDirectSiteFiles(cleanQuery, 'course_material');
    if (directFiles.length > 0) {
      return withWhatsAppGroup({
        type: 'file_list',
        intent: 'course_material',
        title: `Found ${directFiles.length} file${directFiles.length === 1 ? '' : 's'} for ${extractCourseCode(cleanQuery) || 'this course'}`,
        answer: 'I found the course material for this course. Open or download it below.',
        files: directFiles,
        suggestions: buildSuggestions('course_material', cleanQuery),
      });
    }

    const grounded = await runGeminiGroundedPrompt(buildGroundedPrompt(cleanQuery, intent));
    return buildCourseMaterialResponse(cleanQuery, grounded);
  }

  const grounded = await runGeminiGroundedPrompt(buildGroundedPrompt(cleanQuery, intent));

  if (intent === 'past_question') {
    return buildPastQuestionResponse(cleanQuery, grounded);
  }

  return buildInformationResponse(cleanQuery, intent, grounded);
}

module.exports = {
  answerAskQuery,
  _private: {
    runGeminiGroundedPrompt,
    buildGroundedPrompt,
    findBestPdfFile,
    buildFileCandidateList,
  },
};
