import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronLeft, ChevronRight, Calendar, Plus, Clock } from "lucide-react";
import { Task, getTaskPriority } from "../types";

interface CalendarViewProps {
  tasks: Task[];
  onSelectDate: (date: string) => void;
  onAddTaskOnDate?: (date: string) => void;
}

export default function CalendarView({ tasks, onSelectDate, onAddTaskOnDate }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  // Get first day of month (0 = Sunday, 1 = Monday, etc.)
  const firstDayIndex = new Date(year, month, 1).getDay();

  // Get number of days in the month
  const totalDays = new Date(year, month + 1, 0).getDate();

  // Days of previous month to show
  const prevMonthTotalDays = new Date(year, month, 0).getDate();

  const daysArray: { day: number; isCurrentMonth: boolean; dateString: string }[] = [];

  // Previous month overflow
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const prevDay = prevMonthTotalDays - i;
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    const dateString = `${prevYear}-${String(prevMonth + 1).padStart(2, "0")}-${String(prevDay).padStart(2, "0")}`;
    daysArray.push({ day: prevDay, isCurrentMonth: false, dateString });
  }

  // Current month days
  for (let i = 1; i <= totalDays; i++) {
    const dateString = `${year}-${String(month + 1).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
    daysArray.push({ day: i, isCurrentMonth: true, dateString });
  }

  // Next month overflow to complete the grid (usually 42 boxes)
  const remainingSlots = 42 - daysArray.length;
  for (let i = 1; i <= remainingSlots; i++) {
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    const dateString = `${nextYear}-${String(nextMonth + 1).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
    daysArray.push({ day: i, isCurrentMonth: false, dateString });
  }

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const todayStr = new Date().toISOString().split("T")[0];

  return (
    <div className="glass-card rounded-3xl p-6 border border-white/60 dark:border-slate-800/60 shadow-xl overflow-hidden relative" id="calendar-panel">
      {/* Decorative Blur */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 bg-indigo-600/10 text-indigo-600 dark:bg-indigo-400/10 dark:text-indigo-400 rounded-xl flex items-center justify-center">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold font-display text-slate-800 dark:text-slate-100">
              {monthNames[month]} {year}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-sans">
              Click a date to filter or add tasks
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-500/5 dark:bg-slate-400/5 p-1 rounded-xl border border-slate-200/40 dark:border-slate-800/40">
          <button
            onClick={handlePrevMonth}
            className="p-1.5 hover:bg-white dark:hover:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="text-xs font-semibold px-2.5 py-1.5 hover:bg-white dark:hover:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
          >
            Today
          </button>
          <button
            onClick={handleNextMonth}
            className="p-1.5 hover:bg-white dark:hover:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Days of Week Row */}
      <div className="grid grid-cols-7 gap-1.5 mb-2 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">
        <div>Sun</div>
        <div>Mon</div>
        <div>Tue</div>
        <div>Wed</div>
        <div>Thu</div>
        <div>Fri</div>
        <div>Sat</div>
      </div>

      {/* Grid of Days */}
      <div className="grid grid-cols-7 gap-1.5">
        {daysArray.map(({ day, isCurrentMonth, dateString }, index) => {
          const dayTasks = tasks.filter((t) => t.deadlineDate === dateString);
          const pendingDayTasks = dayTasks.filter((t) => t.status === "Pending");
          const completedDayTasks = dayTasks.filter((t) => t.status === "Completed");

          const isToday = dateString === todayStr;

          return (
            <div
              key={`${dateString}-${index}`}
              onClick={() => onSelectDate(dateString)}
              className={`min-h-[70px] p-1.5 rounded-2xl border transition-all relative flex flex-col justify-between group cursor-pointer ${
                isCurrentMonth
                  ? "bg-white/45 hover:bg-white/90 dark:bg-slate-900/30 dark:hover:bg-slate-800/60 border-white/60 dark:border-slate-800/60"
                  : "bg-slate-500/5 hover:bg-slate-500/10 dark:bg-slate-400/2 dark:hover:bg-slate-400/5 border-slate-200/20 dark:border-slate-800/10 opacity-40"
              } ${isToday ? "ring-2 ring-indigo-500 ring-offset-1 dark:ring-indigo-400" : ""}`}
            >
              {/* Day Number */}
              <div className="flex justify-between items-center">
                <span
                  className={`text-xs font-bold font-mono ${
                    isToday
                      ? "text-indigo-600 dark:text-indigo-400 font-extrabold"
                      : "text-slate-700 dark:text-slate-300"
                  }`}
                >
                  {day}
                </span>

                {/* Add Quick Task button on hover */}
                {onAddTaskOnDate && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddTaskOnDate(dateString);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-indigo-500 hover:text-white dark:hover:bg-indigo-400 text-indigo-600 dark:text-indigo-400 rounded-sm transition-all"
                    title="Add task on this date"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Tasks Mini Indicators */}
              <div className="flex flex-col gap-0.5 mt-1 overflow-hidden max-h-[36px]">
                {pendingDayTasks.slice(0, 2).map((t) => {
                  const p = getTaskPriority(t, new Date());
                  return (
                    <div
                      key={t.id}
                      className={`text-[9px] px-1 py-0.5 rounded-sm truncate font-medium border ${
                        p === "Overdue" || p === "Critical"
                          ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/10"
                          : p === "High"
                            ? "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/10"
                            : p === "Medium"
                              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/10"
                              : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/10"
                      }`}
                      title={`${t.title} (${p} Priority)`}
                    >
                      {t.title}
                    </div>
                  );
                })}
                
                {completedDayTasks.length > 0 && pendingDayTasks.length < 2 && (
                  <div className="text-[8px] text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5 font-bold italic pl-1">
                    ✓ {completedDayTasks.length} completed
                  </div>
                )}

                {dayTasks.length > 2 && (
                  <div className="text-[8px] text-slate-400 dark:text-slate-500 font-bold font-mono text-center">
                    +{dayTasks.length - 2} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
