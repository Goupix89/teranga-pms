import { Prisma, UserRole, UserStatus, EstablishmentRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { prisma, createTenantClient } from '../utils/prisma';
import { NotFoundError, ValidationError, ForbiddenError } from '../utils/errors';
import { paginate, toSkipTake } from '../utils/helpers';
import { PaginationParams } from '../types';
import { config } from '../config';

// Establishment roles that MANAGER can create
const MANAGER_CREATABLE_ROLES: EstablishmentRole[] = ['SERVER', 'COOK', 'CLEANER'];

// =============================================================================
// USER SERVICE
// =============================================================================

export class UserService {
  async list(tenantId: string, params: PaginationParams, filters: {
    role?: UserRole; status?: UserStatus; search?: string;
    establishmentIds?: string[]; requestingRole?: UserRole;
  } = {}) {
    // SUPERADMIN sees all users across all tenants
    const isSuperAdmin = filters.requestingRole === 'SUPERADMIN';

    const where: Prisma.UserWhereInput = {
      // SUPERADMIN: no tenant filter; others: filter by tenant
      ...(!isSuperAdmin && { tenantId }),
      ...(filters.role && { role: filters.role }),
      ...(filters.status && { status: filters.status }),
      ...(filters.search && {
        OR: [
          { firstName: { contains: filters.search, mode: 'insensitive' as const } },
          { lastName: { contains: filters.search, mode: 'insensitive' as const } },
          { email: { contains: filters.search, mode: 'insensitive' as const } },
        ],
      }),
      // Non-SUPERADMIN users only see users from their establishments
      ...(!isSuperAdmin && filters.establishmentIds && {
        memberships: { some: { establishmentId: { in: filters.establishmentIds } } },
      }),
    };

    const select = {
      id: true, email: true, firstName: true, lastName: true,
      role: true, status: true, phone: true,
      lastLoginAt: true, lastActiveAt: true, createdAt: true,
      tenantId: true,
      tenant: isSuperAdmin ? { select: { id: true, name: true, slug: true } } : false,
      memberships: {
        select: {
          establishmentId: true,
          role: true,
          establishment: { select: { id: true, name: true } },
        },
      },
    };

    const [data, total] = await Promise.all([
      prisma.user.findMany({ where, select, ...toSkipTake(params), orderBy: { createdAt: 'desc' } }),
      prisma.user.count({ where }),
    ]);

    return paginate(data, total, params);
  }

  async getById(_tenantId: string, id: string) {
    const user = await prisma.user.findFirst({
      where: { id },
      select: {
        id: true, email: true, firstName: true, lastName: true,
        role: true, status: true, phone: true,
        lastLoginAt: true, lastActiveAt: true, createdAt: true, updatedAt: true,
        memberships: {
          select: {
            establishmentId: true,
            role: true,
            establishment: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!user) throw new NotFoundError('Utilisateur');
    return user;
  }

  async create(tenantId: string, data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
    establishmentIds?: string[];
    establishmentRole?: EstablishmentRole;
  }, requestingEstRole?: EstablishmentRole) {
    // MANAGER can only create SERVER, COOK, CLEANER → status PENDING_APPROVAL
    if (requestingEstRole === 'MANAGER') {
      if (data.establishmentRole && !MANAGER_CREATABLE_ROLES.includes(data.establishmentRole)) {
        throw new ForbiddenError('Un manager ne peut créer que des serveurs, cuisiniers ou agents d\'entretien');
      }
      if (!data.establishmentRole) {
        throw new ForbiddenError('Le rôle d\'établissement est requis');
      }
    }

    // DAF can create MANAGER, SERVER, COOK, CLEANER, POS — not DAF or OWNER
    if (requestingEstRole === 'DAF') {
      if (data.establishmentRole === 'DAF' || data.establishmentRole === 'OWNER') {
        throw new ForbiddenError('Un DAF ne peut pas créer un DAF ou un propriétaire');
      }
    }

    // OWNER can create any role except OWNER (one OWNER per establishment)
    if (requestingEstRole === 'OWNER') {
      if (data.establishmentRole === 'OWNER') {
        throw new ForbiddenError('Il ne peut y avoir qu\'un seul propriétaire par établissement');
      }
    }

    const passwordHash = await bcrypt.hash(data.password, config.bcrypt.saltRounds);

    // Users created by MANAGER or DAF need approval (from DAF/OWNER or OWNER respectively)
    const needsApproval = requestingEstRole === 'MANAGER' || requestingEstRole === 'DAF';

    const user = await prisma.user.create({
      data: {
        tenantId,
        email: data.email.toLowerCase().trim(),
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        role: 'EMPLOYEE',
        status: needsApproval ? 'PENDING_APPROVAL' : 'ACTIVE',
        phone: data.phone,
        ...(data.establishmentIds && data.establishmentIds.length > 0 && data.establishmentRole && {
          memberships: {
            createMany: {
              data: data.establishmentIds.map((estId) => ({
                establishmentId: estId,
                role: data.establishmentRole!,
              })),
            },
          },
        }),
      },
      select: {
        id: true, email: true, firstName: true, lastName: true,
        role: true, status: true, createdAt: true,
        memberships: {
          select: {
            establishmentId: true,
            role: true,
            establishment: { select: { id: true, name: true } },
          },
        },
      },
    });

    return user;
  }

  async approve(tenantId: string, id: string) {
    const user = await prisma.user.findFirst({ where: { id, tenantId } });
    if (!user) throw new NotFoundError('Utilisateur');

    if (user.status !== 'PENDING_APPROVAL') {
      throw new ValidationError('Cet utilisateur n\'est pas en attente d\'approbation');
    }

    return prisma.user.update({
      where: { id },
      data: { status: 'ACTIVE' },
      select: {
        id: true, email: true, firstName: true, lastName: true,
        role: true, status: true, createdAt: true,
        memberships: {
          select: {
            establishmentId: true,
            role: true,
            establishment: { select: { id: true, name: true } },
          },
        },
      },
    });
  }

  async update(tenantId: string, id: string, data: {
    firstName?: string;
    lastName?: string;
    phone?: string | null;
    status?: UserStatus;
    establishmentIds?: string[];
    establishmentRole?: EstablishmentRole;
  }, requestingEstRole: EstablishmentRole | null) {
    const user = await prisma.user.findFirst({ where: { id } });
    if (!user) throw new NotFoundError('Utilisateur');

    // Can't demote a SUPERADMIN
    if (user.role === 'SUPERADMIN') {
      throw new ValidationError('Impossible de modifier un super administrateur via cette méthode');
    }

    const { establishmentIds, establishmentRole, ...updateData } = data;

    // Sync memberships: delete existing, create new
    if (establishmentIds !== undefined && establishmentRole) {
      await prisma.establishmentMember.deleteMany({
        where: { userId: id },
      });

      if (establishmentIds.length > 0) {
        await prisma.establishmentMember.createMany({
          data: establishmentIds.map((estId) => ({
            userId: id,
            establishmentId: estId,
            role: establishmentRole,
          })),
        });
      }
    }

    return prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true, email: true, firstName: true, lastName: true,
        role: true, status: true, phone: true, updatedAt: true,
        memberships: {
          select: {
            establishmentId: true,
            role: true,
            establishment: { select: { id: true, name: true } },
          },
        },
      },
    });
  }

  async archive(tenantId: string, id: string) {
    const user = await prisma.user.findFirst({ where: { id } });
    if (!user) throw new NotFoundError('Utilisateur');

    if (user.role === 'SUPERADMIN') {
      // Check if it's the last superadmin
      const superAdminCount = await prisma.user.count({
        where: { tenantId, role: 'SUPERADMIN', status: 'ACTIVE' },
      });
      if (superAdminCount <= 1) {
        throw new ValidationError('Impossible d\'archiver le dernier super administrateur');
      }
    }

    // Revoke all sessions
    await prisma.refreshToken.updateMany({
      where: { userId: id },
      data: { revoked: true },
    });

    return prisma.user.update({
      where: { id },
      data: { status: 'ARCHIVED', archivedAt: new Date() },
    });
  }

  async unarchive(id: string) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundError('Utilisateur');

    if (user.status !== 'ARCHIVED') {
      throw new ValidationError('Cet utilisateur n\'est pas archivé');
    }

    return prisma.user.update({
      where: { id },
      data: { status: 'ACTIVE', archivedAt: null },
      select: {
        id: true, email: true, firstName: true, lastName: true,
        role: true, status: true, createdAt: true,
      },
    });
  }

  async hardDelete(id: string) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundError('Utilisateur');

    if (user.role === 'SUPERADMIN') {
      throw new ValidationError('Impossible de supprimer un super administrateur');
    }

    // Delete related data in transaction (order matters for FK constraints)
    await prisma.$transaction(async (tx) => {
      // Approval requests
      await tx.approvalRequest.deleteMany({ where: { requestedById: id } });
      await tx.approvalRequest.deleteMany({ where: { reviewedById: id } });
      // Nullify stock movement approver references
      await tx.stockMovement.updateMany({ where: { approvedById: id }, data: { approvedById: null } });
      // Stock movements performed by user
      await tx.stockMovement.deleteMany({ where: { performedById: id } });
      // Articles created by user — unlink instead of delete
      await tx.article.updateMany({ where: { createdById: id }, data: { createdById: null } });
      // Order items then orders
      const userOrders = await tx.order.findMany({ where: { createdById: id }, select: { id: true } });
      if (userOrders.length > 0) {
        const orderIds = userOrders.map((o) => o.id);
        await tx.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
        await tx.order.deleteMany({ where: { id: { in: orderIds } } });
      }
      // Invoice items then invoices
      const userInvoices = await tx.invoice.findMany({ where: { createdById: id }, select: { id: true } });
      if (userInvoices.length > 0) {
        const invoiceIds = userInvoices.map((i) => i.id);
        await tx.invoiceItem.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
        await tx.invoice.deleteMany({ where: { id: { in: invoiceIds } } });
      }
      // Cleaning sessions
      await tx.cleaningSession.deleteMany({ where: { cleanerId: id } });
      // Notifications & device tokens
      await tx.notification.deleteMany({ where: { userId: id } });
      await tx.deviceToken.deleteMany({ where: { userId: id } });
      // Sessions & memberships
      await tx.refreshToken.deleteMany({ where: { userId: id } });
      await tx.establishmentMember.deleteMany({ where: { userId: id } });
      // Finally the user
      await tx.user.delete({ where: { id } });
    });
  }
}

export const userService = new UserService();

// =============================================================================
// ESTABLISHMENT SERVICE
// =============================================================================

export class EstablishmentService {
  async list(tenantId: string, params: PaginationParams, establishmentIds?: string[], isSuperAdmin = false) {
    const where: Prisma.EstablishmentWhereInput = {
      isActive: true,
      // SUPERADMIN sees all establishments; others: filter by tenant + memberships
      ...(!isSuperAdmin && { tenantId }),
      ...(!isSuperAdmin && establishmentIds && { id: { in: establishmentIds } }),
    };

    const [data, total] = await Promise.all([
      prisma.establishment.findMany({
        where,
        include: {
          _count: { select: { rooms: true } },
          ...(isSuperAdmin && { tenant: { select: { id: true, name: true, slug: true } } }),
        },
        ...toSkipTake(params),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.establishment.count({ where }),
    ]);

    return paginate(data, total, params);
  }

  async getById(tenantId: string, id: string) {
    const db = createTenantClient(tenantId);

    const est = await db.establishment.findFirst({
      where: { id },
      include: {
        rooms: {
          where: { isActive: true },
          select: { id: true, number: true, type: true, status: true, pricePerNight: true },
          orderBy: { number: 'asc' },
        },
        _count: { select: { rooms: true } },
      },
    });

    if (!est) throw new NotFoundError('Établissement');
    return est;
  }

  async create(tenantId: string, data: {
    name: string; address: string; city: string; country: string;
    phone?: string; email?: string; website?: string; starRating?: number;
    timezone?: string; currency?: string;
  }, creatorUserId?: string) {
    const establishment = await prisma.establishment.create({
      data: { tenantId, ...data },
    });

    // Add the creator as OWNER member of the new establishment
    if (creatorUserId) {
      await prisma.establishmentMember.create({
        data: {
          userId: creatorUserId,
          establishmentId: establishment.id,
          role: 'OWNER',
        },
      });
    }

    // Create default article categories for the new establishment
    const defaultCategories = ['Restaurant', 'Boissons', 'Fournitures'];
    for (const name of defaultCategories) {
      await prisma.articleCategory.upsert({
        where: { tenantId_establishmentId_name: { tenantId, establishmentId: establishment.id, name } },
        update: {},
        create: { tenantId, establishmentId: establishment.id, name },
      });
    }

    return establishment;
  }

  async update(tenantId: string, id: string, data: Partial<{
    name: string; address: string; city: string; country: string;
    phone: string; email: string; website: string; starRating: number;
    timezone: string; currency: string;
  }>) {
    const est = await prisma.establishment.findFirst({ where: { id, tenantId } });
    if (!est) throw new NotFoundError('Établissement');

    return prisma.establishment.update({ where: { id }, data });
  }

  async delete(tenantId: string, id: string) {
    const est = await prisma.establishment.findFirst({ where: { id, tenantId } });
    if (!est) throw new NotFoundError('Établissement');

    return prisma.establishment.update({
      where: { id },
      data: { isActive: false },
    });
  }
}

export const establishmentService = new EstablishmentService();

// =============================================================================
// SUPPLIER SERVICE
// =============================================================================

export class SupplierService {
  async list(tenantId: string, params: PaginationParams, search?: string) {
    const db = createTenantClient(tenantId);

    const where: Prisma.SupplierWhereInput = {
      isActive: true,
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { email: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      db.supplier.findMany({ where, ...toSkipTake(params) }),
      db.supplier.count({ where }),
    ]);

    return paginate(data, total, params);
  }

  async getById(tenantId: string, id: string) {
    const db = createTenantClient(tenantId);

    const supplier = await db.supplier.findFirst({
      where: { id },
      include: {
        stockMovements: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            article: { select: { name: true, sku: true } },
          },
        },
      },
    });

    if (!supplier) throw new NotFoundError('Fournisseur');
    return supplier;
  }

  async create(tenantId: string, data: {
    name: string; email?: string; phone?: string;
    address?: string; notes?: string;
  }) {
    return prisma.supplier.create({
      data: { tenantId, ...data },
    });
  }

  async update(tenantId: string, id: string, data: Partial<{
    name: string; email: string; phone: string;
    address: string; notes: string; isActive: boolean;
  }>) {
    const supplier = await prisma.supplier.findFirst({ where: { id, tenantId } });
    if (!supplier) throw new NotFoundError('Fournisseur');

    return prisma.supplier.update({ where: { id }, data });
  }

  async delete(tenantId: string, id: string) {
    const supplier = await prisma.supplier.findFirst({ where: { id, tenantId } });
    if (!supplier) throw new NotFoundError('Fournisseur');

    return prisma.supplier.update({
      where: { id },
      data: { isActive: false },
    });
  }
}

export const supplierService = new SupplierService();

// =============================================================================
// ARTICLE & CATEGORY SERVICE
// =============================================================================

export class ArticleService {
  async list(tenantId: string, params: PaginationParams, filters: { categoryId?: string; search?: string; lowStock?: boolean; includeUnapproved?: boolean; menuOnly?: boolean; establishmentId?: string } = {}) {
    const db = createTenantClient(tenantId);

    const where: any = {
      isActive: true,
      ...(filters.includeUnapproved ? {} : { isApproved: true }),
      ...(filters.establishmentId && { establishmentId: filters.establishmentId }),
      ...(filters.categoryId && { categoryId: filters.categoryId }),
      ...(filters.menuOnly && {
        isApproved: true,
      }),
      ...(filters.search && {
        OR: [
          { name: { contains: filters.search, mode: 'insensitive' } },
          { sku: { contains: filters.search, mode: 'insensitive' } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      db.article.findMany({
        where,
        include: { category: { select: { id: true, name: true } } },
        ...toSkipTake(params),
      }),
      db.article.count({ where }),
    ]);

    // Convert Decimal fields to numbers for JSON serialization (mobile compatibility)
    const serialized = data.map((a: any) => ({
      ...a,
      unitPrice: Number(a.unitPrice),
      costPrice: Number(a.costPrice),
    }));

    return paginate(serialized, total, params);
  }

  async getLowStock(tenantId: string) {
    // Use raw query for column comparison (current_stock <= minimum_stock)
    return prisma.$queryRaw`
      SELECT a.*, c.name as category_name
      FROM articles a
      LEFT JOIN article_categories c ON a.category_id = c.id
      WHERE a.tenant_id = ${tenantId}
        AND a.is_active = true
        AND a.current_stock <= a.minimum_stock
      ORDER BY (a.current_stock::float / NULLIF(a.minimum_stock, 0)) ASC
    `;
  }

  async getById(tenantId: string, id: string) {
    const db = createTenantClient(tenantId);

    const article = await db.article.findFirst({
      where: { id },
      include: {
        category: { select: { id: true, name: true } },
        stockMovements: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: {
            performedBy: { select: { firstName: true, lastName: true } },
            supplier: { select: { name: true } },
          },
        },
      },
    });

    if (!article) throw new NotFoundError('Article');
    return { ...article, unitPrice: Number(article.unitPrice), costPrice: Number(article.costPrice) };
  }

  async findByName(tenantId: string, name: string) {
    const db = createTenantClient(tenantId);
    return db.article.findFirst({
      where: { tenantId, name: { equals: name, mode: 'insensitive' }, isActive: true },
    });
  }

  async create(tenantId: string, data: {
    categoryId?: string; name: string; sku?: string;
    description?: string; imageUrl?: string; unitPrice: number; costPrice?: number;
    currentStock?: number; minimumStock?: number; unit?: string;
    isApproved?: boolean; createdById?: string; establishmentId?: string;
  }) {
    const article = await prisma.article.create({
      data: { tenantId, ...data },
      include: { category: { select: { id: true, name: true } } },
    });
    return { ...article, unitPrice: Number(article.unitPrice), costPrice: Number(article.costPrice) };
  }

  async update(tenantId: string, id: string, data: any) {
    const article = await prisma.article.findFirst({ where: { id, tenantId } });
    if (!article) throw new NotFoundError('Article');

    return prisma.article.update({
      where: { id },
      data,
      include: { category: { select: { id: true, name: true } } },
    });
  }

  /**
   * Permanently delete an article.
   * Refuses if the article is referenced in existing orders or invoices.
   * Cascades: removes stockMovements and stockAlerts.
   */
  async delete(tenantId: string, id: string) {
    const article = await prisma.article.findFirst({ where: { id, tenantId } });
    if (!article) throw new NotFoundError('Article');

    // Check for order/invoice references
    const [orderItemCount, invoiceItemCount] = await Promise.all([
      prisma.orderItem.count({ where: { articleId: id } }),
      prisma.invoiceItem.count({ where: { articleId: id } }),
    ]);

    if (orderItemCount > 0 || invoiceItemCount > 0) {
      throw new ValidationError(
        `Impossible de supprimer : cet article est référencé dans ${orderItemCount} commande(s) et ${invoiceItemCount} facture(s). Désactivez-le à la place.`
      );
    }

    // Delete related data then article in a transaction
    await prisma.$transaction([
      prisma.stockAlert.deleteMany({ where: { articleId: id } }),
      prisma.stockMovement.deleteMany({ where: { articleId: id } }),
      prisma.article.delete({ where: { id } }),
    ]);

    return { deleted: true, id };
  }

  /**
   * Find duplicate articles: same name (case-insensitive), including inactive.
   */
  async findDuplicates(tenantId: string) {
    const db = createTenantClient(tenantId);

    // Get all articles (active + inactive)
    const articles = await db.article.findMany({
      where: {},
      include: { category: { select: { id: true, name: true } } },
      orderBy: { name: 'asc' },
    });

    // Group by lowercased name
    const groups = new Map<string, typeof articles>();
    for (const article of articles) {
      const key = article.name.trim().toLowerCase();
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(article);
    }

    // Keep only groups with >1 article
    const duplicateGroups = [...groups.entries()]
      .filter(([, g]) => g.length > 1)
      .map(([name, group]) => ({
        name,
        count: group.length,
        articles: group.map((a: any) => ({
          id: a.id,
          name: a.name,
          sku: a.sku,
          unitPrice: Number(a.unitPrice),
          currentStock: a.currentStock,
          isActive: a.isActive,
          isApproved: a.isApproved,
          category: a.category?.name || null,
          createdAt: a.createdAt,
        })),
      }));

    return {
      duplicateGroups,
      summary: {
        totalGroups: duplicateGroups.length,
        totalDuplicateArticles: duplicateGroups.reduce((s, g) => s + g.count - 1, 0),
      },
    };
  }
}

export const articleService = new ArticleService();

export class CategoryService {
  async list(tenantId: string, establishmentId?: string) {
    const db = createTenantClient(tenantId);

    const where: any = {
      ...(establishmentId && { establishmentId }),
    };

    return db.articleCategory.findMany({
      where,
      include: {
        children: true,
        _count: { select: { articles: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async create(tenantId: string, data: { name: string; parentId?: string; establishmentId?: string }) {
    return prisma.articleCategory.create({
      data: { tenantId, ...data },
    });
  }

  async update(tenantId: string, id: string, data: { name?: string; parentId?: string | null }) {
    const cat = await prisma.articleCategory.findFirst({ where: { id, tenantId } });
    if (!cat) throw new NotFoundError('Catégorie');

    return prisma.articleCategory.update({ where: { id }, data });
  }
}

export const categoryService = new CategoryService();
