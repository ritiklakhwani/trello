import { Router } from "express";
import type { Request, Response } from "express";
import { prisma } from "db/client";
import { authMiddleware } from "../middleware";
import { CreateOrgSchema, OrgNameSchema } from "../types";
import { success } from "zod";
import { id } from "zod/locales";

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

    const Org = await prisma.$transaction(async (tx) => {
      const created = await tx.organization.create({
        data: { name: name, description: description },
      });

      const Membership = await tx.membership.create({
        data: { userId: req.userId, orgId: created.id, role: "ADMIN" },
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
  const { userId } = req.body;

  if (!userId)
    return res.status(401).json({ success: false, msg: "invalid user Id!" });

  const exists = await prisma.membership.findMany({
    where: { userId: userId, role: "ADMIN" },
    select: { org: { select: { name: true, description: true } } },
  });

  if (!exists)
    return res
      .status(401)
      .json({ success: false, msg: `no orgs exists for userId: ${userId}` });

  return res.status(201).json({
    success: true,
    data: exists,
  });
});

router.delete("/org", authMiddleware, async (req: Request, res: Response) => {
  const parsed = OrgNameSchema.safeParse(req.body);

  if (!parsed.success)
    return res.status(401).json({
      success: false,
      msg: "invalid input!",
    });

  const { name } = parsed.data;

  const check = await prisma.$transaction(async (tx) => {
    const org = await tx.organization.findUnique({
      where: { name: name },
    });

    if (!org)
      return res.status(401).json({
        success: false,
        msg: "org not found!",
      });

    const membership = await tx.membership.findUnique({
      where: {
        userId_orgId: { userId: req.userId, orgId: org.id, role: "ADMIN" },
      },
    });

    if (!membership)
      return res.status(401).json({
        success: false,
        msg: "membership not found!",
      });

    return { org, membership };
  });

  if (!check) return res.status(401).json({
        success: false,
        msg: "only the admin/creator of the org can delete!",
      });

    const deleteOrg = await prisma.organization.delete({where : {id: check[org][id]}})
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
router.put("/org/:orgId", (req: Request, res: Response) => {});
router.put("/org/:orgId", (req: Request, res: Response) => {});
router.post("/org/:orgId", (req: Request, res: Response) => {});
router.delete("/org/:orgId", (req: Request, res: Response) => {});
router.put("/org/:orgId", (req: Request, res: Response) => {});
router.put("/org/:orgId", (req: Request, res: Response) => {});
