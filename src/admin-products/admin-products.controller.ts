import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express/multer';
import { AdminProductsService } from './admin-products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Controller('admin/products')
export class AdminProductsController {
  constructor(private readonly adminProductsService: AdminProductsService) {}

  /**
   * GET /api/admin/products
   * Returns ALL products (active + inactive) with stock and images.
   * Never exposed publicly — requires admin API key middleware.
   */
  @Get()
  findAll() {
    return this.adminProductsService.findAll();
  }

  /** POST /api/admin/products — create a new product. */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateProductDto) {
    return this.adminProductsService.create(dto);
  }

  /** PATCH /api/admin/products/:id — partially update a product. */
  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.adminProductsService.update(id, dto);
  }

  /** DELETE /api/admin/products/:id — permanently delete (only if no orders). */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.adminProductsService.remove(id);
  }

  /** PATCH /api/admin/products/:id/toggle-active — flip isActive. */
  @Patch(':id/toggle-active')
  toggleActive(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.adminProductsService.toggleActive(id);
  }

  /**
   * POST /api/admin/products/images
   * Upload product images and get back storage paths.
   * Files are stored in uploads/products/ and served at /uploads/products/.
   */
  @Post('images')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FilesInterceptor('images', 10, {
      limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB per file
    }),
  )
  uploadImages(
    @UploadedFiles() files: { originalname: string; buffer: Buffer; mimetype: string; size: number }[],
  ): Promise<{ urls: string[] }> {
    return this.adminProductsService.uploadImages(files ?? []);
  }
}
