import { Router } from "express";
import type { Request, Response } from "express";
import { prisma } from "db/client";
import { authMiddleware } from "../middleware";
import {
  CreateOrgSchema,
  OrgNameSchema,
  InviteSchema,
  CreateBoardSchema,
} from "../types";
import { Resend } from "resend";
import { success } from "zod";

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

    return res.status(401).json({
      success: true,
      msg: "board created succesfully!",
      data: createBoard,
    });
  },
);

router.get("/org/:orgId/boards", authMiddleware, async (req: Request, res: Response) => {

  const orgId = Number(req.params.orgId)

  if (!Number.isInteger(orgId)) {
  return res.status(400).json({
    success: false,
    msg: "Invalid organization ID",
  });
}
  const membership = await prisma.membership.findUnique({
    where : {
      userId_orgId : {userId: req.userId, orgId: orgId}
    }
  })

  if(!membership) return res.status(403).json({
    success: false,
    msg: `you are not a member of ${org.name}`
  })

  const board = await prisma.board.findMany({
    where : {
      organizationId: orgId
    }
  })

  if(board.length === 0) return res.status(403).json({
    success: false,
    msg: `no board exists in this org`
  })

  return res.status(200).json({
    data : board
  })
});

router.delete(
  "/org/:orgId/boards/:boardId",
  (req: Request, res: Response) => {},
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

    res
      .status(200)
      .json({ success: true, data: "invitation sent successfully!" });
  },
);

router.post("/org/accept", (req: Request, res: Response) => {});

router.post(
  "/org/:orgId/boards/:boardId/section",
  (req: Request, res: Response) => {},
);

router.put(
  "/org/:orgId/boards/:boardId/section/:sectionId",
  (req: Request, res: Response) => {},
);

router.post(
  "/org/:orgId/boards/:boardId/section/:sectionId/issue",
  (req: Request, res: Response) => {},
);

router.get(
  "/org/:orgId/boards/:boardId/section",
  (req: Request, res: Response) => {},
);

router.get("/org/:orgId", (req: Request, res: Response) => {});
router.get("/org/:orgId", (req: Request, res: Response) => {});
router.delete("/org/:orgId", (req: Request, res: Response) => {});
router.delete("/org/:orgId", (req: Request, res: Response) => {});
router.put("/org/:orgId", (req: Request, res: Response) => {});
router.put("/org/:orgId", (req: Request, res: Response) => {});
router.post("/org/:orgId", (req: Request, res: Response) => {});
router.delete("/org/:orgId", (req: Request, res: Response) => {});
router.put("/org/:orgId", (req: Request, res: Response) => {});
router.put("/org/:orgId", (req: Request, res: Response) => {});
