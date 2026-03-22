// ========================================
// ./__benchmark__/Schema/zod-schema.ts
// ========================================
import * as z from 'zod';

// ============================================
// Address Schema
// ============================================

const addressSchema = z.object({
  street: z.string().min(1),
  city: z.string().min(1),
  country: z.string().min(2),
  postalCode: z.string().regex(/^\d{5,6}$/),
  coordinates: z
    .object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
    })
    .optional(),
});

const userSchema = z.object({
  id: z.uuid(),
  username: z.string().min(3).max(20),
  email: z.email(),
  age: z.number().int().min(0).max(150).optional(),
  isActive: z.boolean(),
  role: z.enum(['admin', 'user', 'guest']),
  tags: z.array(z.string().min(1)),
  address: addressSchema,
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime().optional(),
  preferences: z
    .object({
      theme: z.enum(['light', 'dark', 'system']),
      language: z.string().min(2),
      notifications: z.boolean(),
    })
    .optional(),
});

const postSchema = z.object({
  id: z.uuid(),
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  authorId: z.uuid(),
  status: z.enum(['draft', 'published', 'archived']),
  views: z.number().int().nonnegative(),
  likes: z.number().int().nonnegative(),
  comments: z.array(
    z.object({
      id: z.uuid(),
      userId: z.uuid(),
      content: z.string().min(1),
      createdAt: z.string(),
    }),
  ),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime().optional(),
});

export {userSchema, postSchema};

export function validateUser(data: unknown): boolean {
  return userSchema.safeParse(data).success;
}

export function validatePost(data: unknown): boolean {
  return postSchema.safeParse(data).success;
}
