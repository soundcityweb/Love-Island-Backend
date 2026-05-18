import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsISO8601,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  ArrayMaxSize,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CompetitionType } from '../../entities/competition-type.enum';
import { CompetitionStatus } from '../../entities/competition-status.enum';

export class CreateQuestionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  question: string;

  /**
   * Between 2 and 6 answer options.
   * Each option is a non-empty string up to 200 characters.
   */
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(6)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  options: string[];

  /**
   * Must exactly match one of the provided `options`.
   * Stored server-side only; never returned to public clients.
   */
  @IsString()
  @IsNotEmpty()
  correctAnswer: string;
}

export class CreateCompetitionDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(200)
  title: string;

  /**
   * URL-safe slug. If omitted the service auto-generates one from `title`.
   * Must be unique across all competitions.
   */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  slug?: string;

  @IsEnum(CompetitionType)
  type: CompetitionType;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  bannerUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  sponsorName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  sponsorLogo?: string;

  @IsOptional()
  @IsISO8601()
  startAt?: string;

  @IsOptional()
  @IsISO8601()
  endAt?: string;

  @IsOptional()
  @IsEnum(CompetitionStatus)
  status?: CompetitionStatus;

  /**
   * Optional JSON string describing the reward for winners.
   * Example: {"type":"voucher","value":"5000","currency":"NGN"}
   */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  rewardConfig?: string | null;

  /**
   * Questions to create along with the competition.
   * Required for `quiz` and `prediction` types; ignored for `poll` and `upload`.
   */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateQuestionDto)
  questions?: CreateQuestionDto[];
}
