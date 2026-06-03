import axios from "axios";

// Single source of truth for the backend base URL. Set VITE_API_URL per
// environment (.env.development / .env.production / Vercel env vars).
export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5050";

// Axios instance that attaches the JWT (from localStorage) to every request.
export const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// fetch() wrapper for pages that use fetch instead of axios.
export async function apiFetch(path, options = {}) {
  const token = localStorage.getItem("token");
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(`${API_URL}${path}`, { ...options, headers });
}
