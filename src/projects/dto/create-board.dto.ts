import { IsString, Length } from 'class-validator';

export class CreateBoardDto {
  @IsString()
  @Length(2, 100)
  name!: string;
}
