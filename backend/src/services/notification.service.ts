import { Response } from 'express';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { firebaseService } from './firebase.service';

// In-memory SSE connections: userId -> Response[]
const sseClients = new Map<string, Response[]>();

export class NotificationService {
  /**
   * Create a notification for a specific user and push via SSE.
   */
  async notify(params: {
    tenantId: string;
    userId: string;
    establishmentId?: string;
    type: string;
    title: string;
    message: string;
    data?: Record<string, unknown>;
  }) {
    const notification = await prisma.notification.create({
      data: {
        tenantId: params.tenantId,
        userId: params.userId,
        establishmentId: params.establishmentId,
        type: params.type,
        title: params.title,
        message: params.message,
        data: params.data ? (params.data as any) : undefined,
      },
    });

    // Push to SSE clients
    this.pushToUser(params.userId, notification);

    // Push via FCM (fire-and-forget)
    firebaseService.sendToUser(params.userId, {
      title: params.title,
      body: params.message,
      data: {
        notificationId: notification.id,
        type: params.type,
        ...(params.establishmentId && { establishmentId: params.establishmentId }),
      },
    }).catch(() => {});

    return notification;
  }

  /**
   * Notify all users with a specific establishment role.
   */
  async notifyRole(params: {
    tenantId: string;
    establishmentId: string;
    roles: string[];
    type: string;
    title: string;
    message: string;
    data?: Record<string, unknown>;
  }) {
    // Find all users with the given roles in the establishment
    const members = await prisma.establishmentMember.findMany({
      where: {
        establishmentId: params.establishmentId,
        role: { in: params.roles as any },
        isActive: true,
      },
      select: { userId: true },
    });

    const notifications = await Promise.all(
      members.map((m) =>
        this.notify({
          tenantId: params.tenantId,
          userId: m.userId,
          establishmentId: params.establishmentId,
          type: params.type,
          title: params.title,
          message: params.message,
          data: params.data,
        })
      )
    );

    return notifications;
  }

  /**
   * Get notifications for a user.
   */
  async getForUser(userId: string, onlyUnread = false, limit = 50) {
    return prisma.notification.findMany({
      where: {
        userId,
        ...(onlyUnread && { isRead: false }),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Get unread count for a user.
   */
  async getUnreadCount(userId: string) {
    return prisma.notification.count({
      where: { userId, isRead: false },
    });
  }

  /**
   * Mark a notification as read.
   */
  async markAsRead(userId: string, notificationId: string) {
    return prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true },
    });
  }

  /**
   * Mark all notifications as read for a user.
   */
  async markAllAsRead(userId: string) {
    return prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  // =========================================================================
  // SSE Management
  // =========================================================================

  /**
   * Register an SSE client connection.
   */
  addClient(userId: string, res: Response) {
    const clients = sseClients.get(userId) || [];
    clients.push(res);
    sseClients.set(userId, clients);

    // Remove client on connection close
    res.on('close', () => {
      this.removeClient(userId, res);
    });
  }

  /**
   * Remove an SSE client connection.
   */
  removeClient(userId: string, res: Response) {
    const clients = sseClients.get(userId) || [];
    const filtered = clients.filter((c) => c !== res);
    if (filtered.length === 0) {
      sseClients.delete(userId);
    } else {
      sseClients.set(userId, filtered);
    }
  }

  /**
   * Push a notification to a user's SSE clients.
   */
  private pushToUser(userId: string, notification: any) {
    const clients = sseClients.get(userId) || [];
    const payload = `data: ${JSON.stringify(notification)}\n\n`;

    for (const client of clients) {
      try {
        client.write(payload);
      } catch (err) {
        logger.error('SSE write error', { userId, error: err });
      }
    }
  }
}

export const notificationService = new NotificationService();
