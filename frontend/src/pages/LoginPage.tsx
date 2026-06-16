import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/api/client";
import { toast } from "sonner";

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const onSubmit = async () => {
    if (!email.trim() || !password) {
      toast.error("Email and password are required");
      return;
    }

    setIsLoading(true);
    try {
      await api.post("/auth/login", { email, password });
      toast.success("Signed in");
      navigate("/dashboard");
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Login failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-slate-950 p-4">
      <div className="glass w-full max-w-md rounded-2xl p-6">
        <h1 className="text-2xl font-semibold">Welcome back</h1>
        <p className="mt-1 text-sm text-slate-400">Access Deriv AI Premium Intelligence</p>

        <div className="mt-6 space-y-3">
          <input
            className="w-full rounded-xl border border-white/10 bg-white/5 p-3"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          <input
            className="w-full rounded-xl border border-white/10 bg-white/5 p-3"
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          <button
            className="w-full rounded-xl bg-cyan-500 p-3 font-medium text-slate-950 disabled:opacity-60"
            disabled={isLoading}
            onClick={onSubmit}
          >
            {isLoading ? "Signing in..." : "Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}
