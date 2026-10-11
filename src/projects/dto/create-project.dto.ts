import { IsOptional, IsString, Length, Matches } from 'class-validator';

export class CreateProjectDto {
  @IsString()
  @Length(2, 100)
  name!: string;

  @IsOptional()
  @IsString()
  @Length(2, 60)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug?: string;

  @IsOptional()
  @IsString()
  @Length(0, 1000)
  description?: string;
}
