import { IsString, Length } from 'class-validator';

export class UpdateBoardDto {
  @IsString()
  @Length(2, 100)
  name!: string;
}