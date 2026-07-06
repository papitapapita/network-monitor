import { Customer } from 'domain/customers';
import {
  CustomerResponseDTO,
  CustomerListResponseDTO,
  CreateCustomerRequestDTO,
  UpdateCustomerRequestDTO
} from '../dtos';

export class CustomerMapper {
  public static toDTO(customer: Customer): CustomerResponseDTO {
    return {
      id: customer.id.toString(),
      fullName: customer.fullName,
      phone: customer.phone.toString(),
      email: customer.email !== null ? customer.email.toString() : null,
      cedula:
        customer.cedula !== null ? customer.cedula.toString() : null,
      createdAt: customer.createdAt.toISOString(),
      updatedAt: customer.updatedAt.toISOString()
    };
  }

  public static toListDTO(
    customers: Customer[],
    total: number,
    limit: number = 20,
    offset: number = 0
  ): CustomerListResponseDTO {
    return {
      customers: customers.map((c) => this.toDTO(c)),
      total,
      hasMore: offset + customers.length < total,
      limit,
      offset
    };
  }

  public static extractCreateData(dto: CreateCustomerRequestDTO) {
    return {
      fullName: dto.fullName,
      phone: dto.phone,
      email: dto.email ?? null,
      cedula: dto.cedula ?? null
    };
  }

  public static extractUpdateData(dto: UpdateCustomerRequestDTO) {
    const updates: {
      fullName?: string;
      phone?: string;
      email?: string | null;
      cedula?: string | null;
    } = {};
    if (dto.fullName !== undefined) updates.fullName = dto.fullName;
    if (dto.phone !== undefined) updates.phone = dto.phone;
    if (dto.email !== undefined) updates.email = dto.email;
    if (dto.cedula !== undefined) updates.cedula = dto.cedula;
    return updates;
  }
}
