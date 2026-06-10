import axios from 'axios';

const API_URL = (process.env.REACT_APP_API_URL || 'http://localhost:5000/api').trim();

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests if it exists
api.interceptors.request.use(
  (config) => {
    if (config.skipAuth) {
      delete config.headers.Authorization;
      return config;
    }

    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (
      error.response?.status !== 401
      || originalRequest?.skipAuth
      || originalRequest?._retriedWithoutBearer
    ) {
      return Promise.reject(error);
    }

    localStorage.removeItem('token');
    originalRequest._retriedWithoutBearer = true;
    originalRequest.skipAuth = true;
    originalRequest.headers = {
      ...(originalRequest.headers || {}),
    };
    delete originalRequest.headers.Authorization;
    return api(originalRequest);
  }
);

export default api;
