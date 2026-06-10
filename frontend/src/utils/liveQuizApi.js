import axios from 'axios';
import api from './api';

const LIVE_QUIZ_API_URL = (
  process.env.REACT_APP_LIVE_QUIZ_API_URL
  || process.env.REACT_APP_API_URL
  || 'http://localhost:5000/api'
).trim();

const liveQuizApi = axios.create({
  baseURL: LIVE_QUIZ_API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

let sessionTokenRefresh = null;
let adminSessionPrepared = false;

const refreshSessionToken = async () => {
  if (!sessionTokenRefresh) {
    sessionTokenRefresh = api.get('/auth/session-token', {
      skipAuth: true,
    }).then((response) => {
      const nextToken = response.data?.data?.token || '';
      if (nextToken) {
        localStorage.setItem('token', nextToken);
      }
      return nextToken;
    }).catch(() => '').finally(() => {
      sessionTokenRefresh = null;
    });
  }

  return sessionTokenRefresh;
};

const getSessionToken = async () => {
  const existingToken = localStorage.getItem('token');
  if (existingToken) {
    return existingToken;
  }

  return refreshSessionToken();
};

const prepareAdminSessionToken = async () => {
  if (adminSessionPrepared) {
    return getSessionToken();
  }

  const existingToken = localStorage.getItem('token') || '';
  const refreshedToken = await refreshSessionToken();
  if (refreshedToken) {
    adminSessionPrepared = true;
    return refreshedToken;
  }
  return existingToken;
};

const retryWithFreshSession = async (originalRequest) => {
  localStorage.removeItem('token');
  adminSessionPrepared = false;
  const token = await refreshSessionToken();
  if (!token) {
    return null;
  }

  originalRequest._retriedWithSessionToken = true;
  originalRequest.headers = {
    ...(originalRequest.headers || {}),
    Authorization: `Bearer ${token}`,
  };
  return liveQuizApi(originalRequest);
};

liveQuizApi.interceptors.request.use(
  async (config) => {
    const isAdminRequest = String(config.url || '').includes('/live-quiz/admin/');
    const token = isAdminRequest
      ? await prepareAdminSessionToken()
      : await getSessionToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

liveQuizApi.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status !== 401 || originalRequest?._retriedWithSessionToken) {
      return Promise.reject(error);
    }

    const retriedResponse = await retryWithFreshSession(originalRequest);
    if (!retriedResponse) {
      return Promise.reject(error);
    }
    return retriedResponse;
  }
);

export const getLiveQuizApiUrl = () => LIVE_QUIZ_API_URL;

export default liveQuizApi;
