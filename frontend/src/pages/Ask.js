import React, { useEffect, useRef, useState } from 'react';
import { FiFileText, FiHelpCircle, FiLoader, FiMessageSquare, FiSearch, FiSend } from 'react-icons/fi';
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

const Ask = () => {
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pdfBlobUrl, setPdfBlobUrl] = useState('');
  const [pdfLoading, setPdfLoading] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    trackFeatureVisit('ask');
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl);
      }
    };
  }, [pdfBlobUrl]);

  const loadPdf = async (token) => {
    if (!token) return;

    setPdfLoading(true);
    try {
      const result = await api.get(`/ask/pdf/${encodeURIComponent(token)}`, {
        responseType: 'blob',
      });

      const nextUrl = URL.createObjectURL(result.data);
      setPdfBlobUrl((current) => {
        if (current) {
          URL.revokeObjectURL(current);
        }
        return nextUrl;
      });
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to open the PDF right now.');
    } finally {
      if (mountedRef.current) {
        setPdfLoading(false);
      }
    }
  };

  const submitQuery = async (value) => {
    const trimmed = String(value || query).trim();
    if (!trimmed) {
      setError('Enter what you want Ask to find.');
      return;
    }

    setLoading(true);
    setError('');
    setResponse(null);
    if (pdfBlobUrl) {
      URL.revokeObjectURL(pdfBlobUrl);
      setPdfBlobUrl('');
    }

    try {
      const result = await api.post('/ask/query', { query: trimmed });
      const payload = result.data?.data || null;
      setResponse(payload);

      if (payload?.type === 'past_question_pdf' && payload?.pdf?.token) {
        await loadPdf(payload.pdf.token);
      }
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Ask could not process that request.');
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
        <section className="ask-hero">
          <div className="ask-hero-copy">
            <p className="ask-kicker">Ask</p>
            <h1>NOUN answers without sending students away.</h1>
            <p className="ask-lead">
              Ask searches the web in the background for NOUN-related answers, then brings back a clean result.
              Past questions open as PDFs here. Timetable, matriculation, and TMA answers show as readable cards.
            </p>
          </div>
          <div className="ask-hero-card">
            <div className="ask-hero-card-row">
              <FiSearch />
              <span>Web lookup happens on the server</span>
            </div>
            <div className="ask-hero-card-row">
              <FiFileText />
              <span>PDFs render here without source links</span>
            </div>
            <div className="ask-hero-card-row">
              <FiMessageSquare />
              <span>Designed for NOUN student questions</span>
            </div>
          </div>
        </section>

        <section className="ask-console">
          <div className="ask-console-header">
            <div>
              <p className="ask-console-kicker">Prompt Ask</p>
              <h2>What do you want to find?</h2>
            </div>
            {loading && (
              <div className="ask-loading-pill">
                <FiLoader className="spin" />
                Searching
              </div>
            )}
          </div>

          <div className="ask-form">
            <textarea
              className="ask-input"
              placeholder="Try: GST 105 past question, NOUN matriculation requirements, or latest NOUN timetable"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              rows={4}
            />
            <button
              type="button"
              className="ask-submit"
              onClick={() => submitQuery()}
              disabled={loading}
            >
              <FiSend />
              Ask
            </button>
          </div>

          <div className="ask-example-row">
            {ASK_EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                className="ask-chip"
                onClick={() => {
                  setQuery(example);
                  submitQuery(example);
                }}
                disabled={loading}
              >
                {example}
              </button>
            ))}
          </div>

          {error && <div className="ask-error">{error}</div>}
        </section>

        {response && (
          <section className="ask-response-shell">
            <div className="ask-response-header">
              <div>
                <p className="ask-console-kicker">Result</p>
                <h2>{response.title || 'Ask response'}</h2>
              </div>
              <div className="ask-response-tag">
                {response.intent ? response.intent.replace(/_/g, ' ') : 'NOUN'}
              </div>
            </div>

            {response.answer && <p className="ask-response-summary">{response.answer}</p>}
            {response.followUpQuestion && (
              <div className="ask-followup-box">
                <FiHelpCircle />
                <span>{response.followUpQuestion}</span>
              </div>
            )}

            {Array.isArray(response.sections) && response.sections.length > 0 && (
              <div className="ask-section-grid">
                {response.sections.map((section) => (
                  <article className="ask-section-card" key={section.title}>
                    <h3>{section.title}</h3>
                    <ul>
                      {(section.items || []).map((item, index) => (
                        <li key={`${section.title}-${index}`}>{item}</li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            )}

            {Array.isArray(response.suggestions) && response.suggestions.length > 0 && (
              <div className="ask-suggestion-row">
                {response.suggestions.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className="ask-chip"
                    onClick={() => {
                      setQuery(item);
                      submitQuery(item);
                    }}
                    disabled={loading}
                  >
                    {item}
                  </button>
                ))}
              </div>
            )}

            {response.type === 'past_question_pdf' && (
              <div className="ask-pdf-panel">
                <div className="ask-pdf-meta">
                  <div>
                    <p className="ask-console-kicker">Past Question PDF</p>
                    <h3>{response.pdf?.fileName || 'NOUN past question'}</h3>
                  </div>
                  {pdfLoading && (
                    <div className="ask-loading-pill">
                      <FiLoader className="spin" />
                      Loading PDF
                    </div>
                  )}
                </div>
                {pdfBlobUrl && (
                  <iframe
                    title="Ask PDF Viewer"
                    src={pdfBlobUrl}
                    className="ask-pdf-frame"
                  />
                )}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
};

export default Ask;
