export const slugifyCourse = (courseCode = '', courseName = '') => {
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
