import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';

export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  @Length(2, 100)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(0, 1000)
  description?: string;

  @IsOptional()
  @IsBoolean()
  archived?: boolean;
}
