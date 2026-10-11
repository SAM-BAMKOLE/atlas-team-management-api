import { IsOptional, IsString, Length, Matches } from 'class-validator';

export class CreateWorkspaceDto {
  @IsString()
  @Length(2, 80)
  name!: string;

  @IsOptional()
  @IsString()
  @Length(2, 50)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug must contain lowercase letters, numbers, and hyphens',
  })
  slug?: string;
}
