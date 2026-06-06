import { io } from 'socket.io-client';
import { getLiveQuizApiUrl } from './liveQuizApi';

export const getLiveQuizSocketUrl = () => {
  if (process.env.REACT_APP_LIVE_QUIZ_SOCKET_URL) {
    return process.env.REACT_APP_LIVE_QUIZ_SOCKET_URL.trim();
  }

  try {
    const apiUrl = getLiveQuizApiUrl();
    const url = new URL(apiUrl, window.location.origin);
    url.pathname = url.pathname.replace(/\/api\/?$/, '') || '/';
    url.search = '';
    url.hash = '';
    return url.origin;
  } catch {
    return window.location.origin;
  }
};

export const createLiveQuizSocket = () => io(getLiveQuizSocketUrl(), {
  autoConnect: true,
  withCredentials: true,
  transports: ['websocket', 'polling'],
});
