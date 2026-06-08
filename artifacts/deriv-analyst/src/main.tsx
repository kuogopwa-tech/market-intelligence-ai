import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setBaseUrl } from "@workspace/api-client-react";

// Configure API base for generated clients. Prefer Vite env var `VITE_API_BASE`,
// fall back to localhost:3000 for development.
setBaseUrl((import.meta.env.VITE_API_BASE as string) ?? "http://localhost:3000");

createRoot(document.getElementById("root")!).render(<App />);
