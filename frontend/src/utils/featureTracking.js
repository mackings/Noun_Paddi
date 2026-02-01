import api from './api';

export const trackFeatureVisit = async (feature) => {
  if (!feature) return;
  try {
    await api.post('/analytics/feature-visit', { feature });
  } catch (error) {
    // Silently ignore analytics errors
  }
};
