import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL ;

const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  }
});

// Add request interceptor for debugging
api.interceptors.request.use(
  (config) => {
    // console.log(`Making request to: ${config.baseURL}${config.url}`);
    return config;
  },
  (error) => {
    // console.error('Request error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor for debugging
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === 'ECONNABORTED') {
      // console.error('Request timed out');
    } else if (!error.response) {
      // console.error('Network error:', error.message);
    } else {
      // console.error('Response error:', error.response.status, error.response.data);
    }
    return Promise.reject(error);
  }
);

export default api; 