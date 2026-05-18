import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { CmsPageStatus } from '../../entities/cms-page.entity';

export class UpdateCmsPageDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  title?: string;

  @IsString()
  @IsNotEmpty({ message: 'Content cannot be empty.' })
  content: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  metaTitle?: string | null;

  @IsOptional()
  @IsString()
  metaDescription?: string | null;

  @IsEnum(CmsPageStatus, { message: 'Status must be draft or published.' })
  status: CmsPageStatus;
}
