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

const getSessionToken = async () => {
  const existingToken = localStorage.getItem('token');
  if (existingToken) return existingToken;

  const response = await api.get('/auth/session-token');
  const nextToken = response.data?.data?.token;
  if (nextToken) {
    localStorage.setItem('token', nextToken);
  }
  return nextToken || '';
};

liveQuizApi.interceptors.request.use(
  async (config) => {
    const token = await getSessionToken();
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

    localStorage.removeItem('token');
    const token = await getSessionToken();
    if (!token) return Promise.reject(error);

    originalRequest._retriedWithSessionToken = true;
    originalRequest.headers = {
      ...(originalRequest.headers || {}),
      Authorization: `Bearer ${token}`,
    };
    return liveQuizApi(originalRequest);
  }
);

export const getLiveQuizApiUrl = () => LIVE_QUIZ_API_URL;

export default liveQuizApi;
