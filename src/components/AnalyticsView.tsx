import React from "react";
import { motion } from "motion/react";
import { TrendingUp, BarChart2, Calendar, Target, Award, CheckCircle } from "lucide-react";
import { Task, getTaskPriority } from "../types";

interface AnalyticsViewProps {
  tasks: Task[];
}

export default function AnalyticsView({ tasks }: AnalyticsViewProps) {
  const completedTasks = tasks.filter((t) => t.status === "Completed");
  const pendingTasks = tasks.filter((t) => t.status === "Pending");

  // Calculate Streak or Productivity Rates
  const completionRate = tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0;

  // Let's parse Weekly completions (Sunday - Saturday)
  const getCompletionsByDay = () => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const counts = [0, 0, 0, 0, 0, 0, 0];

    completedTasks.forEach((task) => {
      if (task.completedAt) {
        const date = new Date(task.completedAt);
        const dayIdx = date.getDay();
        counts[dayIdx]++;
      } else {
        // Fallback to deadline date if completedAt isn't present
        const date = new Date(task.deadlineDate);
        if (!isNaN(date.getTime())) {
          counts[date.getDay()]++;
        }
      }
    });

    return days.map((day, idx) => ({
      day,
      count: counts[idx],
    }));
  };

  const weeklyData = getCompletionsByDay();
  const maxWeeklyCount = Math.max(...weeklyData.map((d) => d.count), 1);

  // Parse Categories
  const categoriesMap: { [key: string]: number } = {};
  tasks.forEach((t) => {
    categoriesMap[t.category] = (categoriesMap[t.category] || 0) + 1;
  });

  const categoryData = Object.keys(categoriesMap).map((cat) => ({
    name: cat,
    count: categoriesMap[cat],
  }));

  // Parse Priorities dynamically based on current time
  const priorityCounts = { Overdue: 0, Critical: 0, High: 0, Medium: 0, Low: 0 };
  const now = new Date();
  tasks.forEach((t) => {
    const priority = getTaskPriority(t, now);
    priorityCounts[priority]++;
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6" id="analytics-panel">
      {/* Chart 1: Weekly completions */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="md:col-span-2 glass-card rounded-3xl p-6 border border-white/60 dark:border-slate-800/60 shadow-xl flex flex-col justify-between"
      >
        <div>
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-10 h-10 bg-indigo-600/10 text-indigo-600 dark:bg-indigo-400/10 dark:text-indigo-400 rounded-xl flex items-center justify-center">
              <BarChart2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold font-display text-slate-800 dark:text-slate-100">
                Weekly Productivity Flow
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Completions by day of the week
              </p>
            </div>
          </div>
        </div>

        {/* Custom SVG/HTML Bar Chart */}
        <div className="h-44 flex items-end justify-between gap-2.5 px-2 mt-6 mb-2">
          {weeklyData.map((data, idx) => {
            const heightPct = (data.count / maxWeeklyCount) * 100;
            return (
              <div key={data.day} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                <div className="w-full relative group flex justify-center items-end h-full">
                  {/* Tooltip */}
                  <div className="absolute -top-8 bg-slate-900 text-white text-[10px] py-1 px-2 rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap font-mono font-bold z-10 shadow-md">
                    {data.count} task{data.count !== 1 ? "s" : ""}
                  </div>

                  {/* Bar */}
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${heightPct}%` }}
                    transition={{ duration: 0.8, delay: idx * 0.05, ease: "easeOut" }}
                    className={`w-full rounded-t-xl relative overflow-hidden transition-all duration-300 min-h-[4px] cursor-pointer ${
                      data.count > 0
                        ? "bg-gradient-to-t from-indigo-600 to-indigo-400 hover:from-indigo-500 hover:to-purple-400 shadow-indigo-500/10 shadow-lg"
                        : "bg-slate-200/50 dark:bg-slate-800/30"
                    }`}
                  >
                    {data.count > 0 && (
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" style={{ backgroundSize: '200% 100%' }} />
                    )}
                  </motion.div>
                </div>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 font-mono">
                  {data.day}
                </span>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* Chart 2: Priority/Category distribution */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="glass-card rounded-3xl p-6 border border-white/60 dark:border-slate-800/60 shadow-xl flex flex-col justify-between"
      >
        <div>
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-10 h-10 bg-purple-600/10 text-purple-600 dark:bg-purple-400/10 dark:text-purple-400 rounded-xl flex items-center justify-center">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold font-display text-slate-800 dark:text-slate-100">
                Task Breakdown
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                By importance and frequency
              </p>
            </div>
          </div>

          {/* Priority Levels */}
          <div className="space-y-3">
            <div>
              <div className="flex justify-between items-center text-xs font-semibold mb-1">
                <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1.5 font-bold">
                  <span className="w-2 h-2 rounded-full bg-rose-600 animate-pulse" /> Overdue
                </span>
                <span className="text-slate-600 dark:text-slate-300 font-mono">
                  {priorityCounts.Overdue} task{priorityCounts.Overdue !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-rose-600"
                  style={{ width: `${tasks.length > 0 ? (priorityCounts.Overdue / tasks.length) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center text-xs font-semibold mb-1">
                <span className="text-red-500 dark:text-red-400 flex items-center gap-1.5 font-bold">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> Critical
                </span>
                <span className="text-slate-600 dark:text-slate-300 font-mono">
                  {priorityCounts.Critical} task{priorityCounts.Critical !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-red-500"
                  style={{ width: `${tasks.length > 0 ? (priorityCounts.Critical / tasks.length) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center text-xs font-semibold mb-1">
                <span className="text-orange-500 dark:text-orange-400 flex items-center gap-1.5 font-bold">
                  <span className="w-2 h-2 rounded-full bg-orange-500" /> High Priority
                </span>
                <span className="text-slate-600 dark:text-slate-300 font-mono">
                  {priorityCounts.High} task{priorityCounts.High !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-orange-500"
                  style={{ width: `${tasks.length > 0 ? (priorityCounts.High / tasks.length) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center text-xs font-semibold mb-1">
                <span className="text-amber-500 dark:text-amber-400 flex items-center gap-1.5 font-bold">
                  <span className="w-2 h-2 rounded-full bg-amber-400" /> Medium Priority
                </span>
                <span className="text-slate-600 dark:text-slate-300 font-mono">
                  {priorityCounts.Medium} task{priorityCounts.Medium !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-400"
                  style={{ width: `${tasks.length > 0 ? (priorityCounts.Medium / tasks.length) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center text-xs font-semibold mb-1">
                <span className="text-blue-500 dark:text-blue-400 flex items-center gap-1.5 font-bold">
                  <span className="w-2 h-2 rounded-full bg-blue-400" /> Low Priority
                </span>
                <span className="text-slate-600 dark:text-slate-300 font-mono">
                  {priorityCounts.Low} task{priorityCounts.Low !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-400"
                  style={{ width: `${tasks.length > 0 ? (priorityCounts.Low / tasks.length) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Completion summary rate */}
        <div className="mt-4 pt-4 border-t border-slate-200/50 dark:border-slate-800/50 flex justify-between items-center">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Completion Rate:</span>
          <span className="text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400">
            {completionRate}%
          </span>
        </div>
      </motion.div>
    </div>
  );
}
