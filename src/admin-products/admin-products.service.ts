import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, Not, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { CloudinaryService } from '../common/cloudinary/cloudinary.service';

interface UploadedImageFile {
  originalname: string;
  buffer: Buffer;
  mimetype: string;
  size: number;
}
import { Product } from '../entities/product.entity';
import { ProductImage } from '../entities/product-image.entity';
import { OrderItem } from '../entities/order-item.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductImageDto } from './dto/product-image.dto';

@Injectable()
export class AdminProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(ProductImage)
    private readonly imageRepo: Repository<ProductImage>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepo: Repository<OrderItem>,
    private readonly dataSource: DataSource,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  // ── LIST (admin: all products, including inactive) ────────────────────────

  async findAll(): Promise<Product[]> {
    return this.productRepo.find({
      relations: ['images', 'category'],
      order: { createdAt: 'DESC', images: { sortOrder: 'ASC' } },
    });
  }

  // ── CREATE ────────────────────────────────────────────────────────────────

  async create(dto: CreateProductDto): Promise<Product> {
    const slug = await this.resolveSlug(dto.slug, dto.name);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const productRepo = queryRunner.manager.getRepository(Product);
      const imageRepo = queryRunner.manager.getRepository(ProductImage);

      const product = productRepo.create({
        name: dto.name,
        slug,
        description: dto.description ?? null,
        basePrice: dto.basePrice.toFixed(2),
        currency: dto.currency ?? 'NGN',
        categoryId: dto.categoryId ?? null,
        stock: dto.stock ?? 0,
        lowStockThreshold: dto.lowStockThreshold ?? 5,
        isActive: dto.isActive ?? true,
      });
      const saved = await productRepo.save(product);

      if (dto.images?.length) {
        await imageRepo.save(
          dto.images.map((img, i) =>
            imageRepo.create({
              productId: saved.id,
              url: img.url,
              sortOrder: img.sortOrder ?? i,
            }),
          ),
        );
      }

      await queryRunner.commitTransaction();

      return this.findOneOrFail(saved.id);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      this.rethrowDbError(err);
    } finally {
      await queryRunner.release();
    }
  }

  // ── UPDATE ────────────────────────────────────────────────────────────────

  async update(id: string, dto: UpdateProductDto): Promise<Product> {
    const product = await this.findOneOrFail(id);

    // Determine slug: explicit override → regen from new name → keep current
    let slug = product.slug;
    if (dto.slug !== undefined) {
      slug = await this.resolveSlug(dto.slug, dto.name ?? product.name, id);
    } else if (dto.name !== undefined && dto.name !== product.name) {
      slug = await this.resolveSlug(undefined, dto.name, id);
    }

    if (dto.name !== undefined) product.name = dto.name;
    if (dto.description !== undefined) product.description = dto.description;
    if (dto.basePrice !== undefined) product.basePrice = dto.basePrice.toFixed(2);
    if (dto.currency !== undefined) product.currency = dto.currency;
    if (dto.stock !== undefined) product.stock = dto.stock;
    if (dto.lowStockThreshold !== undefined) product.lowStockThreshold = dto.lowStockThreshold;
    if (dto.categoryId !== undefined) product.categoryId = dto.categoryId;
    if (dto.isActive !== undefined) product.isActive = dto.isActive;
    product.slug = slug;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      await queryRunner.manager.getRepository(Product).save(product);

      // Replace images only when the caller explicitly includes the key
      if (dto.images !== undefined) {
        await queryRunner.manager
          .getRepository(ProductImage)
          .delete({ productId: id });

        if (dto.images.length > 0) {
          await queryRunner.manager.getRepository(ProductImage).save(
            dto.images.map((img, i) =>
              queryRunner.manager.getRepository(ProductImage).create({
                productId: id,
                url: img.url,
                sortOrder: img.sortOrder ?? i,
              }),
            ),
          );
        }
      }

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      this.rethrowDbError(err);
    } finally {
      await queryRunner.release();
    }

    return this.findOneOrFail(id);
  }

  // ── DELETE ────────────────────────────────────────────────────────────────

  async remove(id: string): Promise<{ deleted: true; id: string }> {
    const product = await this.findOneOrFail(id);

    // Reject deletion if any order has ever referenced this product.
    // (The FK is RESTRICT so the DB would reject it too, but we surface a
    //  friendlier error before hitting the constraint.)
    const orderedCount = await this.orderItemRepo.count({
      where: { productId: product.id },
    });
    if (orderedCount > 0) {
      throw new ConflictException(
        'This product has existing orders and cannot be deleted. ' +
          'Deactivate it instead via PATCH /admin/products/:id/toggle-active.',
      );
    }

    await this.productRepo.remove(product);
    return { deleted: true, id };
  }

  // ── TOGGLE ACTIVE ─────────────────────────────────────────────────────────

  async toggleActive(id: string): Promise<Product> {
    const product = await this.findOneOrFail(id);
    product.isActive = !product.isActive;
    await this.productRepo.save(product);
    return this.findOneOrFail(id);
  }

  // ── UPLOAD IMAGES ─────────────────────────────────────────────────────────

  async uploadImages(
    files: UploadedImageFile[],
  ): Promise<{ urls: string[] }> {
    const urls: string[] = [];
    for (const file of files) {
      const { secureUrl } = await this.cloudinaryService.uploadBuffer(
        file.buffer,
        'products',
        'image',
      );
      urls.push(secureUrl);
    }
    return { urls };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async findOneOrFail(id: string): Promise<Product> {
    const product = await this.productRepo.findOne({
      where: { id },
      relations: ['images', 'category'],
      order: { images: { sortOrder: 'ASC' } },
    });
    if (!product) throw new NotFoundException(`Product with id "${id}" not found.`);
    return product;
  }

  /**
   * Resolves the final slug to use.
   * - If an explicit slug is supplied, sanitise and check uniqueness.
   * - Otherwise auto-generate from name, appending a counter until unique.
   * `excludeId` is passed on updates so the product doesn't conflict with itself.
   */
  private async resolveSlug(
    explicit: string | undefined,
    name: string,
    excludeId?: string,
  ): Promise<string> {
    if (explicit !== undefined) {
      const sanitised = sanitiseSlug(explicit);
      if (!sanitised) throw new BadRequestException('slug produced an empty string.');
      await this.assertSlugUnique(sanitised, excludeId);
      return sanitised;
    }

    const base = slugifyName(name);
    return this.generateUniqueProductSlug(base, excludeId);
  }

  private async generateUniqueProductSlug(
    base: string,
    excludeId?: string,
  ): Promise<string> {
    let candidate = base;
    let counter = 1;
    while (await this.slugExists(candidate, excludeId)) {
      candidate = `${base}-${counter}`;
      counter++;
    }
    return candidate;
  }

  private async slugExists(slug: string, excludeId?: string): Promise<boolean> {
    const where = excludeId
      ? { slug, id: Not(excludeId) }
      : { slug };
    return (await this.productRepo.count({ where })) > 0;
  }

  private async assertSlugUnique(slug: string, excludeId?: string): Promise<void> {
    if (await this.slugExists(slug, excludeId)) {
      throw new ConflictException(`Slug "${slug}" is already in use.`);
    }
  }

  /** Surface human-readable messages for known DB constraint violations. */
  private rethrowDbError(err: unknown): never {
    const msg =
      err instanceof Error ? err.message : String(err);
    if (msg.includes('UQ_products_slug') || msg.includes('unique constraint')) {
      throw new ConflictException('A product with that slug already exists.');
    }
    throw err;
  }
}

// ── Pure helpers ─────────────────────────────────────────────────────────────

function slugifyName(name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'product';
}

function sanitiseSlug(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Satisfy TS — ProductImageDto is used via dto parameter types above.
void ProductImageDto;
