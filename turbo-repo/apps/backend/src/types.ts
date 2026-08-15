
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

export const InviteSchema = z.object({
  email: z.email(), 
  orgId: z.number()
})

export const DeleteMembershipSchema = z.object({
  userId: z.number(),
  orgId: z.number()
})

export const CreateOrgSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(6)
});

export const CreateBoardSchema = z.object({
  orgId: z.number(),
  title: z.string().min(1)
})
export const UpdateBoardSchema = z.object({
  boardId: z.number(),
  title: z.string().min(1),
})

export const CreateSectionSchema = z.object({
  boardId: z.number(),
  title: z.string().min(1)
})
export const UpdateSectionSchema = z.object({
  sectionId: z.number(),
  title: z.string().min(1)
})

export const CreateIssueSchema = z.object({})
export const UpdateIssueSchema = z.object({})
export const MoveIssueSchema = z.object({})

export const CreateCommentSchema = z.object({})
export const UpdateCommentSchema = z.object({})
