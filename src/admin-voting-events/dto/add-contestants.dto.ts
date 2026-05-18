import { IsArray, IsUUID, ArrayMinSize } from 'class-validator';

export class AddContestantsDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one islander is required.' })
  @IsUUID('4', { each: true, message: 'Each islanderId must be a valid UUID.' })
  islanderIds: string[];
}
