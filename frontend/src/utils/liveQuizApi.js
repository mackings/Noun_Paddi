import axios from 'axios';

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

liveQuizApi.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export const getLiveQuizApiUrl = () => LIVE_QUIZ_API_URL;

export default liveQuizApi;
