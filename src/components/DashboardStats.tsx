import React from "react";
import { motion } from "motion/react";
import { ListTodo, CheckCircle2, Clock, AlertCircle, Percent } from "lucide-react";
import { Task } from "../types";

interface DashboardStatsProps {
  tasks: Task[];
  overdueCount: number;
}

export default function DashboardStats({ tasks, overdueCount }: DashboardStatsProps) {
  const total = tasks.length;
  const completed = tasks.filter((t) => t.status === "Completed").length;
  const pending = tasks.filter((t) => t.status === "Pending").length;
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

  const stats = [
    {
      id: "stats-total",
      label: "Total Tasks",
      value: total,
      icon: ListTodo,
      color: "from-blue-500/10 to-indigo-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400",
      glow: "bg-blue-500/5",
    },
    {
      id: "stats-pending",
      label: "Pending",
      value: pending,
      icon: Clock,
      color: "from-amber-500/10 to-orange-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400",
      glow: "bg-amber-500/5",
    },
    {
      id: "stats-completed",
      label: "Completed",
      value: completed,
      icon: CheckCircle2,
      color: "from-emerald-500/10 to-teal-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400",
      glow: "bg-emerald-500/5",
    },
    {
      id: "stats-overdue",
      label: "Overdue",
      value: overdueCount,
      icon: AlertCircle,
      color: overdueCount > 0 
        ? "from-rose-500/20 to-red-500/20 border-rose-500/30 text-rose-600 dark:text-rose-400 animate-pulse" 
        : "from-slate-500/10 to-zinc-500/10 border-slate-500/20 text-slate-500 dark:text-slate-400",
      glow: overdueCount > 0 ? "bg-rose-500/10" : "bg-slate-500/5",
    },
  ];

  return (
    <div className="space-y-6">
      {/* 4 Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, idx) => (
          <motion.div
            key={stat.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: idx * 0.05 }}
            className={`relative overflow-hidden rounded-2xl border p-4 bg-gradient-to-br ${stat.color} backdrop-blur-md flex flex-col justify-between h-28 shadow-xs hover:scale-[1.02] transition-transform`}
          >
            <div className={`absolute -right-4 -bottom-4 w-16 h-16 rounded-full blur-xl ${stat.glow}`} />
            
            <div className="flex justify-between items-start">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {stat.label}
              </span>
              <stat.icon className="w-5 h-5 opacity-80" />
            </div>
            
            <div className="mt-2">
              <span className="text-3xl font-bold font-display tracking-tight text-slate-800 dark:text-slate-100">
                {stat.value}
              </span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Progress Bar Panel */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="glass-card rounded-2xl p-5 border border-slate-200 dark:border-slate-800/60 shadow-sm"
        id="stats-progress-card"
      >
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2">
            <Percent className="w-5 h-5 text-indigo-500" />
            <h3 className="font-display font-bold text-slate-800 dark:text-slate-100">
              Productivity Momentum
            </h3>
          </div>
          <span className="text-sm font-bold font-mono text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2.5 py-1 rounded-lg">
            {progress}% Completed
          </span>
        </div>

        {/* Outer bar */}
        <div className="h-4 bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden relative border border-slate-200/40 dark:border-slate-800/20">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500 rounded-full relative"
          >
            {/* Animated gleam */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" style={{ backgroundSize: '200% 100%' }} />
          </motion.div>
        </div>

        {/* Motivational subtext based on progress */}
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2.5 italic">
          {progress === 0 && "Start today by checking off your first task! You've got this."}
          {progress > 0 && progress < 40 && "Nice start! Keep building your momentum."}
          {progress >= 40 && progress < 80 && "Awesome pace! You are crushing your schedule today."}
          {progress >= 80 && progress < 100 && "So close! Just a final push to reach perfection."}
          {progress === 100 && "Exceptional work! You completed 100% of your tasks!"}
        </p>
      </motion.div>
    </div>
  );
}
