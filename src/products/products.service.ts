import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../entities/product.entity';
import { Category } from '../entities/category.entity';

export interface ProductListItemDto {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  basePrice: string;
  currency: string;
  category: string;
  imageUrl: string | null;
  /** True when stock > 0 — quantity never exposed publicly. */
  inStock: boolean;
}

export interface ProductDetailDto {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  basePrice: string;
  currency: string;
  category: string;
  /** True when stock > 0; stock quantity is never exposed. */
  inStock: boolean;
  images: string[];
}

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
  ) {}

  /**
   * List active products with their first image (by sort_order).
   * Optionally filter by category slug.
   */
  async findActive(categorySlug?: string): Promise<ProductListItemDto[]> {
    let categoryId: string | undefined;
    if (categorySlug) {
      const cat = await this.categoryRepository.findOne({ where: { slug: categorySlug, isActive: true } });
      categoryId = cat?.id;
    }

    const qb = this.productRepository
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.images', 'images')
      .leftJoinAndSelect('p.category', 'category')
      .where('p.isActive = true')
      .orderBy('p.createdAt', 'DESC');

    if (categoryId) {
      qb.andWhere('p.categoryId = :categoryId', { categoryId });
    }

    const products = await qb.getMany();

    return products.map((p) => {
      const firstImage = p.images
        ?.slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)[0];
      return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        description: p.description,
        basePrice: p.basePrice,
        currency: p.currency,
        category: p.category?.name ?? '-',
        imageUrl: firstImage?.url ?? null,
        inStock: p.stock > 0,
      };
    });
  }

  /**
   * Fetch a single active product by slug with all images (sorted by sort_order).
   * Exposes inStock boolean (stock > 0) but not the quantity.
   * Throws 404 if not found or inactive.
   */
  async findBySlug(slug: string): Promise<ProductDetailDto> {
    const product = await this.productRepository.findOne({
      where: { slug, isActive: true },
      relations: ['images', 'category'],
    });
    if (!product) {
      throw new NotFoundException(`Product "${slug}" not found.`);
    }

    const sortedImages = (product.images ?? [])
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((img) => img.url);

    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: product.description,
      basePrice: product.basePrice,
      currency: product.currency,
      category: product.category?.name ?? 'Apparel',
      inStock: product.stock > 0,
      images: sortedImages,
    };
  }
}
