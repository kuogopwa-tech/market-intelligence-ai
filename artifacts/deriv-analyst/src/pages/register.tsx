import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff, UserPlus, Cpu, Activity, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";

const TradingBackground = () => {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden bg-[#020617]">
      <div 
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `linear-gradient(#3b82f6 1px, transparent 1px), linear-gradient(90deg, #3b82f6 1px, transparent 1px)`,
          backgroundSize: '40px 40px'
        }}
      />
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, height: 0 }}
            animate={{ 
              opacity: [0.1, 0.3, 0.1],
              height: [20, 100, 40],
              y: [Math.random() * 1000, Math.random() * 1000]
            }}
            transition={{ 
              duration: 5 + Math.random() * 10, 
              repeat: Infinity,
              ease: "linear"
            }}
            className="absolute w-1 bg-blue-500/20"
            style={{ 
              left: `${i * 5}%`,
              boxShadow: '0 0 15px rgba(59, 130, 246, 0.5)'
            }}
          />
        ))}
      </div>
      {[...Array(30)].map((_, i) => (
        <motion.div
          key={`p-${i}`}
          animate={{
            x: [Math.random() * window.innerWidth, Math.random() * window.innerWidth],
            y: [Math.random() * window.innerHeight, Math.random() * window.innerHeight],
            opacity: [0, 0.4, 0]
          }}
          transition={{
            duration: 10 + Math.random() * 20,
            repeat: Infinity,
            ease: "linear"
          }}
          className="absolute w-1 h-1 bg-cyan-400 rounded-full blur-[1px]"
        />
      ))}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 blur-[120px] rounded-full" />
    </div>
  );
};

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<"user" | "admin">("user");
  const [loading, setLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const { login } = useAuth();
  const [, setLocation] = useLocation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setIsError(false);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, role }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Registration failed");
      }

      login(data.token, data.user);
      toast.success("Registration successful");
      setLocation("/");
    } catch (error: any) {
      setIsError(true);
      toast.error("Registration Error", { description: error.message });
      setTimeout(() => setIsError(false), 500);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex items-center justify-center min-h-screen p-4 overflow-hidden">
      <TradingBackground />

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="flex justify-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1, rotate: [0, -10, 10, 0] }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 backdrop-blur-xl shadow-[0_0_20px_rgba(34,211,238,0.2)]"
          >
            <UserPlus className="w-10 h-10 text-cyan-400" />
          </motion.div>
        </div>

        <motion.div
          animate={isError ? { x: [-10, 10, -10, 10, 0] } : {}}
          transition={{ duration: 0.4 }}
        >
          <Card className="border-white/10 bg-black/40 backdrop-blur-2xl shadow-2xl overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 via-blue-400 to-indigo-500 opacity-50" />
            
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60 tracking-tight">
                Analyst Registration
              </CardTitle>
              <CardDescription className="text-cyan-200/50 mt-2 font-medium">
                Create your credentials for market synchronization
              </CardDescription>
            </CardHeader>

            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-6 pt-6">
                <div className="space-y-2 group">
                  <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-cyan-400/70 ml-1">
                    Designated Email
                  </Label>
                  <div className="relative">
                    <Input
                      id="email"
                      type="email"
                      placeholder="analyst@market-ai.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="bg-white/5 border-white/10 focus:border-cyan-500/50 focus:ring-cyan-500/20 transition-all duration-300 h-12 pl-10"
                    />
                    <Cpu className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-400/40 group-focus-within:text-cyan-400 transition-colors" />
                  </div>
                </div>

                <div className="space-y-2 group">
                  <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-cyan-400/70 ml-1">
                    Secure Access Code
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="bg-white/5 border-white/10 focus:border-cyan-500/50 focus:ring-cyan-500/20 transition-all duration-300 h-12 pl-10 pr-10"
                    />
                    <Activity className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-400/40 group-focus-within:text-cyan-400 transition-colors" />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 hover:text-cyan-400 transition-colors"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2 group">
                  <Label htmlFor="role" className="text-xs font-semibold uppercase tracking-wider text-cyan-400/70 ml-1">
                    Assigned Role (Demo)
                  </Label>
                  <div className="relative">
                    <select
                      id="role"
                      className="flex h-12 w-full rounded-md border border-white/10 bg-white/5 px-10 py-1 text-sm shadow-sm transition-all duration-300 focus:border-cyan-500/50 focus:ring-cyan-500/20 focus:outline-none appearance-none"
                      value={role}
                      onChange={(e) => setRole(e.target.value as any)}
                    >
                      <option value="user" className="bg-[#0f172a]">Standard User</option>
                      <option value="admin" className="bg-[#0f172a]">Administrator</option>
                    </select>
                    <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-400/40 group-focus-within:text-cyan-400 transition-colors" />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-cyan-400/40">
                      <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  </div>
                </div>
              </CardContent>

              <CardFooter className="flex flex-col space-y-6 pt-2 pb-8">
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full"
                >
                  <Button 
                    type="submit" 
                    className="w-full h-12 bg-cyan-600 hover:bg-cyan-500 text-white font-bold shadow-[0_0_20px_rgba(8,145,178,0.4)] transition-all duration-300 relative overflow-hidden group"
                    disabled={loading}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-cyan-400/0 via-white/20 to-cyan-400/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                    {loading ? (
                      <div className="flex items-center">
                        <Loader2 className="mr-2 h-5 w-5 animate-spin text-white" />
                        <span>Processing...</span>
                      </div>
                    ) : (
                      <span className="flex items-center">
                        Confirm Registration <Activity className="ml-2 w-4 h-4" />
                      </span>
                    )}
                  </Button>
                </motion.div>

                <div className="text-sm text-center">
                  <span className="text-white/40">Already authorized?</span>{" "}
                  <Button 
                    variant="link" 
                    className="p-0 text-cyan-400 hover:text-blue-400 font-bold transition-colors" 
                    onClick={() => setLocation("/login")}
                  >
                    Access Terminal
                  </Button>
                </div>
              </CardFooter>
            </form>
          </Card>
        </motion.div>
        
        <div className="mt-8 text-center">
          <p className="text-[10px] text-white/20 uppercase tracking-[0.2em]">
            System Node v4.2.0 • Market Intelligence Network
          </p>
        </div>
      </motion.div>
    </div>
  );
}
