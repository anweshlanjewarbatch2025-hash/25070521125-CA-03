const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

// ==================== USER MODEL ====================

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

// ==================== ASSIGNMENT MODEL ====================

const assignmentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    subject: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      default: "",
    },

    deadline: {
      type: Date,
      required: true,
    },

    completed: {
      type: Boolean,
      default: false,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

const Assignment = mongoose.model("Assignment", assignmentSchema);

// ==================== AUTHENTICATION MIDDLEWARE ====================

function authenticateToken(req, res, next) {
  const authorization = req.headers.authorization;

  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({
      message: "Please log in first",
    });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (error) {
    return res.status(401).json({
      message: "Invalid or expired token",
    });
  }
}

// ==================== REGISTER ====================

app.post("/api/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (
      typeof name !== "string" ||
      !name.trim() ||
      typeof email !== "string" ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
      typeof password !== "string" ||
      password.length < 8
    ) {
      return res.status(400).json({
        message: "Enter a valid name, email, and password of at least 8 characters",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(409).json({
        message: "Email is already registered",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
    });

    const token = jwt.sign(
      { userId: user._id.toString() },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.status(201).json({
      message: "Registration successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "Email is already registered",
      });
    }

    console.error("Registration error:", error.message);

    res.status(500).json({
      message: "Registration failed",
    });
  }
});

// ==================== LOGIN ====================

app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    const user = await User.findOne({
      email: email.trim().toLowerCase(),
    });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    const token = jwt.sign(
      { userId: user._id.toString() },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Login error:", error.message);

    res.status(500).json({
      message: "Login failed",
    });
  }
});

// ==================== GET ASSIGNMENTS ====================

app.get("/api/assignments", authenticateToken, async (req, res) => {
  try {
    const assignments = await Assignment.find({
      userId: req.user.userId,
    }).sort({ deadline: 1 });

    res.json(assignments);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Unable to fetch assignments",
    });
  }
});

// ==================== CREATE ASSIGNMENT ====================

app.post("/api/assignments", authenticateToken, async (req, res) => {
  try {
    const { title, subject, description, deadline } = req.body;

    if (
      typeof title !== "string" ||
      !title.trim() ||
      typeof subject !== "string" ||
      !subject.trim() ||
      typeof deadline !== "string" ||
      !Number.isFinite(Date.parse(deadline))
    ) {
      return res.status(400).json({
        message: "Title, subject, and a valid deadline are required",
      });
    }

    const assignment = await Assignment.create({
      title: title.trim(),
      subject: subject.trim(),
      description:
        typeof description === "string" ? description.trim() : "",
      deadline: new Date(deadline),
      userId: req.user.userId,
    });

    res.status(201).json(assignment);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Unable to create assignment",
    });
  }
});

// ==================== UPDATE ASSIGNMENT ====================

app.patch(
  "/api/assignments/:id",
  authenticateToken,
  async (req, res) => {
    try {
      const updates = {};
      const { title, subject, description, deadline, completed } = req.body;

      if (title !== undefined) {
        if (typeof title !== "string" || !title.trim()) {
          return res.status(400).json({
            message: "Title cannot be empty",
          });
        }

        updates.title = title.trim();
      }

      if (subject !== undefined) {
        if (typeof subject !== "string" || !subject.trim()) {
          return res.status(400).json({
            message: "Subject cannot be empty",
          });
        }

        updates.subject = subject.trim();
      }

      if (description !== undefined) {
        if (typeof description !== "string") {
          return res.status(400).json({
            message: "Invalid description",
          });
        }

        updates.description = description.trim();
      }

      if (deadline !== undefined) {
        if (
          typeof deadline !== "string" ||
          !Number.isFinite(Date.parse(deadline))
        ) {
          return res.status(400).json({
            message: "Invalid deadline",
          });
        }

        updates.deadline = new Date(deadline);
      }

      if (completed !== undefined) {
        if (typeof completed !== "boolean") {
          return res.status(400).json({
            message: "Invalid completion status",
          });
        }

        updates.completed = completed;
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({
          message: "No valid updates provided",
        });
      }

      const assignment = await Assignment.findOneAndUpdate(
        {
          _id: req.params.id,
          userId: req.user.userId,
        },
        updates,
        {
          new: true,
          runValidators: true,
        }
      );

      if (!assignment) {
        return res.status(404).json({
          message: "Assignment not found",
        });
      }

      res.json(assignment);
    } catch (error) {
      if (error.name === "CastError") {
        return res.status(400).json({
          message: "Invalid assignment ID",
        });
      }

      console.error(error);

      res.status(500).json({
        message: "Unable to update assignment",
      });
    }
  }
);

// ==================== DELETE ASSIGNMENT ====================

app.delete(
  "/api/assignments/:id",
  authenticateToken,
  async (req, res) => {
    try {
      const assignment = await Assignment.findOneAndDelete({
        _id: req.params.id,
        userId: req.user.userId,
      });

      if (!assignment) {
        return res.status(404).json({
          message: "Assignment not found",
        });
      }

      res.json({
        message: "Assignment deleted successfully",
      });
    } catch (error) {
      if (error.name === "CastError") {
        return res.status(400).json({
          message: "Invalid assignment ID",
        });
      }

      console.error(error);

      res.status(500).json({
        message: "Unable to delete assignment",
      });
    }
  }
);

// ==================== HOME ROUTE ====================

app.get("/", (req, res) => {
  res.send("ASSIGN-EASE Backend is Running!");
});

// ==================== START SERVER ====================

async function startServer() {
  if (!process.env.MONGO_URI || !process.env.JWT_SECRET) {
    console.error("Configure MONGO_URI and JWT_SECRET in the .env file");
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGO_URI);

    console.log("MongoDB Connected Successfully!");

    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("MongoDB Connection Error:", error.message);
    process.exit(1);
  }
}

startServer();