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
  'GST 105 past question',
  'What do I need for NOUN matriculation?',
  'Show the latest NOUN timetable',
  'Explain NOUN TMA submission',
];

const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const extractCourseCode = (value) => {
  const match = String(value || '').toUpperCase().match(/\b([A-Z]{3})\s*[-/]?\s*(\d{3})\b/);
  return match ? `${match[1]} ${match[2]}` : '';
};

const buildLoadingTitle = (value) => {
  const trimmed = String(value || '').trim();
  const courseCode = extractCourseCode(trimmed);
  if (courseCode) {
    return `Loading Your ${courseCode}`;
  }

  if (!trimmed) {
    return 'Loading Your Request';
  }

  return `Loading Your ${trimmed.slice(0, 36)}`;
};

const isMobileClient = () => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(max-width: 720px)').matches || /android|iphone|ipad|ipod|mobile/i.test(window.navigator.userAgent || '');
};

const triggerDownload = (blobUrl, fileName) => {
  const anchor = document.createElement('a');
  anchor.href = blobUrl;
  anchor.download = fileName || 'noun-file';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
};

const initialAssistantMessage = {
  id: makeId(),
  role: 'assistant',
  kind: 'response',
  data: {
    title: 'Ask anything about NOUN',
    answer: 'Ask works like a chat thread. For past questions, send the course code and I will list the files I find, open them here when possible, and let you download them.',
    suggestions: ASK_EXAMPLES,
  },
};

const askStructuredData = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      name: 'Ask NOUN Questions and Past Questions',
      url: 'https://paddi.com.ng/ask',
      description: 'Find NOUN past questions, timetable updates, matriculation information, TMA help, and NOUN study files on Ask Paddi.',
      isPartOf: {
        '@type': 'WebSite',
        name: 'NounPaddi',
        url: 'https://paddi.com.ng',
      },
    },
    {
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'Can Ask Paddi find NOUN past questions?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Ask Paddi helps students find NOUN past questions and related study files by course code, then opens or prepares those files for download inside the app when possible.',
          },
        },
        {
          '@type': 'Question',
          name: 'Can Ask Paddi show NOUN timetable, matriculation, and TMA information?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Yes. Ask Paddi is designed for NOUN timetable updates, matriculation information, TMA guidance, and other NOUN student questions in a chat-style interface.',
          },
        },
      ],
    },
  ],
};

function ResponseCard({ message, onSuggestionClick }) {
  const { data, loading, error } = message;

  if (loading) {
    return (
      <div className="ask-card ask-card-loading">
        <FiLoader className="spin" />
        <div>
          <h3>{data?.loadingTitle || 'Loading Your Request'}</h3>
          <p>{data?.loadingMessage || 'Searching and preparing the result.'}</p>
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
      {data.fileStatus && (
        <div className="ask-file-status">
          <FiDownload />
          <span>{data.fileStatus}</span>
        </div>
      )}
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
                  Preparing file
                </div>
              )}
              {data.pdfBlobUrl && data.pdfCanPreview === false && (
                <a
                  href={data.pdfBlobUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="ask-download-btn"
                >
                  <FiFileText />
                  Open File
                </a>
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
          {data.pdfBlobUrl && data.pdfCanPreview !== false && (
            <iframe
              title={data.pdf?.fileName || 'Ask PDF Viewer'}
              src={data.pdfBlobUrl}
              className="ask-pdf-frame"
            />
          )}
          {data.pdfBlobUrl && data.pdfCanPreview === false && (
            <div className="ask-mobile-file-note">
              PDF preview is limited on this device. Use Open File or Download above.
            </div>
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
  const threadShellRef = useRef(null);
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

  const scrollToResults = () => {
    window.requestAnimationFrame(() => {
      threadShellRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
      threadRef.current?.scrollTo({
        top: threadRef.current.scrollHeight,
        behavior: 'smooth',
      });
    });
  };

  const scrollToMessage = (messageId) => {
    window.requestAnimationFrame(() => {
      const target = document.getElementById(`ask-message-${messageId}`);
      if (target) {
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'end',
        });
        return;
      }

      scrollToResults();
    });
  };

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
        fileStatus: 'Preparing your file.',
      },
    }));
    scrollToResults();

    try {
      const result = await api.get(`/ask/pdf/${encodeURIComponent(token)}`, {
        responseType: 'blob',
      });

      const blobUrl = URL.createObjectURL(result.data);
      const mobileClient = isMobileClient();
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
            pdfCanPreview: !mobileClient,
            pdfLoading: false,
            fileStatus: mobileClient
              ? 'Your file is ready. Use Open File or Download below.'
              : 'Your file is ready below.',
          },
        };
      });
      scrollToResults();
    } catch (requestError) {
      updateMessage(messageId, (message) => ({
        data: {
          ...message.data,
          pdfLoading: false,
          fileStatus: '',
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
        fileStatus: `Preparing ${file.fileName || 'your file'}.`,
      },
    }));
    scrollToResults();

    try {
      const result = await api.get(`/ask/pdf/${encodeURIComponent(file.token)}`, {
        responseType: 'blob',
      });

      const blobUrl = URL.createObjectURL(result.data);
      const mobileClient = isMobileClient();
      blobUrlsRef.current.add(blobUrl);
      updateMessage(messageId, (message) => {
        if (message?.data?.pdfBlobUrl) {
          URL.revokeObjectURL(message.data.pdfBlobUrl);
          blobUrlsRef.current.delete(message.data.pdfBlobUrl);
        }

        if (file.extension !== 'pdf') {
          triggerDownload(blobUrl, file.fileName || 'noun-file');
        }

        return {
          data: {
            ...message.data,
            pdf: {
              fileName: file.fileName,
            },
            pdfBlobUrl: blobUrl,
            pdfCanPreview: file.extension === 'pdf' && !mobileClient,
            pdfLoading: false,
            type: file.extension === 'pdf' ? 'past_question_pdf' : message.data.type,
            answer: file.extension === 'pdf'
              ? message.data.answer
              : 'The file is ready. The download has started, and you can download it again below if needed.',
            fileStatus: file.extension === 'pdf'
              ? (mobileClient ? 'Your PDF is ready. Use Open File or Download below.' : 'Your PDF is ready below.')
              : `${file.fileName || 'Your file'} is downloading.`,
          },
        };
      });
      scrollToResults();
    } catch (requestError) {
      updateMessage(messageId, (message) => ({
        data: {
          ...message.data,
          pdfLoading: false,
          fileStatus: '',
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
      data: {
        loadingTitle: buildLoadingTitle(trimmed),
        loadingMessage: 'Searching and preparing the result.',
      },
    };

    setLoading(true);
    setComposerError('');
    setQuery('');
    setMessages((current) => [...current, userMessage, placeholderMessage]);
    scrollToMessage(placeholderId);

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
      scrollToMessage(placeholderId);

      if (payload?.type === 'past_question_pdf' && payload?.pdf?.token) {
        await loadPdfIntoMessage(placeholderId, payload.pdf.token, payload.pdf.fileName);
      }
    } catch (requestError) {
      const status = requestError.response?.status;
      updateMessage(placeholderId, () => ({
        loading: false,
        error: status === 401
          ? 'Sign in to use Ask and open NOUN files.'
          : (requestError.response?.data?.message || 'Ask could not process that request.'),
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
        title="Ask Paddi: NOUN Past Questions, Timetable, Matriculation and TMA Help"
        description="Ask Paddi helps NOUN students find past questions, timetable updates, matriculation information, TMA help, and NOUN study files in one place."
        url="/ask"
        keywords="Ask Paddi, NOUN past questions, NOUN timetable, NOUN matriculation, NOUN TMA, NOUN study help, NOUN student support"
        robots="index, follow"
        structuredData={askStructuredData}
      />

      <div className="container">
        <section className="ask-shell">
          <div className="ask-sidebar">
            <p className="ask-kicker">Ask</p>
            <h1>NOUN help in a chat thread.</h1>
            <p className="ask-lead">
              Ask Paddi helps NOUN students find past questions, timetable updates, matriculation information, TMA guidance, and study files in one place.
            </p>
            <div className="ask-sidebar-points">
              <div className="ask-hero-card-row">
                <FiSearch />
                <span>Search NOUN-related results and present them clearly</span>
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

          <section className="ask-thread-shell" ref={threadShellRef}>
            <div className="ask-thread" ref={threadRef}>
              {messages.map((message) => (
                <div
                  key={message.id}
                  id={`ask-message-${message.id}`}
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
