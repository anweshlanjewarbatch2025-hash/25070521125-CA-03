import { useEffect, useMemo, useState } from "react";
import axios from "axios";

import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  Circle,
  Clock3,
  FileText,
  LayoutDashboard,
  ListTodo,
  LockKeyhole,
  LogOut,
  Mail,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserRound,
  X,
} from "lucide-react";

import "./App.css";

const API = axios.create({
  baseURL: "http://localhost:5000/api",
});

function readStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("assignEaseUser") || "null");
  } catch {
    return null;
  }
}

function formatDate(date) {
  if (!date) return "No date";

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

function getLocalDateTime(date) {
  const pad = (number) => String(number).padStart(2, "0");

  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

function emptyAssignmentForm() {
  const deadline = new Date();

  deadline.setDate(deadline.getDate() + 2);
  deadline.setHours(23, 59, 0, 0);

  return {
    title: "",
    subject: "",
    description: "",
    deadline: getLocalDateTime(deadline),
  };
}

function getGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";

  return "Good evening";
}

function getDeadlineStatus(assignment) {
  if (assignment.completed) return "Completed";

  if (new Date(assignment.deadline).getTime() < Date.now()) {
    return "Overdue";
  }

  return "Pending";
}

function App() {
  // ==================== AUTHENTICATION STATE ====================

  const [token, setToken] = useState(
    () => localStorage.getItem("assignEaseToken") || ""
  );

  const [user, setUser] = useState(readStoredUser);

  const [authMode, setAuthMode] = useState("login");

  const [authForm, setAuthForm] = useState({
    name: "",
    email: "",
    password: "",
  });

  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");

  // ==================== DASHBOARD STATE ====================

  const [assignments, setAssignments] = useState([]);

  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [dataError, setDataError] = useState("");

  const [notice, setNotice] = useState("");

  const [activeFilter, setActiveFilter] = useState("All");
  const [search, setSearch] = useState("");

  // ==================== ASSIGNMENT FORM STATE ====================

  const [showForm, setShowForm] = useState(false);

  const [editingId, setEditingId] = useState(null);

  const [assignmentForm, setAssignmentForm] = useState(
    emptyAssignmentForm
  );

  const [formError, setFormError] = useState("");
  const [savingAssignment, setSavingAssignment] = useState(false);

  // ==================== LOAD ASSIGNMENTS ====================

  useEffect(() => {
    if (!token) {
      setAssignments([]);
      setLoadingAssignments(false);
      return;
    }

    let cancelled = false;

    async function loadAssignments() {
      setLoadingAssignments(true);
      setDataError("");

      try {
        const response = await API.get("/assignments", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!cancelled) {
          setAssignments(response.data);
        }
      } catch (error) {
        if (cancelled) return;

        if (error.response?.status === 401) {
          localStorage.removeItem("assignEaseToken");
          localStorage.removeItem("assignEaseUser");

          setToken("");
          setUser(null);
        } else {
          setDataError(
            error.response?.data?.message ||
              "Unable to load assignments. Check that the backend is running."
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingAssignments(false);
        }
      }
    }

    loadAssignments();

    return () => {
      cancelled = true;
    };
  }, [token]);

  // ==================== REGISTER / LOGIN ====================

  async function handleAuthSubmit(event) {
    event.preventDefault();

    setAuthError("");
    setAuthLoading(true);

    try {
      const endpoint =
        authMode === "register" ? "/register" : "/login";

      const payload =
        authMode === "register"
          ? authForm
          : {
              email: authForm.email,
              password: authForm.password,
            };

      const response = await API.post(endpoint, payload);

      const { token: newToken, user: newUser } = response.data;

      if (!newToken || !newUser) {
        throw new Error(
          "The backend did not return an authentication token."
        );
      }

      localStorage.setItem("assignEaseToken", newToken);

      localStorage.setItem(
        "assignEaseUser",
        JSON.stringify(newUser)
      );

      setToken(newToken);
      setUser(newUser);

      setAuthForm({
        name: "",
        email: "",
        password: "",
      });

      setAssignments([]);
      setDataError("");
      setActiveFilter("All");
      setShowForm(false);
    } catch (error) {
      setAuthError(
        error.response?.data?.message ||
          error.message ||
          "Could not connect to the server. Make sure your backend is running."
      );
    } finally {
      setAuthLoading(false);
    }
  }

  // ==================== LOGOUT ====================

  function handleLogout() {
    localStorage.removeItem("assignEaseToken");
    localStorage.removeItem("assignEaseUser");

    setToken("");
    setUser(null);

    setAssignments([]);
    setSearch("");
    setActiveFilter("All");

    setShowForm(false);
    setEditingId(null);

    setAuthMode("login");
    setAuthError("");
    setNotice("");
  }

  // ==================== FORM HELPERS ====================

  function openNewAssignmentForm() {
    setEditingId(null);
    setAssignmentForm(emptyAssignmentForm());

    setFormError("");
    setShowForm(true);
  }

  function openEditAssignmentForm(assignment) {
    setEditingId(assignment._id);

    setAssignmentForm({
      title: assignment.title,
      subject: assignment.subject,
      description: assignment.description || "",
      deadline: getLocalDateTime(new Date(assignment.deadline)),
    });

    setFormError("");
    setShowForm(true);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function closeAssignmentForm() {
    setShowForm(false);
    setEditingId(null);

    setAssignmentForm(emptyAssignmentForm());
    setFormError("");
  }

  // ==================== CREATE / EDIT ASSIGNMENT ====================

  async function handleAssignmentSubmit(event) {
    event.preventDefault();

    setFormError("");
    setNotice("");

    if (
      !assignmentForm.title.trim() ||
      !assignmentForm.subject.trim() ||
      !assignmentForm.deadline
    ) {
      setFormError("Please fill in the title, subject and deadline.");
      return;
    }

    const deadlineDate = new Date(assignmentForm.deadline);

    if (Number.isNaN(deadlineDate.getTime())) {
      setFormError("Please choose a valid deadline.");
      return;
    }

    const payload = {
      title: assignmentForm.title.trim(),
      subject: assignmentForm.subject.trim(),
      description: assignmentForm.description.trim(),
      deadline: deadlineDate.toISOString(),
    };

    setSavingAssignment(true);

    try {
      const config = {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      };

      if (editingId) {
        const response = await API.patch(
          `/assignments/${editingId}`,
          payload,
          config
        );

        setAssignments((previous) =>
          previous
            .map((item) =>
              item._id === editingId ? response.data : item
            )
            .sort(
              (a, b) =>
                new Date(a.deadline) - new Date(b.deadline)
            )
        );

        setNotice("Assignment updated successfully.");
      } else {
        const response = await API.post(
          "/assignments",
          payload,
          config
        );

        setAssignments((previous) =>
          [...previous, response.data].sort(
            (a, b) =>
              new Date(a.deadline) - new Date(b.deadline)
          )
        );

        setNotice("Assignment added successfully.");
      }

      closeAssignmentForm();
    } catch (error) {
      setFormError(
        error.response?.data?.message ||
          "Could not save the assignment. Please try again."
      );
    } finally {
      setSavingAssignment(false);
    }
  }

  // ==================== MARK COMPLETE / PENDING ====================

  async function toggleAssignment(assignment) {
    setNotice("");

    try {
      const response = await API.patch(
        `/assignments/${assignment._id}`,
        {
          completed: !assignment.completed,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setAssignments((previous) =>
        previous.map((item) =>
          item._id === assignment._id ? response.data : item
        )
      );

      setNotice(
        response.data.completed
          ? "Assignment marked as completed."
          : "Assignment moved back to pending."
      );
    } catch (error) {
      setNotice(
        error.response?.data?.message ||
          "Could not update the assignment."
      );
    }
  }

  // ==================== DELETE ASSIGNMENT ====================

  async function deleteAssignment(assignment) {
    const confirmed = window.confirm(
      `Delete "${assignment.title}"? This action cannot be undone.`
    );

    if (!confirmed) return;

    setNotice("");

    try {
      await API.delete(`/assignments/${assignment._id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setAssignments((previous) =>
        previous.filter((item) => item._id !== assignment._id)
      );

      setNotice("Assignment deleted successfully.");
    } catch (error) {
      setNotice(
        error.response?.data?.message ||
          "Could not delete the assignment."
      );
    }
  }

  // ==================== DASHBOARD STATISTICS ====================

  const stats = useMemo(() => {
    const total = assignments.length;

    const completed = assignments.filter(
      (item) => item.completed
    ).length;

    const pending = assignments.filter(
      (item) => !item.completed
    ).length;

    const overdue = assignments.filter(
      (item) => getDeadlineStatus(item) === "Overdue"
    ).length;

    return {
      total,
      completed,
      pending,
      overdue,
    };
  }, [assignments]);

  // ==================== SEARCH + FILTER ====================

  const filteredAssignments = useMemo(() => {
    return assignments
      .filter((assignment) => {
        const status = getDeadlineStatus(assignment);

        if (activeFilter === "Pending" && assignment.completed) {
          return false;
        }

        if (activeFilter === "Completed" && !assignment.completed) {
          return false;
        }

        if (activeFilter === "Overdue" && status !== "Overdue") {
          return false;
        }

        const query = search.trim().toLowerCase();

        if (!query) return true;

        return [
          assignment.title,
          assignment.subject,
          assignment.description,
        ].some((value) =>
          (value || "").toLowerCase().includes(query)
        );
      })
      .sort(
        (a, b) =>
          new Date(a.deadline) - new Date(b.deadline)
      );
  }, [assignments, activeFilter, search]);

  const upcomingAssignments = useMemo(() => {
    return assignments
      .filter(
        (assignment) =>
          !assignment.completed &&
          new Date(assignment.deadline).getTime() >= Date.now()
      )
      .sort(
        (a, b) =>
          new Date(a.deadline) - new Date(b.deadline)
      )
      .slice(0, 3);
  }, [assignments]);

  // ==================== LOGIN / REGISTER PAGE ====================

  if (!token || !user) {
    return (
      <div className="auth-page">
        <section className="auth-visual">
          <div className="brand">
            <div className="brand-icon">
              <BookOpen size={23} />
            </div>

            <span>
              assign<span className="brand-accent">ease</span>
            </span>
          </div>

          <div className="auth-hero">
            <div className="eyebrow light-eyebrow">
              <Sparkles size={14} />
              YOUR ACADEMIC WORKSPACE
            </div>

            <h1>
              Less stress.
              <br />
              <span>More progress.</span>
            </h1>

            <p>
              All your assignments, deadlines and academic goals
              in one organized place. Get focused and get things
              done.
            </p>

            <div className="auth-benefits">
              <div>
                <span className="benefit-icon">
                  <Check size={16} />
                </span>
                Stay ahead of every deadline
              </div>

              <div>
                <span className="benefit-icon">
                  <Check size={16} />
                </span>
                Track your daily progress
              </div>

              <div>
                <span className="benefit-icon">
                  <Check size={16} />
                </span>
                Keep your academic work organized
              </div>
            </div>

            <div className="auth-quote">
              <div className="quote-stars">★★★★★</div>

              <p>
                “A little organization goes a long way.”
              </p>

              <span>YOUR JOURNEY, YOUR PACE</span>
            </div>
          </div>

          <div className="auth-visual-footer">
            © 2026 ASSIGN-EASE
            <span>Built for better study habits.</span>
          </div>
        </section>

        <section className="auth-panel">
          <div className="auth-panel-top">
            <span className="secure-label">
              <ShieldCheck size={16} />
              PERSONAL WORKSPACE
            </span>

            <span className="auth-step">
              {authMode === "login" ? "01 / 02" : "02 / 02"}
            </span>
          </div>

          <div className="auth-form-container">
            <div className="auth-heading-icon">
              {authMode === "login" ? (
                <LockKeyhole size={22} />
              ) : (
                <UserRound size={22} />
              )}
            </div>

            <p className="section-kicker">
              {authMode === "login" ? "WELCOME BACK" : "GET STARTED"}
            </p>

            <h2>
              {authMode === "login"
                ? "Good to see you."
                : "Create your account."}
            </h2>

            <p className="auth-subtitle">
              {authMode === "login"
                ? "Sign in to pick up where you left off."
                : "Set up your workspace and organize your assignments."}
            </p>

            {authError && (
              <div className="error-message">
                <AlertCircle size={17} />
                <span>{authError}</span>
              </div>
            )}

            <form onSubmit={handleAuthSubmit} className="auth-form">
              {authMode === "register" && (
                <label className="field-label">
                  Full name

                  <div className="input-wrap">
                    <UserRound size={18} />

                    <input
                      type="text"
                      placeholder="Enter your full name"
                      value={authForm.name}
                      onChange={(event) =>
                        setAuthForm({
                          ...authForm,
                          name: event.target.value,
                        })
                      }
                      autoComplete="name"
                      required
                    />
                  </div>
                </label>
              )}

              <label className="field-label">
                Email address

                <div className="input-wrap">
                  <Mail size={18} />

                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={authForm.email}
                    onChange={(event) =>
                      setAuthForm({
                        ...authForm,
                        email: event.target.value,
                      })
                    }
                    autoComplete="email"
                    required
                  />
                </div>
              </label>

              <label className="field-label">
                Password

                <div className="input-wrap">
                  <LockKeyhole size={18} />

                  <input
                    type="password"
                    placeholder={
                      authMode === "register"
                        ? "At least 8 characters"
                        : "Enter your password"
                    }
                    value={authForm.password}
                    onChange={(event) =>
                      setAuthForm({
                        ...authForm,
                        password: event.target.value,
                      })
                    }
                    autoComplete={
                      authMode === "login"
                        ? "current-password"
                        : "new-password"
                    }
                    minLength={8}
                    required
                  />
                </div>
              </label>

              <button
                type="submit"
                className="primary-button auth-submit"
                disabled={authLoading}
              >
                {authLoading
                  ? "Please wait..."
                  : authMode === "login"
                    ? "Sign in to dashboard"
                    : "Create my account"}

                {!authLoading && <ArrowRight size={18} />}
              </button>
            </form>

            <div className="auth-divider">
              <span />
              <p>YOUR WORKSPACE AWAITS</p>
              <span />
            </div>

            <p className="auth-switch">
              {authMode === "login"
                ? "New to Assign-Ease?"
                : "Already have an account?"}

              <button
                type="button"
                onClick={() => {
                  setAuthMode(
                    authMode === "login" ? "register" : "login"
                  );

                  setAuthError("");
                }}
              >
                {authMode === "login" ? "Create account" : "Sign in"}
              </button>
            </p>

            <p className="auth-privacy">
              <ShieldCheck size={14} />
              Your account is protected with password hashing.
            </p>
          </div>
        </section>
      </div>
    );
  }

  // ==================== MAIN DASHBOARD ====================

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand sidebar-brand">
          <div className="brand-icon">
            <BookOpen size={23} />
          </div>

          <span>
            assign<span className="brand-accent">ease</span>
          </span>
        </div>

        <div className="workspace-chip">
          <div className="workspace-dot" />

          <div>
            <strong>My workspace</strong>
            <span>Personal account</span>
          </div>
        </div>

        <p className="sidebar-label">WORKSPACE</p>

        <nav className="sidebar-nav">
          <button
            type="button"
            className="nav-item active"
          >
            <LayoutDashboard size={18} />
            <span>Overview</span>
          </button>

          <button
            type="button"
            className={`nav-item ${
              activeFilter === "All" ? "nav-selected" : ""
            }`}
            onClick={() => setActiveFilter("All")}
          >
            <ListTodo size={18} />
            <span>All assignments</span>

            <span className="nav-count">{stats.total}</span>
          </button>

          <button
            type="button"
            className={`nav-item ${
              activeFilter === "Pending" ? "nav-selected" : ""
            }`}
            onClick={() => setActiveFilter("Pending")}
          >
            <Circle size={18} />
            <span>Pending</span>

            <span className="nav-count">{stats.pending}</span>
          </button>

          <button
            type="button"
            className={`nav-item ${
              activeFilter === "Completed" ? "nav-selected" : ""
            }`}
            onClick={() => setActiveFilter("Completed")}
          >
            <CheckCircle2 size={18} />
            <span>Completed</span>
          </button>

          <button
            type="button"
            className={`nav-item ${
              activeFilter === "Overdue" ? "nav-selected" : ""
            }`}
            onClick={() => setActiveFilter("Overdue")}
          >
            <Clock3 size={18} />
            <span>Overdue</span>

            {stats.overdue > 0 && (
              <span className="nav-alert">{stats.overdue}</span>
            )}
          </button>
        </nav>

        <div className="sidebar-spacer" />

        <div className="sidebar-tip">
          <div className="tip-icon">
            <Sparkles size={17} />
          </div>

          <strong>Small steps add up.</strong>

          <p>
            Finish one task at a time. Your progress will follow.
          </p>
        </div>

        <div className="sidebar-profile">
          <div className="profile-avatar">
            {(user.name || "U").charAt(0).toUpperCase()}
          </div>

          <div className="profile-details">
            <strong>{user.name}</strong>
            <span>{user.email}</span>
          </div>

          <button
            type="button"
            className="icon-button logout-button"
            onClick={handleLogout}
            title="Log out"
            aria-label="Log out"
          >
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Workspace</span>

            <span className="breadcrumb-separator">/</span>

            <strong>Overview</strong>
          </div>

          <div className="topbar-right">
            <span className="local-status">
              <span className="status-dot" />
              Workspace active
            </span>

            <div className="topbar-avatar">
              {(user.name || "U").charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        <div className="page-content">
          <section className="welcome-row">
            <div>
              <div className="section-kicker welcome-kicker">
                {new Intl.DateTimeFormat("en-IN", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                }).format(new Date()).toUpperCase()}
              </div>

              <h1>
                {getGreeting()},{" "}
                <span className="welcome-name">
                  {user.name.split(" ")[0]}
                </span>
                <span className="wave">✦</span>
              </h1>

              <p className="welcome-description">
                Here's your academic overview. Let's make today count.
              </p>
            </div>

            <button
              type="button"
              className="primary-button new-assignment-button"
              onClick={openNewAssignmentForm}
            >
              <Plus size={19} />
              New assignment
            </button>
          </section>

          {notice && (
            <div className="notice-message">
              <CheckCircle2 size={18} />

              <span>{notice}</span>

              <button
                type="button"
                onClick={() => setNotice("")}
                aria-label="Dismiss message"
              >
                <X size={16} />
              </button>
            </div>
          )}

          {dataError && (
            <div className="error-message dashboard-error">
              <AlertCircle size={18} />
              {dataError}
            </div>
          )}

          {/* Statistics */}

          <section className="stats-grid">
            <div className="stat-card">
              <div className="stat-top">
                <div className="stat-icon icon-purple">
                  <FileText size={21} />
                </div>

                <span className="stat-label">ALL TIME</span>
              </div>

              <div className="stat-bottom">
                <div>
                  <h2>{stats.total}</h2>
                  <p>Total assignments</p>
                </div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-top">
                <div className="stat-icon icon-orange">
                  <Clock3 size={21} />
                </div>

                <span className="stat-label">IN PROGRESS</span>
              </div>

              <div className="stat-bottom">
                <div>
                  <h2>{stats.pending}</h2>
                  <p>Pending tasks</p>
                </div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-top">
                <div className="stat-icon icon-green">
                  <CheckCircle2 size={21} />
                </div>

                <span className="stat-label">ACCOMPLISHED</span>
              </div>

              <div className="stat-bottom">
                <div>
                  <h2>{stats.completed}</h2>
                  <p>Completed tasks</p>
                </div>

                <span className="stat-percentage">
                  {stats.total > 0
                    ? Math.round(
                        (stats.completed / stats.total) * 100
                      )
                    : 0}
                  %
                </span>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-top">
                <div className="stat-icon icon-red">
                  <CalendarDays size={21} />
                </div>

                <span className="stat-label">NEEDS ATTENTION</span>
              </div>

              <div className="stat-bottom">
                <div>
                  <h2>{stats.overdue}</h2>
                  <p>Overdue tasks</p>
                </div>
              </div>
            </div>
          </section>

          {/* Add / Edit Form */}

          {showForm && (
            <section className="assignment-form-card">
              <div className="form-card-heading">
                <div>
                  <div className="section-kicker">
                    ASSIGNMENT DETAILS
                  </div>

                  <h2>
                    {editingId ? "Edit assignment" : "Create an assignment"}
                  </h2>

                  <p>
                    Add the details below to keep your work organized.
                  </p>
                </div>

                <button
                  type="button"
                  className="icon-button close-form-button"
                  onClick={closeAssignmentForm}
                  aria-label="Close form"
                >
                  <X size={19} />
                </button>
              </div>

              {formError && (
                <div className="error-message">
                  <AlertCircle size={17} />
                  {formError}
                </div>
              )}

              <form
                className="assignment-form"
                onSubmit={handleAssignmentSubmit}
              >
                <div className="form-fields-grid">
                  <label className="field-label">
                    Assignment title

                    <input
                      type="text"
                      placeholder="e.g. Data Structures Lab"
                      value={assignmentForm.title}
                      onChange={(event) =>
                        setAssignmentForm({
                          ...assignmentForm,
                          title: event.target.value,
                        })
                      }
                      maxLength={120}
                      required
                    />
                  </label>

                  <label className="field-label">
                    Subject

                    <input
                      type="text"
                      placeholder="e.g. Computer Science"
                      value={assignmentForm.subject}
                      onChange={(event) =>
                        setAssignmentForm({
                          ...assignmentForm,
                          subject: event.target.value,
                        })
                      }
                      maxLength={100}
                      required
                    />
                  </label>

                  <label className="field-label">
                    Deadline

                    <input
                      type="datetime-local"
                      value={assignmentForm.deadline}
                      onChange={(event) =>
                        setAssignmentForm({
                          ...assignmentForm,
                          deadline: event.target.value,
                        })
                      }
                      required
                    />
                  </label>

                  <label className="field-label">
                    Description

                    <textarea
                      placeholder="Add instructions or notes..."
                      value={assignmentForm.description}
                      onChange={(event) =>
                        setAssignmentForm({
                          ...assignmentForm,
                          description: event.target.value,
                        })
                      }
                      maxLength={2000}
                      rows={3}
                    />
                  </label>
                </div>

                <div className="form-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={closeAssignmentForm}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="primary-button"
                    disabled={savingAssignment}
                  >
                    {savingAssignment
                      ? "Saving..."
                      : editingId
                        ? "Save changes"
                        : "Create assignment"}

                    {!savingAssignment && <ArrowRight size={17} />}
                  </button>
                </div>
              </form>
            </section>
          )}

          {/* Main Content */}

          <section className="content-grid">
            <div className="assignments-panel">
              <div className="panel-heading">
                <div>
                  <h2>Your assignments</h2>

                  <p>
                    Every task is a step toward your goals.
                  </p>
                </div>

                <span className="total-pill">
                  {filteredAssignments.length}{" "}
                  {filteredAssignments.length === 1 ? "task" : "tasks"}
                </span>
              </div>

              <div className="assignment-toolbar">
                <div className="search-box">
                  <Search size={18} />

                  <input
                    type="search"
                    placeholder="Search assignments..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    aria-label="Search assignments"
                  />

                  {search && (
                    <button
                      type="button"
                      className="clear-search"
                      onClick={() => setSearch("")}
                      aria-label="Clear search"
                    >
                      <X size={15} />
                    </button>
                  )}
                </div>

                <div className="filter-tabs">
                  {["All", "Pending", "Completed", "Overdue"].map(
                    (filter) => (
                      <button
                        key={filter}
                        type="button"
                        className={
                          activeFilter === filter ? "filter-active" : ""
                        }
                        onClick={() => setActiveFilter(filter)}
                      >
                        {filter}
                      </button>
                    )
                  )}
                </div>
              </div>

              {loadingAssignments ? (
                <div className="empty-state">
                  <div className="empty-state-icon">
                    <Clock3 size={27} />
                  </div>

                  <h3>Loading assignments...</h3>

                  <p>Fetching your latest work from the database.</p>
                </div>
              ) : filteredAssignments.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">
                    {search ? (
                      <Search size={27} />
                    ) : (
                      <FileText size={27} />
                    )}
                  </div>

                  <h3>
                    {search
                      ? "No matching assignments"
                      : activeFilter === "All"
                        ? "Your workspace is ready"
                        : `No ${activeFilter.toLowerCase()} assignments`}
                  </h3>

                  <p>
                    {search
                      ? "Try another search term."
                      : activeFilter === "All"
                        ? "Add your first assignment and start organizing your work."
                        : "You're all caught up in this category."}
                  </p>

                  {!search && activeFilter === "All" && (
                    <button
                      type="button"
                      className="primary-button empty-state-button"
                      onClick={openNewAssignmentForm}
                    >
                      <Plus size={17} />
                      Add your first task
                    </button>
                  )}
                </div>
              ) : (
                <div className="assignment-list">
                  {filteredAssignments.map((assignment) => {
                    const status = getDeadlineStatus(assignment);

                    return (
                      <article
                        className={`assignment-card ${
                          assignment.completed ? "is-completed" : ""
                        }`}
                        key={assignment._id}
                      >
                        <button
                          type="button"
                          className={`completion-button ${
                            assignment.completed ? "checked" : ""
                          }`}
                          onClick={() => toggleAssignment(assignment)}
                          title={
                            assignment.completed
                              ? "Mark as pending"
                              : "Mark as completed"
                          }
                          aria-label={
                            assignment.completed
                              ? "Mark as pending"
                              : "Mark as completed"
                          }
                        >
                          {assignment.completed ? (
                            <CheckCircle2 size={22} />
                          ) : (
                            <Circle size={22} />
                          )}
                        </button>

                        <div className="assignment-main">
                          <div className="assignment-meta">
                            <span className="subject-badge">
                              {assignment.subject}
                            </span>

                            <span
                              className={`status-badge status-${status.toLowerCase()}`}
                            >
                              <span />
                              {status}
                            </span>
                          </div>

                          <h3>{assignment.title}</h3>

                          {assignment.description && (
                            <p className="assignment-description">
                              {assignment.description}
                            </p>
                          )}

                          <div className="assignment-footer">
                            <span
                              className={`deadline-text ${
                                status === "Overdue" ? "deadline-overdue" : ""
                              }`}
                            >
                              <CalendarDays size={15} />

                              {status === "Overdue" ? "Was due " : "Due "}

                              {formatDate(assignment.deadline)}
                            </span>
                          </div>
                        </div>

                        <div className="assignment-actions">
                          <button
                            type="button"
                            className="icon-button"
                            onClick={() =>
                              openEditAssignmentForm(assignment)
                            }
                            title="Edit assignment"
                            aria-label="Edit assignment"
                          >
                            <Pencil size={16} />
                          </button>

                          <button
                            type="button"
                            className="icon-button delete-action"
                            onClick={() => deleteAssignment(assignment)}
                            title="Delete assignment"
                            aria-label="Delete assignment"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}

              <div className="assignment-panel-footer">
                <span>
                  <ShieldCheck size={15} />
                  Your assignments are saved to your database.
                </span>
              </div>
            </div>

            {/* Right Side */}

            <aside className="right-column">
              <section className="focus-card">
                <div className="focus-decor focus-decor-one" />
                <div className="focus-decor focus-decor-two" />

                <div className="focus-card-content">
                  <div className="focus-icon">
                    <Sparkles size={19} />
                  </div>

                  <p className="focus-label">YOUR FOCUS</p>

                  <h2>
                    Progress over
                    <br />
                    perfection.
                  </h2>

                  <p className="focus-description">
                    Consistency beats last-minute stress. Keep showing up
                    for your goals.
                  </p>

                  <div className="focus-progress">
                    <div>
                      <span>Completion rate</span>

                      <strong>
                        {stats.total > 0
                          ? Math.round(
                              (stats.completed / stats.total) * 100
                            )
                          : 0}
                        %
                      </strong>
                    </div>

                    <div className="progress-track">
                      <div
                        className="progress-fill"
                        style={{
                          width: `${
                            stats.total > 0
                              ? (stats.completed / stats.total) * 100
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </section>

              <section className="upcoming-panel">
                <div className="upcoming-heading">
                  <div>
                    <p className="section-kicker">STAY PREPARED</p>

                    <h2>Upcoming deadlines</h2>
                  </div>

                  <div className="upcoming-icon">
                    <CalendarDays size={19} />
                  </div>
                </div>

                {upcomingAssignments.length === 0 ? (
                  <div className="upcoming-empty">
                    <CheckCircle2 size={22} />

                    <p>
                      No upcoming deadlines. Add a task when you're ready.
                    </p>
                  </div>
                ) : (
                  <div className="upcoming-list">
                    {upcomingAssignments.map((assignment) => (
                      <div
                        className="upcoming-item"
                        key={assignment._id}
                      >
                        <div className="upcoming-date">
                          <span>
                            {new Date(
                              assignment.deadline
                            ).toLocaleDateString("en-IN", {
                              day: "2-digit",
                            })}
                          </span>

                          <small>
                            {new Date(
                              assignment.deadline
                            ).toLocaleDateString("en-IN", {
                              month: "short",
                            })}
                          </small>
                        </div>

                        <div className="upcoming-details">
                          <strong>{assignment.title}</strong>

                          <span>{assignment.subject}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  className="text-action"
                  onClick={() => {
                    setActiveFilter("Pending");
                    window.scrollTo({
                      top: 0,
                      behavior: "smooth",
                    });
                  }}
                >
                  View pending tasks
                  <ArrowRight size={16} />
                </button>
              </section>

              <section className="productivity-tip">
                <div className="productivity-icon">
                  <BookOpen size={19} />
                </div>

                <div>
                  <strong>A little study tip</strong>

                  <p>
                    Break a big assignment into smaller tasks. Starting
                    becomes much easier.
                  </p>
                </div>
              </section>
            </aside>
          </section>

          <footer className="page-footer">
            <span>ASSIGN-EASE</span>

            <span>
              Built for your next big achievement. <span>✦</span>
            </span>
          </footer>
        </div>
      </main>
    </div>
  );
}

export default App;