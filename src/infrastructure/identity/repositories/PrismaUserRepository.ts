import {
  PrismaClient,
  UserRole as PrismaUserRole
} from 'generated/prisma/client';
import { EventDispatcher, Result } from 'domain/shared/core';
import { UserId } from 'domain/shared/ids';
import { User } from 'domain/identity/aggregates/User';
import { UserEmail } from 'domain/identity/value-objects/UserEmail';
import { IUserRepository } from 'domain/identity/repository/IUserRepository';
import { UserPrismaMapper } from '../mappers/UserPrismaMapper';
import { isUniqueViolation } from '../../persistence/prisma-errors';

export class PrismaUserRepository implements IUserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  public async save(user: User): Promise<Result<User>> {
    try {
      const data = UserPrismaMapper.toPersistence(user);
      await this.prisma.user.upsert({
        where: { id: data.id },
        create: {
          id: data.id,
          email: data.email,
          passwordHash: data.passwordHash,
          role: data.role as PrismaUserRole,
          disabledAt: data.disabledAt,
          tokenVersion: data.tokenVersion,
          failedSignIns: data.failedSignIns,
          signInPausedUntil: data.signInPausedUntil,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt
        },
        update: {
          email: data.email,
          passwordHash: data.passwordHash,
          role: data.role as PrismaUserRole,
          disabledAt: data.disabledAt,
          tokenVersion: data.tokenVersion,
          failedSignIns: data.failedSignIns,
          signInPausedUntil: data.signInPausedUntil,
          updatedAt: data.updatedAt
        }
      });
      EventDispatcher.dispatchEventsForAggregate(user.id);
      return Result.ok<User>(user);
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : String(error);
      if (isUniqueViolation(error)) {
        return Result.fail<User>(
          'A user with this email already exists'
        );
      }
      return Result.fail<User>(`Database error saving user: ${msg}`);
    }
  }

  public async findById(id: UserId): Promise<Result<User | null>> {
    try {
      const raw = await this.prisma.user.findUnique({
        where: { id: id.toString() }
      });
      if (!raw) return Result.ok<User | null>(null);
      const result = UserPrismaMapper.toDomain(raw);
      if (result.isFailure) {
        return Result.fail<User | null>(
          `Failed to map user: ${result.error}`
        );
      }
      return Result.ok<User | null>(result.value);
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : String(error);
      return Result.fail<User | null>(
        `Database error finding user: ${msg}`
      );
    }
  }

  public async findByEmail(
    email: UserEmail
  ): Promise<Result<User | null>> {
    try {
      const raw = await this.prisma.user.findUnique({
        where: { email: email.toString() }
      });
      if (!raw) return Result.ok<User | null>(null);
      const result = UserPrismaMapper.toDomain(raw);
      if (result.isFailure) {
        return Result.fail<User | null>(
          `Failed to map user: ${result.error}`
        );
      }
      return Result.ok<User | null>(result.value);
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : String(error);
      return Result.fail<User | null>(
        `Database error finding user: ${msg}`
      );
    }
  }

  public async findAll(): Promise<Result<User[]>> {
    try {
      const rows = await this.prisma.user.findMany({
        orderBy: { createdAt: 'asc' }
      });
      const users: User[] = [];
      for (const raw of rows) {
        const result = UserPrismaMapper.toDomain(raw);
        if (result.isFailure) {
          return Result.fail<User[]>(
            `Failed to map user: ${result.error}`
          );
        }
        users.push(result.value);
      }
      return Result.ok<User[]>(users);
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : String(error);
      return Result.fail<User[]>(
        `Database error listing users: ${msg}`
      );
    }
  }
}
