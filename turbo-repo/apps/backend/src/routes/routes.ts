import { Router } from "express";
import type { Request, Response } from "express";
import { prisma } from "db/client";
import { authMiddleware } from "../middleware";
import { CreateOrgSchema } from "../types";

export const router = Router();

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

    const Org = await prisma.organization.create({
      data: { name: name, description: description },
    });

    if (!Org)
      return res
        .status(402)
        .json({ success: false, msg: "create org failed please try again" });

    const Membership = await prisma.membership.create({
      data: { userId: req.userId, orgId: Org.id, role: "ADMIN" },
    });

    if (!Membership)
      return res
        .status(402)
        .json({ success: false, msg: "create org failed please try again" });

    res.status(201).json({
      success: true,
      msg: "org created successfully!",
      data: {
        orgId: Org.id,
        membershipId: Membership.id,
        admin: req.userId,
      },
    });
  },
);

router.get("/org/:userId", async (req: Request, res: Response) => {
  const { userId } = req.params;

  if (!userId)
    return res.status(401).json({ success: false, msg: "invalid user Id!" });

  const exists = await prisma.membership.findMany({
    where: { userId: Number(userId), role: "ADMIN" },
    select: { org: { select: { name: true, description: true } } },
  });

  if(!exists) return res.status(401).json({success: false, msg: `no orgs exists for userId: ${userId}`})

  const orgs = exists.map( o => {
    const 
  })
});

router.get("/org/:orgId/boards", (req: Request, res: Response) => {});

router.post("/org/:orgId/boards", (req: Request, res: Response) => {});

router.delete(
  "/org/:orgId/boards/:boardId",
  (req: Request, res: Response) => {},
);

router.post("/org/:orgId/invite", (req: Request, res: Response) => {});

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
router.delete("/org/:orgId", (req: Request, res: Response) => {});
router.put("/org/:orgId", (req: Request, res: Response) => {});
router.put("/org/:orgId", (req: Request, res: Response) => {});
router.post("/org/:orgId", (req: Request, res: Response) => {});
router.delete("/org/:orgId", (req: Request, res: Response) => {});
router.put("/org/:orgId", (req: Request, res: Response) => {});
router.put("/org/:orgId", (req: Request, res: Response) => {});
