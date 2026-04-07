import { ApprovalStatus, ApprovalType } from '@prisma/client';
import { prisma, createTenantClient } from '../utils/prisma';
import { NotFoundError, ValidationError } from '../utils/errors';
import { paginate, toSkipTake } from '../utils/helpers';
import { PaginationParams } from '../types';
import { notificationService } from './notification.service';

export class ApprovalService {
  /**
   * List approval requests with filters and pagination.
   */
  async list(
    tenantId: string,
    params: PaginationParams,
    filters: {
      establishmentId?: string;
      status?: ApprovalStatus;
      type?: ApprovalType;
    } = {}
  ) {
    const db = createTenantClient(tenantId);

    const where: any = {
      ...(filters.establishmentId && {
        OR: [
          { establishmentId: filters.establishmentId },
          { establishmentId: '' }, // Include approvals without establishment (e.g. article creation)
        ],
      }),
      ...(filters.status && { status: filters.status }),
      ...(filters.type && { type: filters.type }),
    };

    const [data, total] = await Promise.all([
      db.approvalRequest.findMany({
        where,
        include: {
          requestedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
          reviewedBy: { select: { id: true, firstName: true, lastName: true } },
        },
        ...toSkipTake(params),
      }),
      db.approvalRequest.count({ where }),
    ]);

    return paginate(data, total, params);
  }

  /**
   * Create a new approval request.
   */
  async create(
    tenantId: string,
    data: {
      establishmentId: string;
      type: ApprovalType;
      requestedById: string;
      payload: any;
      targetId?: string;
    }
  ) {
    const approval = await prisma.approvalRequest.create({
      data: {
        tenantId,
        establishmentId: data.establishmentId,
        type: data.type,
        requestedById: data.requestedById,
        payload: data.payload,
        targetId: data.targetId,
      },
      include: {
        requestedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    // Notify DAF/OWNER about the new approval request
    const typeLabels: Record<string, string> = {
      EMPLOYEE_CREATION: 'Nouvel employe',
      RESERVATION_MODIFICATION: 'Modification reservation',
      ROOM_CREATION: 'Nouvelle chambre',
      STOCK_MOVEMENT: 'Mouvement de stock',
      ARTICLE_CREATION: 'Nouvel article',
    };

    notificationService.notifyRole({
      tenantId,
      establishmentId: data.establishmentId,
      roles: ['DAF', 'OWNER'],
      type: 'APPROVAL_NEEDED',
      title: 'Approbation requise',
      message: `${typeLabels[data.type] || data.type} — demande de ${approval.requestedBy.firstName} ${approval.requestedBy.lastName}.`,
      data: { approvalId: approval.id, approvalType: data.type },
    }).catch(() => {});

    return approval;
  }

  /**
   * Approve a pending approval request.
   * Handles side effects based on approval type.
   */
  async approve(tenantId: string, id: string, reviewerId: string, reviewerRole?: string) {
    return prisma.$transaction(async (tx) => {
      const request = await tx.approvalRequest.findFirst({
        where: { id, tenantId, status: 'PENDING' },
      });

      if (!request) throw new NotFoundError('Demande d\'approbation');

      // DAF cannot approve their own article creations — only OWNER/SUPERADMIN can
      if (
        request.type === 'ARTICLE_CREATION' &&
        request.requestedById === reviewerId &&
        reviewerRole !== 'OWNER' && reviewerRole !== 'SUPERADMIN'
      ) {
        throw new ValidationError('Vous ne pouvez pas approuver vos propres créations d\'articles. Seul un propriétaire ou superadmin le peut.');
      }

      // Mark as approved
      const approved = await tx.approvalRequest.update({
        where: { id },
        data: {
          status: 'APPROVED',
          reviewedById: reviewerId,
          reviewedAt: new Date(),
        },
        include: {
          requestedBy: { select: { id: true, firstName: true, lastName: true } },
          reviewedBy: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      // Handle side effects based on type
      if (request.type === 'EMPLOYEE_CREATION' && request.targetId) {
        await tx.user.update({
          where: { id: request.targetId },
          data: { status: 'ACTIVE' },
        });
      }

      if (request.type === 'RESERVATION_MODIFICATION' && request.targetId) {
        const payload = request.payload as Record<string, any>;
        const updateData: any = {};

        if (payload.checkIn) updateData.checkIn = new Date(payload.checkIn);
        if (payload.checkOut) updateData.checkOut = new Date(payload.checkOut);
        if (payload.guestName) updateData.guestName = payload.guestName;
        if (payload.guestEmail !== undefined) updateData.guestEmail = payload.guestEmail;
        if (payload.guestPhone !== undefined) updateData.guestPhone = payload.guestPhone;
        if (payload.numberOfGuests) updateData.numberOfGuests = payload.numberOfGuests;
        if (payload.notes !== undefined) updateData.notes = payload.notes;

        if (Object.keys(updateData).length > 0) {
          await tx.reservation.update({
            where: { id: request.targetId },
            data: updateData,
          });
        }
      }

      if (request.type === 'ROOM_CREATION') {
        const payload = request.payload as Record<string, any>;
        await tx.room.create({
          data: {
            tenantId,
            establishmentId: payload.establishmentId,
            number: payload.number,
            floor: payload.floor,
            type: payload.type,
            status: payload.status ?? 'AVAILABLE',
            pricePerNight: payload.pricePerNight,
            maxOccupancy: payload.maxOccupancy,
            amenities: payload.amenities ?? [],
            description: payload.description,
          },
        });
      }

      if (request.type === 'STOCK_MOVEMENT' && request.targetId) {
        const movement = await tx.stockMovement.findUnique({
          where: { id: request.targetId },
        });

        if (!movement) throw new NotFoundError('Mouvement de stock');

        await tx.stockMovement.update({
          where: { id: request.targetId },
          data: {
            approvedById: reviewerId,
            approvedAt: new Date(),
          },
        });

        await tx.article.update({
          where: { id: movement.articleId },
          data: { currentStock: movement.newStock },
        });
      }

      // Approve article creation — activate the article
      if (request.type === 'ARTICLE_CREATION' && request.targetId) {
        await tx.article.update({
          where: { id: request.targetId },
          data: { isApproved: true, isActive: true },
        });
      }

      // Notify the requester about the approval
      notificationService.notify({
        tenantId,
        userId: request.requestedById,
        establishmentId: request.establishmentId,
        type: 'APPROVAL_RESULT',
        title: 'Demande approuvee',
        message: `Votre demande a ete approuvee.`,
        data: { approvalId: id, approvalType: request.type, status: 'APPROVED' },
      }).catch(() => {});

      return approved;
    });
  }

  /**
   * Reject a pending approval request.
   */
  async reject(tenantId: string, id: string, reviewerId: string, reason?: string) {
    const request = await prisma.approvalRequest.findFirst({
      where: { id, tenantId, status: 'PENDING' },
    });

    if (!request) throw new NotFoundError('Demande d\'approbation');

    const rejected = await prisma.approvalRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        reviewedById: reviewerId,
        reviewedAt: new Date(),
        reason,
      },
      include: {
        requestedBy: { select: { id: true, firstName: true, lastName: true } },
        reviewedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    // Deactivate rejected article
    if (request.type === 'ARTICLE_CREATION' && request.targetId) {
      await prisma.article.update({
        where: { id: request.targetId },
        data: { isActive: false },
      });
    }

    // Notify the requester about the rejection
    notificationService.notify({
      tenantId,
      userId: request.requestedById,
      establishmentId: request.establishmentId,
      type: 'APPROVAL_RESULT',
      title: 'Demande refusee',
      message: reason ? `Votre demande a ete refusee : ${reason}` : 'Votre demande a ete refusee.',
      data: { approvalId: id, approvalType: request.type, status: 'REJECTED', reason },
    }).catch(() => {});

    return rejected;
  }

  /**
   * Get count of pending approval requests for an establishment.
   */
  async getPendingCount(tenantId: string, establishmentId: string) {
    const db = createTenantClient(tenantId);

    return db.approvalRequest.count({
      where: {
        establishmentId,
        status: 'PENDING',
      },
    });
  }
}

export const approvalService = new ApprovalService();
