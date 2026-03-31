import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "@workspace/db";
import { usersTable, userSettingsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth.js";

const router = Router();

router.post("/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      res.status(400).json({ error: "username, email and password are required" });
      return;
    }
    const existing = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1);
    if (existing.length > 0) {
      res.status(400).json({ error: "Email already registered" });
      return;
    }
    const existingUsername = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.username, username))
      .limit(1);
    if (existingUsername.length > 0) {
      res.status(400).json({ error: "Username already taken" });
      return;
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const [user] = await db
      .insert(usersTable)
      .values({ username, email, passwordHash })
      .returning();
    await db.insert(userSettingsTable).values({ userId: user.id }).onConflictDoNothing();
    const secret = process.env["JWT_SECRET"] ?? "fallback-secret";
    const token = jwt.sign({ userId: user.id }, secret, { expiresIn: "30d" });
    res.cookie("token", token, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
    res.json({ id: user.id, username: user.username, email: user.email });
  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).json({ error: "Registration failed" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: "email and password are required" });
      return;
    }
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1);
    if (!user) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }
    const secret = process.env["JWT_SECRET"] ?? "fallback-secret";
    const token = jwt.sign({ userId: user.id }, secret, { expiresIn: "30d" });
    res.cookie("token", token, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
    res.json({ id: user.id, username: user.username, email: user.email });
  } catch {
    res.status(500).json({ error: "Login failed" });
  }
});

router.post("/logout", (_req, res) => {
  res.clearCookie("token");
  res.json({ ok: true });
});

router.get("/me", requireAuth, async (req: AuthRequest, res) => {
  try {
    const [user] = await db
      .select({ id: usersTable.id, username: usersTable.username, email: usersTable.email })
      .from(usersTable)
      .where(eq(usersTable.id, req.userId!))
      .limit(1);
    if (!user) {
      res.status(401).json({ error: "User not found" });
      return;
    }
    res.json(user);
  } catch {
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

export default router;
