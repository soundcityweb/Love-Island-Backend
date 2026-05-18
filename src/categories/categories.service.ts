import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from '../entities/category.entity';

export interface CategoryDto {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
}

export interface AdminCategoryDto extends CategoryDto {
  isActive: boolean;
  createdAt: Date;
}

export interface CreateCategoryPayload {
  name: string;
  slug?: string;
  description?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export interface UpdateCategoryPayload {
  name?: string;
  slug?: string;
  description?: string;
  sortOrder?: number;
  isActive?: boolean;
}

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
  ) {}

  async findAllActive(): Promise<CategoryDto[]> {
    const cats = await this.categoryRepo.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
    return cats.map(this.toDto);
  }

  async findAllAdmin(): Promise<AdminCategoryDto[]> {
    const cats = await this.categoryRepo.find({
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
    return cats.map(this.toAdminDto);
  }

  async create(payload: CreateCategoryPayload): Promise<AdminCategoryDto> {
    const slug = payload.slug ?? this.slugify(payload.name);
    await this.assertSlugUnique(slug);
    await this.assertNameUnique(payload.name);

    const category = this.categoryRepo.create({
      name: payload.name,
      slug,
      description: payload.description ?? null,
      sortOrder: payload.sortOrder ?? 0,
      isActive: payload.isActive ?? true,
    });
    const saved = await this.categoryRepo.save(category);
    return this.toAdminDto(saved);
  }

  async update(id: string, payload: UpdateCategoryPayload): Promise<AdminCategoryDto> {
    const category = await this.findOneOrFail(id);

    if (payload.name !== undefined && payload.name !== category.name) {
      await this.assertNameUnique(payload.name, id);
      category.name = payload.name;
    }
    if (payload.slug !== undefined && payload.slug !== category.slug) {
      await this.assertSlugUnique(payload.slug, id);
      category.slug = payload.slug;
    }
    if (payload.description !== undefined) category.description = payload.description;
    if (payload.sortOrder !== undefined) category.sortOrder = payload.sortOrder;
    if (payload.isActive !== undefined) category.isActive = payload.isActive;

    const saved = await this.categoryRepo.save(category);
    return this.toAdminDto(saved);
  }

  async remove(id: string): Promise<{ deleted: true; id: string }> {
    const category = await this.findOneOrFail(id);
    await this.categoryRepo.remove(category);
    return { deleted: true, id };
  }

  private async findOneOrFail(id: string): Promise<Category> {
    const cat = await this.categoryRepo.findOne({ where: { id } });
    if (!cat) throw new NotFoundException(`Category "${id}" not found.`);
    return cat;
  }

  private async assertNameUnique(name: string, excludeId?: string): Promise<void> {
    const existing = await this.categoryRepo.findOne({ where: { name } });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException(`A category named "${name}" already exists.`);
    }
  }

  private async assertSlugUnique(slug: string, excludeId?: string): Promise<void> {
    const existing = await this.categoryRepo.findOne({ where: { slug } });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException(`Slug "${slug}" is already in use.`);
    }
  }

  private slugify(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '') || 'category';
  }

  private toDto(cat: Category): CategoryDto {
    return {
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      description: cat.description,
      sortOrder: cat.sortOrder,
    };
  }

  private toAdminDto(cat: Category): AdminCategoryDto {
    return {
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      description: cat.description,
      sortOrder: cat.sortOrder,
      isActive: cat.isActive,
      createdAt: cat.createdAt,
    };
  }
}
