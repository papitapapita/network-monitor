/**
 * Application Layer
 *
 * The application layer coordinates domain objects to perform specific
 * application tasks (use cases). It's responsible for:
 *
 * - Orchestrating domain objects
 * - Implementing business workflows
 * - Handling transactions
 * - Managing application services
 *
 * The application layer is thin - it delegates business logic to the domain
 * and uses repositories to persist/retrieve aggregates.
 */

// Core components
export * from './core';

// Interfaces
export * from './interfaces';

// DTOs
export * from './dtos';

// Mappers
export * from './mappers';

// Use Cases
export * from './use-cases';
