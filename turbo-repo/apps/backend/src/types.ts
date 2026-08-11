import { password } from "bun";
import { z } from "zod";

declare global {
    namespace Express {
        interface Request {
            userId: number;
        }
    }
}

export const SignupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const SigninSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const CreateOrgSchema = z.object({
  organizationId: z.number(),
  title: z.string().min(1),
});

// export const CreateBoardSchema = z.object({});
