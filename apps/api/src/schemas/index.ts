import { z } from "zod";

export const uuidSchema = z.string().uuid();

export const timestampSchema = z.object({
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type Pagination = z.infer<typeof paginationSchema>;

export function paginatedResponse<T>(items: T[], total: number, page: number, pageSize: number) {
  return {
    data: items,
    meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
  };
}

export const errorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
  }),
});
