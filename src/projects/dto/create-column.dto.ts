import { IsInt, IsString, Length, Min } from 'class-validator';

export class CreateColumnDto {
  @IsString()
  @Length(1, 80)
  name!: string;

  @IsInt()
  @Min(0)
  position!: number;
}
