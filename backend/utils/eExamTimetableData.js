const timetable = require('../data/eExamFinalTimetable2026_1.json');

const TIME_TO_HOUR = {
  '8:30am': { hour: 8, minute: 30 },
  '11am': { hour: 11, minute: 0 },
  '2pm': { hour: 14, minute: 0 },
  '3pm': { hour: 15, minute: 0 },
};

const normalizeCourseCode = (value) => String(value || '').trim().toUpperCase();

const getExamStartAt = ({ examDate, startTime }) => {
  const time = TIME_TO_HOUR[startTime];
  if (!time) return new Date(`${examDate}T00:00:00.000Z`);

  const [year, month, day] = String(examDate).split('-').map(Number);
  // NOUN timetable times are Nigeria local time (Africa/Lagos, UTC+1).
  return new Date(Date.UTC(year, month - 1, day, time.hour - 1, time.minute, 0, 0));
};

const entries = timetable.map((entry) => ({
  ...entry,
  courseCode: normalizeCourseCode(entry.courseCode),
  examStartAt: getExamStartAt(entry).toISOString(),
}));

const findTimetableEntry = (courseCode) => {
  const normalized = normalizeCourseCode(courseCode);
  return entries.find((entry) => entry.courseCode === normalized) || null;
};

const searchTimetable = (query, limit = 20) => {
  const normalized = normalizeCourseCode(query);
  if (!normalized) return [];

  return entries
    .filter((entry) => (
      entry.courseCode.includes(normalized)
      || String(entry.courseTitle || '').toUpperCase().includes(normalized)
    ))
    .slice(0, limit);
};

module.exports = {
  entries,
  findTimetableEntry,
  getExamStartAt,
  normalizeCourseCode,
  searchTimetable,
};
