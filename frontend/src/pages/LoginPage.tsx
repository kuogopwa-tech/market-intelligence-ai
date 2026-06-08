import { useNavigate } from "react-router-dom";

export default function LoginPage() {
  const navigate = useNavigate();
  return (
    <div className="grid min-h-screen place-items-center bg-slate-950 p-4">
      <div className="glass w-full max-w-md rounded-2xl p-6">
        <h1 className="text-2xl font-semibold">Welcome back</h1>
        <p className="mt-1 text-sm text-slate-400">Access Deriv AI Premium Intelligence</p>
        <div className="mt-6 space-y-3">
          <input className="w-full rounded-xl border border-white/10 bg-white/5 p-3" placeholder="Email" />
          <input className="w-full rounded-xl border border-white/10 bg-white/5 p-3" placeholder="Password" type="password" />
          <button className="w-full rounded-xl bg-cyan-500 p-3 font-medium text-slate-950" onClick={() => navigate("/dashboard")}>Sign in</button>
        </div>
      </div>
    </div>
  );
}
