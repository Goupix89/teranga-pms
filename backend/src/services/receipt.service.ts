import PDFDocument from 'pdfkit';
import { createTenantClient } from '../utils/prisma';
import { NotFoundError } from '../utils/errors';
const QRCode = require('qrcode');

const PAYMENT_LABELS: Record<string, string> = {
  CASH: 'Espèces',
  CARD: 'Carte bancaire',
  BANK_TRANSFER: 'Virement',
  MOBILE_MONEY: 'Mobile Money',
  MOOV_MONEY: 'Flooz (Moov Money)',
  MIXX_BY_YAS: 'Yas (MTN)',
  OTHER: 'Autre',
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR').format(Math.round(amount)) + ' FCFA';
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Africa/Lome',
  });
}

export class ReceiptService {
  /**
   * Generate a PDF receipt for an order.
   */
  async generatePdf(tenantId: string, orderId: string): Promise<Buffer> {
    const db = createTenantClient(tenantId);

    const order = await db.order.findFirst({
      where: { id: orderId },
      include: {
        items: {
          include: {
            article: { select: { name: true } },
          },
        },
        establishment: {
          select: {
            name: true,
            address: true,
            city: true,
            country: true,
            phone: true,
            email: true,
            currency: true,
          },
        },
        createdBy: { select: { firstName: true, lastName: true } },
      },
    });

    if (!order) throw new NotFoundError('Commande introuvable');

    const est = order.establishment;
    const totalAmount = Number(order.totalAmount);

    // Generate QR code
    const qrPayload = JSON.stringify({
      type: 'TERANGA_PMS_RECEIPT',
      orderId: order.id,
      orderNumber: order.orderNumber,
      amount: totalAmount,
      currency: 'XOF',
      establishment: est.name,
      date: order.createdAt.toISOString(),
    });
    const qrBuffer: Buffer = await QRCode.toBuffer(qrPayload, {
      width: 120,
      margin: 1,
      color: { dark: '#3E2723', light: '#FFFFFF' },
    });

    // Build PDF — receipt-sized (80mm = ~226 points)
    const pageWidth = 226;
    const margin = 12;
    const contentWidth = pageWidth - margin * 2;

    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({
        size: [pageWidth, 600],
        margins: { top: 12, bottom: 12, left: margin, right: margin },
        bufferPages: true,
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // ── Header ──
      doc.font('Helvetica-Bold').fontSize(14).text(est.name, { align: 'center' });
      doc.font('Helvetica').fontSize(7);
      if (est.address) doc.text(est.address, { align: 'center' });
      if (est.city) doc.text(`${est.city}${est.country ? ', ' + est.country : ''}`, { align: 'center' });
      if (est.phone) doc.text(`Tél: ${est.phone}`, { align: 'center' });
      if (est.email) doc.text(est.email, { align: 'center' });

      doc.moveDown(0.3);
      this.drawSeparator(doc, margin, contentWidth);

      // ── Order info ──
      doc.font('Helvetica-Bold').fontSize(9).text(`Reçu N° ${order.orderNumber}`, { align: 'center' });
      doc.font('Helvetica').fontSize(7);
      doc.text(`Date: ${formatDate(order.createdAt)}`);
      if (order.tableNumber) doc.text(`Table: ${order.tableNumber}`);
      doc.text(`Serveur: ${order.createdBy.firstName} ${order.createdBy.lastName}`);

      doc.moveDown(0.3);
      this.drawSeparator(doc, margin, contentWidth);

      // ── Items ──
      doc.font('Helvetica').fontSize(7);
      const items = order.items as any[];
      for (const item of items) {
        const qty = item.quantity;
        const price = Number(item.unitPrice);
        const subtotal = qty * price;
        const name = item.article?.name || 'Article';
        const left = `${qty}x ${name}`;
        const right = formatCurrency(subtotal);

        // Item name on left, price on right
        const rightWidth = doc.widthOfString(right);
        const leftMaxWidth = contentWidth - rightWidth - 4;
        const truncatedName = left.length > 30 ? left.substring(0, 28) + '..' : left;

        doc.text(truncatedName, margin, doc.y, { continued: true, width: leftMaxWidth });
        doc.text(right, { align: 'right', width: contentWidth });
      }

      doc.moveDown(0.3);
      this.drawSeparator(doc, margin, contentWidth);

      // ── Total ──
      doc.font('Helvetica-Bold').fontSize(10);
      doc.text(`TOTAL: ${formatCurrency(totalAmount)}`, { align: 'right' });

      // ── Payment method ──
      if (order.paymentMethod) {
        doc.font('Helvetica').fontSize(7);
        doc.text(`Paiement: ${PAYMENT_LABELS[order.paymentMethod] || order.paymentMethod}`, { align: 'left' });
      }

      doc.moveDown(0.5);

      // ── QR Code ──
      const qrSize = 80;
      const qrX = (pageWidth - qrSize) / 2;
      doc.image(qrBuffer, qrX, doc.y, { width: qrSize, height: qrSize });
      doc.y += qrSize + 4;

      // ── Footer ──
      doc.font('Helvetica').fontSize(7);
      doc.text('Merci de votre visite !', { align: 'center' });
      doc.moveDown(0.2);
      doc.fontSize(6).text(`Généré le ${formatDate(new Date())}`, { align: 'center' });

      doc.end();
    });
  }

  /**
   * Generate a PDF for an invoice (A4 format).
   */
  async generateInvoicePdf(tenantId: string, invoiceId: string): Promise<Buffer> {
    const db = createTenantClient(tenantId);

    const invoice = await db.invoice.findFirst({
      where: { id: invoiceId },
      include: {
        items: {
          include: { article: { select: { name: true } } },
        },
        orders: {
          select: {
            orderNumber: true, tableNumber: true, paymentMethod: true,
            createdBy: { select: { firstName: true, lastName: true } },
            items: { include: { article: { select: { name: true } } } },
          },
          take: 1,
        },
        reservation: { select: { guestName: true, checkIn: true, checkOut: true } },
        createdBy: { select: { firstName: true, lastName: true } },
      },
    });

    if (!invoice) throw new NotFoundError('Facture introuvable');

    // Find establishment via order or fallback
    let establishment: any = null;
    if (invoice.orders.length > 0) {
      const order = await db.order.findFirst({
        where: { invoiceId: invoice.id },
        include: { establishment: { select: { name: true, address: true, city: true, country: true, phone: true, email: true, currency: true } } },
      });
      establishment = order?.establishment;
    }
    if (!establishment) {
      // Fallback: get first establishment of tenant
      establishment = await db.establishment.findFirst({ where: {}, select: { name: true, address: true, city: true, country: true, phone: true, email: true, currency: true } });
    }

    const subtotal = Number(invoice.subtotal);
    const taxRate = Number(invoice.taxRate);
    const taxAmount = Number(invoice.taxAmount);
    const totalAmount = Number(invoice.totalAmount);
    const order = invoice.orders[0];

    // QR code
    const qrPayload = JSON.stringify({
      type: 'TERANGA_PMS_INVOICE',
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      amount: totalAmount,
      currency: invoice.currency || 'XOF',
      status: invoice.status,
    });
    const qrBuffer: Buffer = await QRCode.toBuffer(qrPayload, {
      width: 120, margin: 1,
      color: { dark: '#3E2723', light: '#FFFFFF' },
    });

    // A4 PDF
    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 40, bottom: 40, left: 50, right: 50 },
        bufferPages: true,
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageWidth = 595.28;
      const margin = 50;
      const contentWidth = pageWidth - margin * 2;

      // ── Header ──
      if (establishment) {
        doc.font('Helvetica-Bold').fontSize(18).text(establishment.name, { align: 'center' });
        doc.font('Helvetica').fontSize(9);
        const parts = [establishment.address, establishment.city, establishment.country].filter(Boolean);
        if (parts.length) doc.text(parts.join(', '), { align: 'center' });
        if (establishment.phone) doc.text(`Tél: ${establishment.phone}`, { align: 'center' });
        if (establishment.email) doc.text(establishment.email, { align: 'center' });
      }

      doc.moveDown(1);
      doc.font('Helvetica-Bold').fontSize(16).text(`FACTURE N° ${invoice.invoiceNumber}`, { align: 'center' });
      doc.moveDown(0.5);

      // ── Info block ──
      doc.font('Helvetica').fontSize(9);
      doc.text(`Date: ${formatDate(invoice.createdAt)}`);
      doc.text(`Statut: ${invoice.status}`);
      if (invoice.reservation) {
        doc.text(`Client: ${invoice.reservation.guestName}`);
      }
      if (order) {
        doc.text(`Commande: ${order.orderNumber}`);
        if (order.tableNumber) doc.text(`Table: ${order.tableNumber}`);
        doc.text(`Serveur: ${order.createdBy.firstName} ${order.createdBy.lastName}`);
        if (order.paymentMethod) doc.text(`Paiement: ${PAYMENT_LABELS[order.paymentMethod] || order.paymentMethod}`);
      }

      doc.moveDown(0.8);

      // ── Table header ──
      const colX = { desc: margin, qty: margin + contentWidth * 0.55, unit: margin + contentWidth * 0.70, total: margin + contentWidth * 0.85 };
      doc.font('Helvetica-Bold').fontSize(9);
      const headerY = doc.y;
      doc.text('Description', colX.desc, headerY);
      doc.text('Qté', colX.qty, headerY);
      doc.text('P.U.', colX.unit, headerY);
      doc.text('Total', colX.total, headerY);

      doc.moveDown(0.3);
      const lineY = doc.y;
      doc.moveTo(margin, lineY).lineTo(margin + contentWidth, lineY).stroke('#CCCCCC');
      doc.y = lineY + 6;

      // ── Items ──
      // Use invoice items if available, otherwise fall back to order items
      const displayItems: Array<{ description: string; quantity: number; unitPrice: number; total: number }> = [];
      if (invoice.items.length > 0) {
        for (const item of invoice.items) {
          displayItems.push({
            description: item.article?.name || item.description,
            quantity: item.quantity,
            unitPrice: Number(item.unitPrice),
            total: Number(item.totalPrice),
          });
        }
      } else if (order?.items) {
        for (const item of order.items as any[]) {
          const qty = item.quantity;
          const up = Number(item.unitPrice);
          displayItems.push({
            description: item.article?.name || 'Article',
            quantity: qty,
            unitPrice: up,
            total: qty * up,
          });
        }
      }

      doc.font('Helvetica').fontSize(9);
      for (const item of displayItems) {
        const rowY = doc.y;
        doc.text(item.description, colX.desc, rowY, { width: contentWidth * 0.50 });
        doc.text(String(item.quantity), colX.qty, rowY);
        doc.text(formatCurrency(item.unitPrice), colX.unit, rowY);
        doc.text(formatCurrency(item.total), colX.total, rowY);
        doc.moveDown(0.2);
      }

      doc.moveDown(0.3);
      const sepY = doc.y;
      doc.moveTo(margin, sepY).lineTo(margin + contentWidth, sepY).stroke('#CCCCCC');
      doc.y = sepY + 8;

      // ── Totals ──
      const totalsX = margin + contentWidth * 0.60;
      doc.font('Helvetica').fontSize(9);
      doc.text(`Sous-total:`, totalsX, doc.y, { continued: true });
      doc.text(formatCurrency(subtotal), { align: 'right' });
      if (taxRate > 0) {
        doc.text(`Taxe (${taxRate}%):`, totalsX, doc.y, { continued: true });
        doc.text(formatCurrency(taxAmount), { align: 'right' });
      }
      doc.font('Helvetica-Bold').fontSize(12);
      doc.text(`TOTAL: ${formatCurrency(totalAmount)}`, { align: 'right' });

      doc.moveDown(1.5);

      // ── QR Code ──
      const qrSize = 80;
      const qrX = (pageWidth - qrSize) / 2;
      doc.image(qrBuffer, qrX, doc.y, { width: qrSize, height: qrSize });
      doc.y += qrSize + 8;

      // ── Footer ──
      doc.font('Helvetica').fontSize(8);
      doc.text('Merci de votre confiance !', { align: 'center' });
      doc.moveDown(0.2);
      doc.fontSize(7).text(`Document généré le ${formatDate(new Date())}`, { align: 'center' });

      doc.end();
    });
  }

  /**
   * Generate a PDF receipt for a reservation (ticket 80mm format).
   */
  async generateReservationPdf(tenantId: string, reservationId: string): Promise<Buffer> {
    const db = createTenantClient(tenantId);

    const reservation = await db.reservation.findFirst({
      where: { id: reservationId },
      include: {
        room: {
          select: {
            number: true, type: true, pricePerNight: true,
            establishment: { select: { name: true, address: true, city: true, country: true, phone: true, email: true, currency: true } },
          },
        },
        invoices: { select: { id: true, invoiceNumber: true, status: true, totalAmount: true }, take: 1 },
      },
    });

    if (!reservation) throw new NotFoundError('Réservation introuvable');

    const est = reservation.room.establishment;
    const totalAmount = Number(reservation.totalPrice);
    const pricePerNight = Number(reservation.room.pricePerNight);
    const checkIn = new Date(reservation.checkIn);
    const checkOut = new Date(reservation.checkOut);
    const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
    const invoice = reservation.invoices[0];

    // QR code
    const qrPayload = JSON.stringify({
      type: 'TERANGA_PMS_RESERVATION',
      reservationId: reservation.id,
      invoiceNumber: invoice?.invoiceNumber,
      amount: totalAmount,
      currency: 'XOF',
      guest: reservation.guestName,
      establishment: est.name,
    });
    const qrBuffer: Buffer = await QRCode.toBuffer(qrPayload, {
      width: 120, margin: 1,
      color: { dark: '#3E2723', light: '#FFFFFF' },
    });

    const pageWidth = 226;
    const margin = 12;
    const contentWidth = pageWidth - margin * 2;

    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({
        size: [pageWidth, 600],
        margins: { top: 12, bottom: 12, left: margin, right: margin },
        bufferPages: true,
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header
      doc.font('Helvetica-Bold').fontSize(14).text(est.name, { align: 'center' });
      doc.font('Helvetica').fontSize(7);
      if (est.address) doc.text(est.address, { align: 'center' });
      if (est.city) doc.text(`${est.city}${est.country ? ', ' + est.country : ''}`, { align: 'center' });
      if (est.phone) doc.text(`Tél: ${est.phone}`, { align: 'center' });
      if (est.email) doc.text(est.email, { align: 'center' });

      doc.moveDown(0.3);
      this.drawSeparator(doc, margin, contentWidth);

      // Reservation info
      doc.font('Helvetica-Bold').fontSize(9).text(invoice ? `Reçu N° ${invoice.invoiceNumber}` : 'Reçu de réservation', { align: 'center' });
      doc.font('Helvetica').fontSize(7);
      doc.text(`Client: ${reservation.guestName}`);
      if (reservation.guestPhone) doc.text(`Tél: ${reservation.guestPhone}`);
      doc.text(`Chambre: ${reservation.room.number} (${reservation.room.type})`);
      doc.text(`Arrivée: ${formatDate(checkIn)}`);
      doc.text(`Départ: ${formatDate(checkOut)}`);
      doc.text(`Personnes: ${reservation.numberOfGuests}`);

      doc.moveDown(0.3);
      this.drawSeparator(doc, margin, contentWidth);

      // Item line
      doc.font('Helvetica').fontSize(7);
      const itemLeft = `${nights} nuit${nights > 1 ? 's' : ''} × ${formatCurrency(pricePerNight)}`;
      const itemRight = formatCurrency(totalAmount);
      const rightWidth = doc.widthOfString(itemRight);
      doc.text(itemLeft, margin, doc.y, { continued: true, width: contentWidth - rightWidth - 4 });
      doc.text(itemRight, { align: 'right', width: contentWidth });

      doc.moveDown(0.3);
      this.drawSeparator(doc, margin, contentWidth);

      // Total
      doc.font('Helvetica-Bold').fontSize(10);
      doc.text(`TOTAL: ${formatCurrency(totalAmount)}`, { align: 'right' });

      // Payment status
      doc.font('Helvetica').fontSize(7);
      if (invoice) {
        const statusLabel = invoice.status === 'PAID' ? 'Payée' : invoice.status === 'ISSUED' ? 'En attente' : invoice.status;
        doc.text(`Facture: ${invoice.invoiceNumber} — ${statusLabel}`);
      }

      doc.moveDown(0.5);

      // QR Code
      const qrSize = 80;
      const qrX = (pageWidth - qrSize) / 2;
      doc.image(qrBuffer, qrX, doc.y, { width: qrSize, height: qrSize });
      doc.y += qrSize + 4;

      // Footer
      doc.font('Helvetica').fontSize(7);
      doc.text('Merci de votre visite !', { align: 'center' });
      doc.moveDown(0.2);
      doc.fontSize(6).text(`Généré le ${formatDate(new Date())}`, { align: 'center' });

      doc.end();
    });
  }

  private drawSeparator(doc: PDFKit.PDFDocument, x: number, width: number) {
    const y = doc.y;
    doc.moveTo(x, y).lineTo(x + width, y).dash(2, { space: 2 }).stroke('#999999').undash();
    doc.y = y + 6;
  }
}

export const receiptService = new ReceiptService();
