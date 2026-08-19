import { User } from 'domain/identity';

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
}
