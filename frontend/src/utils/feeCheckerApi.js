const FIREBASE_API_KEY = 'AIzaSyB2-yfD3sYGuKXB8kiYrQnNK-g89x-Gs10';
const FIREBASE_PROJECT_ID = 'noun-summary';
const AUTH_STORAGE_KEY = 'np_fee_checker_auth_v1';
const AUTH_ENDPOINT = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_API_KEY}`;
const FIRESTORE_BASE_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

let authState = null;
let authPromise = null;
const collectionCache = new Map();

const readStoredAuthState = () => {
  if (authState) return authState;
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.sessionStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed?.idToken || !parsed?.expiresAt || parsed.expiresAt <= Date.now() + 60_000) {
      return null;
    }

    authState = parsed;
    return parsed;
  } catch (error) {
    return null;
  }
};

const persistAuthState = (state) => {
  authState = state;

  if (typeof window === 'undefined') return;

  try {
    window.sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    // Ignore storage failures.
  }
};

const clearAuthState = () => {
  authState = null;

  if (typeof window === 'undefined') return;

  try {
    window.sessionStorage.removeItem(AUTH_STORAGE_KEY);
  } catch (error) {
    // Ignore storage failures.
  }
};

async function authenticateAnonymously() {
  const cached = readStoredAuthState();
  if (cached) return cached.idToken;
  if (authPromise) return authPromise;

  authPromise = fetch(AUTH_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ returnSecureToken: true }),
  })
    .then(async (response) => {
      const payload = await response.json();
      if (!response.ok || !payload?.idToken) {
        throw new Error(payload?.error?.message || 'Failed to authenticate fee checker.');
      }

      const expiresInMs = Number(payload.expiresIn || 3600) * 1000;
      persistAuthState({
        idToken: payload.idToken,
        expiresAt: Date.now() + expiresInMs,
      });

      return payload.idToken;
    })
    .finally(() => {
      authPromise = null;
    });

  return authPromise;
}

function parseFirestoreValue(value) {
  if (!value || typeof value !== 'object') return value;
  if (Object.prototype.hasOwnProperty.call(value, 'stringValue')) return value.stringValue;
  if (Object.prototype.hasOwnProperty.call(value, 'integerValue')) return Number(value.integerValue);
  if (Object.prototype.hasOwnProperty.call(value, 'doubleValue')) return Number(value.doubleValue);
  if (Object.prototype.hasOwnProperty.call(value, 'booleanValue')) return Boolean(value.booleanValue);
  if (Object.prototype.hasOwnProperty.call(value, 'timestampValue')) return value.timestampValue;
  if (Object.prototype.hasOwnProperty.call(value, 'nullValue')) return null;

  if (value.arrayValue) {
    return Array.isArray(value.arrayValue.values)
      ? value.arrayValue.values.map(parseFirestoreValue)
      : [];
  }

  if (value.mapValue) {
    return Object.entries(value.mapValue.fields || {}).reduce((result, [key, nestedValue]) => {
      result[key] = parseFirestoreValue(nestedValue);
      return result;
    }, {});
  }

  return value;
}

function parseFirestoreDocument(document) {
  const fields = parseFirestoreValue({ mapValue: { fields: document.fields || {} } }) || {};
  const pathSegments = String(document.name || '').split('/');

  return {
    id: pathSegments[pathSegments.length - 1],
    name: document.name,
    createTime: document.createTime,
    updateTime: document.updateTime,
    ...fields,
  };
}

async function requestDocumentList(path, retry = true) {
  const authToken = await authenticateAnonymously();
  const response = await fetch(`${FIRESTORE_BASE_URL}/${path}`, {
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  });

  if ((response.status === 401 || response.status === 403) && retry) {
    clearAuthState();
    return requestDocumentList(path, false);
  }

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error?.message || 'Failed to load fee data.');
  }

  return Array.isArray(payload.documents)
    ? payload.documents.map(parseFirestoreDocument)
    : [];
}

async function getDocumentList(path) {
  if (collectionCache.has(path)) {
    return collectionCache.get(path);
  }

  const documents = await requestDocumentList(path);
  collectionCache.set(path, documents);
  return documents;
}

function sortByName(a, b) {
  return String(a.name || '').localeCompare(String(b.name || ''));
}

function sortLevels(a, b) {
  return Number(a.name || 0) - Number(b.name || 0);
}

function sortSemesters(a, b) {
  return Number(a.id || a.name || 0) - Number(b.id || b.name || 0);
}

export async function fetchFeeCheckerFaculties() {
  const documents = await getDocumentList('faculty?pageSize=50');
  return [...documents].sort(sortByName);
}

export async function fetchFeeCheckerPrograms(facultyId) {
  if (!facultyId) return [];
  const documents = await getDocumentList(`faculty/${facultyId}/programs?pageSize=100`);
  return [...documents].sort(sortByName);
}

export async function fetchFeeCheckerLevels(facultyId, programId) {
  if (!facultyId || !programId) return [];
  const documents = await getDocumentList(`faculty/${facultyId}/programs/${programId}/levels?pageSize=30`);
  return [...documents].sort(sortLevels);
}

export async function fetchFeeCheckerSemesters(facultyId, programId, levelId) {
  if (!facultyId || !programId || !levelId) return [];
  const documents = await getDocumentList(
    `faculty/${facultyId}/programs/${programId}/levels/${levelId}/semesters?pageSize=10`
  );
  return [...documents].sort(sortSemesters);
}
