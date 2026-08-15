import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET!;

export const authMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const token = req.headers.authorization;

  if (!token?.startsWith("Bearer ")) {
    return res.status(401).json({ messages: "No Token" });
  }

  try {
    const payload = jwt.verify(token.slice(7), JWT_SECRET) as {
      userId: number;
    };
    req.userId = payload.userId;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid Token" });
  }
};

