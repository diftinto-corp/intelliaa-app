import { z } from 'zod';

/**
 * Validation schema for creating document storage
 */
export const createStorageSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido').max(100, 'El nombre es demasiado largo'),
  description: z.string().max(500, 'La descripción es demasiado larga').optional(),
  account_id: z.string().uuid('El ID de cuenta debe ser un UUID válido'),
  file: z.instanceof(File)
    .refine(file => file.size > 0, 'El archivo está vacío')
    .refine(file => file.size <= 50 * 1024 * 1024, 'El archivo excede el límite de 50MB')
    .refine(file => file.type === 'application/pdf', 'Solo se aceptan archivos PDF')
});

/**
 * Validation schema for adding document to storage
 */
export const addDocumentSchema = z.object({
  storageId: z.string().uuid('El ID de almacenamiento debe ser un UUID válido'),
  accountId: z.string().uuid('El ID de cuenta debe ser un UUID válido'),
  file: z.instanceof(File)
    .refine(file => file.size > 0, 'El archivo está vacío')
    .refine(file => file.size <= 50 * 1024 * 1024, 'El archivo excede el límite de 50MB')
    .refine(file => file.type === 'application/pdf', 'Solo se aceptan archivos PDF')
});

/**
 * Validation schema for deleting document from storage
 */
export const deleteDocumentSchema = z.object({
  storageId: z.string().uuid('El ID de almacenamiento debe ser un UUID válido'),
  documentId: z.string().uuid('El ID de documento debe ser un UUID válido'),
  accountId: z.string().uuid('El ID de cuenta debe ser un UUID válido')
});

/**
 * Validation schema for deleting storage
 */
export const deleteStorageSchema = z.object({
  storageId: z.string().uuid('El ID de almacenamiento debe ser un UUID válido'),
  accountId: z.string().uuid('El ID de cuenta debe ser un UUID válido')
});

/**
 * Validation schema for assigning storage to assistant
 */
export const assignStorageSchema = z.object({
  assistantId: z.string().uuid('El ID de asistente debe ser un UUID válido'),
  storage_id: z.string().uuid('El ID de almacenamiento debe ser un UUID válido'),
  account_id: z.string().uuid('El ID de cuenta debe ser un UUID válido'),
  assistant_type: z.enum(['voice', 'whatsapp'], {
    errorMap: () => ({ message: 'El tipo de asistente debe ser "voice" o "whatsapp"' })
  })
});

/**
 * Validation schema for unassigning storage from assistant
 */
export const unassignStorageSchema = z.object({
  assistantId: z.string().uuid('El ID de asistente debe ser un UUID válido'),
  storageId: z.string().uuid('El ID de almacenamiento debe ser un UUID válido'),
  accountId: z.string().uuid('El ID de cuenta debe ser un UUID válido')
});
