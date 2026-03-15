import React, { useEffect, useRef, useState } from 'react';
import {
  FiArrowDownCircle,
  FiDownload,
  FiFileText,
  FiLoader,
  FiMessageSquare,
  FiSearch,
  FiSend,
  FiUsers,
  FiUser,
} from 'react-icons/fi';
import api from '../utils/api';
import { trackFeatureVisit } from '../utils/featureTracking';
import SEO from '../components/SEO';
import './Ask.css';

const ASK_EXAMPLES = [
  'GST 105 past question 2023',
  'What do I need for NOUN matriculation?',
  'Show the latest NOUN timetable',
  'Explain NOUN TMA submission',
];

const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const initialAssistantMessage = {
  id: makeId(),
  role: 'assistant',
  kind: 'response',
  data: {
    title: 'Ask anything about NOUN',
    answer: 'Ask works like a chat thread. For past questions, include the course code and year so I can search, open the PDF here, and let you download it.',
    suggestions: ASK_EXAMPLES,
    sections: [
      {
        title: 'Good prompts',
        items: [
          'Use exact course codes for past questions.',
          'Add the year when you want a specific paper.',
          'Ask matriculation, timetable, and TMA questions in plain language.',
        ],
      },
    ],
  },
};

function ResponseCard({ message, onSuggestionClick }) {
  const { data, loading, error } = message;

  if (loading) {
    return (
      <div className="ask-card ask-card-loading">
        <FiLoader className="spin" />
        <div>
          <h3>Researching your request</h3>
          <p>Searching and preparing the result.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ask-card ask-card-error">
        <h3>Ask could not complete that request</h3>
        <p>{error}</p>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="ask-card">
      {data.intent && (
        <div className="ask-response-tag">
          {data.intent.replace(/_/g, ' ')}
        </div>
      )}

      {data.title && <h3>{data.title}</h3>}
      {data.answer && <p className="ask-card-summary">{data.answer}</p>}
      {data.followUpQuestion && (
        <div className="ask-followup-box">
          <FiMessageSquare />
          <span>{data.followUpQuestion}</span>
        </div>
      )}

      {Array.isArray(data.sections) && data.sections.length > 0 && (
        <div className="ask-section-grid">
          {data.sections.map((section, index) => (
            <article className="ask-section-card" key={`${section.title}-${index}`}>
              <h4>{section.title}</h4>
              <ul>
                {(section.items || []).map((item, itemIndex) => (
                  <li key={`${section.title}-${itemIndex}`}>{item}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      )}

      {(data.type === 'past_question_pdf' || data.type === 'timetable_pdf') && (
        <div className="ask-pdf-panel">
          <div className="ask-pdf-meta">
            <div>
              <p className="ask-console-kicker">{data.type === 'timetable_pdf' ? 'Timetable File' : 'Past Question PDF'}</p>
              <h4>{data.pdf?.fileName || (data.type === 'timetable_pdf' ? 'NOUN timetable' : 'NOUN past question')}</h4>
            </div>
            <div className="ask-pdf-actions">
              {data.pdfLoading && (
                <div className="ask-loading-pill">
                  <FiLoader className="spin" />
                  Loading PDF
                </div>
              )}
              {data.pdfBlobUrl && (
                <a
                  href={data.pdfBlobUrl}
                  download={data.pdf?.fileName || 'noun-past-question.pdf'}
                  className="ask-download-btn"
                >
                  <FiDownload />
                  Download
                </a>
              )}
            </div>
          </div>
          {data.pdfBlobUrl && (
            <iframe
              title={data.pdf?.fileName || 'Ask PDF Viewer'}
              src={data.pdfBlobUrl}
              className="ask-pdf-frame"
            />
          )}
        </div>
      )}

      {Array.isArray(data.files) && data.files.length > 0 && (
        <div className="ask-file-list">
          {data.files.map((file) => (
            <div className="ask-file-row" key={`${file.fileName}-${file.token}`}>
              <div>
                <h4>{file.label || file.fileName}</h4>
                <p className="ask-file-meta">{file.fileName}</p>
              </div>
              <button
                type="button"
                className="ask-download-btn ask-download-btn-button"
                onClick={() => data.onOpenFile?.(file)}
              >
                <FiDownload />
                Open File
              </button>
            </div>
          ))}
        </div>
      )}

      {data.whatsappGroup?.url && (
        <div className="ask-community-card">
          <div>
            <p className="ask-console-kicker">Community</p>
            <h4>Need updates from other NOUN students?</h4>
            <p className="ask-card-summary">Join the WhatsApp group from here for shared updates and discussion.</p>
          </div>
          <a
            href={data.whatsappGroup.url}
            target="_blank"
            rel="noreferrer"
            className="ask-whatsapp-btn"
          >
            <FiUsers />
            {data.whatsappGroup.label || 'Join WhatsApp Group'}
          </a>
        </div>
      )}

      {Array.isArray(data.suggestions) && data.suggestions.length > 0 && (
        <div className="ask-suggestion-row">
          {data.suggestions.map((item) => (
            <button
              key={item}
              type="button"
              className="ask-chip"
              onClick={() => onSuggestionClick(item)}
            >
              {item}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const Ask = () => {
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState([initialAssistantMessage]);
  const [loading, setLoading] = useState(false);
  const [composerError, setComposerError] = useState('');
  const mountedRef = useRef(true);
  const threadRef = useRef(null);
  const blobUrlsRef = useRef(new Set());

  useEffect(() => {
    trackFeatureVisit('ask');
    const blobUrls = blobUrlsRef.current;
    return () => {
      mountedRef.current = false;
      blobUrls.forEach((blobUrl) => {
        URL.revokeObjectURL(blobUrl);
      });
      blobUrls.clear();
    };
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      threadRef.current?.scrollTo({
        top: threadRef.current.scrollHeight,
        behavior: 'smooth',
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [messages.length]);

  const updateMessage = (messageId, updater) => {
    setMessages((current) =>
      current.map((message) => (
        message.id === messageId
          ? { ...message, ...updater(message) }
          : message
      ))
    );
  };

  const loadPdfIntoMessage = async (messageId, token, fileName) => {
    updateMessage(messageId, (message) => ({
      data: {
        ...message.data,
        pdfLoading: true,
      },
    }));

    try {
      const result = await api.get(`/ask/pdf/${encodeURIComponent(token)}`, {
        responseType: 'blob',
      });

      const blobUrl = URL.createObjectURL(result.data);
      blobUrlsRef.current.add(blobUrl);
      updateMessage(messageId, (message) => {
        if (message?.data?.pdfBlobUrl) {
          URL.revokeObjectURL(message.data.pdfBlobUrl);
          blobUrlsRef.current.delete(message.data.pdfBlobUrl);
        }

        return {
          data: {
            ...message.data,
            pdf: {
              ...message.data?.pdf,
              fileName,
            },
            pdfBlobUrl: blobUrl,
            pdfLoading: false,
          },
        };
      });
    } catch (requestError) {
      updateMessage(messageId, (message) => ({
        data: {
          ...message.data,
          pdfLoading: false,
          answer: requestError.response?.data?.message || 'The result was found, but the PDF could not be opened right now.',
        },
      }));
    }
  };

  const loadListedFileIntoMessage = async (messageId, file) => {
    updateMessage(messageId, (message) => ({
      data: {
        ...message.data,
        pdfLoading: true,
      },
    }));

    try {
      const result = await api.get(`/ask/pdf/${encodeURIComponent(file.token)}`, {
        responseType: 'blob',
      });

      const blobUrl = URL.createObjectURL(result.data);
      blobUrlsRef.current.add(blobUrl);
      updateMessage(messageId, (message) => {
        if (message?.data?.pdfBlobUrl) {
          URL.revokeObjectURL(message.data.pdfBlobUrl);
          blobUrlsRef.current.delete(message.data.pdfBlobUrl);
        }

        return {
          data: {
            ...message.data,
            pdf: {
              fileName: file.fileName,
            },
            pdfBlobUrl: blobUrl,
            pdfLoading: false,
            type: file.extension === 'pdf' ? 'past_question_pdf' : message.data.type,
          },
        };
      });
    } catch (requestError) {
      updateMessage(messageId, (message) => ({
        data: {
          ...message.data,
          pdfLoading: false,
          answer: requestError.response?.data?.message || 'That file could not be opened right now.',
        },
      }));
    }
  };

  const submitQuery = async (value) => {
    const trimmed = String(value || query).trim();
    if (!trimmed || loading) {
      if (!trimmed) setComposerError('Enter what you want Ask to find.');
      return;
    }

    const userMessage = {
      id: makeId(),
      role: 'user',
      text: trimmed,
    };

    const placeholderId = makeId();
    const placeholderMessage = {
      id: placeholderId,
      role: 'assistant',
      kind: 'response',
      loading: true,
      data: null,
    };

    setLoading(true);
    setComposerError('');
    setQuery('');
    setMessages((current) => [...current, userMessage, placeholderMessage]);

    try {
      const result = await api.post('/ask/query', { query: trimmed });
      const payload = result.data?.data || null;
      if (payload && Array.isArray(payload.files) && payload.files.length > 0) {
        payload.onOpenFile = (file) => loadListedFileIntoMessage(placeholderId, file);
      }

      updateMessage(placeholderId, () => ({
        loading: false,
        error: '',
        data: payload,
      }));

      if (payload?.type === 'past_question_pdf' && payload?.pdf?.token) {
        await loadPdfIntoMessage(placeholderId, payload.pdf.token, payload.pdf.fileName);
      }
    } catch (requestError) {
      updateMessage(placeholderId, () => ({
        loading: false,
        error: requestError.response?.data?.message || 'Ask could not process that request.',
        data: null,
      }));
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  };

  return (
    <div className="ask-page">
      <SEO
        title="Ask NOUN Questions - NounPaddi"
        description="Ask NounPaddi to find NOUN-specific past questions, matriculation details, timetables, and TMA guidance."
        url="/ask"
        keywords="NOUN ask, NOUN past question finder, NOUN timetable, NOUN matriculation, NOUN TMA"
        robots="noindex, nofollow"
      />

      <div className="container">
        <section className="ask-shell">
          <div className="ask-sidebar">
            <p className="ask-kicker">Ask</p>
            <h1>NOUN research in a chat thread.</h1>
            <p className="ask-lead">
              Ask researches the web with Gemini, replies in chat format, and opens past-question PDFs inline.
            </p>
            <div className="ask-sidebar-points">
              <div className="ask-hero-card-row">
                <FiSearch />
                <span>Gemini researches NOUN-related web results</span>
              </div>
              <div className="ask-hero-card-row">
                <FiFileText />
                <span>Past questions open in the thread and can be downloaded</span>
              </div>
              <div className="ask-hero-card-row">
                <FiArrowDownCircle />
                <span>For past questions, the course code is enough to list available files</span>
              </div>
            </div>
            <div className="ask-example-stack">
              {ASK_EXAMPLES.map((example) => (
                <button
                  key={example}
                  type="button"
                  className="ask-chip ask-chip-block"
                  onClick={() => submitQuery(example)}
                  disabled={loading}
                >
                  {example}
                </button>
              ))}
            </div>
          </div>

          <section className="ask-thread-shell">
            <div className="ask-thread" ref={threadRef}>
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`ask-message ask-message-${message.role}`}
                >
                  <div className={`ask-avatar ask-avatar-${message.role}`}>
                    {message.role === 'assistant' ? <FiMessageSquare /> : <FiUser />}
                  </div>
                  <div className="ask-bubble">
                    {message.role === 'user' ? (
                      <p className="ask-user-text">{message.text}</p>
                    ) : (
                      <ResponseCard
                        message={message}
                        onSuggestionClick={submitQuery}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="ask-composer">
              <div className="ask-composer-header">
                <div>
                  <p className="ask-console-kicker">Prompt Ask</p>
                  <h2>Ask in plain language</h2>
                </div>
                {loading && (
                  <div className="ask-loading-pill">
                    <FiLoader className="spin" />
                    Working
                  </div>
                )}
              </div>
              <div className="ask-form">
                <textarea
                  className="ask-input"
                  placeholder="Try: GST 105 past question, GST 105 TMA, NOUN matriculation requirements, or latest NOUN timetable"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      submitQuery();
                    }
                  }}
                  rows={3}
                />
                <button
                  type="button"
                  className="ask-submit"
                  onClick={() => submitQuery()}
                  disabled={loading}
                >
                  <FiSend />
                  Send
                </button>
              </div>
              {composerError && <div className="ask-error">{composerError}</div>}
            </div>
          </section>
        </section>
      </div>
    </div>
  );
};

export default Ask;
