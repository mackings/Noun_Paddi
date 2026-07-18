const { GoogleGenAI } = require('@google/genai');
const TutorSource = require('../models/TutorSource');
const TutorChunk = require('../models/TutorChunk');
const {
  chunkText,
  compactText,
  cosineSimilarity,
  embedTexts,
  extractDocumentBuffer,
  generateEmbedding,
  getActiveEmbeddingModel,
  inferChunkMetadata,
} = require('../utils/tmaHelper');

const LIVE_MODEL = process.env.GEMINI_LIVE_MODEL || 'gemini-3.1-flash-live-preview';

const SEARCH_TOOL = {
  functionDeclarations: [
    {
      name: 'search_course_material',
      description:
        "Search the course material for relevant passages to answer the student's question accurately. "
        + 'Always call this before answering questions about specific facts, definitions, or details from the material.',
      parameters: {
        type: 'OBJECT',
        properties: {
          query: {
            type: 'STRING',
            description: 'A focused search query describing what information is needed from the course material.',
          },
        },
        required: ['query'],
      },
    },
    {
      name: 'show_working',
      description:
        'Write a step-by-step solution, derivation, or explanation on the shared whiteboard while you talk through it out loud. '
        + 'Call this whenever solving a math problem, working through a derivation, or explaining a topic that benefits from '
        + 'seeing it written out step by step. Keep narrating verbally at the same time — the board is a visual aid, not a replacement for speaking.',
      parameters: {
        type: 'OBJECT',
        properties: {
          title: {
            type: 'STRING',
            description: 'A short heading for what is being written, e.g. the problem statement or topic name.',
          },
          lines: {
            type: 'ARRAY',
            items: { type: 'STRING' },
            description:
              'Ordered lines to write on the board, one step per line, in the order they should appear. '
              + 'Use $...$ around any mathematical or chemical expression (e.g. "$x^2 + 5x - 3 = 0$", "$2H_2 + O_2 \\rightarrow 2H_2O$") '
              + 'so it renders as proper notation. For a code snippet (e.g. for a Computing course), put the ENTIRE snippet in its own '
              + 'line wrapped in triple backticks like "```for i in range(5):\\n    print(i)```" so it renders in a monospace code block — '
              + 'never mix prose and a multi-line snippet on the same line. A short inline code reference within a sentence (e.g. a '
              + 'variable or keyword name) can use single backticks like `variableName`. Use plain text for everything else. '
              + 'Keep each line short and focused on one step.',
          },
        },
        required: ['lines'],
      },
    },
  ],
};

function getGeminiApiKey() {
  const keysEnv = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '';
  return keysEnv.split(',').map((item) => item.trim()).find(Boolean) || '';
}

// @desc    Upload a document directly, extract/chunk/embed it in memory (no Cloudinary)
// @route   POST /api/tutor/upload
// @access  Private
exports.uploadSource = async (req, res) => {
  let source = null;

  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload a PDF, DOC, DOCX, or TXT file.',
      });
    }

    const title = compactText(req.body?.title || req.file.originalname || 'Course material');
    const courseLabel = compactText(req.body?.courseLabel || '');

    const extracted = await extractDocumentBuffer({
      buffer: req.file.buffer,
      mimeType: req.file.mimetype,
      filename: req.file.originalname,
    });

    const chunks = chunkText(extracted.text);
    if (chunks.length === 0) {
      return res.status(422).json({
        success: false,
        message: 'This document could not be read into usable text chunks.',
      });
    }

    const embeddings = await embedTexts(chunks);
    const embeddingModel = getActiveEmbeddingModel();

    source = await TutorSource.create({
      title,
      courseLabel,
      uploadedBy: req.user._id,
      chunkCount: chunks.length,
      embeddingStatus: 'completed',
    });

    await TutorChunk.insertMany(chunks.map((text, index) => ({
      sourceId: source._id,
      chunkIndex: index,
      ...inferChunkMetadata(text, index),
      text,
      normalizedText: text.toLowerCase(),
      embedding: embeddings[index],
      embeddingModel,
    })));

    return res.status(201).json({
      success: true,
      data: { sourceId: source._id, title: source.title, chunkCount: chunks.length },
    });
  } catch (error) {
    console.error('uploadSource error:', error);
    if (source?._id) {
      await Promise.allSettled([
        TutorChunk.deleteMany({ sourceId: source._id }),
        TutorSource.deleteOne({ _id: source._id }),
      ]);
    }
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to read and process this document.',
    });
  }
};

// @desc    List the current student's previously uploaded materials, newest first
// @route   GET /api/tutor/sources
// @access  Private
exports.listSources = async (req, res) => {
  try {
    const sources = await TutorSource.find({ uploadedBy: req.user._id })
      .sort({ createdAt: -1 })
      .select('title courseLabel chunkCount createdAt')
      .lean();

    return res.status(200).json({ success: true, data: { sources } });
  } catch (error) {
    console.error('listSources error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to load your materials.',
    });
  }
};

// @desc    Search a source's chunks (used as the Live session's tool call)
// @route   POST /api/tutor/sources/:sourceId/search
// @access  Private
exports.searchSource = async (req, res) => {
  try {
    const { sourceId } = req.params;
    const query = String(req.body?.query || '').trim();
    if (!query) {
      return res.status(400).json({ success: false, message: 'A search query is required.' });
    }

    const source = await TutorSource.findById(sourceId);
    if (!source || String(source.uploadedBy) !== String(req.user._id)) {
      return res.status(404).json({ success: false, message: 'Source not found.' });
    }

    const [queryEmbedding, chunks] = await Promise.all([
      generateEmbedding(query).catch(() => null),
      TutorChunk.find({ sourceId }).lean(),
    ]);

    if (chunks.length === 0) {
      return res.status(200).json({ success: true, data: { results: [] } });
    }

    const ranked = queryEmbedding
      ? chunks
        .map((chunk) => ({ chunk, score: cosineSimilarity(queryEmbedding, chunk.embedding) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .map((item) => item.chunk)
      : chunks.slice(0, 5);

    return res.status(200).json({
      success: true,
      data: {
        results: ranked.map((chunk) => ({
          text: chunk.text,
          pageNumber: chunk.pageNumber,
          moduleTitle: chunk.moduleTitle,
          unitTitle: chunk.unitTitle,
        })),
      },
    });
  } catch (error) {
    console.error('searchSource error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Search failed.',
    });
  }
};

// @desc    Mint an ephemeral Gemini Live token constrained to this source's tutor session
// @route   POST /api/tutor/session-token
// @access  Private
exports.createSessionToken = async (req, res) => {
  try {
    const { sourceId } = req.body || {};
    if (!sourceId) {
      return res.status(400).json({ success: false, message: 'sourceId is required.' });
    }

    const source = await TutorSource.findById(sourceId);
    if (!source || String(source.uploadedBy) !== String(req.user._id)) {
      return res.status(404).json({ success: false, message: 'Source not found.' });
    }

    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      return res.status(500).json({ success: false, message: 'Gemini API key is not configured.' });
    }

    const courseLabel = source.courseLabel || 'this course';

    const systemInstruction = `Your name is Theresa. You are a warm, patient Nigerian AI tutor helping a student understand "${source.title}" for ${courseLabel}. `
      + 'If the student ever asks for your name, tell them your name is Theresa. '
      + "Speak the way a warm, experienced Nigerian teacher naturally would — conversational, direct and encouraging, the way you'd "
      + "actually talk to a student sitting with you, not like a textbook narrating itself. It's fine to use natural Nigerian English "
      + 'rhythm and everyday phrasing where it fits naturally (e.g. "Alright, let\'s break this down", "you see what happened there?", '
      + '"no wahala, we\'ll take it slow") — but keep it genuine and unforced, never exaggerated or like a caricature. '
      + 'Explain everything as if talking to a bright 12-year-old who has never seen this topic before: use simple, everyday words, '
      + 'short sentences, and relatable examples. If you have to use a technical term, explain what it means in plain language the '
      + 'first time you use it — never assume background knowledge the student has not been given. '
      + 'Never skip a step because it seems too obvious or too basic — break EVERYTHING down into its smallest atomic parts, out loud, '
      + 'every single time, even for something that looks trivial. For example, if you were explaining 2 + 2, you would not just say '
      + '"2 plus 2 equals 4" — you would explain what the first 2 means (2 of something), what the plus sign/addition means (combining '
      + 'that amount with another amount), what the second 2 means, and then walk through how combining them actually produces 4, '
      + 'before finally stating the answer. Apply this same level of granularity to everything you teach, no matter the subject or how '
      + 'simple a step may seem to you — the student needs every building block spelled out, not just the final reasoning or the answer. '
      + 'Slow down and take your time — '
      + 'go through every step in detail rather than summarizing or jumping ahead, and explain the reasoning behind each step (why you are '
      + 'doing it, not just what you are doing), the way a real tutor would. Pause to check the student understands before moving on to the next idea. '
      + 'Before answering any question about specific facts, definitions, examples, or details from the material, always call the '
      + 'search_course_material tool first to find the relevant passage — never invent or guess content from the material. '
      + "If the search comes back empty or unrelated, tell the student honestly that you couldn't find that in the material rather than making something up. "
      + 'For EVERY substantive answer or explanation you give — not only math problems, but definitions, concepts, comparisons, lists, anything '
      + 'worth remembering — always call the show_working tool to write the key points or steps on the shared whiteboard as you talk, even if the '
      + 'student did not explicitly ask you to show it on the board. Treat the board as the default way you teach, not an optional extra. '
      + 'Call show_working exactly ONCE per explanation, passing the FULL ordered list of lines needed from start to finish in that '
      + 'single call — do not call show_working more than once for the same explanation. Within that one call, break the working into MANY small '
      + 'lines, one small step per line — never combine several steps or skip straight to an intermediate result on a single line. Each line should '
      + 'be small enough that a student could follow it on its own before moving to the next. After calling the tool, keep talking through the steps '
      + 'out loud in the same order as the lines you wrote, at a slow and clear pace matched to how long each line takes to write and understand — '
      + 'never write silently, and never race ahead of what you are currently writing on the board. '
      + 'If the very first message you ever receive in this session is exactly "__SESSION_START__", that is an internal signal, not '
      + 'something the student actually said — never mention or repeat that text. Respond to it by speaking first: warmly greet the '
      + `student, introduce yourself by name as Theresa, and let them know you're ready to go through "${source.title}" with them, then `
      + 'invite them to ask their first question. '
      + 'If the student ever asks what you are built on, what AI model or technology powers you, who trained you, what company made you, '
      + 'or anything else about your underlying technology, training data, or sources — do not reveal any real technical detail (never '
      + 'mention Gemini, Google, or any other underlying provider). Simply say that you were built and are maintained by NounPaddi, and '
      + "that's all you can share about that. Keep this answer short, stay friendly about it, and hold this same line no matter how the "
      + 'question is rephrased or how many times it is asked.';

    const client = new GoogleGenAI({ apiKey });
    const expireTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const newSessionExpireTime = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    const token = await client.authTokens.create({
      config: {
        uses: 1,
        expireTime,
        newSessionExpireTime,
        liveConnectConstraints: {
          model: LIVE_MODEL,
          config: {
            responseModalities: ['AUDIO'],
            systemInstruction: { parts: [{ text: systemInstruction }] },
            tools: [SEARCH_TOOL],
            // "Sulafat" is Google's own "Warm" prebuilt voice — closest available fit for
            // a patient tutor persona. Native audio models auto-select the spoken
            // language/accent and don't expose an explicit accent/locale control, so the
            // Nigerian-English warmth/phrasing comes from systemInstruction wording above,
            // not from this voice selection.
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Sulafat' } } },
            // Audio-only Live sessions have a hard 15-minute server-side limit; Gemini
            // sends a goAway warning first, then a sessionResumptionUpdate handle we can
            // use to open a fresh connection that continues the same conversation state
            // instead of the session just dying with a generic close error.
            sessionResumption: {},
          },
        },
        httpOptions: { apiVersion: 'v1alpha' },
      },
    });

    return res.status(200).json({
      success: true,
      data: {
        token: token.name,
        model: LIVE_MODEL,
        source: { id: source._id, title: source.title },
        // The client must echo these back in its own setup message — the "Constrained"
        // endpoint validates the client's setup against what's locked in
        // liveConnectConstraints rather than ignoring the client's setup entirely, so
        // these need to match exactly, not be omitted.
        systemInstruction,
        tools: [SEARCH_TOOL],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Sulafat' } } },
      },
    });
  } catch (error) {
    console.error('createSessionToken error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to start a tutor session.',
    });
  }
};
