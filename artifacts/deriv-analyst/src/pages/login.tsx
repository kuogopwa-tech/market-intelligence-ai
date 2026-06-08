import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff, TrendingUp, Cpu, Activity } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const TradingBackground = () => {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden bg-[#020617]">
      {/* Digital Grid */}
      <div 
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `linear-gradient(#3b82f6 1px, transparent 1px), linear-gradient(90deg, #3b82f6 1px, transparent 1px)`,
          backgroundSize: '40px 40px'
        }}
      />
      
      {/* Animated Candlestick-like elements */}
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

      {/* Floating Particles */}
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

      {/* Glow Effects */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 blur-[120px] rounded-full" />
    </div>
  );
};

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const { login } = useAuth();
  const [, setLocation] = useLocation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setIsError(false);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Login failed");
      }

      login(data.token, data.user);
      toast.success("Login successful");
      setLocation("/");
    } catch (error: any) {
      setIsError(true);
      toast.error("Login Error", { description: error.message });
      // Reset error state after animation
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
            animate={{ scale: 1, rotate: [0, 10, -10, 0] }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 backdrop-blur-xl shadow-[0_0_20px_rgba(59,130,246,0.2)]"
          >
            <TrendingUp className="w-10 h-10 text-blue-400" />
          </motion.div>
        </div>

        <motion.div
          animate={isError ? { x: [-10, 10, -10, 10, 0] } : {}}
          transition={{ duration: 0.4 }}
        >
          <Card className="border-white/10 bg-black/40 backdrop-blur-2xl shadow-2xl overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-cyan-400 to-purple-500 opacity-50" />
            
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60 tracking-tight">
                AI Trading Intelligence
              </CardTitle>
              <CardDescription className="text-blue-200/50 mt-2 font-medium">
                Enter the future of autonomous market analysis
              </CardDescription>
            </CardHeader>

            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-6 pt-6">
                <div className="space-y-2 group">
                  <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-blue-400/70 ml-1">
                    Intelligence ID (Email)
                  </Label>
                  <div className="relative">
                    <Input
                      id="email"
                      type="email"
                      placeholder="operator@market-ai.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="bg-white/5 border-white/10 focus:border-blue-500/50 focus:ring-blue-500/20 transition-all duration-300 h-12 pl-10"
                    />
                    <Cpu className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400/40 group-focus-within:text-blue-400 transition-colors" />
                  </div>
                </div>

                <div className="space-y-2 group">
                  <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-blue-400/70 ml-1">
                    Access Code (Password)
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="bg-white/5 border-white/10 focus:border-blue-500/50 focus:ring-blue-500/20 transition-all duration-300 h-12 pl-10 pr-10"
                    />
                    <Activity className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400/40 group-focus-within:text-blue-400 transition-colors" />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 hover:text-blue-400 transition-colors"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
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
                    className="w-full h-12 bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-[0_0_20px_rgba(37,99,235,0.4)] transition-all duration-300 relative overflow-hidden group"
                    disabled={loading}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-400/0 via-white/20 to-blue-400/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                    {loading ? (
                      <div className="flex items-center">
                        <Loader2 className="mr-2 h-5 w-5 animate-spin text-cyan-200" />
                        <span>Synchronizing...</span>
                      </div>
                    ) : (
                      <span className="flex items-center">
                        Initialize Terminal <TrendingUp className="ml-2 w-4 h-4" />
                      </span>
                    )}
                  </Button>
                </motion.div>

                <div className="text-sm text-center">
                  <span className="text-white/40">New analyst?</span>{" "}
                  <Button 
                    variant="link" 
                    className="p-0 text-blue-400 hover:text-cyan-400 font-bold transition-colors" 
                    onClick={() => setLocation("/register")}
                  >
                    Request Credentials
                  </Button>
                </div>
              </CardFooter>
            </form>
          </Card>
        </motion.div>
        
        <div className="mt-8 text-center">
          <p className="text-[10px] text-white/20 uppercase tracking-[0.2em]">
            Secure Access Gateway v4.2.0 • Market Intelligence Network
          </p>
        </div>
      </motion.div>
    </div>
  );
}
