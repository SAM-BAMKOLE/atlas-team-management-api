import { IsString, Length, MinLength } from 'class-validator';

export class PasswordResetConfirmDto {
  @IsString()
  @MinLength(32)
  token!: string;

  @IsString()
  @Length(8, 128)
  password!: string;
}
