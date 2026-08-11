import "dotenv/config";
import { Router } from "express";
import type { Request, Response } from "express";
import { prisma } from "db/client";
import { SignupSchema, SigninSchema } from "../types";
import bcrypt from "bcrypt";
import jwt, { sign, type JwtPayload } from "jsonwebtoken";
import { authMiddleware } from "../middleware";
import { success } from "zod";

const secret = process.env.JWT_SECRET || "";

export const authRouter = Router();

authRouter.post("/signup", async (req: Request, res: Response) => {
  const parsed = SigninSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(401).json({
      success: false,
      msg: "invalid schema or data!",
    });
  }

  const { email, password } = parsed.data;

  const existing = await prisma.user.findUnique({
    where: { email: email },
  });

  if (existing) {
    return res.status(401).json({
      success: false,
      msg: "email already signed up!",
    });
  }

  const hashed = await bcrypt.hash(password, 10);
  const User = await prisma.user.create({
    data: { email, password: hashed },
    select: { id: true, email: true },
  });

  res.status(201).json({
    success: true,
    data: {
      userId: User.id,
      email: User.email,
    },
  });
});

authRouter.post("/signin", async (req: Request, res: Response) => {
  const parsed = SigninSchema.safeParse(req.body);

  if (!parsed.success)
    return res.status(401).json({
      sucess: false,
      msg: "invalid login input!",
    });

  const { email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email: email } });

  if (!existing)
    return res.status(402).json({
      success: false,
      msg: "invalid credentials or please signup first!",
    });

  const ok = await bcrypt.compare(password, existing.password);

  if (!ok)
    return res.status(402).json({
      success: false,
      msg: "invalid credentials!",
    });

  const token = jwt.sign({ id: existing.id }, secret, { expiresIn: "7d" });

  res.status(201).json({
    success: true,
    data: {
      token: token,
      userId: existing.id,
      email: existing.email,
    },
  });
});
