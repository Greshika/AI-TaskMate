import React, { useState } from "react";
import { motion } from "motion/react";
import { Mail, Lock, User, Key, CheckCircle, ArrowRight, Loader2, Sparkles } from "lucide-react";
import { User as UserType } from "../types";

interface AuthProps {
  onLoginSuccess: (user: UserType) => void;
  isDarkMode: boolean;
}

type AuthMode = "login" | "signup" | "forgot";

export default function Auth({ onLoginSuccess, isDarkMode }: AuthProps) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setTempPassword(null);
    setLoading(true);

    const url = mode === "login" 
      ? "/api/auth/login" 
      : mode === "signup" 
        ? "/api/auth/signup" 
        : "/api/auth/forgot-password";

    const body = mode === "login"
      ? { email, password }
      : mode === "signup"
        ? { name, email, password }
        : { email };

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Something went wrong. Please try again.");
      }

      if (mode === "login" || mode === "signup") {
        onLoginSuccess(data.user);
      } else if (mode === "forgot") {
        setSuccessMsg(data.message);
        if (data.tempPassword) {
          setTempPassword(data.tempPassword);
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-radial from-slate-50 to-slate-200 dark:from-slate-900 dark:to-slate-950 font-sans transition-colors duration-300">
      <div className="absolute top-0 left-0 w-full h-full bg-[linear-gradient(to_right,rgba(99,102,241,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(99,102,241,0.05)_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none" />
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        {/* App Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/10 dark:bg-indigo-400/10 text-indigo-600 dark:text-indigo-400 rounded-full text-sm font-medium border border-indigo-500/20 dark:border-indigo-400/20 mb-3 backdrop-blur-xs">
            <Sparkles className="w-4 h-4" />
            AI TaskMate
          </div>
          <h1 className="text-4xl font-bold font-display tracking-tight text-slate-800 dark:text-slate-100">
            TaskMate <span className="text-indigo-600 dark:text-indigo-400">AI</span>
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm font-sans">
            Elevate your day with intelligent deadline prioritization
          </p>
        </div>

        {/* Form Container */}
        <div className="glass-panel rounded-3xl p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl" />

          <h2 className="text-2xl font-bold font-display text-slate-800 dark:text-slate-100 mb-6">
            {mode === "login" && "Welcome Back"}
            {mode === "signup" && "Create Account"}
            {mode === "forgot" && "Reset Password"}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Alex Mercer"
                    className="w-full bg-slate-500/5 dark:bg-slate-400/5 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl py-3 pl-10 pr-4 text-slate-800 dark:text-slate-100 outline-none transition-all placeholder:text-slate-400 text-sm"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="alex@example.com"
                  className="w-full bg-slate-500/5 dark:bg-slate-400/5 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl py-3 pl-10 pr-4 text-slate-800 dark:text-slate-100 outline-none transition-all placeholder:text-slate-400 text-sm"
                />
              </div>
            </div>

            {mode !== "forgot" && (
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Password
                  </label>
                  {mode === "login" && (
                    <button
                      type="button"
                      onClick={() => {
                        setMode("forgot");
                        setError(null);
                        setSuccessMsg(null);
                        setTempPassword(null);
                      }}
                      className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-500/5 dark:bg-slate-400/5 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl py-3 pl-10 pr-4 text-slate-800 dark:text-slate-100 outline-none transition-all placeholder:text-slate-400 text-sm"
                  />
                </div>
              </div>
            )}

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs rounded-xl flex items-start gap-2">
                <span className="font-semibold">Error:</span> {error}
              </div>
            )}

            {successMsg && (
              <div className="p-3 bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400 text-xs rounded-xl space-y-2">
                <div className="flex items-center gap-1.5 font-medium">
                  <CheckCircle className="w-4 h-4" />
                  <span>{successMsg}</span>
                </div>
                {tempPassword && (
                  <div className="p-2 bg-white/50 dark:bg-black/20 rounded-lg border border-green-500/10 mt-1">
                    <p className="text-slate-500 dark:text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-1">Temporary Password</p>
                    <code className="text-sm font-mono font-semibold select-all text-slate-800 dark:text-slate-100">{tempPassword}</code>
                  </div>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full relative group bg-indigo-600 hover:bg-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-400 text-white font-medium rounded-xl py-3 px-4 shadow-lg shadow-indigo-500/20 dark:shadow-indigo-500/10 hover:shadow-indigo-500/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <span>
                    {mode === "login" && "Sign In"}
                    {mode === "signup" && "Create Account"}
                    {mode === "forgot" && "Send Reset Credentials"}
                  </span>
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </>
              )}
            </button>
          </form>

          {/* Bottom Switcher */}
          <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-800/60 text-center text-sm text-slate-500 dark:text-slate-400">
            {mode === "login" ? (
              <p>
                Don't have an account?{" "}
                <button
                  onClick={() => {
                    setMode("signup");
                    setError(null);
                    setSuccessMsg(null);
                    setTempPassword(null);
                  }}
                  className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
                >
                  Sign Up
                </button>
              </p>
            ) : (
              <p>
                Already have an account?{" "}
                <button
                  onClick={() => {
                    setMode("login");
                    setError(null);
                    setSuccessMsg(null);
                    setTempPassword(null);
                  }}
                  className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
                >
                  Sign In
                </button>
              </p>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
