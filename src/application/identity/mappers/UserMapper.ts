import { User } from 'domain/identity';
import { UserAccountDTO } from '../dtos/UserManagementDTOs';

export class UserMapper {
  public static toDTO(user: User): {
    id: string;
    email: string;
    role: string;
  } {
    return {
      id: user.id.toString(),
      email: user.email.toString(),
      role: user.role.toString()
    };
  }

  public static toAccountDTO(user: User): UserAccountDTO {
    return {
      id: user.id.toString(),
      email: user.email.toString(),
      role: user.role.toString(),
      disabled: user.isDisabled,
      disabledAt: user.disabledAt?.toISOString() ?? null,
      twoFactorEnabled: user.hasTwoFactor,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString()
    };
  }
}
