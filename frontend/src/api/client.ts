import axios from "axios";

export const api = axios.create({
  baseURL: "/api",
  timeout: 20_000,
  // Required for auth cookie support (httpOnly cookie named `token`)
  withCredentials: true,
});
