import api from './api';

function sortByName(a, b) {
  return String(a.name || '').localeCompare(String(b.name || ''));
}

function sortLevels(a, b) {
  return Number(a.name || 0) - Number(b.name || 0);
}

function sortSemesters(a, b) {
  return Number(a.id || a.name || 0) - Number(b.id || b.name || 0);
}

async function getFeeCheckerList(endpoint, params = {}) {
  const response = await api.get(endpoint, { params });
  return Array.isArray(response.data?.data) ? response.data.data : [];
}

export async function fetchFeeCheckerFaculties() {
  const documents = await getFeeCheckerList('/projects/fees/faculties');
  return [...documents].sort(sortByName);
}

export async function fetchFeeCheckerPrograms(facultyId) {
  if (!facultyId) return [];
  const documents = await getFeeCheckerList('/projects/fees/programs', { facultyId });
  return [...documents].sort(sortByName);
}

export async function fetchFeeCheckerLevels(facultyId, programId) {
  if (!facultyId || !programId) return [];
  const documents = await getFeeCheckerList('/projects/fees/levels', { facultyId, programId });
  return [...documents].sort(sortLevels);
}

export async function fetchFeeCheckerSemesters(facultyId, programId, levelId) {
  if (!facultyId || !programId || !levelId) return [];
  const documents = await getFeeCheckerList('/projects/fees/semesters', { facultyId, programId, levelId });
  return [...documents].sort(sortSemesters);
}
