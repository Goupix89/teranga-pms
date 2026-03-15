import { ApprovalStatus, ApprovalType } from '@prisma/client';
import { prisma, createTenantClient } from '../utils/prisma';
import { NotFoundError, ValidationError } from '../utils/errors';
import { paginate, toSkipTake } from '../utils/helpers';
import { PaginationParams } from '../types';

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
      ...(filters.establishmentId && { establishmentId: filters.establishmentId }),
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
    return prisma.approvalRequest.create({
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
  }

  /**
   * Approve a pending approval request.
   * Handles side effects based on approval type.
   */
  async approve(tenantId: string, id: string, reviewerId: string) {
    return prisma.$transaction(async (tx) => {
      const request = await tx.approvalRequest.findFirst({
        where: { id, tenantId, status: 'PENDING' },
      });

      if (!request) throw new NotFoundError('Demande d\'approbation');

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

    return prisma.approvalRequest.update({
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
