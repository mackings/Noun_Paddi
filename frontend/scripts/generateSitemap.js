/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const siteUrl = (process.env.REACT_APP_SITE_URL || 'https://paddi.com.ng').replace(/\/$/, '');
const apiBaseUrl = (
  process.env.REACT_APP_API_URL
  || process.env.SITEMAP_API_URL
  || 'https://noun-paddi-backend.vercel.app/api'
).replace(/\/$/, '');
const publicDir = path.join(__dirname, '..', 'public');
const sitemapPath = path.join(publicDir, 'sitemap.xml');

const staticUrls = [
  '/',
  '/disclaimer',
  '/ask',
  '/courses',
  '/summaries',
  '/it-placement',
  '/practice',
  '/noun-course-materials',
  '/noun-practice-questions',
  '/noun-student-community',
  '/news',
];

const newsPosts = [
  'noun-course-summaries-study-update',
  'noun-practice-questions-public-access',
  'noun-siwes-placement-support-update',
];

const today = new Date().toISOString().slice(0, 10);

const slugifyCourse = (courseCode = '', courseName = '') => {
  const codePart = String(courseCode || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const namePart = String(courseName || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return [codePart, namePart].filter(Boolean).join('-');
};

const toUrlNode = (loc, priority = '0.8') => `  <url>
    <loc>${siteUrl}${loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${priority}</priority>
  </url>`;

const buildXml = (coursePaths) => {
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...staticUrls.map((url, index) => toUrlNode(url, index === 0 ? '1.0' : '0.8')),
    ...newsPosts.map((slug) => toUrlNode(`/news/${slug}`, '0.7')),
    ...coursePaths.map((url) => toUrlNode(url, '0.7')),
    '</urlset>',
    '',
  ];
  return lines.join('\n');
};

const fetchCourses = async () => {
  const response = await fetch(`${apiBaseUrl}/courses`);
  if (!response.ok) {
    throw new Error(`Failed to fetch courses: ${response.status}`);
  }
  const payload = await response.json();
  return Array.isArray(payload?.data) ? payload.data : [];
};

const main = async () => {
  let coursePaths = [];

  try {
    const courses = await fetchCourses();
    coursePaths = courses
      .map((course) => `/noun-course/${slugifyCourse(course.courseCode, course.courseName)}`)
      .filter(Boolean);
    console.log(`Generated sitemap entries for ${coursePaths.length} course pages.`);
  } catch (error) {
    console.warn(`Sitemap course fetch skipped: ${error.message}`);
  }

  const xml = buildXml(coursePaths);
  fs.writeFileSync(sitemapPath, xml, 'utf8');
  console.log(`Sitemap written to ${sitemapPath}`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
