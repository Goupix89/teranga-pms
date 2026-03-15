import { Prisma, UserRole, UserStatus } from '@prisma/client';
import bcrypt from 'bcrypt';
import { prisma, createTenantClient } from '../utils/prisma';
import { NotFoundError, ValidationError, ForbiddenError } from '../utils/errors';
import { paginate, toSkipTake } from '../utils/helpers';
import { PaginationParams } from '../types';
import { config } from '../config';

// =============================================================================
// USER SERVICE
// =============================================================================

export class UserService {
  async list(tenantId: string, params: PaginationParams, filters: {
    role?: UserRole; status?: UserStatus; search?: string;
    establishmentIds?: string[]; requestingRole?: UserRole;
  } = {}) {
    const db = createTenantClient(tenantId);

    const where: Prisma.UserWhereInput = {
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
      ...(filters.requestingRole !== 'SUPERADMIN' && filters.establishmentIds && {
        establishments: { some: { id: { in: filters.establishmentIds } } },
      }),
    };

    const select = {
      id: true, email: true, firstName: true, lastName: true,
      role: true, status: true, phone: true,
      lastLoginAt: true, lastActiveAt: true, createdAt: true,
      establishments: { select: { id: true, name: true } },
    };

    const [data, total] = await Promise.all([
      db.user.findMany({ where, select, ...toSkipTake(params) }),
      db.user.count({ where }),
    ]);

    return paginate(data, total, params);
  }

  async getById(tenantId: string, id: string) {
    const db = createTenantClient(tenantId);

    const user = await db.user.findFirst({
      where: { id },
      select: {
        id: true, email: true, firstName: true, lastName: true,
        role: true, status: true, phone: true,
        lastLoginAt: true, lastActiveAt: true, createdAt: true, updatedAt: true,
        establishments: { select: { id: true, name: true } },
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
    role?: UserRole;
    phone?: string;
    establishmentIds?: string[];
  }, requestingRole?: UserRole, requestingEstablishmentIds?: string[]) {
    // MANAGER can only create EMPLOYEE users
    if (requestingRole === 'MANAGER') {
      if (data.role && data.role !== 'EMPLOYEE') {
        throw new ForbiddenError('Un manager ne peut créer que des employés');
      }
      data.role = 'EMPLOYEE';

      // Manager can only assign users to their own establishments
      if (data.establishmentIds && requestingEstablishmentIds) {
        const unauthorized = data.establishmentIds.filter(
          (id) => !requestingEstablishmentIds.includes(id)
        );
        if (unauthorized.length > 0) {
          throw new ForbiddenError('Vous ne pouvez assigner un utilisateur qu\'à vos propres établissements');
        }
      }
    }

    // ADMIN can create MANAGER and EMPLOYEE, not SUPERADMIN
    if (requestingRole === 'ADMIN') {
      if (data.role === 'SUPERADMIN') {
        throw new ForbiddenError('Seul un super administrateur peut créer un autre super administrateur');
      }
      if (data.role === 'ADMIN') {
        throw new ForbiddenError('Seul un super administrateur peut créer un administrateur d\'établissement');
      }
    }

    const passwordHash = await bcrypt.hash(data.password, config.bcrypt.saltRounds);

    // Users created by MANAGER need admin approval
    const needsApproval = requestingRole === 'MANAGER';

    return prisma.user.create({
      data: {
        tenantId,
        email: data.email.toLowerCase().trim(),
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role || 'EMPLOYEE',
        status: needsApproval ? 'PENDING_APPROVAL' : 'ACTIVE',
        phone: data.phone,
        ...(data.establishmentIds && {
          establishments: {
            connect: data.establishmentIds.map((id) => ({ id })),
          },
        }),
      },
      select: {
        id: true, email: true, firstName: true, lastName: true,
        role: true, status: true, createdAt: true,
        establishments: { select: { id: true, name: true } },
      },
    });
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
        establishments: { select: { id: true, name: true } },
      },
    });
  }

  async update(tenantId: string, id: string, data: {
    firstName?: string;
    lastName?: string;
    role?: UserRole;
    phone?: string | null;
    status?: UserStatus;
    establishmentIds?: string[];
  }, requestingUserRole: UserRole) {
    const user = await prisma.user.findFirst({ where: { id, tenantId } });
    if (!user) throw new NotFoundError('Utilisateur');

    // Only SUPERADMIN and ADMIN can change roles
    if (data.role && requestingUserRole !== 'SUPERADMIN' && requestingUserRole !== 'ADMIN') {
      throw new ForbiddenError('Seul un administrateur peut modifier les rôles');
    }

    // ADMIN can't assign SUPERADMIN or ADMIN roles
    if (data.role && requestingUserRole === 'ADMIN' && (data.role === 'SUPERADMIN' || data.role === 'ADMIN')) {
      throw new ForbiddenError('Seul un super administrateur peut attribuer ce rôle');
    }

    // Can't demote yourself
    if (data.role && user.role === 'SUPERADMIN' && data.role !== 'SUPERADMIN') {
      throw new ValidationError('Un super administrateur ne peut pas se rétrograder');
    }

    const { establishmentIds, ...updateData } = data;

    return prisma.user.update({
      where: { id },
      data: {
        ...updateData,
        ...(establishmentIds !== undefined && {
          establishments: {
            set: establishmentIds.map((estId) => ({ id: estId })),
          },
        }),
      },
      select: {
        id: true, email: true, firstName: true, lastName: true,
        role: true, status: true, phone: true, updatedAt: true,
        establishments: { select: { id: true, name: true } },
      },
    });
  }

  async archive(tenantId: string, id: string) {
    const user = await prisma.user.findFirst({ where: { id, tenantId } });
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
}

export const userService = new UserService();

// =============================================================================
// ESTABLISHMENT SERVICE
// =============================================================================

export class EstablishmentService {
  async list(tenantId: string, params: PaginationParams, establishmentIds?: string[]) {
    const db = createTenantClient(tenantId);

    const where: Prisma.EstablishmentWhereInput = {
      isActive: true,
      ...(establishmentIds && { id: { in: establishmentIds } }),
    };

    const [data, total] = await Promise.all([
      db.establishment.findMany({
        where,
        include: { _count: { select: { rooms: true } } },
        ...toSkipTake(params),
      }),
      db.establishment.count({ where }),
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
    phone?: string; email?: string; starRating?: number;
    timezone?: string; currency?: string;
  }) {
    return prisma.establishment.create({
      data: { tenantId, ...data },
    });
  }

  async update(tenantId: string, id: string, data: Partial<{
    name: string; address: string; city: string; country: string;
    phone: string; email: string; starRating: number;
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
  async list(tenantId: string, params: PaginationParams, filters: { categoryId?: string; search?: string; lowStock?: boolean } = {}) {
    const db = createTenantClient(tenantId);

    const where: any = {
      isActive: true,
      ...(filters.categoryId && { categoryId: filters.categoryId }),
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

    return paginate(data, total, params);
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
    return article;
  }

  async create(tenantId: string, data: {
    categoryId?: string; name: string; sku?: string;
    description?: string; unitPrice: number; costPrice?: number;
    currentStock?: number; minimumStock?: number; unit?: string;
  }) {
    return prisma.article.create({
      data: { tenantId, ...data },
      include: { category: { select: { id: true, name: true } } },
    });
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
}

export const articleService = new ArticleService();

export class CategoryService {
  async list(tenantId: string) {
    const db = createTenantClient(tenantId);

    return db.articleCategory.findMany({
      include: {
        children: true,
        _count: { select: { articles: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async create(tenantId: string, data: { name: string; parentId?: string }) {
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
