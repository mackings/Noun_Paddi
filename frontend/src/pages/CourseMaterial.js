import React, { useEffect, useRef, useState } from 'react';
import {
  Download,
  FileText,
  Search,
  Send,
  UserCircle,
  Users,
  Loader2,
} from 'lucide-react';
import api from '../utils/api';
import { trackFeatureVisit } from '../utils/featureTracking';
import SEO from '../components/SEO';
import ShellHeader from '../shell/ShellHeader';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { cn } from '../lib/utils';

const MATERIAL_EXAMPLES = [
  'GST 105',
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
    return `Finding ${courseCode} course material`;
  }

  if (!trimmed) {
    return 'Finding your course material';
  }

  return `Finding ${trimmed.slice(0, 36)}`;
};

const isMobileClient = () => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(max-width: 720px)').matches || /android|iphone|ipad|ipod|mobile/i.test(window.navigator.userAgent || '');
};

const triggerDownload = (blobUrl, fileName) => {
  const anchor = document.createElement('a');
  anchor.href = blobUrl;
  anchor.download = fileName || 'noun-course-material';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
};

const readBlobErrorMessage = async (requestError, fallback) => {
  const responseData = requestError.response?.data;

  if (typeof Blob !== 'undefined' && responseData instanceof Blob) {
    try {
      const text = await responseData.text();
      const parsed = JSON.parse(text);
      return parsed?.message || fallback;
    } catch (error) {
      return fallback;
    }
  }

  return responseData?.message || fallback;
};

const courseMaterialStructuredData = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      name: 'NOUN Course Material Search',
      url: 'https://paddi.com.ng/course-material',
      description: 'Search for the real NOUN course material (course guide, lecture notes, or textbook PDF) for any course by course code, sourced from the official NOUN website, Google, and other NOUN-related sites.',
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
          name: 'Can Course Material find the actual NOUN course guide PDF?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Yes. Course Material searches the official NOUN website first, then the wider web, for the real course guide or lecture notes PDF for a course — not a summary.',
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
      <Card className="tw:flex tw:items-center tw:gap-3 tw:p-4">
        <Loader2 className="tw:h-5 tw:w-5 tw:flex-none tw:animate-spin tw:text-brand-600 tw:dark:text-brand-400" />
        <div>
          <h3 className="tw:font-heading tw:text-sm tw:font-bold">{data?.loadingTitle || 'Loading Your Request'}</h3>
          <p className="tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">{data?.loadingMessage || 'Searching and preparing the result.'}</p>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="tw:space-y-1 tw:border-red-200 tw:bg-red-50 tw:p-4 tw:dark:border-red-500/20 tw:dark:bg-red-500/10">
        <h3 className="tw:font-heading tw:text-sm tw:font-bold tw:text-red-700 tw:dark:text-red-300">Course Material could not complete that request</h3>
        <p className="tw:text-xs tw:text-red-600 tw:dark:text-red-300">{error}</p>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <Card className="tw:space-y-3 tw:p-4">
      {data.intent && (
        <span className="tw:inline-block tw:w-fit tw:rounded-full tw:bg-brand-100 tw:px-2 tw:py-0.5 tw:text-[11px] tw:font-semibold tw:text-brand-700 tw:capitalize tw:dark:bg-brand-950 tw:dark:text-brand-300">
          {data.intent.replace(/_/g, ' ')}
        </span>
      )}

      {data.title && <h3 className="tw:font-heading tw:text-sm tw:font-bold">{data.title}</h3>}
      {data.answer && <p className="tw:text-sm tw:text-slate-600 tw:dark:text-slate-300">{data.answer}</p>}
      {data.fileStatus && (
        <div className="tw:flex tw:items-center tw:gap-2 tw:rounded-xl tw:bg-slate-50 tw:p-3 tw:text-xs tw:text-slate-600 tw:dark:bg-slate-800/60 tw:dark:text-slate-300">
          <Download className="tw:h-4 tw:w-4 tw:flex-none" />
          <span>{data.fileStatus}</span>
        </div>
      )}
      {data.followUpQuestion && (
        <div className="tw:flex tw:items-center tw:gap-2 tw:rounded-xl tw:bg-brand-50 tw:p-3 tw:text-xs tw:text-brand-700 tw:dark:bg-brand-950/40 tw:dark:text-brand-300">
          <FileText className="tw:h-4 tw:w-4 tw:flex-none" />
          <span>{data.followUpQuestion}</span>
        </div>
      )}

      {Array.isArray(data.sections) && data.sections.length > 0 && (
        <div className="tw:space-y-3">
          {data.sections.map((section, index) => (
            <div key={`${section.title}-${index}`} className="tw:rounded-xl tw:bg-slate-50 tw:p-3 tw:dark:bg-slate-800/60">
              <h4 className="tw:font-heading tw:text-xs tw:font-bold">{section.title}</h4>
              <ul className="tw:mt-1.5 tw:list-disc tw:space-y-1 tw:pl-4 tw:text-xs tw:text-slate-600 tw:dark:text-slate-300">
                {(section.items || []).map((item, itemIndex) => (
                  <li key={`${section.title}-${itemIndex}`}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {data.type === 'course_material_pdf' && (
        <div className="tw:space-y-2 tw:rounded-xl tw:border tw:border-slate-200 tw:p-3 tw:dark:border-slate-800">
          <div className="tw:flex tw:items-center tw:justify-between tw:gap-2">
            <div>
              <p className="tw:text-[11px] tw:font-bold tw:tracking-wide tw:text-brand-600 tw:uppercase tw:dark:text-brand-400">
                Course Material PDF
              </p>
              <h4 className="tw:text-sm tw:font-semibold">{data.pdf?.fileName || 'NOUN course material'}</h4>
            </div>
            <div className="tw:flex-none">
              {data.pdfLoading && (
                <span className="tw:flex tw:items-center tw:gap-1.5 tw:text-xs tw:text-slate-400">
                  <Loader2 className="tw:h-3.5 tw:w-3.5 tw:animate-spin" /> Preparing
                </span>
              )}
              {data.pdfBlobUrl && (
                <a
                  href={data.pdfBlobUrl}
                  download={data.pdf?.fileName || 'noun-course-material.pdf'}
                  className={cn('tw:inline-flex tw:items-center tw:gap-1.5 tw:rounded-xl tw:bg-brand-600 tw:px-3 tw:py-1.5 tw:text-xs tw:font-semibold tw:text-white tw:hover:bg-brand-500')}
                >
                  <Download className="tw:h-3.5 tw:w-3.5" /> Download
                </a>
              )}
            </div>
          </div>
          {data.pdfBlobUrl && data.pdfCanPreview !== false && (
            <iframe
              title={data.pdf?.fileName || 'Course Material PDF Viewer'}
              src={data.pdfBlobUrl}
              className="tw:h-80 tw:w-full tw:rounded-lg tw:border tw:border-slate-200 tw:dark:border-slate-800"
            />
          )}
          {data.pdfBlobUrl && data.pdfCanPreview === false && (
            <p className="tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">PDF preview is limited on this device. Download above.</p>
          )}
        </div>
      )}

      {Array.isArray(data.files) && data.files.length > 0 && (
        <div className="tw:space-y-2">
          {data.files.map((file) => (
            <div key={`${file.fileName}-${file.token}`} className="tw:flex tw:items-center tw:justify-between tw:gap-2 tw:rounded-xl tw:bg-slate-50 tw:p-3 tw:dark:bg-slate-800/60">
              <div className="tw:min-w-0">
                <h4 className="tw:truncate tw:text-sm tw:font-semibold">{file.label || file.fileName}</h4>
                <p className="tw:truncate tw:text-xs tw:text-slate-400">{file.fileName}</p>
              </div>
              <button
                type="button"
                onClick={() => data.onOpenFile?.(file)}
                className="tw:flex tw:flex-none tw:items-center tw:gap-1.5 tw:rounded-xl tw:bg-brand-600 tw:px-3 tw:py-1.5 tw:text-xs tw:font-semibold tw:text-white tw:hover:bg-brand-500"
              >
                <Download className="tw:h-3.5 tw:w-3.5" /> Download
              </button>
            </div>
          ))}
        </div>
      )}

      {data.whatsappGroup?.url && (
        <div className="tw:flex tw:items-center tw:justify-between tw:gap-3 tw:rounded-xl tw:bg-emerald-50 tw:p-3 tw:dark:bg-emerald-950/30">
          <div>
            <p className="tw:text-[11px] tw:font-bold tw:tracking-wide tw:text-emerald-700 tw:uppercase tw:dark:text-emerald-300">Community</p>
            <h4 className="tw:text-sm tw:font-semibold">Need updates from other NOUN students?</h4>
            <p className="tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">Join the WhatsApp group from here for shared updates and discussion.</p>
          </div>
          <a
            href={data.whatsappGroup.url}
            target="_blank"
            rel="noreferrer"
            className="tw:flex tw:flex-none tw:items-center tw:gap-1.5 tw:rounded-xl tw:bg-emerald-600 tw:px-3 tw:py-1.5 tw:text-xs tw:font-semibold tw:text-white tw:hover:bg-emerald-500"
          >
            <Users className="tw:h-3.5 tw:w-3.5" /> {data.whatsappGroup.label || 'Join Group'}
          </a>
        </div>
      )}

      {Array.isArray(data.suggestions) && data.suggestions.length > 0 && (
        <div className="tw:flex tw:flex-wrap tw:gap-2">
          {data.suggestions.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => onSuggestionClick(item)}
              className="tw:rounded-full tw:border tw:border-slate-200 tw:px-3 tw:py-1.5 tw:text-xs tw:font-semibold tw:text-slate-600 tw:transition-colors tw:hover:bg-slate-50 tw:dark:border-slate-800 tw:dark:text-slate-300 tw:dark:hover:bg-slate-800"
            >
              {item}
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}

const CourseMaterial = () => {
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [composerError, setComposerError] = useState('');
  const mountedRef = useRef(true);
  const threadRef = useRef(null);
  const threadShellRef = useRef(null);
  const blobUrlsRef = useRef(new Set());

  useEffect(() => {
    // Re-arm on every (re)mount, not just at useRef's initial value — React 18
    // StrictMode double-invokes effects in development (mount, cleanup, mount again),
    // so without this the cleanup below permanently leaves mountedRef.current false
    // before the "real" mount even starts, silently no-op-ing every mountedRef.current
    // guard for the rest of the component's life (verified: this was why the Search
    // button stayed stuck on "Searching..." even after the result had rendered).
    mountedRef.current = true;
    trackFeatureVisit('course_material');
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
      const target = document.getElementById(`course-material-message-${messageId}`);
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
              ? 'Your file is ready. Download below.'
              : 'Your file is ready below.',
          },
        };
      });
      scrollToResults();
    } catch (requestError) {
      const errorMessage = await readBlobErrorMessage(
        requestError,
        'The result was found, but the file could not be opened right now.',
      );
      updateMessage(messageId, (message) => ({
        data: {
          ...message.data,
          pdfLoading: false,
          fileStatus: '',
          answer: errorMessage,
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

        triggerDownload(
          blobUrl,
          file.fileName || (file.extension === 'pdf' ? 'noun-course-material.pdf' : 'noun-file'),
        );

        return {
          data: {
            ...message.data,
            pdf: {
              fileName: file.fileName,
            },
            pdfBlobUrl: blobUrl,
            pdfCanPreview: file.extension === 'pdf' && !mobileClient,
            pdfLoading: false,
            type: file.extension === 'pdf' ? 'course_material_pdf' : message.data.type,
            answer: file.extension === 'pdf'
              ? 'Your download has started. You can download it again below if needed.'
              : 'The file is ready. The download has started, and you can download it again below if needed.',
            fileStatus: file.extension === 'pdf'
              ? (mobileClient ? 'Your PDF is ready. Download below.' : 'Your PDF has started downloading. You can download it again below if needed.')
              : `${file.fileName || 'Your file'} is downloading.`,
          },
        };
      });
      scrollToResults();
    } catch (requestError) {
      const errorMessage = await readBlobErrorMessage(
        requestError,
        'That file could not be opened right now.',
      );
      updateMessage(messageId, (message) => ({
        data: {
          ...message.data,
          pdfLoading: false,
          fileStatus: '',
          answer: errorMessage,
        },
      }));
    }
  };

  const submitQuery = async (value) => {
    const trimmed = String(value || query).trim();
    if (!trimmed || loading) {
      if (!trimmed) setComposerError('Type a course code or course title first.');
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
        loadingMessage: 'Searching NOUN, Google, and related sites for the real course material.',
      },
    };

    setLoading(true);
    setComposerError('');
    setQuery('');
    setMessages((current) => [...current, userMessage, placeholderMessage]);
    scrollToMessage(placeholderId);

    try {
      const result = await api.post('/ask/query', { query: trimmed, mode: 'course_material' });
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

      // Reset the composer's own loading state as soon as the query result itself has
      // landed — the PDF fetch below is a separate step with its own "Preparing" status
      // shown inline on the message (data.pdfLoading), so the Search button shouldn't
      // stay stuck on "Searching..." while a large file streams in behind the scenes.
      if (mountedRef.current) {
        setLoading(false);
      }

      if (payload?.type === 'course_material_pdf' && payload?.pdf?.token) {
        await loadPdfIntoMessage(placeholderId, payload.pdf.token, payload.pdf.fileName);
      }
    } catch (requestError) {
      const status = requestError.response?.status;
      updateMessage(placeholderId, () => ({
        loading: false,
        error: status === 401
          ? 'Sign in to use Course Material and open NOUN files.'
          : (requestError.response?.data?.message || 'Course Material could not process that request.'),
        data: null,
      }));
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  };

  return (
    <div className="np-shell">
      <SEO
        title="Course Material: NOUN Course Guides and Lecture Notes"
        description="Search for the real NOUN course material — course guide, lecture notes, or textbook PDF — for any course by course code, sourced from the official NOUN website, Google, and other NOUN-related sites."
        url="/course-material"
        keywords="NOUN course material, NOUN course guide, NOUN lecture notes, NOUN textbook, NOUN study material"
        robots="index, follow"
        structuredData={courseMaterialStructuredData}
      />
      <ShellHeader title="Course Material" />

      <div className="tw:space-y-4 tw:p-4">
        <div>
          <p className="tw:text-xs tw:font-bold tw:tracking-wide tw:text-brand-600 tw:uppercase tw:dark:text-brand-400">Course Material</p>
          <h1 className="tw:font-heading tw:mt-1 tw:text-lg tw:font-bold tw:tracking-tight">Find the real NOUN course material with just a course code like GST 101.</h1>
          <p className="tw:mt-1 tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">
            Searches the official NOUN website first, then Google and other NOUN-related sites — the actual course guide or lecture notes, not a summary.
          </p>
          <div className="tw:mt-3 tw:flex tw:flex-wrap tw:gap-2">
            {MATERIAL_EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => submitQuery(example)}
                disabled={loading}
                className="tw:flex tw:items-center tw:gap-2 tw:rounded-xl tw:border tw:border-slate-200 tw:bg-white tw:px-3 tw:py-2 tw:text-left tw:transition-colors tw:hover:bg-slate-50 tw:disabled:opacity-50 tw:dark:border-slate-800 tw:dark:bg-slate-900 tw:dark:hover:bg-slate-800"
              >
                <span className="tw:flex tw:h-8 tw:w-8 tw:flex-none tw:items-center tw:justify-center tw:rounded-lg tw:bg-brand-100 tw:text-brand-600 tw:dark:bg-brand-950 tw:dark:text-brand-300">
                  <Search className="tw:h-4 tw:w-4" />
                </span>
                <span>
                  <strong className="tw:block tw:text-sm">{example}</strong>
                  <span className="tw:text-xs tw:text-slate-400">Tap to search course material</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        <div ref={threadShellRef} className="tw:space-y-3">
          <div ref={threadRef} className="tw:space-y-3">
            {messages.map((message) => (
              <div
                key={message.id}
                id={`course-material-message-${message.id}`}
                className={cn('tw:flex tw:gap-2.5', message.role === 'user' && 'tw:flex-row-reverse')}
              >
                <span
                  className={cn(
                    'tw:flex tw:h-8 tw:w-8 tw:flex-none tw:items-center tw:justify-center tw:rounded-full',
                    message.role === 'assistant'
                      ? 'tw:bg-brand-100 tw:text-brand-600 tw:dark:bg-brand-950 tw:dark:text-brand-300'
                      : 'tw:bg-slate-100 tw:text-slate-500 tw:dark:bg-slate-800 tw:dark:text-slate-400',
                  )}
                >
                  {message.role === 'assistant' ? <FileText className="tw:h-4 tw:w-4" /> : <UserCircle className="tw:h-4 tw:w-4" />}
                </span>
                <div className="tw:min-w-0 tw:flex-1">
                  {message.role === 'user' ? (
                    <p className="tw:ml-auto tw:w-fit tw:rounded-2xl tw:rounded-tr-sm tw:bg-brand-600 tw:px-3.5 tw:py-2 tw:text-sm tw:text-white">{message.text}</p>
                  ) : (
                    <ResponseCard message={message} onSuggestionClick={submitQuery} />
                  )}
                </div>
              </div>
            ))}
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              submitQuery();
            }}
            className="tw:space-y-1.5"
          >
            <label htmlFor="course-material-input" className="tw:text-xs tw:font-semibold tw:text-slate-700 tw:dark:text-slate-300">
              Enter your course code
            </label>
            <div className="tw:space-y-2">
              <textarea
                id="course-material-input"
                placeholder="Example: GST 101"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    submitQuery();
                  }
                }}
                rows={2}
                className="tw:w-full tw:resize-none tw:rounded-xl tw:border tw:border-slate-200 tw:bg-white tw:p-3 tw:text-sm tw:outline-none tw:focus:border-brand-500 tw:dark:border-slate-800 tw:dark:bg-slate-900 tw:dark:text-slate-100"
              />
              <p className="tw:text-xs tw:text-slate-400">Examples: GST 101, ECO 202, MAC 211.</p>
              <Button type="submit" disabled={loading} className="tw:w-full">
                {loading ? <Loader2 className="tw:h-4 tw:w-4 tw:animate-spin" /> : <Send className="tw:h-4 tw:w-4" />}
                {loading ? 'Searching...' : 'Search Course Material'}
              </Button>
            </div>
            {composerError && <p className="tw:text-xs tw:font-medium tw:text-red-600 tw:dark:text-red-400">{composerError}</p>}
          </form>
        </div>
      </div>
    </div>
  );
};

export default CourseMaterial;
