import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Sparkles,
  Search,
  Filter,
  Plus,
  LogOut,
  Calendar as CalendarIcon,
  BarChart2,
  ListTodo,
  CheckCircle,
  Clock,
  AlertCircle,
  HelpCircle,
  Edit2,
  Trash2,
  Check,
  ChevronDown,
  ChevronUp,
  Brain,
  MessageSquare,
  Sun,
  Moon,
  TrendingUp,
  Award,
  BookOpen,
  FolderMinus,
  CheckCircle2,
  X,
  PlusCircle,
  Play,
  Mic
} from "lucide-react";
import { Task, User, SubTask, TaskPriority, getDeadlineDate, getTaskPriority } from "./types";
import Auth from "./components/Auth";
import DashboardStats from "./components/DashboardStats";
import CalendarView from "./components/CalendarView";
import AnalyticsView from "./components/AnalyticsView";
import Confetti from "./components/Confetti";
import VoiceAssistant from "./components/VoiceAssistant";

// Motivational completion quotes
const MOTIVATIONAL_MESSAGES = [
  "Excellent work! Keep going!",
  "Great job! You're one step closer to success.",
  "Amazing! Task completed successfully.",
  "Keep up the momentum.",
  "You're doing great."
];

// Default categories
const CATEGORIES = ["Work", "Study", "Personal", "Finance", "Health", "Others"];

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // Tabs: "dashboard", "calendar", "analytics"
  const [activeTab, setActiveTab] = useState<"dashboard" | "calendar" | "analytics">("dashboard");
  
  // Theme Toggle
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedPriority, setSelectedPriority] = useState("All");

  // Add/Edit Task Dialog State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  
  // Task form state
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formCategory, setFormCategory] = useState("Work");
  const [formPriority, setFormPriority] = useState<"High" | "Medium" | "Low">("Medium");
  const [formDeadlineDate, setFormDeadlineDate] = useState("");
  const [formDeadlineTime, setFormDeadlineTime] = useState("");
  const [formDuration, setFormDuration] = useState("30 mins");
  const [formSubtasks, setFormSubtasks] = useState<string[]>([]);
  const [newSubtaskText, setNewSubtaskText] = useState("");

  // AI & Motivation States
  const [isGeneratingSubtasks, setIsGeneratingSubtasks] = useState(false);
  const [motivationMessage, setMotivationMessage] = useState("");
  const [showConfetti, setShowConfetti] = useState(false);
  const [showQuoteToast, setShowQuoteToast] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<{
    generalTips: string[];
    taskSuggestions: { taskId: string; suggestion: string; priorityBoost: boolean }[];
  } | null>(null);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [isVoiceAssistantOpen, setIsVoiceAssistantOpen] = useState(false);

  // Expandable tasks tracking
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  // Live clock and date update
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDate(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Sync state to local storage or API on initial boot
  useEffect(() => {
    // Check local storage for pre-existing user session
    const storedUser = localStorage.getItem("taskmate_user");
    if (storedUser) {
      try {
        const u = JSON.parse(storedUser);
        setUser(u);
        fetchTasks(u.id);
      } catch (e) {
        // Clear broken token
        localStorage.removeItem("taskmate_user");
      }
    }
  }, []);

  // Fetch tasks
  const fetchTasks = async (userId: string) => {
    try {
      const res = await fetch(`/api/tasks?userId=${userId}`);
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks);
      }
    } catch (e) {
      console.error("Error loading tasks", e);
    }
  };

  // Dark mode side effect
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDarkMode]);

  // Handle Login / Sign up success
  const handleLoginSuccess = (loggedInUser: User) => {
    setUser(loggedInUser);
    localStorage.setItem("taskmate_user", JSON.stringify(loggedInUser));
    fetchTasks(loggedInUser.id);
    fetchAISuggestions(loggedInUser.name, tasks);
  };

  // Handle Logout
  const handleLogout = () => {
    setUser(null);
    setTasks([]);
    setAiSuggestions(null);
    localStorage.removeItem("taskmate_user");
  };

  // Priority levels and rank mappings for sorting
  const priorityRank: Record<TaskPriority, number> = {
    Overdue: 1,
    Critical: 2,
    High: 3,
    Medium: 4,
    Low: 5,
  };

  // Fetch AI suggestions
  const fetchAISuggestions = async (userName: string, currentTasks: Task[]) => {
    if (currentTasks.length === 0) return;
    setIsLoadingSuggestions(true);
    try {
      const res = await fetch("/api/ai/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tasks: currentTasks, userName }),
      });
      if (res.ok) {
        const data = await res.json();
        setAiSuggestions(data);
      }
    } catch (err) {
      console.error("Error fetching AI recommendations", err);
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  // Trigger AI suggestions update whenever tasks count or completed state changes
  useEffect(() => {
    if (user && tasks.length > 0) {
      // Debounce suggestions call to not saturate API
      const timeoutId = setTimeout(() => {
        fetchAISuggestions(user.name, tasks);
      }, 3000);
      return () => clearTimeout(timeoutId);
    }
  }, [tasks.length, user]);

  // SMART TASK PRIORITIZATION & SORTING ALGORITHM (CORE INTENT)
  const sortedAndFilteredTasks = useMemo(() => {
    let result = [...tasks];

    // Search query filter
    if (searchQuery.trim()) {
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Category filter
    if (selectedCategory !== "All") {
      result = result.filter((t) => t.category === selectedCategory);
    }

    // Priority filter
    if (selectedPriority !== "All") {
      result = result.filter((t) => getTaskPriority(t, currentDate) === selectedPriority);
    }

    const pending = result.filter((t) => t.status === "Pending");
    const completed = result.filter((t) => t.status === "Completed");

    // Dynamic prioritization
    const sortedPending = [...pending].sort((a, b) => {
      const priorityA = getTaskPriority(a, currentDate);
      const priorityB = getTaskPriority(b, currentDate);

      const rankA = priorityRank[priorityA];
      const rankB = priorityRank[priorityB];

      if (rankA !== rankB) {
        return rankA - rankB;
      }

      // Within each category, tasks should be sorted by the nearest deadline
      const timeA = getDeadlineDate(a).getTime();
      const timeB = getDeadlineDate(b).getTime();
      return timeA - timeB;
    });

    // Completed sorted by finished time
    const sortedCompleted = [...completed].sort((a, b) => {
      const compA = a.completedAt ? new Date(a.completedAt).getTime() : 0;
      const compB = b.completedAt ? new Date(b.completedAt).getTime() : 0;
      return compB - compA;
    });

    return [...sortedPending, ...sortedCompleted];
  }, [tasks, searchQuery, selectedCategory, selectedPriority, currentDate]);

  // Separate sorted pending and completed lists
  const pendingTasksSorted = useMemo(() => {
    return sortedAndFilteredTasks.filter((t) => t.status === "Pending");
  }, [sortedAndFilteredTasks]);

  const completedTasksSorted = useMemo(() => {
    return sortedAndFilteredTasks.filter((t) => t.status === "Completed");
  }, [sortedAndFilteredTasks]);

  // Today's Most Important Task: highest-priority pending task
  const mostImportantTask = useMemo(() => {
    const pending = tasks.filter((t) => t.status === "Pending");
    if (pending.length === 0) return null;

    // Use the same priority rank sorting as the dynamic tasklist
    const sortedPending = [...pending].sort((a, b) => {
      const priorityA = getTaskPriority(a, currentDate);
      const priorityB = getTaskPriority(b, currentDate);
      const rankA = priorityRank[priorityA];
      const rankB = priorityRank[priorityB];

      if (rankA !== rankB) {
        return rankA - rankB;
      }

      return getDeadlineDate(a).getTime() - getDeadlineDate(b).getTime();
    });

    return sortedPending[0] || null;
  }, [tasks, currentDate]);

  // Live dynamic Alert Engine
  const smartAlerts = useMemo(() => {
    const alerts: { id: string; type: "warning" | "danger"; title: string; message: string; taskId: string }[] = [];
    const pending = tasks.filter((t) => t.status === "Pending");

    pending.forEach((task) => {
      const deadline = getDeadlineDate(task);
      const diffMs = deadline.getTime() - currentDate.getTime();
      const diffMins = Math.round(diffMs / (1000 * 60));

      if (diffMins < 0) {
        alerts.push({
          id: `alert-overdue-${task.id}`,
          type: "danger",
          title: "Deadline Missed",
          message: `Reschedule or complete "${task.title}" immediately.`,
          taskId: task.id
        });
      } else if (diffMins > 0 && diffMins <= 15) {
        alerts.push({
          id: `alert-15m-${task.id}`,
          type: "warning",
          title: "Urgent Deadline",
          message: `"${task.title}" starts in ${diffMins} minutes.`,
          taskId: task.id
        });
      } else if (diffMins > 15 && diffMins <= 30) {
        alerts.push({
          id: `alert-30m-${task.id}`,
          type: "warning",
          title: "Approaching soon",
          message: `Only ${diffMins} minutes left for "${task.title}".`,
          taskId: task.id
        });
      } else if (diffMins > 30 && diffMins <= 60) {
        alerts.push({
          id: `alert-1h-${task.id}`,
          type: "warning",
          title: "Upcoming Deadline",
          message: `"${task.title}" deadline is in 1 hour.`,
          taskId: task.id
        });
      }
    });

    // Sort alerts by urgency (danger first)
    return alerts.sort((a, b) => (a.type === "danger" ? -1 : 1));
  }, [tasks, currentDate]);

  // AI Task Breakdown Subtask fetcher
  const handleAIBreakdown = async () => {
    if (!formTitle.trim()) {
      alert("Please enter a task title first so the AI can break it down.");
      return;
    }
    setIsGeneratingSubtasks(true);
    try {
      const res = await fetch("/api/ai/breakdown", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: formTitle, description: formDescription }),
      });
      if (res.ok) {
        const data = await res.json();
        const items = data.subtasks.map((st: any) => st.title);
        setFormSubtasks((prev) => [...prev, ...items]);
      }
    } catch (err) {
      console.error("Failed to generate subtasks", err);
    } finally {
      setIsGeneratingSubtasks(false);
    }
  };

  // Subtask management in form
  const addFormSubtask = () => {
    if (newSubtaskText.trim()) {
      setFormSubtasks([...formSubtasks, newSubtaskText.trim()]);
      setNewSubtaskText("");
    }
  };

  const removeFormSubtask = (index: number) => {
    setFormSubtasks(formSubtasks.filter((_, i) => i !== index));
  };

  // Task creation or modification submit
  const handleTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formDeadlineDate || !formDeadlineTime) {
      return;
    }

    const payload = {
      userId: user?.id,
      title: formTitle,
      description: formDescription,
      category: formCategory,
      priority: formPriority,
      deadlineDate: formDeadlineDate,
      deadlineTime: formDeadlineTime,
      estimatedDuration: formDuration,
      status: editingTask ? editingTask.status : "Pending",
      subtasks: formSubtasks.map((title) => ({
        id: "sub_" + Math.random().toString(36).substr(2, 9),
        title,
        completed: false
      }))
    };

    try {
      const url = editingTask ? `/api/tasks/${editingTask.id}` : "/api/tasks";
      const method = editingTask ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        if (editingTask) {
          setTasks(tasks.map((t) => (t.id === editingTask.id ? data.task : t)));
        } else {
          setTasks([...tasks, data.task]);
        }
        closeForm();
      }
    } catch (err) {
      console.error("Error saving task", err);
    }
  };

  // Open Form for Adding
  const openAddForm = () => {
    setEditingTask(null);
    setFormTitle("");
    setFormDescription("");
    setFormCategory("Work");
    setFormPriority("Medium");
    
    // Set default values to today
    const todayStr = new Date().toISOString().split("T")[0];
    setFormDeadlineDate(todayStr);
    setFormDeadlineTime("18:00");
    setFormDuration("30 mins");
    setFormSubtasks([]);
    setIsFormOpen(true);
  };

  // Open Form for Editing
  const openEditForm = (task: Task) => {
    setEditingTask(task);
    setFormTitle(task.title);
    setFormDescription(task.description);
    setFormCategory(task.category);
    setFormPriority(task.priority);
    setFormDeadlineDate(task.deadlineDate);
    setFormDeadlineTime(task.deadlineTime);
    setFormDuration(task.estimatedDuration);
    setFormSubtasks((task.subtasks || []).map((s) => s.title));
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingTask(null);
  };

  // Toggle Task Completion State
  const toggleTaskStatus = async (task: Task) => {
    const isCompleted = task.status === "Completed";
    const newStatus = isCompleted ? "Pending" : "Completed";

    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        const data = await res.json();
        setTasks(tasks.map((t) => (t.id === task.id ? data.task : t)));

        // Show confetti & quote if completing
        if (newStatus === "Completed") {
          const randQuote = MOTIVATIONAL_MESSAGES[Math.floor(Math.random() * MOTIVATIONAL_MESSAGES.length)];
          setMotivationMessage(randQuote);
          setShowConfetti(true);
          setShowQuoteToast(true);

          setTimeout(() => {
            setShowConfetti(false);
          }, 3000);

          setTimeout(() => {
            setShowQuoteToast(false);
          }, 5000);
        }
      }
    } catch (err) {
      console.error("Error updating task status", err);
    }
  };

  // Delete Task
  const deleteTask = async (taskId: string) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setTasks(tasks.filter((t) => t.id !== taskId));
        if (expandedTaskId === taskId) {
          setExpandedTaskId(null);
        }
      }
    } catch (err) {
      console.error("Error deleting task", err);
    }
  };

  // Toggle subtask within task checklist
  const toggleSubtask = async (task: Task, subtaskId: string) => {
    const updatedSubtasks = (task.subtasks || []).map((st) =>
      st.id === subtaskId ? { ...st, completed: !st.completed } : st
    );

    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subtasks: updatedSubtasks }),
      });

      if (res.ok) {
        const data = await res.json();
        setTasks(tasks.map((t) => (t.id === task.id ? data.task : t)));
      }
    } catch (err) {
      console.error("Error toggling subtask", err);
    }
  };

  // Simple formatter for time remaining
  const getTimeRemainingText = (task: Task) => {
    const dl = getDeadlineDate(task);
    const diff = dl.getTime() - currentDate.getTime();
    if (diff < 0) return "Overdue";
    
    const diffHours = diff / (1000 * 60 * 60);
    if (diffHours < 1) {
      const mins = Math.round(diff / (1000 * 60));
      return `${mins}m left`;
    }
    if (diffHours < 24) {
      return `${Math.round(diffHours)}h left`;
    }
    return `${Math.round(diffHours / 24)}d left`;
  };

  // If user is not authenticated, render login page
  if (!user) {
    return <Auth onLoginSuccess={handleLoginSuccess} isDarkMode={isDarkMode} />;
  }

  return (
    <div className={`min-h-screen bg-[#f1f5f9] text-slate-800 transition-colors duration-300 relative ${isDarkMode ? "dark bg-slate-950 text-slate-100" : ""}`}>
      {/* Dynamic Confetti */}
      <Confetti active={showConfetti} />

      {/* Aesthetic ambient glass gradients */}
      <div className="absolute top-0 left-0 w-full h-full bg-[linear-gradient(to_right,rgba(99,102,241,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(99,102,241,0.03)_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none" />
      <div className="absolute top-10 left-10 w-[450px] h-[450px] bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-20 right-10 w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-3xl pointer-events-none animate-pulse" />

      {/* Floating Motivational Toast */}
      <AnimatePresence>
        {showQuoteToast && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 16, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-gradient-to-r from-emerald-600 to-teal-500 text-white px-6 py-4 rounded-2xl shadow-xl border border-white/20 flex items-center gap-3 backdrop-blur-md"
          >
            <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center font-bold">✓</div>
            <div>
              <p className="text-xs uppercase tracking-widest font-extrabold opacity-80">Task Completed!</p>
              <p className="text-sm font-bold font-sans">{motivationMessage}</p>
            </div>
            <button onClick={() => setShowQuoteToast(false)} className="ml-4 opacity-70 hover:opacity-100 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-[1500px] mx-auto p-4 md:p-6 lg:p-8 flex flex-col lg:flex-row gap-6 relative z-10 min-h-screen">
        
        {/* SIDEBAR NAVIGATION - Frosted glass card */}
        <aside className="w-full lg:w-72 h-fit lg:sticky lg:top-8 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border border-white/60 dark:border-slate-800/60 rounded-3xl p-6 flex flex-col gap-6 shadow-xl">
          {/* Logo Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-indigo-300 shadow-md">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="text-xl font-bold font-display tracking-tight text-slate-900 dark:text-white">TaskMate</span>
              <span className="text-xs block font-bold text-indigo-500 font-sans tracking-wide">AI PRODUCTIVITY</span>
            </div>
          </div>

          <div className="h-px bg-slate-200/50 dark:bg-slate-800/50" />

          {/* Navigation Links */}
          <nav className="flex flex-col gap-1.5">
            <button
              onClick={() => setActiveTab("dashboard")}
              className={`px-4 py-3 rounded-2xl flex items-center gap-3 font-semibold transition-all duration-300 text-left ${
                activeTab === "dashboard"
                  ? "bg-indigo-600/15 text-indigo-700 dark:text-indigo-400 font-bold border-l-4 border-indigo-600"
                  : "hover:bg-white/50 dark:hover:bg-slate-800/30 text-slate-600 dark:text-slate-400"
              }`}
            >
              <ListTodo className="w-5 h-5" />
              My Tasks
            </button>
            <button
              onClick={() => setActiveTab("calendar")}
              className={`px-4 py-3 rounded-2xl flex items-center gap-3 font-semibold transition-all duration-300 text-left ${
                activeTab === "calendar"
                  ? "bg-indigo-600/15 text-indigo-700 dark:text-indigo-400 font-bold border-l-4 border-indigo-600"
                  : "hover:bg-white/50 dark:hover:bg-slate-800/30 text-slate-600 dark:text-slate-400"
              }`}
            >
              <CalendarIcon className="w-5 h-5" />
              Calendar Grid
            </button>
            <button
              onClick={() => setActiveTab("analytics")}
              className={`px-4 py-3 rounded-2xl flex items-center gap-3 font-semibold transition-all duration-300 text-left ${
                activeTab === "analytics"
                  ? "bg-indigo-600/15 text-indigo-700 dark:text-indigo-400 font-bold border-l-4 border-indigo-600"
                  : "hover:bg-white/50 dark:hover:bg-slate-800/30 text-slate-600 dark:text-slate-400"
              }`}
            >
              <BarChart2 className="w-5 h-5" />
              Productivity Score
            </button>
          </nav>

          {/* User Section Streak & Logout */}
          <div className="mt-auto pt-6 border-t border-slate-200/50 dark:bg-transparent dark:border-slate-800/50 space-y-4">
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-4 text-white shadow-lg relative overflow-hidden">
              <div className="absolute -right-2 -bottom-2 w-16 h-16 bg-white/10 rounded-full blur-md" />
              <p className="text-[10px] font-extrabold uppercase tracking-wider opacity-85">Daily Focus Streak</p>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-3xl font-black font-display">{user.streak || 1}</span>
                <span className="text-xs font-bold font-sans">Days Streak 🔥</span>
              </div>
              <p className="text-[11px] mt-1.5 opacity-90 leading-tight">Keep the fire burning by organizing everyday!</p>
            </div>

            <div className="flex justify-between items-center bg-slate-500/5 dark:bg-slate-400/5 p-2 rounded-2xl border border-slate-200/40 dark:border-slate-800/40">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center font-bold">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="max-w-[100px]">
                  <p className="text-xs font-bold truncate text-slate-800 dark:text-slate-100">{user.name}</p>
                  <p className="text-[9px] text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                title="Log Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </aside>

        {/* MAIN BODY LAYOUT */}
        <main className="flex-1 flex flex-col gap-6 overflow-hidden">
          
          {/* HEADER SECTION - Greeting, date & live clock */}
          <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white/20 dark:bg-slate-900/10 p-5 rounded-3xl border border-white/40 dark:border-slate-800/20 shadow-xs">
            <div>
              <h1 className="text-3xl font-bold font-display text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-1.5">
                Hi, {user.name} 👋
              </h1>
              <p className="text-slate-500 dark:text-slate-400 mt-1 font-sans text-sm">
                Welcome back! You have <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">{tasks.filter(t => t.status === "Pending").length} tasks</span> to complete today.
                <span className="block text-xs mt-0.5 text-slate-400 dark:text-slate-500 font-semibold">Stay focused and finish your important tasks.</span>
              </p>
            </div>

            <div className="flex items-center gap-4 text-right bg-slate-500/5 dark:bg-slate-400/5 px-4.5 py-3 rounded-2xl border border-slate-200/40 dark:border-slate-800/40">
              <Clock className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
              <div>
                <p className="text-xl font-bold font-mono tracking-tight text-slate-800 dark:text-slate-100">
                  {currentDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </p>
                <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider font-mono">
                  {currentDate.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
                </p>
              </div>
            </div>
          </header>

          {/* DYNAMIC VIEW SWAPPER */}
          <AnimatePresence mode="wait">
            {activeTab === "dashboard" && (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                {/* Dashboard Stats */}
                <DashboardStats tasks={tasks} overdueCount={smartAlerts.filter(a => a.type === "danger").length} />

                {/* Sub-container containing tasks panel vs. focus/alerts sidebar */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                  
                  {/* LEFT GRID: Main Task management */}
                  <div className="xl:col-span-2 space-y-4">
                    
                    {/* FILTER, SEARCH, & ADD ACTION CONTROLS */}
                    <div className="glass-card rounded-2xl p-4.5 border border-white/60 dark:border-slate-800/60 shadow-md space-y-3">
                      <div className="flex flex-col sm:flex-row gap-3">
                        {/* Search Input */}
                        <div className="relative flex-1">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search title, description or category..."
                            className="w-full bg-slate-500/5 dark:bg-slate-400/5 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl py-2 pl-9 pr-4 text-slate-800 dark:text-slate-100 outline-none transition-all placeholder:text-slate-400 text-xs"
                          />
                        </div>

                        {/* Quick action button */}
                        <button
                          onClick={openAddForm}
                          className="bg-indigo-600 hover:bg-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-400 text-white px-5 py-2 rounded-xl text-xs font-bold shadow-lg shadow-indigo-500/10 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                          Add Task
                        </button>

                        {/* AI Voice Assistant trigger */}
                        <button
                          onClick={() => setIsVoiceAssistantOpen(true)}
                          className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white px-5 py-2 rounded-xl text-xs font-bold shadow-lg shadow-indigo-500/15 flex items-center justify-center gap-1.5 transition-all cursor-pointer relative group"
                        >
                          <Mic className="w-4 h-4 group-hover:scale-110 transition-transform animate-pulse text-indigo-200" />
                          <span>Voice Assistant</span>
                          <span className="absolute -top-1 -right-1 flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                          </span>
                        </button>
                      </div>

                      {/* Dropdown filters row */}
                      <div className="flex flex-wrap gap-2.5 pt-2 border-t border-slate-200/40 dark:border-slate-800/40">
                        <div className="flex items-center gap-1 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                          <Filter className="w-3.5 h-3.5" /> Filter by:
                        </div>
                        
                        {/* Category Dropdown */}
                        <select
                          value={selectedCategory}
                          onChange={(e) => setSelectedCategory(e.target.value)}
                          className="bg-slate-500/5 dark:bg-slate-400/5 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-lg py-1 px-2.5 text-xs outline-none hover:bg-slate-100 dark:hover:bg-slate-900 cursor-pointer transition-colors font-semibold"
                        >
                          <option value="All">All Categories</option>
                          {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                        </select>

                        {/* Priority Dropdown */}
                        <select
                          value={selectedPriority}
                          onChange={(e) => setSelectedPriority(e.target.value)}
                          className="bg-slate-500/5 dark:bg-slate-400/5 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-lg py-1 px-2.5 text-xs outline-none hover:bg-slate-100 dark:hover:bg-slate-900 cursor-pointer transition-colors font-semibold"
                        >
                          <option value="All">All Priorities</option>
                          <option value="Overdue">🚨 Overdue</option>
                          <option value="Critical">🔴 Critical</option>
                          <option value="High">🟠 High</option>
                          <option value="Medium">🟡 Medium</option>
                          <option value="Low">🔵 Low</option>
                        </select>
                      </div>
                    </div>

                    {/* DYNAMIC LIST HEADER */}
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-bold font-display text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <span>Dynamic Priority Tasklist</span>
                        <span className="text-xs bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full font-bold">
                          {pendingTasksSorted.length} Pending
                        </span>
                      </h2>
                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono">
                        Time Sorted
                      </span>
                    </div>

                    {/* INTERACTIVE TO-DO LIST (SMART TASK PRIORITIZATION IMPLEMENTED) */}
                    <div className="space-y-3" id="task-list-container">
                      <AnimatePresence initial={false}>
                        {pendingTasksSorted.length === 0 ? (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="p-8 text-center glass-card border border-slate-200 dark:border-slate-800/60 rounded-3xl"
                          >
                            <div className="w-12 h-12 bg-slate-500/5 rounded-full flex items-center justify-center mx-auto mb-3">
                              <Check className="w-6 h-6 text-slate-400" />
                            </div>
                            <h3 className="font-bold text-slate-700 dark:text-slate-300">All caught up!</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                              No pending tasks meet your search criteria. Add a task or relax!
                            </p>
                          </motion.div>
                        ) : (
                          pendingTasksSorted.map((task, idx) => {
                            const dynamicPriority = getTaskPriority(task, currentDate);
                            const isOverdue = dynamicPriority === "Overdue";
                            const timeRemaining = getTimeRemainingText(task);
                            const isExpanded = expandedTaskId === task.id;

                            return (
                              <motion.div
                                key={task.id}
                                layoutId={task.id}
                                initial={{ opacity: 0, y: 15 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ duration: 0.3 }}
                                className={`group glass-card rounded-2xl border transition-all duration-300 overflow-hidden relative ${
                                  isOverdue
                                    ? "bg-rose-500/5 border-rose-200/50 dark:border-rose-950/40 ring-1 ring-rose-500/10"
                                    : "bg-white/60 hover:bg-white/90 border-slate-200/60 dark:border-slate-800/60 dark:bg-slate-900/30"
                                }`}
                              >
                                {/* Left accent line indicating priority */}
                                <div className={`absolute top-0 left-0 bottom-0 w-1.5 ${
                                  dynamicPriority === "Overdue"
                                    ? "bg-rose-600 animate-pulse"
                                    : dynamicPriority === "Critical"
                                      ? "bg-red-500 animate-pulse"
                                      : dynamicPriority === "High"
                                        ? "bg-orange-500"
                                        : dynamicPriority === "Medium"
                                          ? "bg-amber-400"
                                          : "bg-blue-400"
                                }`} />

                                <div className="p-4 sm:p-5 flex items-start gap-4">
                                  {/* Custom Checkbox Action (To-Do Checklist Style) */}
                                  <button
                                    onClick={() => toggleTaskStatus(task)}
                                    className="w-6 h-6 rounded-lg border-2 border-slate-300 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-400 flex items-center justify-center cursor-pointer transition-colors bg-white/50 dark:bg-slate-900/50 shrink-0 mt-0.5"
                                  >
                                    <div className="w-3.5 h-3.5 rounded bg-indigo-600 dark:bg-indigo-400 scale-0 transition-transform group-hover:scale-50" />
                                  </button>

                                  <div className="flex-1 min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm sm:text-base leading-tight">
                                        {task.title}
                                      </h3>

                                      {/* Due/Overdue Tag */}
                                      {isOverdue ? (
                                        <span className="bg-rose-500 text-white text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider font-mono">
                                          Overdue
                                        </span>
                                      ) : (
                                        <span className="bg-indigo-500/10 text-indigo-600 dark:bg-indigo-400/10 dark:text-indigo-400 text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider font-mono">
                                          {timeRemaining}
                                        </span>
                                      )}

                                      {/* AI Priority Tag */}
                                      <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider font-mono flex items-center gap-1 ${
                                        dynamicPriority === "Overdue"
                                          ? "bg-rose-600 text-white"
                                          : dynamicPriority === "Critical"
                                            ? "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/40"
                                            : dynamicPriority === "High"
                                              ? "bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-900/40"
                                              : dynamicPriority === "Medium"
                                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/40"
                                                : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/40"
                                      }`}>
                                        <Sparkles className="w-2.5 h-2.5 shrink-0" />
                                        <span>{dynamicPriority}</span>
                                      </span>

                                      {/* Category Indicator */}
                                      <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[9px] px-2 py-0.5 rounded-md font-bold font-mono">
                                        {task.category}
                                      </span>
                                    </div>

                                    {task.description && (
                                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                                        {task.description}
                                      </p>
                                    )}

                                    {/* Footer details */}
                                    <div className="flex flex-wrap items-center gap-3.5 mt-3.5 text-[11px] text-slate-500 dark:text-slate-400 font-semibold font-mono">
                                      <span className="flex items-center gap-1">
                                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                                        Deadline: {task.deadlineDate} • {task.deadlineTime}
                                      </span>
                                      <span>•</span>
                                      <span>Est: {task.estimatedDuration || "30m"}</span>
                                      
                                      {task.subtasks && task.subtasks.length > 0 && (
                                        <>
                                          <span>•</span>
                                          <span className="text-indigo-600 dark:text-indigo-400">
                                            {task.subtasks.filter(s => s.completed).length}/{task.subtasks.length} Subtasks
                                          </span>
                                        </>
                                      )}
                                    </div>
                                  </div>

                                  {/* Right side controls */}
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                                      className="p-1.5 hover:bg-slate-500/10 rounded-lg text-slate-500 dark:text-slate-400 transition-colors"
                                      title={isExpanded ? "Collapse" : "Expand checklist"}
                                    >
                                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                    </button>
                                    <button
                                      onClick={() => openEditForm(task)}
                                      className="p-1.5 hover:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-lg transition-colors cursor-pointer"
                                      title="Edit Task"
                                    >
                                      <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => deleteTask(task.id)}
                                      className="p-1.5 hover:bg-rose-500/10 text-rose-500 rounded-lg transition-colors cursor-pointer"
                                      title="Delete Task"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>

                                {/* EXPANDED DETAILS (Checklist & subtasks) */}
                                <AnimatePresence>
                                  {isExpanded && (
                                    <motion.div
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: "auto", opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      transition={{ duration: 0.25 }}
                                      className="border-t border-slate-200/50 dark:border-slate-800/40 bg-slate-500/2 dark:bg-slate-400/1"
                                    >
                                      <div className="p-5 pl-14 pr-5 space-y-3.5">
                                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                                          <Brain className="w-4 h-4 text-indigo-500" />
                                          Task Completion Checklist
                                        </h4>

                                        {task.subtasks && task.subtasks.length > 0 ? (
                                          <div className="space-y-2">
                                            {task.subtasks.map((st) => (
                                              <div
                                                key={st.id}
                                                onClick={() => toggleSubtask(task, st.id)}
                                                className="flex items-center gap-3.5 p-2 rounded-xl hover:bg-white/40 dark:hover:bg-slate-900/40 cursor-pointer transition-colors"
                                              >
                                                <div className={`w-4.5 h-4.5 rounded-md border-2 flex items-center justify-center transition-colors ${
                                                  st.completed
                                                    ? "bg-indigo-600 border-indigo-600 text-white"
                                                    : "border-slate-300 dark:border-slate-600 bg-white/50"
                                                }`}>
                                                  {st.completed && <Check className="w-3 h-3" />}
                                                </div>
                                                <span className={`text-xs ${st.completed ? "line-through text-slate-400 dark:text-slate-500 font-medium" : "text-slate-700 dark:text-slate-200 font-semibold"}`}>
                                                  {st.title}
                                                </span>
                                              </div>
                                            ))}
                                          </div>
                                        ) : (
                                          <div className="p-4 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-center">
                                            <p className="text-xs text-slate-400 dark:text-slate-500">No checklists created yet.</p>
                                            <button
                                              onClick={() => openEditForm(task)}
                                              className="text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline mt-1 cursor-pointer"
                                            >
                                              Click edit task to create or autogenerate checklist
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </motion.div>
                            );
                          })
                        )}
                      </AnimatePresence>
                    </div>

                    {/* COMPLETED TASKS CONTAINER */}
                    <div className="pt-6">
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold font-display text-slate-800 dark:text-slate-100 flex items-center gap-2">
                          <span>Completed Tasks</span>
                          <span className="text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2.5 py-0.5 rounded-full font-bold">
                            {completedTasksSorted.length} Finished
                          </span>
                        </h2>
                      </div>

                      <div className="space-y-2.5">
                        {completedTasksSorted.length === 0 ? (
                          <div className="p-6 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                            <p className="text-xs text-slate-400 dark:text-slate-500">Completed items will show up here. Let's finish some tasks!</p>
                          </div>
                        ) : (
                          completedTasksSorted.map((task) => (
                            <div
                              key={task.id}
                              className="group glass-card rounded-2xl border border-emerald-500/10 bg-emerald-500/2 dark:bg-emerald-950/5 p-4 flex items-center justify-between opacity-75 hover:opacity-100 transition-opacity relative"
                            >
                              <div className="flex items-center gap-3.5 min-w-0">
                                {/* Completed Checkmark Action (☑) */}
                                <button
                                  onClick={() => toggleTaskStatus(task)}
                                  className="w-6 h-6 rounded-lg bg-emerald-500 text-white flex items-center justify-center cursor-pointer shadow-sm shadow-emerald-500/15 border border-emerald-500/20"
                                >
                                  <Check className="w-4 h-4" />
                                </button>

                                <div className="min-w-0">
                                  <h3 className="font-semibold text-slate-600 dark:text-slate-300 text-sm line-through truncate">
                                    {task.title}
                                  </h3>
                                  <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono mt-0.5">
                                    Finished: {task.completedAt ? new Date(task.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Recently"}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider font-mono">
                                  Completed
                                </span>
                                <button
                                  onClick={() => deleteTask(task.id)}
                                  className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-500/5 rounded-md transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                  </div>

                  {/* RIGHT SIDEBAR PANEL: Focus, Alerts, suggestions */}
                  <div className="space-y-6">

                    {/* QUICK VOICE ASSISTANT MIC TRIGGER CARD */}
                    <div className="bg-gradient-to-br from-indigo-500 to-violet-600 rounded-3xl p-5 text-white shadow-xl relative overflow-hidden border border-white/10 flex flex-col justify-between">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-md" />
                      <div>
                        <div className="flex justify-between items-center mb-3">
                          <span className="text-[10px] font-bold bg-white/20 text-white px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1.5 font-mono">
                            <Sparkles className="w-3 h-3 text-indigo-200" /> AI Assistant
                          </span>
                          <span className="text-[10px] text-indigo-200 font-bold uppercase tracking-wider font-mono flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" /> Online
                          </span>
                        </div>
                        <h3 className="text-lg font-bold font-display leading-tight">Speak to Schedule</h3>
                        <p className="text-[11px] text-indigo-100/90 mt-1.5 leading-relaxed font-sans font-medium">
                          "Remind me to submit DBMS assignment tomorrow at 6 PM"
                        </p>
                      </div>
                      <div className="mt-4 flex items-center gap-2.5">
                        <button
                          onClick={() => setIsVoiceAssistantOpen(true)}
                          className="bg-white text-indigo-700 hover:bg-indigo-50 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                        >
                          <Mic className="w-4 h-4 text-indigo-600" />
                          <span>Open Assistant</span>
                        </button>
                        <span className="text-[9px] text-indigo-200 font-bold font-mono">Hands-free co-pilot</span>
                      </div>
                    </div>
                    
                    {/* TODAY'S FOCUS SECTION - Elite Priority Task */}
                    {mostImportantTask ? (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-indigo-900 dark:bg-slate-900 rounded-3xl p-5 text-white shadow-xl relative overflow-hidden border border-white/10"
                      >
                        {/* Shimmer overlay */}
                        <div className="absolute inset-0 bg-linear-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-shimmer" style={{ backgroundSize: '200% 100%' }} />

                        <div className="relative z-10">
                          <div className="flex justify-between items-center mb-3">
                            <span className="text-[10px] font-bold bg-rose-500 text-white px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                              🔥 Today's Focus
                            </span>
                            <div className="w-2 h-2 bg-rose-400 rounded-full animate-pulse" />
                          </div>

                          <h3 className="text-xl font-bold font-display leading-tight">
                            {mostImportantTask.title}
                          </h3>
                          {mostImportantTask.description && (
                            <p className="text-xs text-indigo-200/90 dark:text-slate-300 mt-1.5 line-clamp-2 leading-relaxed">
                              {mostImportantTask.description}
                            </p>
                          )}

                          <div className="flex items-center justify-between mt-5 pt-4 border-t border-indigo-800/60 dark:border-slate-800/60">
                            <span className="text-xs font-bold text-indigo-100 bg-white/10 px-3 py-1 rounded-full">
                              {getTimeRemainingText(mostImportantTask)}
                            </span>
                            <button
                              onClick={() => {
                                setExpandedTaskId(mostImportantTask.id);
                                const el = document.getElementById("task-list-container");
                                if (el) el.scrollIntoView({ behavior: 'smooth' });
                              }}
                              className="text-xs font-bold underline text-white hover:text-indigo-200"
                            >
                              Open Details
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    ) : (
                      <div className="bg-slate-500/5 dark:bg-slate-400/5 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 text-center">
                        <p className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">🔥 Today's Focus</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">All caught up! Add high-priority tasks to focus.</p>
                      </div>
                    )}

                    {/* SMART ALERTS MODULE */}
                    <div className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-md border border-white/60 dark:border-slate-800/60 rounded-3xl p-5">
                      <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                        <AlertCircle className="w-4.5 h-4.5 text-rose-500" />
                        Smart Live Alerts
                      </h2>

                      {smartAlerts.length === 0 ? (
                        <div className="p-3 bg-slate-500/5 dark:bg-slate-400/5 rounded-2xl text-center">
                          <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">No pressing alerts at this time.</p>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-3 max-h-[250px] overflow-y-auto pr-1">
                          {smartAlerts.map((alert) => (
                            <div
                              key={alert.id}
                              className={`p-3 rounded-2xl border transition-all ${
                                alert.type === "danger"
                                  ? "bg-rose-500/10 border-rose-500/20 text-rose-800 dark:text-rose-400"
                                  : "bg-amber-500/10 border-amber-500/20 text-amber-800 dark:text-amber-400"
                              }`}
                            >
                              <p className="text-[10px] font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
                                <span className={`w-1.5 h-1.5 rounded-full ${alert.type === "danger" ? "bg-rose-500 animate-ping" : "bg-amber-500"}`} />
                                {alert.title}
                              </p>
                              <p className="text-xs font-semibold leading-snug">{alert.message}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* AI COPILOT SUGGESTIONS & PRO TIPS */}
                    <div className="bg-gradient-to-br from-indigo-500/5 to-purple-500/5 border border-indigo-500/10 rounded-3xl p-5">
                      <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
                        <Sparkles className="w-4.5 h-4.5 text-indigo-500" />
                        AI TaskMate Copilot
                      </h2>

                      {isLoadingSuggestions ? (
                        <div className="py-6 flex flex-col items-center justify-center gap-2 text-slate-500 dark:text-slate-400">
                          <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                          <span className="text-[10px] font-bold font-mono">Generating insights...</span>
                        </div>
                      ) : aiSuggestions && aiSuggestions.generalTips && aiSuggestions.generalTips.length > 0 ? (
                        <div className="space-y-3.5">
                          {aiSuggestions.generalTips.map((tip, idx) => (
                            <div key={idx} className="flex gap-2.5 items-start">
                              <span className="text-xs shrink-0 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 p-1 rounded-lg">✨</span>
                              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                                {tip}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center p-3">
                          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                            Create some tasks first! Your elite AI Co-pilot will dynamically review your schedules and suggest professional focus routes.
                          </p>
                        </div>
                      )}
                    </div>

                  </div>

                </div>
              </motion.div>
            )}

            {activeTab === "calendar" && (
              <motion.div
                key="calendar"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.3 }}
              >
                <CalendarView
                  tasks={tasks}
                  onSelectDate={(date) => {
                    setSearchQuery(date);
                    setActiveTab("dashboard");
                  }}
                  onAddTaskOnDate={(date) => {
                    openAddForm();
                    setFormDeadlineDate(date);
                  }}
                />
              </motion.div>
            )}

            {activeTab === "analytics" && (
              <motion.div
                key="analytics"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.3 }}
              >
                <AnalyticsView tasks={tasks} />
              </motion.div>
            )}
          </AnimatePresence>

        </main>
      </div>

      {/* FLOAT MODE TOGGLE FOOTER FLOATER */}
      <div className="fixed bottom-4 right-4 z-40 flex items-center gap-2 bg-white/40 dark:bg-slate-900/40 border border-white/60 dark:border-slate-800/60 p-1.5 rounded-full shadow-lg backdrop-blur-md">
        {/* Floating Voice Assistant Trigger */}
        <button
          onClick={() => setIsVoiceAssistantOpen(true)}
          className="p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full transition-all shadow-md relative group cursor-pointer"
          title="Open AI Voice Assistant"
        >
          <Mic className="w-5 h-5 animate-pulse text-indigo-100" />
          <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-500"></span>
          </span>
        </button>

        <button
          onClick={() => setIsDarkMode(!isDarkMode)}
          className="p-2 hover:bg-white dark:hover:bg-slate-800 rounded-full text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
          title="Toggle Light/Dark Theme"
        >
          {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
      </div>

      {/* AI VOICE ASSISTANT MODAL (Frosted Glass Theme) */}
      <AnimatePresence>
        {isVoiceAssistantOpen && user && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/60 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="w-full max-w-xl bg-white/95 dark:bg-slate-900/95 border border-white dark:border-slate-800/80 rounded-3xl p-6 shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
              
              <VoiceAssistant 
                userId={user.id}
                onTaskCreated={(newTask) => {
                  setTasks((prev) => [newTask, ...prev]);
                  setShowConfetti(true);
                  setMotivationMessage(`Created task "${newTask.title}" via voice assistant!`);
                  setShowQuoteToast(true);
                  setTimeout(() => setShowConfetti(false), 3000);
                  setTimeout(() => setShowQuoteToast(false), 5000);
                  fetchTasks(user.id);
                  fetchAISuggestions(user.name, [newTask, ...tasks]);
                }}
                onRefreshTasks={() => {
                  fetchTasks(user.id);
                }}
                onClose={() => setIsVoiceAssistantOpen(false)}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ADD / EDIT TASK MODAL (Frosted Glass Theme) */}
      <AnimatePresence>
        {isFormOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/60 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="w-full max-w-lg bg-white/90 dark:bg-slate-900/90 border border-white dark:border-slate-800/80 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold font-display text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Sparkles className="w-5 h-5 text-indigo-500" />
                  {editingTask ? "Modify Priority Task" : "Create Priority Task"}
                </h3>
                <button
                  onClick={closeForm}
                  className="p-1.5 hover:bg-slate-500/10 rounded-full text-slate-500 dark:text-slate-400 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleTaskSubmit} className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Task Title
                  </label>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="e.g. Presentation to Board of Directors"
                    className="w-full bg-slate-500/5 dark:bg-slate-400/5 border border-slate-200 dark:border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl py-2.5 px-3.5 text-slate-800 dark:text-slate-100 outline-none transition-all placeholder:text-slate-400 text-sm font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Description
                  </label>
                  <textarea
                    rows={2}
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="What details are critical for accomplishing this objective?"
                    className="w-full bg-slate-500/5 dark:bg-slate-400/5 border border-slate-200 dark:border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl py-2.5 px-3.5 text-slate-800 dark:text-slate-100 outline-none transition-all placeholder:text-slate-400 text-sm"
                  />
                </div>

                {/* AI subtask generator segment */}
                <div className="bg-indigo-500/5 dark:bg-indigo-400/5 border border-indigo-500/10 rounded-2xl p-4 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Brain className="w-4.5 h-4.5 text-indigo-600 dark:text-indigo-400 animate-pulse" />
                      <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300">
                        TaskMate AI Co-pilot Checklist Generator
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleAIBreakdown}
                      disabled={isGeneratingSubtasks || !formTitle.trim()}
                      className="bg-indigo-600 hover:bg-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-400 text-white text-[10px] font-bold py-1 px-3 rounded-lg shadow-sm flex items-center gap-1 cursor-pointer disabled:opacity-40"
                    >
                      {isGeneratingSubtasks ? "Generating..." : "✨ AI Breakdown"}
                    </button>
                  </div>

                  {/* Generated items review */}
                  {formSubtasks.length > 0 && (
                    <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                      {formSubtasks.map((st, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-white/60 dark:bg-slate-800/40 p-2 rounded-lg border border-slate-200/50 dark:border-slate-800/40 text-xs text-slate-700 dark:text-slate-300">
                          <span className="truncate pr-2 font-medium">{st}</span>
                          <button
                            type="button"
                            onClick={() => removeFormSubtask(idx)}
                            className="text-slate-400 hover:text-rose-500 p-0.5"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Manual input for checklists */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newSubtaskText}
                      onChange={(e) => setNewSubtaskText(e.target.value)}
                      placeholder="Add step manually..."
                      className="flex-1 bg-white/80 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg py-1 px-2 text-xs text-slate-800 dark:text-slate-100 outline-none"
                    />
                    <button
                      type="button"
                      onClick={addFormSubtask}
                      className="bg-indigo-600 text-white rounded-lg px-3 py-1 text-xs font-bold"
                    >
                      Add
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                      Category
                    </label>
                    <select
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value)}
                      className="w-full bg-slate-500/5 dark:bg-slate-400/5 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-xl py-2 px-3 text-sm outline-none cursor-pointer"
                    >
                      {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      Priority Level
                    </label>
                    <div className="w-full bg-indigo-500/5 dark:bg-indigo-400/5 border border-dashed border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 rounded-xl py-2 px-3.5 text-xs font-bold flex items-center gap-1.5 h-[38px] select-none" title="Determined automatically by the TaskMate AI model">
                      <Sparkles className="w-3.5 h-3.5 animate-pulse shrink-0" />
                      <span>✨ AI Determined</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                      Deadline Date
                    </label>
                    <input
                      type="date"
                      required
                      value={formDeadlineDate}
                      onChange={(e) => setFormDeadlineDate(e.target.value)}
                      className="w-full bg-slate-500/5 dark:bg-slate-400/5 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-xl py-2 px-3 text-sm outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                      Deadline Time
                    </label>
                    <input
                      type="time"
                      required
                      value={formDeadlineTime}
                      onChange={(e) => setFormDeadlineTime(e.target.value)}
                      className="w-full bg-slate-500/5 dark:bg-slate-400/5 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-xl py-2 px-3 text-sm outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Estimated Duration
                  </label>
                  <input
                    type="text"
                    value={formDuration}
                    onChange={(e) => setFormDuration(e.target.value)}
                    placeholder="e.g. 45 mins, 2 hours"
                    className="w-full bg-slate-500/5 dark:bg-slate-400/5 border border-slate-200 dark:border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl py-2 px-3 text-sm outline-none text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
                  />
                </div>

                <div className="pt-4 flex gap-3.5">
                  <button
                    type="button"
                    onClick={closeForm}
                    className="flex-1 bg-slate-500/10 hover:bg-slate-500/25 dark:bg-slate-400/10 dark:hover:bg-slate-400/20 text-slate-700 dark:text-slate-300 font-semibold py-3 px-4 rounded-xl transition-colors cursor-pointer text-sm text-center"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-indigo-600 hover:bg-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-400 text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-indigo-500/15 hover:shadow-indigo-500/30 transition-all cursor-pointer text-sm text-center"
                  >
                    {editingTask ? "Save Priority Changes" : "Save Priority Task"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
