
"use strict";



const $ = (id) => document.getElementById(id);

const loginPage = $("loginPage");
const plannerApp = $("plannerApp");
const loginForm = $("loginForm");
const taskForm = $("taskForm");
const taskModal = $("taskModal");

const STORAGE_KEYS = {
  name: "studyStudentName",
  email: "studyStudentEmail",
  tasks: "studyFlowTasks",
  schedule: "studyFlowSchedule",
  theme: "studyFlowTheme",
  dailyHours: "studyFlowDailyHours",
  startHour: "studyFlowStartHour"
};



let tasks = loadData(STORAGE_KEYS.tasks, []);
let schedule = loadData(STORAGE_KEYS.schedule, []);
let currentView = "dashboard";
let editingTaskId = null;

let timerSeconds = 25 * 60;
let timerInterval = null;
let timerRunning = false;
let timerMode = "focus";


function loadData(key, fallback) {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : fallback;
  } catch (error) {
    console.error("Could not load saved data:", error);
    return fallback;
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEYS.tasks, JSON.stringify(tasks));
  localStorage.setItem(STORAGE_KEYS.schedule, JSON.stringify(schedule));
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function createId() {
  return Date.now().toString(36) +
    Math.random().toString(36).slice(2, 9);
}

// Use local dates rather than UTC to avoid off-by-one date errors.
function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseLocalDate(value) {
  if (!value) return null;

  const parts = value.split("-").map(Number);

  if (parts.length !== 3 || parts.some(Number.isNaN)) {
    return null;
  }

  const date = new Date(parts[0], parts[1] - 1, parts[2]);

  if (Number.isNaN(date.getTime())) return null;

  return date;
}

function formatDate(value) {
  const date = parseLocalDate(value);

  if (!date) return "No date";

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function dateDifference(from, to) {
  const first = parseLocalDate(from);
  const second = parseLocalDate(to);

  if (!first || !second) return Infinity;

  return Math.round(
    (second.getTime() - first.getTime()) / 86400000
  );
}

function isCompleted(task) {
  return task.status === "completed";
}

function getTaskHours(task) {
  return Math.max(0, Number(task.duration) || 0);
}

function formatHours(hours) {
  const value = Number(hours) || 0;
  return `${Number(value.toFixed(2))}h`;
}

function formatTime(hour) {
  const h = Math.floor(hour);
  const minutes = Math.round((hour - h) * 60);

  const date = new Date();
  date.setHours(h, minutes, 0, 0);

  return date.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit"
  });
}

function showPlanner(name) {
  loginPage.hidden = true;
  loginPage.style.display = "none";

  plannerApp.hidden = false;
  plannerApp.style.display = "";

  const studentName = name || "Arathi Nair";

  $("profileName").textContent = studentName;
  $("studentGreeting").textContent = `Hii, ${studentName} 👋`;

  const avatar = document.querySelector(".profile-avatar");
  if (avatar) {
    avatar.textContent = studentName.trim().charAt(0).toUpperCase() || "A";
  }

  updateDate();
  renderAll();
  showView(currentView);
}

function updateDate() {
  $("currentDate").textContent = new Date().toLocaleDateString(
    "en-IN",
    {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    }
  );
}

loginForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const name = $("studentName").value.trim();
  const email = $("studentEmail").value.trim();

  if (!name || !email) {
    alert("Please enter your name and email address.");
    return;
  }

  localStorage.setItem(STORAGE_KEYS.name, name);
  localStorage.setItem(STORAGE_KEYS.email, email);

  showPlanner(name);
});

$("logoutBtn").addEventListener("click", () => {
  localStorage.removeItem(STORAGE_KEYS.name);
  localStorage.removeItem(STORAGE_KEYS.email);

  stopTimer();

  plannerApp.hidden = true;
  plannerApp.style.display = "none";

  loginPage.hidden = false;
  loginPage.style.display = "flex";

  $("studentName").value = "Arathi Nair";
  $("studentEmail").value = "";
});



function showView(view) {
  const validViews = [
    "dashboard",
    "tasks",
    "schedule",
    "deadlines"
  ];

  if (!validViews.includes(view)) return;

  currentView = view;

  document.querySelectorAll(".page-view").forEach((section) => {
    section.hidden = section.id !== `${view}View`;
  });

  document.querySelectorAll("[data-view]").forEach((button) => {
    if (button.classList.contains("nav-item")) {
      button.classList.toggle(
        "active",
        button.dataset.view === view
      );
    }
  });

  if (view === "dashboard") renderDashboard();
  if (view === "tasks") renderTasks();
  if (view === "schedule") renderSchedule();
  if (view === "deadlines") renderDeadlines();

  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.querySelectorAll("[data-view]").forEach((element) => {
  element.addEventListener("click", (event) => {
    event.preventDefault();
    showView(element.dataset.view);
  });
});



function openTaskModal(task = null) {
  editingTaskId = task ? task.id : null;

  taskForm.reset();

  $("taskId").value = task ? task.id : "";
  $("taskModalTitle").textContent = task
    ? "Edit task"
    : "Add a new task";

  $("taskTitle").value = task?.title || "";
  $("taskSubject").value = task?.subject || "";
  $("taskDueDate").value = task?.dueDate || localDateString();
  $("taskDuration").value = task
    ? getTaskHours(task)
    : 1;

  $("taskPriority").value = task?.priority || "medium";

  taskModal.hidden = false;
  $("taskTitle").focus();
}

function closeTaskModal() {
  taskModal.hidden = true;
  editingTaskId = null;
}

$("addTaskBtn").addEventListener("click", () => openTaskModal());
$("quickAddTask").addEventListener("click", () => openTaskModal());

$("closeTaskModal").addEventListener("click", closeTaskModal);
$("cancelTaskBtn").addEventListener("click", closeTaskModal);

taskModal.addEventListener("click", (event) => {
  if (event.target === taskModal) {
    closeTaskModal();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !taskModal.hidden) {
    closeTaskModal();
  }
});


taskForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const title = $("taskTitle").value.trim();
  const subject = $("taskSubject").value.trim();
  const dueDate = $("taskDueDate").value;
  const duration = Number($("taskDuration").value);
  const priority = $("taskPriority").value;

  if (!title || !dueDate || !Number.isFinite(duration) ||
      duration < 0.25 || duration > 100) {
    alert("Please enter valid task details.");
    return;
  }

  if (!parseLocalDate(dueDate)) {
    alert("Please select a valid due date.");
    return;
  }

  if (editingTaskId) {
    const existing = tasks.find((task) => task.id === editingTaskId);

    if (existing) {
      existing.title = title;
      existing.subject = subject;
      existing.dueDate = dueDate;
      existing.duration = duration;
      existing.priority = priority;
    }
  } else {
    tasks.push({
      id: createId(),
      title,
      subject,
      dueDate,
      duration,
      priority,
      status: "pending",
      createdAt: new Date().toISOString()
    });
  }

  saveData();
  closeTaskModal();
  renderAll();
  showView(currentView);
});



function toggleTask(id) {
  const task = tasks.find((item) => item.id === id);
  if (!task) return;

  task.status = isCompleted(task) ? "pending" : "completed";

  if (isCompleted(task)) {
    task.completedAt = new Date().toISOString();
  } else {
    delete task.completedAt;
  }

  schedule = [];
  saveData();
  renderAll();
  showView(currentView);
}

function editTask(id) {
  const task = tasks.find((item) => item.id === id);
  if (task) openTaskModal(task);
}

function deleteTask(id) {
  const task = tasks.find((item) => item.id === id);
  if (!task) return;

  const confirmed = confirm(
    `Delete "${task.title}" from your planner?`
  );

  if (!confirmed) return;

  tasks = tasks.filter((item) => item.id !== id);
  schedule = [];
  saveData();

  renderAll();
  showView(currentView);
}



function taskStatus(task) {
  if (isCompleted(task)) {
    return {
      label: "Completed",
      className: "status-completed"
    };
  }

  if (task.dueDate < localDateString()) {
    return {
      label: "Overdue",
      className: "status-overdue"
    };
  }

  return {
    label: "Pending",
    className: "status-pending"
  };
}

function taskHTML(task, showActions = true) {
  const status = taskStatus(task);

  const priority = ["high", "medium", "low"].includes(task.priority)
    ? task.priority
    : "medium";

  return `
    <article class="task-item">
      <button
        class="task-checkbox ${isCompleted(task) ? "completed" : ""}"
        data-action="toggle"
        data-id="${escapeHTML(task.id)}"
        aria-label="${isCompleted(task) ? "Mark pending" : "Mark completed"}"
        title="${isCompleted(task) ? "Mark pending" : "Mark completed"}"
      >${isCompleted(task) ? "✓" : ""}</button>

      <div class="task-info ${isCompleted(task) ? "is-completed" : ""}">
        <h3>${escapeHTML(task.title)}</h3>

        <p>
          ${escapeHTML(task.subject || "General")}
          · Due ${escapeHTML(formatDate(task.dueDate))}
          · ${escapeHTML(formatHours(getTaskHours(task)))}
        </p>

        <div class="task-meta">
          <span class="priority-badge priority-${priority}">
            ${priority.charAt(0).toUpperCase() + priority.slice(1)} priority
          </span>

          <span class="status-badge ${status.className}">
            ${status.label}
          </span>
        </div>
      </div>

      ${showActions ? `
        <div class="task-actions">
          <button
            class="icon-btn"
            data-action="edit"
            data-id="${escapeHTML(task.id)}"
            title="Edit task"
            aria-label="Edit task"
          >✎</button>

          <button
            class="icon-btn delete"
            data-action="delete"
            data-id="${escapeHTML(task.id)}"
            title="Delete task"
            aria-label="Delete task"
          >×</button>
        </div>
      ` : ""}
    </article>
  `;
}


document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  const id = button.dataset.id;
  const action = button.dataset.action;

  if (!id) return;

  if (action === "toggle") toggleTask(id);
  if (action === "edit") editTask(id);
  if (action === "delete") deleteTask(id);
});


function renderTasks() {
  const query = $("taskSearch").value.trim().toLowerCase();
  const statusFilter = $("taskFilter").value;
  const priorityFilter = $("priorityFilter").value;

  const filteredTasks = tasks
    .filter((task) => {
      const matchesSearch =
        task.title.toLowerCase().includes(query) ||
        (task.subject || "").toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "completed" && isCompleted(task)) ||
        (statusFilter === "pending" && !isCompleted(task));

      const matchesPriority =
        priorityFilter === "all" ||
        task.priority === priorityFilter;

      return matchesSearch && matchesStatus && matchesPriority;
    })
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  $("allTasksList").innerHTML = filteredTasks.length
    ? filteredTasks.map((task) => taskHTML(task)).join("")
    : `
      <div class="empty-state">
        <span>📚</span>
        <p>No matching tasks. Try a different filter or add a task.</p>
      </div>
    `;
}

$("taskSearch").addEventListener("input", renderTasks);
$("taskFilter").addEventListener("change", renderTasks);
$("priorityFilter").addEventListener("change", renderTasks);


function renderDashboard() {
  const completed = tasks.filter(isCompleted);
  const pending = tasks.filter((task) => !isCompleted(task));

  const totalHours = pending.reduce(
    (sum, task) => sum + getTaskHours(task),
    0
  );

  $("totalTasks").textContent = tasks.length;
  $("completedTasks").textContent = completed.length;
  $("pendingTasks").textContent = pending.length;
  $("studyHours").textContent = formatHours(totalHours);

  const percentage = tasks.length
    ? Math.round((completed.length / tasks.length) * 100)
    : 0;

  $("progressPercent").textContent = `${percentage}%`;
  $("progressBar").style.width = `${percentage}%`;

  $("progressCircle").style.background = `
    conic-gradient(
      var(--primary) ${percentage * 3.6}deg,
      #eaf0f8 ${percentage * 3.6}deg
    )
  `;

  $("progressCaption").textContent =
    percentage === 100 && tasks.length
      ? "Amazing! You've completed all your tasks."
      : tasks.length
        ? `${completed.length} of ${tasks.length} tasks completed. Keep going!`
        : "Your journey starts here! Add your first task.";

  const today = localDateString();

 
  const todayTasks = [...pending].sort((a, b) => {
    const aToday = a.dueDate === today ? 0 : 1;
    const bToday = b.dueDate === today ? 0 : 1;

    return aToday - bToday || a.dueDate.localeCompare(b.dueDate);
  }).slice(0, 4);

  $("todayTasks").innerHTML = todayTasks.length
    ? todayTasks.map((task) => taskHTML(task, false)).join("")
    : `
      <div class="empty-state">
        <span>🎉</span>
        <p>No pending tasks. Add a new task to plan your study time!</p>
      </div>
    `;
}



function renderDeadlines() {
  const today = localDateString();

  const pending = tasks.filter((task) => !isCompleted(task));

  const dueToday = pending.filter((task) => task.dueDate === today);
  const dueWeek = pending.filter((task) => {
    const days = dateDifference(today, task.dueDate);
    return days >= 0 && days <= 7;
  });

  const overdue = pending.filter((task) => task.dueDate < today);

  $("dueTodayCount").textContent = dueToday.length;
  $("dueWeekCount").textContent = dueWeek.length;
  $("overdueCount").textContent = overdue.length;

  const sorted = [...tasks].sort((a, b) => {
    if (isCompleted(a) !== isCompleted(b)) {
      return isCompleted(a) ? 1 : -1;
    }

    return a.dueDate.localeCompare(b.dueDate);
  });

  $("deadlinesList").innerHTML = sorted.length
    ? sorted.map((task) => taskHTML(task)).join("")
    : `
      <div class="empty-state">
        <span>🎯</span>
        <p>No deadlines yet. Add tasks with due dates.</p>
      </div>
    `;
}



function generateSchedule() {
  const dailyCapacity = Number($("dailyHours").value) || 4;
  const startHour = Number($("studyStartTime").value) || 9;
  const today = localDateString();

  localStorage.setItem(STORAGE_KEYS.dailyHours, dailyCapacity);
  localStorage.setItem(STORAGE_KEYS.startHour, startHour);

  const pendingTasks = tasks
    .filter((task) => !isCompleted(task))
    .sort((a, b) => {
      const priorityRank = { high: 0, medium: 1, low: 2 };

      return (
        a.dueDate.localeCompare(b.dueDate) ||
        (priorityRank[a.priority] ?? 1) -
          (priorityRank[b.priority] ?? 1)
      );
    });

  const sessions = [];
  const allocatedByTask = {};
  const dayCapacity = {};

  for (const task of pendingTasks) {
    let remaining = Math.round(getTaskHours(task) * 4) / 4;

    // Split each task into sessions of up to 1 hour.
    while (remaining > 0) {
      const availableDate = findAvailableDate(
        task.dueDate,
        today,
        dailyCapacity,
        dayCapacity
      );

      if (!availableDate) break;

      const capacityLeft =
        dailyCapacity - (dayCapacity[availableDate] || 0);

      const sessionHours = Math.min(
        1,
        remaining,
        capacityLeft
      );

      if (sessionHours <= 0) break;

      const usedHours = dayCapacity[availableDate] || 0;

      const session = {
        id: createId(),
        taskId: task.id,
        title: task.title,
        subject: task.subject || "General",
        date: availableDate,
        startHour: startHour + usedHours,
        duration: sessionHours
      };

      sessions.push(session);

      dayCapacity[availableDate] = usedHours + sessionHours;
      allocatedByTask[task.id] =
        (allocatedByTask[task.id] || 0) + sessionHours;

      remaining = Math.round((remaining - sessionHours) * 100) / 100;
    }
  }

  schedule = sessions;
  saveData();
  renderSchedule();

  const unallocated = pendingTasks.filter((task) => {
    const allocated = allocatedByTask[task.id] || 0;
    return allocated + 0.001 < getTaskHours(task);
  });

  if (unallocated.length) {
    alert(
      `Schedule generated, but ${unallocated.length} task(s) could not be fully scheduled before their deadlines. Try increasing your daily study capacity or adjusting the deadlines.`
    );
  }
}

function findAvailableDate(
  dueDate,
  today,
  dailyCapacity,
  dayCapacity
) {
  const due = parseLocalDate(dueDate);
  const start = parseLocalDate(today);

  if (!due || !start || due < start) return null;

  const current = new Date(start);

  while (current <= due) {
    const key = localDateString(current);
    const used = dayCapacity[key] || 0;

    if (used < dailyCapacity) {
      return key;
    }

    current.setDate(current.getDate() + 1);
  }

  return null;
}

$("generateScheduleBtn").addEventListener("click", generateSchedule);

$("dailyHours").addEventListener("change", () => {
  localStorage.setItem(
    STORAGE_KEYS.dailyHours,
    $("dailyHours").value
  );
});

$("studyStartTime").addEventListener("change", () => {
  localStorage.setItem(
    STORAGE_KEYS.startHour,
    $("studyStartTime").value
  );
});

function renderSchedule() {
  if (!schedule.length) {
    $("scheduleList").innerHTML = `
      <div class="empty-state">
        <span>🗓️</span>
        <p>Add pending tasks and generate a schedule to see your study sessions.</p>
      </div>
    `;
    return;
  }

  const grouped = {};

  schedule
    .filter((session) => {
      const task = tasks.find((item) => item.id === session.taskId);
      return task && !isCompleted(task);
    })
    .sort((a, b) => {
      return a.date.localeCompare(b.date) ||
        a.startHour - b.startHour;
    })
    .forEach((session) => {
      if (!grouped[session.date]) grouped[session.date] = [];
      grouped[session.date].push(session);
    });

  const dates = Object.keys(grouped).sort();

  if (!dates.length) {
    $("scheduleList").innerHTML = `
      <div class="empty-state">
        <span>🗓️</span>
        <p>All scheduled tasks are completed. Generate a new schedule when you add tasks.</p>
      </div>
    `;
    return;
  }

  $("scheduleList").innerHTML = dates.map((date) => {
    const dateLabel = parseLocalDate(date).toLocaleDateString(
      "en-IN",
      {
        weekday: "long",
        day: "numeric",
        month: "short"
      }
    );

    const sessionsHTML = grouped[date].map((session) => `
      <div class="schedule-session">
        <div class="session-time">
          ${escapeHTML(formatTime(session.startHour))}
        </div>

        <div class="session-details">
          <strong>${escapeHTML(session.title)}</strong>
          <small>
            ${escapeHTML(session.subject)}
            · ${escapeHTML(formatHours(session.duration))}
          </small>
        </div>

        <span class="status-badge status-pending">Study</span>
      </div>
    `).join("");

    const total = grouped[date].reduce(
      (sum, session) => sum + session.duration,
      0
    );

    return `
      <article class="schedule-day">
        <h3>${escapeHTML(dateLabel)} · ${escapeHTML(formatHours(total))}</h3>
        ${sessionsHTML}
      </article>
    `;
  }).join("");
}



function exportTasksCSV() {
  if (!tasks.length) {
    alert("There are no tasks to export yet.");
    return;
  }

  const columns = [
    "Title",
    "Subject",
    "Due Date",
    "Duration Hours",
    "Priority",
    "Status"
  ];

  const rows = tasks.map((task) => [
    task.title,
    task.subject || "",
    task.dueDate,
    getTaskHours(task),
    task.priority,
    isCompleted(task) ? "Completed" : "Pending"
  ]);

  const csvCell = (value) => {
    let text = String(value ?? "");

    // Prevent spreadsheet formula injection.
    if (/^[=+\-@\t\r]/.test(text)) {
      text = "'" + text;
    }

    return `"${text.replace(/"/g, '""')}"`;
  };

  const csv = [columns, ...rows]
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n");

  const blob = new Blob(["\uFEFF" + csv], {
    type: "text/csv;charset=utf-8;"
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "studyflow-tasks.csv";

  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}

$("exportTasksBtn").addEventListener("click", exportTasksCSV);



function applyTheme(theme) {
  document.body.classList.toggle("dark-mode", theme === "dark");
  localStorage.setItem(STORAGE_KEYS.theme, theme);
}

$("themeToggle").addEventListener("click", () => {
  const isDark = document.body.classList.contains("dark-mode");
  applyTheme(isDark ? "light" : "dark");
});


function updateTimerDisplay() {
  const minutes = Math.floor(timerSeconds / 60);
  const seconds = timerSeconds % 60;

  $("pomodoroDisplay").textContent =
    `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  document.title = timerRunning
    ? `${$("pomodoroDisplay").textContent} · StudyFlow`
    : "StudyFlow | Smart Study Planner";

  $("pomodoroStart").textContent = timerRunning ? "Pause" : "Start";
}

function stopTimer() {
  if (timerInterval !== null) {
    clearInterval(timerInterval);
  }

  timerInterval = null;
  timerRunning = false;
  updateTimerDisplay();
}

function resetTimer() {
  stopTimer();

  timerMode = "focus";
  timerSeconds = 25 * 60;

  updateTimerDisplay();
}

function startTimer() {
  if (timerRunning) {
    stopTimer();
    return;
  }

  timerRunning = true;
  updateTimerDisplay();

  timerInterval = setInterval(() => {
    timerSeconds--;

    if (timerSeconds <= 0) {
      stopTimer();

      if (timerMode === "focus") {
        alert("Great work! Focus session complete. Take a 5-minute break.");
        timerMode = "break";
        timerSeconds = 5 * 60;
      } else {
        alert("Break finished! Ready for another focus session?");
        timerMode = "focus";
        timerSeconds = 25 * 60;
      }
    }

    updateTimerDisplay();
  }, 1000);
}

$("pomodoroStart").addEventListener("click", startTimer);
$("pomodoroReset").addEventListener("click", resetTimer);


function renderAll() {
  renderDashboard();
  renderTasks();
  renderDeadlines();
  renderSchedule();
}


function initializeApp() {
  const savedDailyHours = localStorage.getItem(
    STORAGE_KEYS.dailyHours
  );

  const savedStartHour = localStorage.getItem(
    STORAGE_KEYS.startHour
  );

  if (savedDailyHours) {
    $("dailyHours").value = savedDailyHours;
  }

  if (savedStartHour) {
    $("studyStartTime").value = savedStartHour;
  }

  applyTheme(localStorage.getItem(STORAGE_KEYS.theme) || "light");

  updateDate();
  updateTimerDisplay();

  const savedName = localStorage.getItem(STORAGE_KEYS.name);
  const savedEmail = localStorage.getItem(STORAGE_KEYS.email);

  if (savedName && savedEmail) {
    $("studentName").value = savedName;
    $("studentEmail").value = savedEmail;
    showPlanner(savedName);
  } else {
    plannerApp.hidden = true;
    plannerApp.style.display = "none";

    loginPage.hidden = false;
    loginPage.style.display = "flex";

    $("studentName").value = "Arathi Nair";
  }
}

initializeApp();
