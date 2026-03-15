import { EstablishmentRole } from '@prisma/client';
import { prisma, createTenantClient } from '../utils/prisma';
import { NotFoundError, ValidationError } from '../utils/errors';

export class MemberService {
  /**
   * List all members of an establishment with user info.
   */
  async list(tenantId: string, establishmentId: string) {
    const db = createTenantClient(tenantId);

    // Verify establishment belongs to tenant
    const establishment = await db.establishment.findFirst({
      where: { id: establishmentId },
    });
    if (!establishment) throw new NotFoundError('Établissement');

    return prisma.establishmentMember.findMany({
      where: { establishmentId, isActive: true },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Add a member to an establishment.
   */
  async add(
    tenantId: string,
    establishmentId: string,
    data: { userId: string; role: EstablishmentRole }
  ) {
    return prisma.$transaction(async (tx) => {
      // Verify establishment belongs to tenant
      const establishment = await tx.establishment.findFirst({
        where: { id: establishmentId, tenantId },
      });
      if (!establishment) throw new NotFoundError('Établissement');

      // Verify user exists and belongs to same tenant
      const user = await tx.user.findFirst({
        where: { id: data.userId, tenantId },
      });
      if (!user) throw new NotFoundError('Utilisateur');

      // Check if membership already exists
      const existing = await tx.establishmentMember.findUnique({
        where: {
          userId_establishmentId: {
            userId: data.userId,
            establishmentId,
          },
        },
      });

      if (existing) {
        if (existing.isActive) {
          throw new ValidationError('Cet utilisateur est déjà membre de cet établissement');
        }
        // Re-activate existing membership
        return tx.establishmentMember.update({
          where: { id: existing.id },
          data: { isActive: true, role: data.role },
          include: {
            user: { select: { id: true, email: true, firstName: true, lastName: true } },
          },
        });
      }

      return tx.establishmentMember.create({
        data: {
          userId: data.userId,
          establishmentId,
          role: data.role,
        },
        include: {
          user: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
      });
    });
  }

  /**
   * Update a member's role.
   */
  async updateRole(
    tenantId: string,
    establishmentId: string,
    memberId: string,
    role: EstablishmentRole
  ) {
    // Verify establishment belongs to tenant
    const establishment = await prisma.establishment.findFirst({
      where: { id: establishmentId, tenantId },
    });
    if (!establishment) throw new NotFoundError('Établissement');

    const member = await prisma.establishmentMember.findFirst({
      where: { id: memberId, establishmentId, isActive: true },
    });
    if (!member) throw new NotFoundError('Membre');

    return prisma.establishmentMember.update({
      where: { id: memberId },
      data: { role },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });
  }

  /**
   * Soft-remove a member (set isActive=false). Cannot remove the last DAF.
   */
  async remove(tenantId: string, establishmentId: string, memberId: string) {
    return prisma.$transaction(async (tx) => {
      // Verify establishment belongs to tenant
      const establishment = await tx.establishment.findFirst({
        where: { id: establishmentId, tenantId },
      });
      if (!establishment) throw new NotFoundError('Établissement');

      const member = await tx.establishmentMember.findFirst({
        where: { id: memberId, establishmentId, isActive: true },
      });
      if (!member) throw new NotFoundError('Membre');

      // Cannot remove the last DAF
      if (member.role === 'DAF') {
        const dafCount = await tx.establishmentMember.count({
          where: { establishmentId, role: 'DAF', isActive: true },
        });
        if (dafCount <= 1) {
          throw new ValidationError('Impossible de supprimer le dernier DAF de l\'établissement');
        }
      }

      return tx.establishmentMember.update({
        where: { id: memberId },
        data: { isActive: false },
        include: {
          user: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
      });
    });
  }
}

export const memberService = new MemberService();
