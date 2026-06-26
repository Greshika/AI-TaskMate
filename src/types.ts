export interface SubTask {
  id: string;
  title: string;
  completed: boolean;
}

export type TaskPriority = 'Overdue' | 'Critical' | 'High' | 'Medium' | 'Low';

export interface Task {
  id: string;
  userId: string;
  title: string;
  description: string;
  category: string;
  priority: TaskPriority;
  deadlineDate: string; // YYYY-MM-DD
  deadlineTime: string; // HH:MM
  estimatedDuration: string; // e.g. "1 hour", "45 mins"
  status: 'Pending' | 'Completed';
  createdAt: string;
  completedAt?: string;
  subtasks?: SubTask[];
  aiReason?: string; // AI generated reason why it's prioritized or tips
}

export interface User {
  id: string;
  name: string;
  email: string;
  streak: number;
  lastActiveDate?: string; // YYYY-MM-DD
}

export interface AISuggestion {
  taskId: string;
  suggestion: string;
  priorityBoost: boolean;
}

export interface AICopilotResponse {
  generalTips: string[];
  taskSuggestions: AISuggestion[];
}

export function getDeadlineDate(task: Task): Date {
  const parts = task.deadlineDate.split('-');
  const timeParts = (task.deadlineTime || '00:00').split(':');
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const hour = timeParts.length >= 1 ? parseInt(timeParts[0], 10) : 0;
    const minute = timeParts.length >= 2 ? parseInt(timeParts[1], 10) : 0;
    return new Date(year, month, day, hour, minute);
  }
  return new Date(task.deadlineDate);
}

export function getTaskPriority(task: Task, refDate: Date): TaskPriority {
  const deadline = getDeadlineDate(task);
  const diffMs = deadline.getTime() - refDate.getTime();

  // 1. If the deadline has passed -> Overdue 🚨
  if (diffMs < 0) {
    return 'Overdue';
  }

  // 2. If the deadline is within the next 2 hours -> Critical 🔴
  if (diffMs <= 7200000) {
    return 'Critical';
  }

  // 3. If the deadline is today but more than 2 hours away -> High 🟠
  const isToday =
    deadline.getFullYear() === refDate.getFullYear() &&
    deadline.getMonth() === refDate.getMonth() &&
    deadline.getDate() === refDate.getDate();

  if (isToday) {
    return 'High';
  }

  // 4. If the deadline is tomorrow -> Medium 🟡
  const tomorrow = new Date(refDate);
  tomorrow.setDate(refDate.getDate() + 1);
  const isTomorrow =
    deadline.getFullYear() === tomorrow.getFullYear() &&
    deadline.getMonth() === tomorrow.getMonth() &&
    deadline.getDate() === tomorrow.getDate();

  if (isTomorrow) {
    return 'Medium';
  }

  // 5. If the deadline is within the next 7 days or beyond -> Low 🔵
  return 'Low';
}

