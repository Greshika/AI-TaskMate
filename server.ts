import express from "express";
import fs from "fs";
import path from "path";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;
const DB_FILE = path.join(process.cwd(), "database.json");

app.use(express.json());

// Initialize Database if it doesn't exist
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(
    DB_FILE,
    JSON.stringify({ users: [], tasks: [] }, null, 2)
  );
}

// Helper to read and write database
function readDB() {
  try {
    const data = fs.readFileSync(DB_FILE, "utf-8");
    return JSON.parse(data);
  } catch (err) {
    return { users: [], tasks: [] };
  }
}

function writeDB(data: any) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// Initialize Gemini SDK with telemetry header
const geminiApiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;

if (geminiApiKey && geminiApiKey !== "MY_GEMINI_API_KEY") {
  ai = new GoogleGenAI({
    apiKey: geminiApiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// ================= AUTH ROUTES =================

// Sign up
app.post("/api/auth/signup", (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: "Name, email and password are required" });
  }

  const db = readDB();
  const existingUser = db.users.find((u: any) => u.email.toLowerCase() === email.toLowerCase());
  if (existingUser) {
    return res.status(400).json({ error: "An account with this email already exists" });
  }

  const newUser = {
    id: "user_" + Math.random().toString(36).substr(2, 9),
    name,
    email: email.toLowerCase(),
    password, // For simplicity in local preview container
    streak: 0,
    lastActiveDate: new Date().toISOString().split("T")[0],
  };

  db.users.push(newUser);
  writeDB(db);

  // Return user without password
  const { password: _, ...userSafe } = newUser;
  res.status(201).json({ user: userSafe });
});

// Login
app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  const db = readDB();
  const user = db.users.find(
    (u: any) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
  );

  if (!user) {
    return res.status(400).json({ error: "Invalid email or password" });
  }

  // Update streak logic
  const todayStr = new Date().toISOString().split("T")[0];
  if (user.lastActiveDate) {
    const lastDate = new Date(user.lastActiveDate);
    const todayDate = new Date(todayStr);
    const diffTime = Math.abs(todayDate.getTime() - lastDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      user.streak = (user.streak || 0) + 1;
    } else if (diffDays > 1) {
      user.streak = 1; // reset streak but give 1 for today
    }
  } else {
    user.streak = 1;
  }
  user.lastActiveDate = todayStr;
  writeDB(db);

  const { password: _, ...userSafe } = user;
  res.json({ user: userSafe });
});

// Forgot password
app.post("/api/auth/forgot-password", (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  const db = readDB();
  const user = db.users.find((u: any) => u.email.toLowerCase() === email.toLowerCase());
  if (!user) {
    return res.status(404).json({ error: "No account found with this email" });
  }

  // Reset to a standard secure demonstration password
  user.password = "TaskMate2026!";
  writeDB(db);

  res.json({
    message: "Password has been successfully reset.",
    tempPassword: "TaskMate2026!"
  });
});

// ================= TASK PRIORITIZATION UTILITY =================

function determineTaskPriorityLocal(
  title: string,
  description: string,
  category: string,
  deadlineDate: string,
  deadlineTime: string
): "High" | "Medium" | "Low" {
  try {
    const today = new Date();
    const deadline = new Date(`${deadlineDate}T${deadlineTime}`);
    const diffMs = deadline.getTime() - today.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    const isUrgentCategory = ["Work", "Study", "Finance"].includes(category);
    const isUrgentKeywords = /urgent|asap|critical|important|exam|test|due|pay/i.test(title + " " + description);

    if (diffHours >= 0 && diffHours < 24) {
      return "High";
    } else if (diffHours < 72 || isUrgentCategory || isUrgentKeywords) {
      return "Medium";
    } else {
      return "Low";
    }
  } catch (e) {
    return "Medium";
  }
}

async function determineTaskPriority(
  title: string,
  description: string,
  category: string,
  deadlineDate: string,
  deadlineTime: string
): Promise<"High" | "Medium" | "Low"> {
  if (!ai) {
    return determineTaskPriorityLocal(title, description, category, deadlineDate, deadlineTime);
  }

  try {
    const todayStr = new Date().toISOString().split("T")[0];
    const prompt = `You are an elite productivity co-pilot.
Analyze the following task details and classify its priority as either "High", "Medium", or "Low".

Task Details:
- Title: ${title}
- Description: ${description || "None"}
- Category: ${category}
- Deadline Date: ${deadlineDate}
- Deadline Time: ${deadlineTime}
- Today's Date: ${todayStr}

Classification Guidelines:
- "High" priority: Critical deadlines (due within 24 hours), exams/tests, essential Work/Finance tasks, or urgent health issues.
- "Medium" priority: Standard task with moderate deadline, routine work/study assignments, or typical goals.
- "Low" priority: Minor chores, distant deadlines (weeks away), flexible tasks, or long-term personal ideas.

Respond with exactly one of the following JSON format:
{
  "priority": "High" | "Medium" | "Low"
}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            priority: {
              type: Type.STRING,
              description: "The priority of the task. Must be exactly 'High', 'Medium', or 'Low'."
            }
          },
          required: ["priority"]
        }
      }
    });

    const parsed = JSON.parse(response.text || "{}");
    const p = parsed.priority;
    if (p === "High" || p === "Medium" || p === "Low") {
      return p;
    }
    return determineTaskPriorityLocal(title, description, category, deadlineDate, deadlineTime);
  } catch (error: any) {
    console.warn("Gemini Priority Error (using local priority logic fallback):", error?.message || error);
    return determineTaskPriorityLocal(title, description, category, deadlineDate, deadlineTime);
  }
}

// ================= TASK ROUTES =================

// Get all tasks for a user
app.get("/api/tasks", (req, res) => {
  const userId = req.query.userId as string;
  if (!userId) {
    return res.status(400).json({ error: "userId query parameter is required" });
  }

  const db = readDB();
  const userTasks = db.tasks.filter((t: any) => t.userId === userId);
  res.json({ tasks: userTasks });
});

// Create a task
app.post("/api/tasks", async (req, res) => {
  const {
    userId,
    title,
    description,
    category,
    deadlineDate,
    deadlineTime,
    estimatedDuration,
  } = req.body;

  if (!userId || !title || !deadlineDate || !deadlineTime) {
    return res.status(400).json({ error: "userId, title, deadline date, and deadline time are required" });
  }

  // Determine priority using Gemini AI (with local fallback)
  const priority = await determineTaskPriority(title, description || "", category || "Others", deadlineDate, deadlineTime);

  const db = readDB();
  const newTask = {
    id: "task_" + Math.random().toString(36).substr(2, 9),
    userId,
    title,
    description: description || "",
    category: category || "Others",
    priority,
    deadlineDate,
    deadlineTime,
    estimatedDuration: estimatedDuration || "30 mins",
    status: "Pending",
    createdAt: new Date().toISOString(),
    subtasks: [],
  };

  db.tasks.push(newTask);
  writeDB(db);

  res.status(201).json({ task: newTask });
});

// Update a task
app.put("/api/tasks/:id", async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  const db = readDB();
  const index = db.tasks.findIndex((t: any) => t.id === id);
  if (index === -1) {
    return res.status(404).json({ error: "Task not found" });
  }

  const currentTask = db.tasks[index];

  // If priority-determining fields are modified, or priority is missing, recalculate it
  const hasPriorityFieldChanges = 
    (updates.title !== undefined && updates.title !== currentTask.title) ||
    (updates.description !== undefined && updates.description !== currentTask.description) ||
    (updates.category !== undefined && updates.category !== currentTask.category) ||
    (updates.deadlineDate !== undefined && updates.deadlineDate !== currentTask.deadlineDate) ||
    (updates.deadlineTime !== undefined && updates.deadlineTime !== currentTask.deadlineTime);

  if (hasPriorityFieldChanges) {
    const title = updates.title !== undefined ? updates.title : currentTask.title;
    const description = updates.description !== undefined ? updates.description : currentTask.description;
    const category = updates.category !== undefined ? updates.category : currentTask.category;
    const deadlineDate = updates.deadlineDate !== undefined ? updates.deadlineDate : currentTask.deadlineDate;
    const deadlineTime = updates.deadlineTime !== undefined ? updates.deadlineTime : currentTask.deadlineTime;

    updates.priority = await determineTaskPriority(title, description, category, deadlineDate, deadlineTime);
  }

  // Handle completion timestamp if status changes to Completed
  if (updates.status === "Completed" && db.tasks[index].status !== "Completed") {
    updates.completedAt = new Date().toISOString();
  } else if (updates.status === "Pending") {
    updates.completedAt = undefined;
  }

  db.tasks[index] = {
    ...db.tasks[index],
    ...updates,
  };
  writeDB(db);

  res.json({ task: db.tasks[index] });
});

// Delete a task
app.delete("/api/tasks/:id", (req, res) => {
  const { id } = req.params;

  const db = readDB();
  const initialLength = db.tasks.length;
  db.tasks = db.tasks.filter((t: any) => t.id !== id);

  if (db.tasks.length === initialLength) {
    return res.status(404).json({ error: "Task not found" });
  }

  writeDB(db);
  res.json({ message: "Task deleted successfully" });
});

// ================= AI ROUTES (GEMINI API) =================

// Get smart AI suggestions for tasks
app.post("/api/ai/suggestions", async (req, res) => {
  const { tasks, userName } = req.body;

  if (!ai) {
    // Return mock recommendations gracefully if API key is not yet set up
    return res.json({
      generalTips: [
        "Create micro-goals for your High-priority tasks to keep momentum.",
        "Take a 5-minute deep breath break after completing any task to boost cognitive stamina.",
        "Your afternoon looks busy. Try scheduling high-focus items before 1:00 PM."
      ],
      taskSuggestions: (tasks || []).map((t: any) => ({
        taskId: t.id,
        suggestion: `Focus on completing the '${t.category}' aspects of this task first.`,
        priorityBoost: t.priority === "High"
      }))
    });
  }

  try {
    const taskSummary = (tasks || [])
      .map((t: any) => `- [${t.priority} Priority] ${t.title} (${t.category}) due on ${t.deadlineDate} at ${t.deadlineTime} (${t.status})`)
      .join("\n");

    const prompt = `You are AI TaskMate, a premium productivity co-pilot.
The user's name is ${userName}.
Analyze their current task list and provide smart, elite suggestions:

${taskSummary || "The user has no tasks right now. Give general advice on starting a productive streak."}

Your advice must be highly tailored to these specific tasks, deadlines, and priorities. Always encourage them politely as a professional assistant.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            generalTips: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "2-3 highly professional and encouraging productivity insights based on their current task composition."
            },
            taskSuggestions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  taskId: { type: Type.STRING, description: "The exact ID of the task from the list." },
                  suggestion: { type: Type.STRING, description: "A highly actionable, realistic 1-sentence tip, milestone warning, or focus advice for this specific task." },
                  priorityBoost: { type: Type.BOOLEAN, description: "Whether this task represents an immediate bottleneck and should temporarily be treated with maximum priority." }
                },
                required: ["taskId", "suggestion", "priorityBoost"]
              },
              description: "Suggestions matched to each pending task ID provided in the list."
            }
          },
          required: ["generalTips", "taskSuggestions"]
        }
      }
    });

    const parsed = JSON.parse(response.text || "{}");
    res.json(parsed);
  } catch (error: any) {
    console.warn("Gemini API Rate Limit / Error (using graceful local fallback):", error?.message || error);
    // Return high-quality, smart, robust local recommendation fallback gracefully
    res.json({
      generalTips: [
        "Focus on tasks tagged as High or Critical first to maintain peak velocity.",
        "Take regular structured breaks (5 minutes) after deep focusing to boost retention.",
        "Try scheduling high-cognitive tasks before noon when mental energy is highest."
      ],
      taskSuggestions: (tasks || []).map((t: any) => ({
        taskId: t.id,
        suggestion: `Focus on the '${t.category || "General"}' aspects of this task first to optimize progress.`,
        priorityBoost: t.priority === "High" || t.priority === "Critical"
      }))
    });
  }
});

// Break down a task into smart subtasks
app.post("/api/ai/breakdown", async (req, res) => {
  const { title, description } = req.body;
  if (!title) {
    return res.status(400).json({ error: "Task title is required" });
  }

  if (!ai) {
    // Return fallback subtasks if AI is not initialized
    return res.json({
      subtasks: [
        { title: "Define objective and review guidelines" },
        { title: "Gather required resources and information" },
        { title: "Draft first outline or prototype" },
        { title: "Review and refine final product" }
      ]
    });
  }

  try {
    const prompt = `Break down the task "${title}" (Description: ${description || "None provided"}) into 3-5 concrete, bite-sized, sequential checklist items that can be marked as completed to achieve this goal.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING, description: "Bite-sized, actionable subtask item." }
            },
            required: ["title"]
          }
        }
      }
    });

    const parsed = JSON.parse(response.text || "[]");
    res.json({ subtasks: parsed });
  } catch (error: any) {
    console.warn("Gemini Breakdown Error (using local checklist generator fallback):", error?.message || error);
    res.json({
      subtasks: [
        { title: "Define action items and set benchmarks" },
        { title: "Gather essential references and setup space" },
        { title: "Draft high-impact initial outline/components" },
        { title: "Perform complete validation and polish details" }
      ]
    });
  }
});

// Voice / Text Assistant Endpoint
app.post("/api/ai/voice-command", async (req, res) => {
  const { userId, text, clientDate } = req.body;
  if (!userId || !text) {
    return res.status(400).json({ error: "userId and text are required" });
  }

  const db = readDB();
  const userTasks = db.tasks.filter((t: any) => t.userId === userId && t.status === "Pending");
  const refDateStr = clientDate || new Date().toISOString();
  const refDate = new Date(refDateStr);
  const todayStr = refDate.toISOString().split("T")[0];

  // Build task summary text for Gemini context
  const taskListSummary = userTasks
    .map((t: any) => {
      return `- Task Name: "${t.title}" | Category: "${t.category}" | Deadline: ${t.deadlineDate} at ${t.deadlineTime}`;
    })
    .join("\n");

  // Helper local fallback in case Gemini isn't available
  const handleLocalFallback = () => {
    const input = text.toLowerCase().trim();
    
    // 1. Check if it's a general greeting or conversation rather than a task query or action
    const isGreetingOrConversation = /^(hello|hi|hey|good\s+morning|good\s+afternoon|good\s+evening|how\s+are\s+you|who\s+are\s+you|what\s+can\s+you\s+do|help|thanks|thank\s+you|bye|goodbye|what\s+is\s+your\s+name|who\s+made\s+you)\b/i.test(input);

    if (isGreetingOrConversation) {
      let reply = "Hello! I am your TaskMate Voice Assistant. You can ask me to add tasks (for example, 'Remind me to submit DBMS assignment tomorrow at 6 PM') or ask about your schedule, overdue tasks, or what you should do first!";
      if (/how\s+are\s+you/i.test(input)) {
        reply = "I'm doing great, thank you for asking! Ready to help you organize your tasks. What can I help you with today?";
      } else if (/what\s+can\s+you\s+do|help/i.test(input)) {
        reply = "I can help you manage your tasks hands-free! Try saying:\n• 'Remind me to buy groceries tomorrow at 5 PM'\n• 'What are my tasks for today?'\n• 'Which task should I do first?'\n• 'Do I have any overdue tasks?'";
      } else if (/thanks|thank\s+you/i.test(input)) {
        reply = "You're very welcome! Let me know if you need anything else.";
      }
      return {
        action: "GENERAL_CONVERSATION",
        replyText: reply
      };
    }

    // 2. Check if it's a query
    const isQuery = /tasks\s+for\s+today|what.*tasks.*today|first|do\s+first|priorit|overdue|next\s+task|what.*next/i.test(input);

    if (!isQuery) {
      // Intent validation: make sure the user is actually trying to create a task!
      const hasTaskPrefix = /remind|add|create|schedule|todo|need\s+to|want\s+to|remember\s+to|have\s+to/i.test(input);
      const hasTaskTime = /today|tomorrow|tonight|evening|afternoon|morning|next\s+week|\bin\s+\d+\s*(?:hour|min)|\b(?:at|on)\s+\d{1,2}|\b(?:on\s+)?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(input);
      const hasTaskActionVerb = /^(buy|pay|call|meet|clean|study|work|finish|write|read|go|prepare|submit|email|send|do|make|get|check|review|run|workout|gym|dentist|doctor)\b/i.test(input);

      // If there is no clear task creation intent, treat as general conversation to avoid adding weird tasks
      if (!hasTaskPrefix && !hasTaskTime && !hasTaskActionVerb && input.split(" ").length < 3) {
        return {
          action: "GENERAL_CONVERSATION",
          replyText: "I'm not sure if you wanted to add a task. You can say 'Remind me to buy milk tomorrow at 6 PM' or ask me about your schedule!"
        };
      }

      // 3. Determine Date
      let dateStr = todayStr;
      let relativeTimeAdded = false;
      let timeStr = "18:00"; // Default to 6:00 PM
      let timeMatched = false;

      // Extract offsets like "in 3 hours" or "in 30 minutes"
      const inHoursMatch = input.match(/\bin\s+(\d+)\s*hour(?:s)?\b/i);
      const inMinsMatch = input.match(/\bin\s+(\d+)\s*min(?:ute)?(?:s)?\b/i);

      if (inHoursMatch) {
        const hoursToAdd = parseInt(inHoursMatch[1], 10);
        const target = new Date(refDate.getTime() + hoursToAdd * 60 * 60 * 1000);
        dateStr = target.toISOString().split("T")[0];
        timeStr = `${target.getHours().toString().padStart(2, "0")}:${target.getMinutes().toString().padStart(2, "0")}`;
        timeMatched = true;
        relativeTimeAdded = true;
      } else if (inMinsMatch) {
        const minsToAdd = parseInt(inMinsMatch[1], 10);
        const target = new Date(refDate.getTime() + minsToAdd * 60 * 1000);
        dateStr = target.toISOString().split("T")[0];
        timeStr = `${target.getHours().toString().padStart(2, "0")}:${target.getMinutes().toString().padStart(2, "0")}`;
        timeMatched = true;
        relativeTimeAdded = true;
      }

      if (!relativeTimeAdded) {
        if (/\btomorrow\b/i.test(input)) {
          const tomorrow = new Date(refDate);
          tomorrow.setDate(refDate.getDate() + 1);
          dateStr = tomorrow.toISOString().split("T")[0];
        } else if (/\bday after tomorrow\b/i.test(input)) {
          const dayAfter = new Date(refDate);
          dayAfter.setDate(refDate.getDate() + 2);
          dateStr = dayAfter.toISOString().split("T")[0];
        } else {
          // Weekdays
          const weekdays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
          let matchedWeekday = false;
          
          for (let i = 0; i < weekdays.length; i++) {
            const dayName = weekdays[i];
            const regexNext = new RegExp(`next\\s+${dayName}`, "i");
            const regexOn = new RegExp(`(?:on\\s+)?${dayName}`, "i");
            
            if (regexNext.test(input)) {
              const targetDay = i;
              const currentDay = refDate.getDay();
              let daysToAdd = (targetDay - currentDay + 7) % 7;
              if (daysToAdd === 0) daysToAdd = 7;
              daysToAdd += 7; // Go to next week's weekday
              const targetDate = new Date(refDate);
              targetDate.setDate(refDate.getDate() + daysToAdd);
              dateStr = targetDate.toISOString().split("T")[0];
              matchedWeekday = true;
              break;
            }
            
            if (regexOn.test(input)) {
              const targetDay = i;
              const currentDay = refDate.getDay();
              let daysToAdd = (targetDay - currentDay + 7) % 7;
              if (daysToAdd === 0) daysToAdd = 7;
              const targetDate = new Date(refDate);
              targetDate.setDate(refDate.getDate() + daysToAdd);
              dateStr = targetDate.toISOString().split("T")[0];
              matchedWeekday = true;
              break;
            }
          }

          if (!matchedWeekday) {
            // Month name search (e.g. "June 28")
            const monthNames = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december", "jan", "feb", "mar", "apr", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
            const monthRegex = new RegExp(`(?:on\\s+)?\\b(${monthNames.join("|")})\\b\\s+(\\d{1,2})(?:st|nd|rd|th)?`, "i");
            const monthMatch = input.match(monthRegex);
            if (monthMatch) {
              const monthStr = monthMatch[1];
              const dayNum = parseInt(monthMatch[2], 10);
              let monthIdx = monthNames.indexOf(monthStr.toLowerCase());
              if (monthIdx >= 12) monthIdx -= 12;
              
              const targetDate = new Date(refDate);
              targetDate.setMonth(monthIdx);
              targetDate.setDate(dayNum);
              if (targetDate.getTime() < refDate.getTime() - 86400000) {
                targetDate.setFullYear(refDate.getFullYear() + 1);
              }
              dateStr = targetDate.toISOString().split("T")[0];
            } else if (/\bnext\s+week\b/i.test(input)) {
              const nextWeek = new Date(refDate);
              nextWeek.setDate(refDate.getDate() + 7);
              dateStr = nextWeek.toISOString().split("T")[0];
            }
          }
        }
      }

      // 4. Determine Time (if not set by relative offsets)
      if (!relativeTimeAdded) {
        if (/\btonight\b/i.test(input)) {
          timeStr = "20:00";
          timeMatched = true;
        } else if (/\bevening\b/i.test(input)) {
          timeStr = "18:00";
          timeMatched = true;
        } else if (/\bafternoon\b/i.test(input)) {
          timeStr = "14:00";
          timeMatched = true;
        } else if (/\bmorning\b/i.test(input)) {
          timeStr = "09:00";
          timeMatched = true;
        }

        const ampmRegex = /(?:at\s+)?\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i;
        const ampmMatch = input.match(ampmRegex);
        
        if (ampmMatch) {
          let hours = parseInt(ampmMatch[1], 10);
          const minutes = ampmMatch[2] ? parseInt(ampmMatch[2], 10) : 0;
          const ampm = ampmMatch[3].toLowerCase();
          
          if (ampm === "pm" && hours < 12) {
            hours += 12;
          } else if (ampm === "am" && hours === 12) {
            hours = 0;
          }
          timeStr = `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
          timeMatched = true;
        } else {
          const hour24Regex = /(?:at\s+)?\b([0-1]?[0-9]|2[0-3]):([0-5][0-9])\b/i;
          const hour24Match = input.match(hour24Regex);
          if (hour24Match) {
            const hours = parseInt(hour24Match[1], 10);
            const minutes = parseInt(hour24Match[2], 10);
            timeStr = `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
            timeMatched = true;
          } else {
            const simpleAtRegex = /\bat\s+(\d{1,2})\b/i;
            const simpleAtMatch = input.match(simpleAtRegex);
            if (simpleAtMatch) {
              let hours = parseInt(simpleAtMatch[1], 10);
              if (hours >= 1 && hours < 12) {
                hours += 12;
              }
              timeStr = `${hours.toString().padStart(2, "0")}:00`;
              timeMatched = true;
            }
          }
        }
      }

      // 5. Determine Category
      let category = "Others";
      if (/assignment|homework|study|exam|class|test|quiz|lecture|reading/i.test(input)) {
        category = "Study";
      } else if (/work|meeting|project|presentation|office|interview|client|report|email|call/i.test(input)) {
        category = "Work";
      } else if (/pay|bill|finance|rent|card|tax|banking|subscription/i.test(input)) {
        category = "Finance";
      } else if (/health|workout|doctor|run|exercise|dentist|gym|medication|pill|walk|yoga|fitness/i.test(input)) {
        category = "Health";
      } else if (/buy|shop|grocery|store|laundry|clean|dinner|lunch|breakfast|gift|party|mom|dad/i.test(input)) {
        category = "Personal";
      }

      // 6. Extract Task Title Concisely
      let title = text;
      
      // Remove introductory action prefixes
      const prefixes = [
        /^\s*(?:please\s+)?remind\s+me\s+to\s+/i,
        /^\s*(?:please\s+)?remind\s+me\s+about\s+/i,
        /^\s*(?:please\s+)?remind\s+me\s+/i,
        /^\s*(?:please\s+)?add\s+a\s+task\s+to\s+/i,
        /^\s*(?:please\s+)?add\s+task\s+to\s+/i,
        /^\s*(?:please\s+)?add\s+a\s+task\s+/i,
        /^\s*(?:please\s+)?add\s+task\s+/i,
        /^\s*(?:please\s+)?add\s+a\s+/i,
        /^\s*(?:please\s+)?add\s+/i,
        /^\s*(?:please\s+)?create\s+a\s+task\s+to\s+/i,
        /^\s*(?:please\s+)?create\s+task\s+to\s+/i,
        /^\s*(?:please\s+)?create\s+a\s+task\s+/i,
        /^\s*(?:please\s+)?create\s+task\s+/i,
        /^\s*(?:please\s+)?create\s+/i,
        /^\s*(?:please\s+)?todo\s+/i,
        /^\s*(?:please\s+)?schedule\s+a\s+task\s+to\s+/i,
        /^\s*(?:please\s+)?schedule\s+task\s+to\s+/i,
        /^\s*(?:please\s+)?schedule\s+a\s+task\s+/i,
        /^\s*(?:please\s+)?schedule\s+task\s+/i,
        /^\s*(?:please\s+)?schedule\s+a\s+p\s+/i,
        /^\s*(?:please\s+)?schedule\s+/i,
        /^\s*(?:please\s+)?i\s+need\s+to\s+/i,
        /^\s*(?:please\s+)?i\s+want\s+to\s+/i,
        /^\s*(?:please\s+)?need\s+to\s+/i,
        /^\s*(?:please\s+)?want\s+to\s+/i,
        /^\s*(?:please\s+)?remember\s+to\s+/i,
        /^\s*(?:please\s+)?have\s+to\s+/i
      ];
      
      for (const p of prefixes) {
        if (p.test(title)) {
          title = title.replace(p, "");
          break;
        }
      }

      // Remove date indicators
      title = title.replace(/\b(?:today|tomorrow|day\s+after\s+tomorrow|next\s+week)\b/i, "");
      title = title.replace(/\b(?:this\s+)?(?:evening|afternoon|morning|tonight)\b/i, "");
      title = title.replace(/\bin\s+\d+\s*hour(?:s)?\b/i, "");
      title = title.replace(/\bin\s+\d+\s*min(?:ute)?(?:s)?\b/i, "");
      
      const weekdays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
      for (const day of weekdays) {
        const regNext = new RegExp(`\\bnext\\s+${day}\\b`, "i");
        const regOn = new RegExp(`\\b(?:on\\s+)?${day}\\b`, "i");
        title = title.replace(regNext, "").replace(regOn, "");
      }
      
      const monthNames = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december", "jan", "feb", "mar", "apr", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
      const monthRegex = new RegExp(`\\b(?:on\\s+)?(?:${monthNames.join("|")})\\b\\s+\\d{1,2}(?:st|nd|rd|th)?`, "i");
      title = title.replace(monthRegex, "");

      // Remove time indicators
      title = title.replace(/\b(?:at\s+)?\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/i, "");
      title = title.replace(/\b(?:at\s+)?(?:[0-1]?[0-9]|2[0-3]):[0-5][0-9]\b/i, "");
      title = title.replace(/\bat\s+\d{1,2}\b/i, "");

      // Clean up prepositions at the end/start of title
      title = title.replace(/\b(?:at|on|for|to|by|in)\s*$/i, "");
      title = title.replace(/^\s*(?:at|on|for|to|by|in)\s+/i, "");
      title = title.replace(/\s+/g, " ").trim();
      
      if (title.length > 0) {
        title = title.charAt(0).toUpperCase() + title.slice(1);
      } else {
        title = "Voice Task";
      }

      const priorityVal = determineTaskPriorityLocal(title, "Created via Voice Assistant", category, dateStr, timeStr);

      const newTask = {
        id: "task_" + Math.random().toString(36).substr(2, 9),
        userId,
        title,
        description: "Created via Voice Assistant",
        category,
        priority: priorityVal,
        deadlineDate: dateStr,
        deadlineTime: timeStr,
        estimatedDuration: "30 mins",
        status: "Pending",
        createdAt: new Date().toISOString(),
        subtasks: []
      };

      db.tasks.push(newTask);
      writeDB(db);

      const readableDate = dateStr === todayStr ? "today" : dateStr === new Date(refDate.getTime() + 86400000).toISOString().split("T")[0] ? "tomorrow" : dateStr;
      
      const formatTime12Hour = (time24: string): string => {
        try {
          const [hStr, mStr] = time24.split(":");
          let hours = parseInt(hStr, 10);
          const minutes = parseInt(mStr, 10);
          const ampm = hours >= 12 ? "PM" : "AM";
          hours = hours % 12;
          if (hours === 0) hours = 12;
          return `${hours}:${minutes.toString().padStart(2, "0")} ${ampm}`;
        } catch (e) {
          return "6:00 PM";
        }
      };

      const readableTime = formatTime12Hour(timeStr);

      return {
        action: "CREATE_TASK",
        replyText: `Got it! I have added "${title}" to your ${category} list for ${readableDate} at ${readableTime}.`,
        task: newTask
      };
    }

    // Checking queries
    if (/tasks\s+for\s+today|what.*tasks.*today/i.test(input)) {
      const todayTasks = userTasks.filter((t: any) => t.deadlineDate === todayStr);
      if (todayTasks.length === 0) {
        return {
          action: "QUERY_TASKS",
          replyText: "You are completely all caught up for today! No tasks scheduled."
        };
      }
      return {
        action: "QUERY_TASKS",
        replyText: `You have ${todayTasks.length} task${todayTasks.length === 1 ? "" : "s"} scheduled for today: ${todayTasks.map((t: any) => t.title).join(", ")}.`
      };
    }

    if (/first|do\s+first|priorit/i.test(input)) {
      if (userTasks.length === 0) {
        return {
          action: "QUERY_TASKS",
          replyText: "You don't have any pending tasks right now. Feel free to relax or add a new task."
        };
      }
      const sorted = [...userTasks].sort((a: any, b: any) => {
        const timeA = new Date(`${a.deadlineDate}T${a.deadlineTime}`).getTime();
        const timeB = new Date(`${b.deadlineDate}T${b.deadlineTime}`).getTime();
        return timeA - timeB;
      });
      const top = sorted[0];
      return {
        action: "QUERY_TASKS",
        replyText: `You should work on "${top.title}" first, as it is due next on ${top.deadlineDate} at ${top.deadlineTime}.`
      };
    }

    if (/overdue/i.test(input)) {
      const overdueTasks = userTasks.filter((t: any) => {
        const deadline = new Date(`${t.deadlineDate}T${t.deadlineTime}`);
        return deadline.getTime() < refDate.getTime();
      });

      if (overdueTasks.length === 0) {
        return {
          action: "QUERY_TASKS",
          replyText: "Great news! You have no overdue tasks at the moment."
        };
      }
      return {
        action: "QUERY_TASKS",
        replyText: `Yes, you have ${overdueTasks.length} overdue task${overdueTasks.length === 1 ? "" : "s"}: ${overdueTasks.map((t: any) => t.title).join(", ")}. It's highly recommended to complete them as soon as possible.`
      };
    }

    if (/next\s+task|what.*next/i.test(input)) {
      const sorted = [...userTasks].sort((a: any, b: any) => {
        const timeA = new Date(`${a.deadlineDate}T${a.deadlineTime}`).getTime();
        const timeB = new Date(`${b.deadlineDate}T${b.deadlineTime}`).getTime();
        return timeA - timeB;
      });
      const next = sorted.find((t: any) => new Date(`${t.deadlineDate}T${t.deadlineTime}`).getTime() >= refDate.getTime());
      if (!next) {
        return {
          action: "QUERY_TASKS",
          replyText: "You don't have any upcoming tasks scheduled. You are good to go!"
        };
      }
      return {
        action: "QUERY_TASKS",
        replyText: `Your next upcoming task is "${next.title}", scheduled for ${next.deadlineDate} at ${next.deadlineTime}.`
      };
    }

    return {
      action: "GENERAL_CONVERSATION",
      replyText: "I am your TaskMate Voice Assistant. You can ask me to add tasks (like 'Remind me to submit DBMS assignment tomorrow at 6 PM') or ask questions about your daily schedule!"
    };
  };

  if (!ai) {
    return res.json(handleLocalFallback());
  }

  try {
    const prompt = `You are the AI TaskMate Voice Assistant.
The user sent the following voice input/text command: "${text}"

Client Context:
- Current Local Date & Time: ${refDate.toString()} (ISO: ${refDateStr})
- Current Today's Date: ${todayStr}
- Pending Tasks List:
${taskListSummary || "None"}

Please evaluate the user's input and select the most appropriate action:
1. CREATE_TASK: If they want to add/remind/schedule a task (e.g., 'Remind me to submit DBMS assignment tomorrow at 6 PM').
2. QUERY_TASKS: If they ask about today's tasks, overdue tasks, what to do first, next tasks, etc.
3. GENERAL_CONVERSATION: Standard chat or productivity advice.

If action is "CREATE_TASK":
- Extract task title concisely (e.g. "Submit DBMS assignment").
- Determine category ('Work', 'Study', 'Personal', 'Finance', 'Health', 'Others').
- Calculate the deadlineDate in YYYY-MM-DD. Compute relative terms like "tomorrow", "next week", "today" based on Today's Date (${todayStr}).
- Calculate deadlineTime in HH:MM (24-hour). Default to "18:00" if unspecified.
- Determine estimatedDuration (e.g., "30 mins", "1 hour").
- Formulate a brief, conversational replyText confirming task creation (e.g., "Sure, I have added the task 'Submit DBMS assignment' for tomorrow at 6:00 PM.").

If action is "QUERY_TASKS":
- Formulate an extremely helpful and smart replyText based on the pending tasks list and deadlines.
- Keep the response professional, friendly, and spoken-friendly (avoid markdown formatting like bold/asterisks inside replyText since this is read aloud via speech synthesis).
- Give specific smart advice like: "Your presentation is due in 2 hours. I recommend starting it now." or "You have 2 tasks due today. I recommend doing task X first."

Respond strictly with the following JSON schema:
{
  "action": "CREATE_TASK" | "QUERY_TASKS" | "GENERAL_CONVERSATION",
  "replyText": "spoken-friendly text response here (avoid markdown stars or hash symbols)",
  "taskToCreate": {
    "title": "Task title",
    "description": "Short description",
    "category": "Work" | "Study" | "Personal" | "Finance" | "Health" | "Others",
    "deadlineDate": "YYYY-MM-DD",
    "deadlineTime": "HH:MM",
    "estimatedDuration": "30 mins"
  },
  "queryType": "TODAY_TASKS" | "FIRST_TASK" | "OVERDUE_TASKS" | "NEXT_TASK" | "NONE"
}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            action: { type: Type.STRING },
            replyText: { type: Type.STRING },
            taskToCreate: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                category: { type: Type.STRING },
                deadlineDate: { type: Type.STRING },
                deadlineTime: { type: Type.STRING },
                estimatedDuration: { type: Type.STRING }
              },
              required: ["title", "deadlineDate", "deadlineTime"]
            },
            queryType: { type: Type.STRING }
          },
          required: ["action", "replyText"]
        }
      }
    });

    const parsed = JSON.parse(response.text || "{}");
    
    if (parsed.action === "CREATE_TASK" && parsed.taskToCreate && parsed.taskToCreate.title) {
      const t = parsed.taskToCreate;
      const priorityVal = await determineTaskPriority(t.title, t.description || "", t.category || "Others", t.deadlineDate, t.deadlineTime);
      
      const newTask = {
        id: "task_" + Math.random().toString(36).substr(2, 9),
        userId,
        title: t.title,
        description: t.description || "Created via Voice Assistant",
        category: t.category || "Others",
        priority: priorityVal,
        deadlineDate: t.deadlineDate,
        deadlineTime: t.deadlineTime || "18:00",
        estimatedDuration: t.estimatedDuration || "30 mins",
        status: "Pending",
        createdAt: new Date().toISOString(),
        subtasks: []
      };

      db.tasks.push(newTask);
      writeDB(db);

      return res.json({
        action: "CREATE_TASK",
        replyText: parsed.replyText,
        task: newTask
      });
    }

    res.json(parsed);
  } catch (error: any) {
    console.warn("Voice Command Endpoint Error (using local NLP fallback):", error?.message || error);
    res.json(handleLocalFallback());
  }
});

// ================= VITE / STATIC MIDDWARE =================

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
