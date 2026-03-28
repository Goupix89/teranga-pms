import * as admin from 'firebase-admin';
import { config } from '../config';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';

let firebaseApp: admin.app.App | null = null;

/**
 * Initialize Firebase Admin SDK.
 * Uses service account JSON file path from FIREBASE_SERVICE_ACCOUNT_PATH env var.
 */
function getFirebaseApp(): admin.app.App | null {
  if (firebaseApp) return firebaseApp;

  try {
    if (config.firebase.serviceAccountPath) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const serviceAccount = require(config.firebase.serviceAccountPath);
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: config.firebase.projectId || serviceAccount.project_id,
      });
      logger.info('Firebase Admin SDK initialized');
    } else if (config.firebase.projectId) {
      // Use application default credentials (for Cloud Run, GCE, etc.)
      firebaseApp = admin.initializeApp({
        projectId: config.firebase.projectId,
      });
      logger.info('Firebase Admin SDK initialized with default credentials');
    } else {
      logger.warn('Firebase not configured — push notifications disabled');
      return null;
    }
  } catch (err) {
    logger.error('Failed to initialize Firebase Admin SDK', { error: String(err) });
    return null;
  }

  return firebaseApp;
}

export class FirebaseService {
  /**
   * Register a device token for push notifications.
   */
  async registerToken(userId: string, token: string, platform: 'WEB' | 'ANDROID' | 'IOS') {
    // Upsert: if token exists for another user, reassign it
    await prisma.deviceToken.upsert({
      where: { token },
      update: { userId, platform, updatedAt: new Date() },
      create: { userId, token, platform },
    });
  }

  /**
   * Remove a device token (logout or token refresh).
   */
  async removeToken(token: string) {
    await prisma.deviceToken.deleteMany({ where: { token } });
  }

  /**
   * Remove all tokens for a user (e.g., on account deletion).
   */
  async removeAllTokens(userId: string) {
    await prisma.deviceToken.deleteMany({ where: { userId } });
  }

  /**
   * Send a push notification to a specific user on all their devices.
   */
  async sendToUser(userId: string, notification: {
    title: string;
    body: string;
    data?: Record<string, string>;
  }) {
    const app = getFirebaseApp();
    if (!app) return;

    const tokens = await prisma.deviceToken.findMany({
      where: { userId },
      select: { id: true, token: true },
    });

    if (tokens.length === 0) return;

    const message: admin.messaging.MulticastMessage = {
      tokens: tokens.map((t) => t.token),
      notification: {
        title: notification.title,
        body: notification.body,
      },
      data: notification.data || {},
      webpush: {
        fcmOptions: {
          link: '/dashboard',
        },
        notification: {
          icon: '/icons/icon-192x192.png',
          badge: '/icons/badge-72x72.png',
        },
      },
      android: {
        priority: 'high',
        notification: {
          channelId: 'teranga_pms',
          icon: 'ic_notification',
          defaultSound: true,
        },
      },
    };

    try {
      const response = await admin.messaging().sendEachForMulticast(message);

      // Clean up invalid tokens
      if (response.failureCount > 0) {
        const invalidTokenIds: string[] = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            const errorCode = resp.error?.code;
            if (
              errorCode === 'messaging/invalid-registration-token' ||
              errorCode === 'messaging/registration-token-not-registered'
            ) {
              invalidTokenIds.push(tokens[idx].id);
            }
          }
        });

        if (invalidTokenIds.length > 0) {
          await prisma.deviceToken.deleteMany({
            where: { id: { in: invalidTokenIds } },
          });
          logger.info(`Removed ${invalidTokenIds.length} invalid FCM tokens`);
        }
      }

      if (response.successCount > 0) {
        logger.debug('FCM push sent', { userId, successCount: response.successCount });
      }
    } catch (err) {
      logger.error('FCM send error', { userId, error: String(err) });
    }
  }
}

export const firebaseService = new FirebaseService();
