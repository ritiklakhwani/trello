import { Router } from "express";
import { prisma } from "db/client";
import { SignupSchema, SigninSchema } from "../types";
// import bcrypt  from "bcrypt";

export const authRouter = Router();

authRouter.post("/signup", async (req, res) => {
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

//   const hashed = await bcrypt.has;
});

authRouter.post("/signin", (req, res) => {});
