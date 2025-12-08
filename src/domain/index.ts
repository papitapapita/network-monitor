/**
 * Domain Layer
 *
 * This is the heart of the Network Management System.
 * It contains all business logic, entities, value objects, and domain events.
 *
 * The domain layer is technology-agnostic and has no dependencies
 * on infrastructure concerns.
 */

// Core kernel classes
export * from './shared/kernel';
export * from './shared/interfaces';

// Value Objects
export * from './value-objects';

// Entities and Aggregates
export * from './entities';

// Domain Events
export * from './events';

// Repository Interfaces
export * from './repository';

// Domain Enums
export * from './shared/enums';

// Shared Props Interfaces
export * from './shared/props';
