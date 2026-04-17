import * as admin from 'firebase-admin';
import webpush from 'web-push';
import { config } from '../config';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';

// Initialize VAPID for Web Push
if (config.vapid.publicKey && config.vapid.privateKey) {
  webpush.setVapidDetails(
    config.vapid.subject,
    config.vapid.publicKey,
    config.vapid.privateKey,
  );
  logger.info('Web Push VAPID initialized');
}

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
   * Register a device token (FCM for mobile, Web Push subscription for web).
   */
  async registerToken(
    userId: string,
    token: string,
    platform: 'WEB' | 'ANDROID' | 'IOS',
    webPushKeys?: { auth: string; p256dh: string },
  ) {
    await prisma.deviceToken.upsert({
      where: { token },
      update: {
        userId,
        platform,
        updatedAt: new Date(),
        ...(webPushKeys && {
          subscriptionAuth: webPushKeys.auth,
          subscriptionP256dh: webPushKeys.p256dh,
        }),
      },
      create: {
        userId,
        token,
        platform,
        ...(webPushKeys && {
          subscriptionAuth: webPushKeys.auth,
          subscriptionP256dh: webPushKeys.p256dh,
        }),
      },
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
   * - WEB: uses Web Push Protocol (VAPID)
   * - ANDROID/IOS: uses Firebase Cloud Messaging
   */
  async sendToUser(userId: string, notification: {
    title: string;
    body: string;
    data?: Record<string, string>;
  }) {
    const tokens = await prisma.deviceToken.findMany({
      where: { userId },
      select: { id: true, token: true, platform: true, subscriptionAuth: true, subscriptionP256dh: true },
    });

    if (tokens.length === 0) return;

    const webTokens = tokens.filter((t) => t.platform === 'WEB');
    const mobileTokens = tokens.filter((t) => t.platform !== 'WEB');

    // Web Push notifications
    const invalidWebIds: string[] = [];
    await Promise.all(
      webTokens.map(async (t) => {
        if (!t.subscriptionAuth || !t.subscriptionP256dh) return;
        const subscription: webpush.PushSubscription = {
          endpoint: t.token,
          keys: { auth: t.subscriptionAuth, p256dh: t.subscriptionP256dh },
        };
        try {
          await webpush.sendNotification(
            subscription,
            JSON.stringify({ title: notification.title, body: notification.body, data: notification.data || {} }),
          );
        } catch (err: any) {
          logger.warn('Web Push send failed', { error: String(err) });
          if (err.statusCode === 410 || err.statusCode === 404) {
            invalidWebIds.push(t.id);
          }
        }
      }),
    );

    if (invalidWebIds.length > 0) {
      await prisma.deviceToken.deleteMany({ where: { id: { in: invalidWebIds } } });
    }

    // FCM notifications for mobile
    if (mobileTokens.length > 0) {
      const app = getFirebaseApp();
      if (!app) return;

      const message: admin.messaging.MulticastMessage = {
        tokens: mobileTokens.map((t) => t.token),
        notification: { title: notification.title, body: notification.body },
        data: notification.data || {},
        android: {
          priority: 'high',
          notification: { channelId: 'teranga_pms', icon: 'ic_notification', defaultSound: true },
        },
      };

      try {
        const response = await admin.messaging().sendEachForMulticast(message);
        if (response.failureCount > 0) {
          const invalidIds: string[] = [];
          response.responses.forEach((resp, idx) => {
            const code = resp.error?.code;
            if (code === 'messaging/invalid-registration-token' || code === 'messaging/registration-token-not-registered') {
              invalidIds.push(mobileTokens[idx].id);
            }
          });
          if (invalidIds.length > 0) {
            await prisma.deviceToken.deleteMany({ where: { id: { in: invalidIds } } });
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
}

export const firebaseService = new FirebaseService();
