import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @Length(8, 128)
  password!: string;

  @IsOptional()
  @IsString()
  @Length(1, 120)
  name?: string;
}
