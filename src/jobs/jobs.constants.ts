export const EMAIL_JOB = 'email.send';

export type EmailJobPayload =
  | { kind: 'invitation'; to: string; workspaceName: string; inviteUrl: string }
  | { kind: 'verification'; to: string; verifyUrl: string }
  | { kind: 'password-reset'; to: string; resetUrl: string };
