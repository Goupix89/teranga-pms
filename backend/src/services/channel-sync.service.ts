import crypto from 'crypto';
import { prisma } from '../utils/prisma';
import { NotFoundError, ConflictError } from '../utils/errors';
import { formatICalDate, formatICalDateTime, escapeICalText } from '../utils/helpers';
import { notificationService } from './notification.service';
import { logger } from '../utils/logger';
import { BookingSource } from '@prisma/client';

// ---------------------------------------------------------------------------
// iCal parser types
// ---------------------------------------------------------------------------

interface ParsedEvent {
  uid: string;
  dtstart: Date | null;
  dtend: Date | null;
  summary: string;
  status: string;
}

interface SyncResult {
  eventsFound: number;
  eventsCreated: number;
  eventsUpdated: number;
  eventsCancelled: number;
  errors: string[];
}

// ---------------------------------------------------------------------------
// Lightweight iCal parser
// ---------------------------------------------------------------------------

function unfoldIcal(text: string): string {
  // RFC 5545: long lines are folded with CRLF + space/tab
  return text.replace(/\r?\n[ \t]/g, '');
}

function extractField(content: string, field: string): string {
  // Match field with optional params, e.g. DTSTART;VALUE=DATE:20260315
  const regex = new RegExp(`^${field}[^:]*:(.*)$`, 'm');
  const match = content.match(regex);
  return match ? match[1].trim() : '';
}

function parseICalDate(raw: string): Date | null {
  if (!raw) return null;
  // VALUE=DATE format: YYYYMMDD
  if (raw.length === 8) {
    const y = parseInt(raw.slice(0, 4));
    const m = parseInt(raw.slice(4, 6)) - 1;
    const d = parseInt(raw.slice(6, 8));
    return new Date(Date.UTC(y, m, d));
  }
  // DATETIME format: YYYYMMDDTHHmmssZ or YYYYMMDDTHHmmss
  if (raw.length >= 15) {
    const y = parseInt(raw.slice(0, 4));
    const m = parseInt(raw.slice(4, 6)) - 1;
    const d = parseInt(raw.slice(6, 8));
    return new Date(Date.UTC(y, m, d));
  }
  return null;
}

function parseICalEvents(icalText: string): ParsedEvent[] {
  const unfolded = unfoldIcal(icalText);
  const events: ParsedEvent[] = [];
  const blocks = unfolded.split('BEGIN:VEVENT');

  for (const block of blocks.slice(1)) {
    const end = block.indexOf('END:VEVENT');
    if (end === -1) continue;
    const content = block.substring(0, end);

    const uid = extractField(content, 'UID');
    if (!uid) continue; // skip events without UID

    events.push({
      uid,
      dtstart: parseICalDate(extractField(content, 'DTSTART')),
      dtend: parseICalDate(extractField(content, 'DTEND')),
      summary: extractField(content, 'SUMMARY').replace(/\\n/g, ' ').replace(/\\[;,]/g, (m) => m[1]),
      status: extractField(content, 'STATUS') || 'CONFIRMED',
    });
  }

  return events;
}

// ---------------------------------------------------------------------------
// Channel Sync Service
// ---------------------------------------------------------------------------

export class ChannelSyncService {
  // =========================================================================
  // CRUD
  // =========================================================================

  async createConnection(tenantId: string, data: { roomId: string; channel: BookingSource; importUrl?: string }) {
    // Verify room belongs to tenant
    const room = await prisma.room.findFirst({
      where: { id: data.roomId, tenantId },
    });
    if (!room) throw new NotFoundError('Chambre introuvable');

    const exportToken = crypto.randomBytes(32).toString('hex');

    return prisma.channelConnection.create({
      data: {
        tenantId,
        roomId: data.roomId,
        channel: data.channel,
        exportToken,
        importUrl: data.importUrl,
      },
      include: { room: { select: { number: true, type: true } } },
    });
  }

  async updateConnection(tenantId: string, id: string, data: { importUrl?: string | null; isActive?: boolean; syncIntervalMin?: number }) {
    const conn = await prisma.channelConnection.findFirst({ where: { id, tenantId } });
    if (!conn) throw new NotFoundError('Connexion introuvable');

    return prisma.channelConnection.update({
      where: { id },
      data: {
        ...(data.importUrl !== undefined && { importUrl: data.importUrl }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.syncIntervalMin !== undefined && { syncIntervalMin: data.syncIntervalMin }),
      },
      include: { room: { select: { number: true, type: true } } },
    });
  }

  async deleteConnection(tenantId: string, id: string) {
    const conn = await prisma.channelConnection.findFirst({ where: { id, tenantId } });
    if (!conn) throw new NotFoundError('Connexion introuvable');
    await prisma.channelConnection.delete({ where: { id } });
  }

  async listConnections(tenantId: string, filters: { roomId?: string; establishmentId?: string } = {}) {
    return prisma.channelConnection.findMany({
      where: {
        tenantId,
        ...(filters.roomId && { roomId: filters.roomId }),
        ...(filters.establishmentId && { room: { establishmentId: filters.establishmentId } }),
      },
      include: {
        room: {
          select: {
            id: true,
            number: true,
            type: true,
            establishment: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getConnectionWithLogs(tenantId: string, id: string) {
    const conn = await prisma.channelConnection.findFirst({
      where: { id, tenantId },
      include: {
        room: {
          select: {
            id: true,
            number: true,
            type: true,
            establishment: { select: { name: true } },
          },
        },
        syncLogs: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });
    if (!conn) throw new NotFoundError('Connexion introuvable');
    return conn;
  }

  async regenerateToken(tenantId: string, id: string) {
    const conn = await prisma.channelConnection.findFirst({ where: { id, tenantId } });
    if (!conn) throw new NotFoundError('Connexion introuvable');

    const exportToken = crypto.randomBytes(32).toString('hex');
    return prisma.channelConnection.update({
      where: { id },
      data: { exportToken },
      include: { room: { select: { number: true, type: true } } },
    });
  }

  // =========================================================================
  // OUTBOUND — Per-room iCal feed
  // =========================================================================

  async generateRoomIcal(token: string): Promise<string> {
    const conn = await prisma.channelConnection.findUnique({
      where: { exportToken: token },
      include: { room: true },
    });

    if (!conn || !conn.isActive) {
      throw new NotFoundError('Calendrier introuvable');
    }

    const reservations = await prisma.reservation.findMany({
      where: {
        roomId: conn.roomId,
        tenantId: conn.tenantId,
        status: { in: ['CONFIRMED', 'CHECKED_IN'] },
        checkOut: { gte: new Date() },
      },
      orderBy: { checkIn: 'asc' },
    });

    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//TerangaPMS//Calendar//FR',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      `X-WR-CALNAME:${escapeICalText(`Chambre ${conn.room.number}`)}`,
    ];

    for (const r of reservations) {
      lines.push(
        'BEGIN:VEVENT',
        `UID:${r.id}@teranga.pms`,
        `DTSTART;VALUE=DATE:${formatICalDate(r.checkIn)}`,
        `DTEND;VALUE=DATE:${formatICalDate(r.checkOut)}`,
        `SUMMARY:${escapeICalText('Non disponible')}`,
        `DTSTAMP:${formatICalDateTime(new Date())}`,
        'STATUS:CONFIRMED',
        'TRANSP:OPAQUE',
        'END:VEVENT',
      );
    }

    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
  }

  // =========================================================================
  // INBOUND — Import iCal from OTA
  // =========================================================================

  async syncInbound(connectionId: string): Promise<SyncResult> {
    const startTime = Date.now();
    const result: SyncResult = { eventsFound: 0, eventsCreated: 0, eventsUpdated: 0, eventsCancelled: 0, errors: [] };

    const conn = await prisma.channelConnection.findUnique({
      where: { id: connectionId },
      include: { room: { include: { establishment: true } } },
    });

    if (!conn || !conn.importUrl || !conn.isActive) {
      throw new NotFoundError('Connexion invalide ou inactive');
    }

    let icalText: string;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const response = await fetch(conn.importUrl, {
        signal: controller.signal,
        headers: { 'User-Agent': 'TerangaPMS/1.0' },
      });
      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      icalText = await response.text();
    } catch (err: any) {
      const errorMsg = `Erreur de téléchargement: ${err.message}`;
      await this.logSync(conn.id, 'INBOUND', result, 'ERROR', errorMsg, Date.now() - startTime);
      await this.updateSyncStatus(conn.id, 'ERROR', errorMsg);
      throw new Error(errorMsg);
    }

    const events = parseICalEvents(icalText);
    result.eventsFound = events.length;

    // Get existing active reservations from this channel for this room
    const existingReservations = await prisma.reservation.findMany({
      where: {
        roomId: conn.roomId,
        tenantId: conn.tenantId,
        source: conn.channel,
        externalRef: { not: null },
        status: { in: ['PENDING', 'CONFIRMED', 'CHECKED_IN'] },
      },
    });

    const existingByRef = new Map(existingReservations.map((r) => [r.externalRef!, r]));
    const incomingUids = new Set(events.map((e) => e.uid));

    // Process each incoming event
    for (const event of events) {
      if (!event.dtstart || !event.dtend) {
        result.errors.push(`UID ${event.uid}: dates manquantes`);
        continue;
      }

      // Skip cancelled events
      if (event.status.toUpperCase() === 'CANCELLED') {
        const existing = existingByRef.get(event.uid);
        if (existing) {
          await prisma.reservation.update({
            where: { id: existing.id },
            data: { status: 'CANCELLED', cancelledAt: new Date() },
          });
          result.eventsCancelled++;
        }
        continue;
      }

      const existing = existingByRef.get(event.uid);

      if (existing) {
        // Update dates if changed
        const checkInChanged = existing.checkIn.getTime() !== event.dtstart.getTime();
        const checkOutChanged = existing.checkOut.getTime() !== event.dtend.getTime();

        if (checkInChanged || checkOutChanged) {
          // Check availability for new dates (excluding this reservation)
          const conflict = await prisma.reservation.findFirst({
            where: {
              roomId: conn.roomId,
              tenantId: conn.tenantId,
              id: { not: existing.id },
              status: { in: ['PENDING', 'CONFIRMED', 'CHECKED_IN'] },
              checkIn: { lt: event.dtend },
              checkOut: { gt: event.dtstart },
            },
          });

          if (conflict) {
            result.errors.push(`UID ${event.uid}: conflit de dates, mise à jour ignorée`);
            continue;
          }

          const nights = Math.ceil((event.dtend.getTime() - event.dtstart.getTime()) / (1000 * 60 * 60 * 24));
          const pricePerNight = Number(conn.room.pricePerNight);

          await prisma.reservation.update({
            where: { id: existing.id },
            data: {
              checkIn: event.dtstart,
              checkOut: event.dtend,
              totalPrice: nights * pricePerNight,
              ...(event.summary && event.summary !== 'Not Available' && event.summary !== 'Non disponible'
                ? { guestName: event.summary }
                : {}),
            },
          });
          result.eventsUpdated++;
        }
      } else {
        // Check not previously cancelled with same ref
        const wasCancelled = await prisma.reservation.findFirst({
          where: {
            roomId: conn.roomId,
            tenantId: conn.tenantId,
            externalRef: event.uid,
            status: 'CANCELLED',
          },
        });
        if (wasCancelled) continue; // Don't re-create cancelled reservations

        // Check availability
        const conflict = await prisma.reservation.findFirst({
          where: {
            roomId: conn.roomId,
            tenantId: conn.tenantId,
            status: { in: ['PENDING', 'CONFIRMED', 'CHECKED_IN'] },
            checkIn: { lt: event.dtend },
            checkOut: { gt: event.dtstart },
          },
        });

        if (conflict) {
          result.errors.push(`UID ${event.uid}: conflit avec réservation existante, ignoré`);
          continue;
        }

        const nights = Math.ceil((event.dtend.getTime() - event.dtstart.getTime()) / (1000 * 60 * 60 * 24));
        const pricePerNight = Number(conn.room.pricePerNight);
        const guestName = event.summary && event.summary !== 'Not Available' && event.summary !== 'Non disponible'
          ? event.summary
          : `${conn.channel.replace('_', ' ')} Guest`;

        await prisma.reservation.create({
          data: {
            tenantId: conn.tenantId,
            roomId: conn.roomId,
            guestName,
            checkIn: event.dtstart,
            checkOut: event.dtend,
            totalPrice: nights * pricePerNight,
            status: 'CONFIRMED',
            source: conn.channel,
            externalRef: event.uid,
          },
        });
        result.eventsCreated++;
      }
    }

    // Detect cancellations: existing reservations whose UID is no longer in the feed
    for (const [ref, reservation] of existingByRef) {
      if (!incomingUids.has(ref)) {
        await prisma.reservation.update({
          where: { id: reservation.id },
          data: { status: 'CANCELLED', cancelledAt: new Date() },
        });
        result.eventsCancelled++;
      }
    }

    // Log and update status
    const durationMs = Date.now() - startTime;
    const status = result.errors.length > 0 ? 'OK' : 'OK'; // partial errors are still OK
    await this.logSync(conn.id, 'INBOUND', result, status, null, durationMs);
    await this.updateSyncStatus(conn.id, result.eventsCreated + result.eventsUpdated + result.eventsCancelled > 0 ? 'OK' : 'NO_CHANGES', null);

    // Notify managers about new external bookings
    if (result.eventsCreated > 0) {
      notificationService.notifyRole({
        tenantId: conn.tenantId,
        establishmentId: conn.room.establishmentId,
        roles: ['MANAGER', 'DAF', 'OWNER'],
        type: 'CHANNEL_SYNC',
        title: 'Nouvelles réservations externes',
        message: `${result.eventsCreated} réservation(s) importée(s) depuis ${conn.channel.replace('_', ' ')} pour la chambre ${conn.room.number}.`,
        data: { connectionId: conn.id, channel: conn.channel, count: result.eventsCreated },
      }).catch(() => {});
    }

    if (result.eventsCancelled > 0) {
      notificationService.notifyRole({
        tenantId: conn.tenantId,
        establishmentId: conn.room.establishmentId,
        roles: ['MANAGER', 'DAF', 'OWNER'],
        type: 'CHANNEL_SYNC',
        title: 'Annulations externes',
        message: `${result.eventsCancelled} réservation(s) annulée(s) depuis ${conn.channel.replace('_', ' ')} pour la chambre ${conn.room.number}.`,
        data: { connectionId: conn.id, channel: conn.channel, count: result.eventsCancelled },
      }).catch(() => {});
    }

    return result;
  }

  // =========================================================================
  // Helpers
  // =========================================================================

  private async logSync(connectionId: string, direction: string, result: SyncResult, status: string, errorMessage: string | null, durationMs: number) {
    await prisma.channelSyncLog.create({
      data: {
        connectionId,
        direction,
        eventsFound: result.eventsFound,
        eventsCreated: result.eventsCreated,
        eventsUpdated: result.eventsUpdated,
        eventsCancelled: result.eventsCancelled,
        status,
        errorMessage,
        durationMs,
      },
    });
  }

  private async updateSyncStatus(connectionId: string, status: string, error: string | null) {
    await prisma.channelConnection.update({
      where: { id: connectionId },
      data: {
        lastSyncAt: new Date(),
        lastSyncStatus: status,
        lastSyncError: error,
      },
    });
  }
}

export const channelSyncService = new ChannelSyncService();
