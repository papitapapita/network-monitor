import { z } from 'zod';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const CALENDAR_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const TICKET_STATUSES = [
  'OPEN',
  'ASSIGNED',
  'IN_PROGRESS',
  'RESOLVED',
  'CANCELLED'
] as const;

const TICKET_PRIORITIES = [
  'LOW',
  'NORMAL',
  'HIGH',
  'URGENT'
] as const;

const TICKET_CATEGORIES = [
  'CONNECTIVITY',
  'INSTALLATION',
  'HARDWARE_FAILURE',
  'MAINTENANCE',
  'RELOCATION',
  'OTHER'
] as const;

const ticketIdParam = z.object({
  id: z
    .string()
    .regex(UUID_REGEX, 'Invalid ticket ID (must be a UUID v4)')
});

const titleField = z
  .string()
  .trim()
  .min(1, 'Ticket title cannot be empty')
  .max(150, 'Ticket title cannot exceed 150 characters');

const descriptionField = z
  .string()
  .trim()
  .min(1, 'Ticket description cannot be empty')
  .max(5000, 'Ticket description cannot exceed 5000 characters');

const calendarDateField = z
  .string()
  .trim()
  .regex(
    CALENDAR_DATE_REGEX,
    'Date must be a calendar date in YYYY-MM-DD format'
  );

const uuidField = (label: string) =>
  z
    .string()
    .regex(UUID_REGEX, `Invalid ${label} (must be a UUID v4)`);

const addressField = z.object({
  street: z
    .string()
    .trim()
    .max(255, 'Street address cannot exceed 255 characters'),
  municipality: z
    .string()
    .trim()
    .max(100, 'Municipality cannot exceed 100 characters'),
  neighborhood: z
    .string()
    .trim()
    .max(150, 'Neighborhood cannot exceed 150 characters'),
  reference: z
    .string()
    .trim()
    .max(255, 'Address reference cannot exceed 255 characters')
    .nullable()
    .optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional()
});

const booleanQueryField = z
  .enum(['true', 'false'])
  .transform((v) => v === 'true');

const limitField = z
  .string()
  .regex(/^\d+$/, 'Limit must be a positive integer')
  .transform(Number)
  .refine((n) => n > 0 && n <= 100, {
    message: 'Limit must be between 1 and 100'
  });

const offsetField = z
  .string()
  .regex(/^\d+$/, 'Offset must be a non-negative integer')
  .transform(Number)
  .refine((n) => n >= 0, { message: 'Offset must be non-negative' });

export const createTicketSchema = z.object({
  body: z
    .object({
      title: titleField,
      description: descriptionField,
      category: z.enum(TICKET_CATEGORIES),
      priority: z.enum(TICKET_PRIORITIES).optional(),
      customerId: uuidField('customer ID').nullable().optional(),
      deviceId: uuidField('device ID').nullable().optional(),
      technicianId: uuidField('technician ID').nullable().optional(),
      address: addressField.nullable().optional(),
      scheduledFor: calendarDateField.nullable().optional()
    })
    .refine(
      (body) =>
        (body.customerId ?? null) !== null ||
        (body.deviceId ?? null) !== null,
      { message: 'A ticket must reference a customer or a device' }
    )
});

export const updateTicketSchema = z.object({
  params: ticketIdParam,
  body: z
    .object({
      title: titleField.optional(),
      description: descriptionField.optional(),
      category: z.enum(TICKET_CATEGORIES).optional(),
      priority: z.enum(TICKET_PRIORITIES).optional(),
      customerId: uuidField('customer ID').nullable().optional(),
      deviceId: uuidField('device ID').nullable().optional(),
      address: addressField.nullable().optional()
    })
    .refine((body) => Object.keys(body).length > 0, {
      message: 'At least one field must be provided for update'
    })
});

export const getTicketByIdSchema = z.object({
  params: ticketIdParam
});

export const deleteTicketSchema = z.object({
  params: ticketIdParam
});

export const listTicketsSchema = z.object({
  query: z.object({
    status: z.enum(TICKET_STATUSES).optional(),
    priority: z.enum(TICKET_PRIORITIES).optional(),
    category: z.enum(TICKET_CATEGORIES).optional(),
    technicianId: uuidField('technician ID').optional(),
    customerId: uuidField('customer ID').optional(),
    deviceId: uuidField('device ID').optional(),
    scheduledFrom: calendarDateField.optional(),
    scheduledTo: calendarDateField.optional(),
    unassignedOnly: booleanQueryField.optional(),
    openOnly: booleanQueryField.optional(),
    limit: limitField.optional(),
    offset: offsetField.optional()
  })
});

export const technicianDaySchema = z.object({
  query: z.object({
    technicianId: uuidField('technician ID'),
    date: calendarDateField.optional()
  })
});

export const assignTicketSchema = z.object({
  params: ticketIdParam,
  body: z.object({
    technicianId: uuidField('technician ID'),
    scheduledFor: calendarDateField.nullable().optional()
  })
});

export const scheduleTicketSchema = z.object({
  params: ticketIdParam,
  body: z.object({
    scheduledFor: calendarDateField.nullable()
  })
});

export const startTicketSchema = z.object({
  params: ticketIdParam
});

export const resolveTicketSchema = z.object({
  params: ticketIdParam,
  body: z.object({
    resolutionNotes: z
      .string()
      .trim()
      .min(1, 'Resolution notes are required to resolve a ticket')
      .max(5000, 'Resolution notes cannot exceed 5000 characters')
  })
});

export const cancelTicketSchema = z.object({
  params: ticketIdParam,
  body: z.object({
    reason: z
      .string()
      .trim()
      .min(1, 'A reason is required to cancel a ticket')
      .max(255, 'Cancel reason cannot exceed 255 characters')
  })
});

export type CreateTicketInput = z.infer<
  typeof createTicketSchema
>['body'];
export type UpdateTicketInput = z.infer<
  typeof updateTicketSchema
>['body'];
export type ListTicketsQuery = z.infer<
  typeof listTicketsSchema
>['query'];
export type TechnicianDayQuery = z.infer<
  typeof technicianDaySchema
>['query'];
export type AssignTicketInput = z.infer<
  typeof assignTicketSchema
>['body'];
