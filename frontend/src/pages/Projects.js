import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, FileText, Send, Zap, Loader2 } from 'lucide-react';
import SEO from '../components/SEO';
import api from '../utils/api';
import ShellHeader from '../shell/ShellHeader';
import { Card, CardContent } from '../components/ui/card';
import { Button, buttonVariants } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { cn } from '../lib/utils';

const Projects = () => {
  const [selectedCourse, setSelectedCourse] = useState('');
  const [keywordsInput, setKeywordsInput] = useState('');
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setTopics([]);

    const keywords = keywordsInput
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    if (!selectedCourse.trim()) {
      setError('Please enter a course.');
      return;
    }

    if (keywords.length < 3 || keywords.length > 4) {
      setError('Please enter 3 to 4 keywords separated by commas.');
      return;
    }

    try {
      setLoading(true);
      const response = await api.post('/projects/topics', {
        course: selectedCourse.trim(),
        keywords,
      });

      setTopics(response.data.data?.topics || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to generate topics. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="np-shell">
      <SEO
        title="Projects - NounPaddi"
        description="Get project topics and check plagiarism for your academic projects."
        url="/projects"
      />
      <ShellHeader title="Projects" />

      <div className="tw:space-y-4 tw:p-4">
        <Card>
          <CardContent className="tw:space-y-4 tw:p-5">
            <div>
              <p className="tw:text-xs tw:font-bold tw:tracking-wide tw:text-brand-600 tw:uppercase tw:dark:text-brand-400">
                Projects Hub
              </p>
              <h1 className="tw:font-heading tw:mt-1 tw:text-xl tw:font-bold tw:tracking-tight">
                Get project topics or check plagiarism
              </h1>
              <p className="tw:mt-1 tw:text-sm tw:text-slate-600 tw:dark:text-slate-300">
                Choose your course, add a few keywords, and get project ideas in seconds.
              </p>
            </div>

            <div className="tw:flex tw:items-start tw:gap-3 tw:rounded-xl tw:bg-slate-50 tw:p-4 tw:dark:bg-slate-800/60">
              <span className="tw:flex tw:h-9 tw:w-9 tw:flex-none tw:items-center tw:justify-center tw:rounded-lg tw:bg-brand-100 tw:text-brand-600 tw:dark:bg-brand-950 tw:dark:text-brand-300">
                <FileText className="tw:h-4 tw:w-4" />
              </span>
              <div className="tw:flex-1">
                <p className="tw:font-heading tw:text-sm tw:font-bold">Upload your project for corrections</p>
                <p className="tw:mt-0.5 tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">
                  Check originality, citation quality, and structure before submission.
                </p>
                <div className="tw:mt-3 tw:flex tw:flex-wrap tw:gap-2">
                  <Link to="/plagiarism" className={cn(buttonVariants({ size: 'sm' }))}>Upload Project</Link>
                  <Link to="/projects/my-fees" className={cn(buttonVariants({ size: 'sm', variant: 'outline' }))}>My fees</Link>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="tw:space-y-4 tw:p-5">
            <div className="tw:flex tw:items-center tw:gap-3">
              <span className="tw:flex tw:h-9 tw:w-9 tw:flex-none tw:items-center tw:justify-center tw:rounded-lg tw:bg-brand-100 tw:text-brand-600 tw:dark:bg-brand-950 tw:dark:text-brand-300">
                <Zap className="tw:h-4 tw:w-4" />
              </span>
              <div>
                <h2 className="tw:font-heading tw:text-sm tw:font-bold">Get Project Topic</h2>
                <p className="tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">Provide a course and 3 to 4 keywords or interests.</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="tw:space-y-4">
              <label className="tw:block tw:space-y-1.5">
                <span className="tw:text-xs tw:font-semibold tw:text-slate-700 tw:dark:text-slate-300">Course</span>
                <Input
                  type="text"
                  placeholder="e.g. Computer Science, Business Admin, Political Science"
                  value={selectedCourse}
                  onChange={(event) => setSelectedCourse(event.target.value)}
                  required
                />
              </label>

              <label className="tw:block tw:space-y-1.5">
                <span className="tw:text-xs tw:font-semibold tw:text-slate-700 tw:dark:text-slate-300">Keywords (3 to 4)</span>
                <Input
                  type="text"
                  placeholder="e.g. renewable energy, sensor networks, smart grid"
                  value={keywordsInput}
                  onChange={(event) => setKeywordsInput(event.target.value)}
                  required
                />
                <span className="tw:block tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">Separate keywords with commas.</span>
              </label>

              {error && (
                <div className="tw:rounded-xl tw:bg-red-100 tw:px-3.5 tw:py-2.5 tw:text-sm tw:text-red-700 tw:dark:bg-red-500/15 tw:dark:text-red-300">
                  {error}
                </div>
              )}

              <Button type="submit" disabled={loading} className="tw:w-full">
                {loading ? (
                  <><Loader2 className="tw:h-4 tw:w-4 tw:animate-spin" /> Generating...</>
                ) : (
                  <><Send className="tw:h-4 tw:w-4" /> Generate Topics</>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="tw:space-y-3 tw:p-5">
            <div className="tw:flex tw:items-center tw:gap-3">
              <span className="tw:flex tw:h-9 tw:w-9 tw:flex-none tw:items-center tw:justify-center tw:rounded-lg tw:bg-brand-100 tw:text-brand-600 tw:dark:bg-brand-950 tw:dark:text-brand-300">
                <BookOpen className="tw:h-4 tw:w-4" />
              </span>
              <div>
                <h3 className="tw:font-heading tw:text-sm tw:font-bold">Your Topic Suggestions</h3>
                <p className="tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">Five focused project ideas will appear here.</p>
              </div>
            </div>

            {topics.length === 0 ? (
              <p className="tw:rounded-xl tw:bg-slate-50 tw:p-4 tw:text-center tw:text-sm tw:text-slate-500 tw:dark:bg-slate-800/60 tw:dark:text-slate-400">
                No topics yet. Fill the form to generate ideas.
              </p>
            ) : (
              <ol className="tw:list-decimal tw:space-y-2 tw:pl-5 tw:text-sm tw:text-slate-700 tw:dark:text-slate-200">
                {topics.map((topic, index) => (
                  <li key={`${topic}-${index}`}>{topic}</li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Projects;
