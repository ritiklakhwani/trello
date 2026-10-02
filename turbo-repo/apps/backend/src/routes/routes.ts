import { Router } from "express";
import type { Request, Response } from "express";
import { prisma } from "db/client";
import { authMiddleware } from "../middleware";
import {
  CreateOrgSchema,
  OrgNameSchema,
  InviteSchema,
  CreateBoardSchema,
  CreateIssueSchema,
  UpdateBoardSchema,
  acceptSchema,
  CreateSectionSchema,
  UpdateSectionSchema,
} from "../types";
import { Resend } from "resend";
import { success } from "zod";
import { tr } from "zod/locales";

export const router = Router();
const resend = new Resend(process.env.RESEND_API_KEY);

router.post(
  "/create/org",
  authMiddleware,
  async (req: Request, res: Response) => {
    const parsed = CreateOrgSchema.safeParse(req.body);

    if (!parsed.success)
      return res.status(401).json({ success: false, msg: "invalid input!" });

    const { name, description } = parsed.data;

    const existing = await prisma.organization.findUnique({
      where: { name: name },
    });

    if (existing)
      return res.status(401).json({
        success: false,
        msg: "org already exists try using different name!",
      });

    const Org = await prisma.$transaction(async (tx) => {
      const created = await tx.organization.create({
        data: { name: name, description: description },
      });

      const Membership = await tx.membership.create({
        data: {
          userId: req.userId,
          orgId: created.id,
          role: "ADMIN",
          accepted: true,
        },
      });

      return { created, Membership };
    });

    res.status(201).json({
      success: true,
      msg: "org created successfully!",
      data: Org,
      admin: req.userId,
    });
  },
);

router.get("/org", authMiddleware, async (req: Request, res: Response) => {
  const exists = await prisma.membership.findMany({
    where: { userId: req.userId },
    select: { org: { select: { id: true, name: true, description: true } } },
  });

  if (!exists || exists.length === 0)
    return res.status(401).json({
      success: false,
      msg: `no orgs exists for userId: ${req.userId}`,
    });

  return res.status(201).json({
    success: true,
    data: exists,
  });
});

router.delete("/org", authMiddleware, async (req: Request, res: Response) => {
  const parsed = OrgNameSchema.safeParse(req.body);

  if (!parsed.success)
    return res.status(403).json({
      success: false,
      msg: "invalid input!",
    });

  const { name } = parsed.data;

  const org = await prisma.organization.findUnique({
    where: { name: name },
  });

  if (!org)
    return res.status(401).json({
      success: false,
      msg: "org not found!",
    });

  const membership = await prisma.membership.findUnique({
    where: {
      userId_orgId: { userId: req.userId, orgId: org.id },
    },
  });

  if (!membership || membership.role !== "ADMIN")
    return res.status(401).json({
      success: false,
      msg: "membership not verified!",
    });

  await prisma.organization.delete({
    where: { id: org.id },
  });

  return res.status(200).json({
    success: true,
    msg: `deleted org with orgId ${org.id} and name ${org.name} `,
  });
});

router.post(
  "/org/:orgId/boards",
  authMiddleware,
  async (req: Request, res: Response) => {
    const parsed = CreateBoardSchema.safeParse(req.body);

    if (!parsed.success)
      return res.status(401).json({
        success: false,
        msg: "invalid input!",
      });

    const orgId = Number(req.params.orgId);

    const { title } = parsed.data;

    const membership = await prisma.membership.findUnique({
      where: {
        userId_orgId: { userId: req.userId, orgId: orgId },
      },
    });

    if (!membership || membership.role !== "ADMIN")
      return res.status(401).json({
        success: false,
        msg: "you are not an admin of this org!",
      });

    const createBoard = await prisma.board.create({
      data: {
        title,
        organizationId: orgId,
      },
    });

    return res.status(201).json({
      success: true,
      msg: "board created succesfully!",
      data: createBoard,
    });
  },
);

router.get(
  "/org/:orgId/boards",
  authMiddleware,
  async (req: Request, res: Response) => {
    const orgId = Number(req.params.orgId);

    if (!Number.isInteger(orgId)) {
      return res.status(400).json({
        success: false,
        msg: "Invalid organization ID",
      });
    }
    const membership = await prisma.membership.findUnique({
      where: {
        userId_orgId: { userId: req.userId, orgId: orgId },
      },
    });

    if (!membership)
      return res.status(403).json({
        success: false,
        msg: `membership doesnt exists!`,
      });

    const board = await prisma.board.findMany({
      where: {
        organizationId: orgId,
      },
    });

    if (board.length === 0)
      return res.status(403).json({
        success: false,
        msg: `no board exists in this org`,
      });

    return res.status(200).json({
      data: board,
    });
  },
);

router.delete(
  "/org/:orgId/boards/:boardId",
  authMiddleware,
  async (req: Request, res: Response) => {
    const orgId = Number(req.params.orgId);
    const boardId = Number(req.params.boardId);

    if (!Number.isInteger(orgId) || !Number.isInteger(boardId)) {
      return res.status(400).json({
        success: false,
        msg: "Invalid organization ID or board ID",
      });
    }

    const membership = await prisma.membership.findUnique({
      where: {
        userId_orgId: { userId: req.userId, orgId: orgId },
      },
    });

    if (!membership || membership.role !== "ADMIN")
      return res.status(403).json({
        success: false,
        msg: `membership doesnt exists!`,
      });

    const board = await prisma.board.findUnique({
      where: {
        id: boardId,
        organizationId: orgId,
      },
    });

    if (!board || board.organizationId !== orgId)
      return res.status(403).json({
        success: false,
        msg: `board doesnt exists!`,
      });

    await prisma.board.delete({
      where: {
        id: boardId,
        organizationId: orgId,
      },
    });

    return res.status(201).json({
      success: true,
      msg: `board with board id ${boardId} deleted successfully`,
    });
  },
);

router.put(
  "/org/:orgId/boards/:boardId",
  authMiddleware,
  async (req: Request, res: Response) => {
    const orgId = Number(req.params.orgId);
    const boardId = Number(req.params.boardId);
    const parsed = UpdateBoardSchema.safeParse(req.body);

    if (
      !Number.isInteger(orgId) ||
      !Number.isInteger(boardId) ||
      !parsed.success
    ) {
      return res.status(400).json({
        success: false,
        msg: "Invalid organization ID or board ID or invalid input",
      });
    }

    const { title } = parsed.data;

    const membership = await prisma.membership.findUnique({
      where: {
        userId_orgId: { userId: req.userId, orgId: orgId },
      },
    });

    if (!membership || membership.role !== "ADMIN")
      return res.status(403).json({
        success: false,
        msg: `membership doesnt exists!`,
      });

    const board = await prisma.board.findFirst({
      where: {
        id: boardId,
        organizationId: orgId,
      },
    });

    if (!board)
      return res.status(403).json({
        success: false,
        msg: `Board doesn't exist in this organization!`,
      });

    await prisma.board.update({
      where: {
        id: boardId,
        organizationId: orgId,
      },

      data: {
        title,
      },
    });

    return res.status(201).json({
      success: true,
      msg: `board with board id ${boardId} updated successfully`,
    });
  },
);

router.post(
  "/org/invite",
  authMiddleware,
  async (req: Request, res: Response) => {
    const parsed = InviteSchema.safeParse(req.body);

    if (!parsed.success)
      return res.status(401).json({
        success: false,
        msg: "invalid input!",
      });

    const { email, orgName } = parsed.data;

    const verify = await prisma.organization.findUnique({
      where: { name: orgName },
    });

    if (!verify)
      return res.status(401).json({
        success: false,
        msg: "org does not exists!",
      });

    const membership = await prisma.membership.findUnique({
      where: { userId_orgId: { userId: req.userId, orgId: verify.id } },
    });

    if (!membership || membership.role !== "ADMIN")
      return res.status(401).json({
        success: false,
        msg: "user not found or not authorized to invite!",
      });

    const user = await prisma.user.findUnique({
      where: { email: email },
    });

    if (!user)
      return res.status(401).json({
        success: false,
        msg: "user does not exists!",
      });

    const userJoined = await prisma.membership.findUnique({
      where: {
        userId_orgId: { userId: user.id, orgId: verify.id },
      },
    });

    if (userJoined)
      return res.status(401).json({
        success: false,
        msg: "user already joined!",
      });

    const existingInvite = await prisma.invitation.findFirst({
      where: {
        email,
        organizationId: verify.id,
        status: "PENDING",
      },
    });

    if (existingInvite)
      return res.status(401).json({
        success: false,
        msg: "Invitation already sent to this user!",
      });

    const inviteToken = crypto.randomUUID();

    const inviteLink = `http://localhost:3000/invite/${inviteToken}`;

    const invite = await prisma.invitation.create({
      data: {
        email,
        token: inviteToken,
        organizationId: verify.id,
        invitedById: membership.userId,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    if (!invite)
      return res.status(401).json({
        success: false,
        msg: "invitation is not saved in db!",
      });

    const { data, error } = await resend.emails.send({
      from: "ritiklakhwani28@gmail.com",
      to: [email],
      subject: `you are invited to join ${orgName}`,
      html: `
    <h2>You've been invited to ${orgName}</h2>
    <p>Click below to accept the invitation:</p>
    <a href="${inviteLink}">Accept Invite</a>
  `,
    });

    if (error) {
      return res.status(400).json({ error });
    }

    return res
      .status(200)
      .json({ success: true, data: "invitation sent successfully!" });
  },
);

router.post(
  "/org/accept",
  authMiddleware,
  async (req: Request, res: Response) => {
    const parsed = acceptSchema.safeParse(req.body);

    if (!parsed.success)
      return res.status(401).json({
        success: false,
        msg: "invalid input!",
      });

    const { token } = parsed.data;

    const Invitation = await prisma.invitation.findUnique({
      where: {
        token,
      },
    });

    if (!Invitation)
      return res.status(401).json({
        success: false,
        msg: "Invitation not found!",
      });

    if (Invitation.status !== "PENDING") {
      return res.status(400).json({
        success: false,
        msg: "Invitation is no longer valid!",
      });
    }

    if (Invitation.expiresAt < new Date()) {
      return res.status(400).json({
        success: false,
        msg: "Invitation has expired!",
      });
    }

    const user = await prisma.user.findUnique({
      where: {
        id: req.userId,
      },
    });

    if (!user || user.email !== Invitation.email) {
      return res.status(403).json({
        success: false,
        msg: "This invitation was not sent to your email!",
      });
    }

    const existing = await prisma.membership.findUnique({
      where: {
        userId_orgId: { userId: req.userId, orgId: Invitation.organizationId },
      },
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        msg: "You are already a member of this organization!",
      });
    }

    await prisma.membership.create({
      data: {
        userId: req.userId,
        orgId: Invitation.organizationId,
        role: "MEMBER",
      },
    });

    await prisma.invitation.update({
      where: {
        id: Invitation.id,
      },
      data: {
        status: "ACCEPTED",
      },
    });

    return res
      .status(200)
      .json({ success: true, data: "invitation accepted successfully!" });
  },
);

router.post(
  "/org/:orgId/boards/:boardId/section",
  authMiddleware,
  async (req: Request, res: Response) => {
    const orgId = Number(req.params.orgId);
    const boardId = Number(req.params.boardId);
    const parsed = CreateSectionSchema.safeParse(req.body);

    if (
      !Number.isInteger(orgId) ||
      !Number.isInteger(boardId) ||
      !parsed.success
    ) {
      return res.status(400).json({
        success: false,
        msg: "Invalid organization ID or board ID or invalid input",
      });
    }

    const { title } = parsed.data;

    const board = await prisma.board.findFirst({
      where: {
        id: boardId,
        organizationId: orgId,
      },
    });

    if (!board)
      return res.status(400).json({
        success: false,
        msg: "board does not belong to this org",
      });

    const membership = await prisma.membership.findUnique({
      where: {
        userId_orgId: { userId: req.userId, orgId: orgId },
      },
    });

    if (!membership)
      return res.status(403).json({
        success: false,
        msg: "you are not a member of this org",
      });

    const sectionCount = await prisma.section.count({
      where: {
        boardId,
      },
    });

    await prisma.section.create({
      data: {
        title,
        boardId,
        position: sectionCount,
      },
    });
  },
);

router.put(
  "/org/:orgId/boards/:boardId/section/:sectionId",
  authMiddleware,
  async (req: Request, res: Response) => {
    const orgId = Number(req.params.orgId);
    const boardId = Number(req.params.boardId);
    const sectionId = Number(req.params.sectionId);

    const parsed = UpdateSectionSchema.safeParse(req.body);

    if (
      !Number.isInteger(orgId) ||
      !Number.isInteger(boardId) ||
      !Number.isInteger(sectionId) ||
      !parsed.success
    ) {
      return res.status(400).json({
        success: false,
        msg: "Invalid organization ID or board ID or invalid input",
      });
    }

    const { title } = parsed.data;

    const board = await prisma.board.findFirst({
      where: {
        id: boardId,
        organizationId: orgId,
      },
    });

    if (!board)
      return res.status(400).json({
        success: false,
        msg: "board does not belong to this org",
      });

    const section = await prisma.section.findFirst({
      where: {
        id: sectionId,
        boardId: board.id,
      },
    });

    if (!section)
      return res.status(400).json({
        success: false,
        msg: "this section does not belong to this board",
      });

    const membership = await prisma.membership.findUnique({
      where: {
        userId_orgId: { userId: req.userId, orgId: orgId },
      },
    });

    if (!membership)
      return res.status(403).json({
        success: false,
        msg: "you are not a member of this org",
      });

    await prisma.section.update({
      where: {
        id: section.id,
        boardId: board.id,
      },
      data: {
        title,
      },
    });
  },
);

router.delete(
  "/org/:orgId/boards/:boardId/section/:sectionId",
  authMiddleware, async(req: Request, res: Response) => {
    const orgId = Number(req.params.orgId);
    const boardId = Number(req.params.boardId);
    const sectionId = Number(req.params.sectionId);

    if (
      !Number.isInteger(orgId) ||
      !Number.isInteger(boardId) ||
      !Number.isInteger(sectionId)
    ) {
      return res.status(400).json({
        success: false,
        msg: "Invalid organization ID or board ID or invalid input",
      });
    }

    const membership = await prisma.membership.findUnique({
      where: {
        userId_orgId: { userId: req.userId, orgId: orgId },
      },
    });

    if (!membership || membership.role !== "ADMIN")
      return res.status(403).json({
        success: false,
        msg: "you are not a member of this org",
      });


    const board = await prisma.board.findFirst({
      where: {
        id: boardId,
        organizationId: orgId,
      },
    });

    if (!board)
      return res.status(400).json({
        success: false,
        msg: "board does not belong to this org",
      });

    const section = await prisma.section.findFirst({
      where: {
        id: sectionId,
        boardId: board.id,
      },
    });

    if (!section)
      return res.status(400).json({
        success: false,
        msg: "this section does not belong to this board",
      });

    await prisma.section.delete({
      where: {
        id: section.id,
      },
    });
  },
);

router.get(
  "/org/:orgId/boards/:boardId/sections",
  authMiddleware, async (req: Request, res: Response) => {
    const orgId = Number(req.params.orgId);
    const boardId = Number(req.params.boardId);
    if (
      !Number.isInteger(orgId) ||
      !Number.isInteger(boardId) ||
    ) {
      return res.status(400).json({
        success: false,
        msg: "Invalid organization ID or board ID or invalid input",
      });
    }

    const membership = await prisma.membership.findUnique({
      where: {
        userId_orgId: { userId: req.userId, orgId: orgId },
      },
    });

    if (!membership)
      return res.status(403).json({
        success: false,
        msg: "you are not a member of this org",
      });


    const board = await prisma.board.findFirst({
      where: {
        id: boardId,
        organizationId: orgId,
      },
    });

    if (!board)
      return res.status(400).json({
        success: false,
        msg: "board does not belong to this org",
      });

      const sections = await prisma.section.findMany({
        where: {
          boardId: board.id
        }
      })

      if(!sections) return res.status(403).json({
        success: false,
        msg: "this board is empty no sections are there in this!"
      })

      return res.status(200).json({
        success: true,
        data: sections
      })
  },
);

router.post(
  "/org/:orgId/boards/:boardId/section/:sectionId/issue",
  authMiddleware, async(req: Request, res: Response) => {
     const orgId = Number(req.params.orgId);
    const boardId = Number(req.params.boardId);
    const sectionId = Number(req.params.sectionId);

    const parsed = CreateIssueSchema.safeParse(req.body)

    if (
      !Number.isInteger(orgId) ||
      !Number.isInteger(boardId) ||
      !Number.isInteger(sectionId) || !parsed.success
    ) {
      return res.status(400).json({
        success: false,
        msg: "Invalid organization ID or board ID or board ID or an invalid input",
      });
    }

    const membership = await prisma.membership.findUnique({
      where: {
        userId_orgId: {
          userId: req.userId, orgId: orgId
        }
      }
    })

    const board = await prisma.board.findUnique({
      where: {
        id: boardId,
        organizationId: orgId
      }
    })

    const section = await prisma.section.findUnique({
      where: {
        id: sectionId,
        boardId: boardId
      }
    })

  },
);

router.post("/org/issue", (req: Request, res: Response) => {});
router.delete("/org/issue", (req: Request, res: Response) => {});
router.put("/org/issue/move", (req: Request, res: Response) => {});

router.get("/org/issues", (req: Request, res: Response) => {});
router.get("/org/issue/:issueId", (req: Request, res: Response) => {});

router.post("/org/comment", (req: Request, res: Response) => {});
router.put("/org/comment", (req: Request, res: Response) => {});
router.delete("/org/comment", (req: Request, res: Response) => {});
router.get("/org/comments", (req: Request, res: Response) => {});

router.delete("/org/membership", (req: Request, res: Response) => {});

router.post("/org/:assign", (req: Request, res: Response) => {});
router.delete("/org/:unassign", (req: Request, res: Response) => {});
router.get("/org/:assignedusers", (req: Request, res: Response) => {});
