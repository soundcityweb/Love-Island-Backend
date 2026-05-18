import { IsObject, IsNotEmpty } from 'class-validator';

/**
 * Body for submitting answers to a competition.
 *
 * `answers` maps question UUID → selected option text, e.g.:
 *   { "a1b2c3d4-...": "Ayo", "e5f6g7h8-...": "The villa" }
 *
 * The service validates that each key is a valid question ID for
 * the competition and that the value is one of the available options.
 */
export class SubmitAnswersDto {
  @IsObject()
  @IsNotEmpty()
  answers: Record<string, string>;
}
