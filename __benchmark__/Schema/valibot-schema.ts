// ========================================
// ./__benchmark__/Schema/valibot-schema.ts
// ========================================
import * as v from 'valibot';

// ============================================
// Address Schema
// ============================================

const addressSchema = v.object({
  street: v.pipe(v.string(), v.minLength(1)),
  city: v.pipe(v.string(), v.minLength(1)),
  country: v.pipe(v.string(), v.minLength(2)),
  postalCode: v.pipe(v.string(), v.regex(/^\d{5,6}$/)),
  coordinates: v.optional(
    v.object({
      lat: v.pipe(v.number(), v.minValue(-90), v.maxValue(90)),
      lng: v.pipe(v.number(), v.minValue(-180), v.maxValue(180)),
    }),
  ),
});

const userSchema = v.object({
  id: v.pipe(v.string(), v.uuid()),
  username: v.pipe(v.string(), v.minLength(3), v.maxLength(20)),
  email: v.pipe(v.string(), v.email()),
  age: v.optional(
    v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(150)),
  ),
  isActive: v.boolean(),
  role: v.picklist(['admin', 'user', 'guest']),
  tags: v.array(v.pipe(v.string(), v.minLength(1))),
  address: addressSchema,
  metadata: v.record(v.string(), v.unknown()),
  createdAt: v.pipe(v.string(), v.isoDateTime()),
  updatedAt: v.optional(v.pipe(v.string(), v.isoDateTime())),
  preferences: v.optional(
    v.object({
      theme: v.picklist(['light', 'dark', 'system']),
      language: v.pipe(v.string(), v.minLength(2)),
      notifications: v.boolean(),
    }),
  ),
});

const postSchema = v.object({
  id: v.pipe(v.string(), v.uuid()),
  title: v.pipe(v.string(), v.minLength(1), v.maxLength(200)),
  content: v.pipe(v.string(), v.minLength(1)),
  authorId: v.pipe(v.string(), v.uuid()),
  status: v.picklist(['draft', 'published', 'archived']),
  views: v.pipe(v.number(), v.integer(), v.minValue(0)),
  likes: v.pipe(v.number(), v.integer(), v.minValue(0)),
  comments: v.array(
    v.object({
      id: v.pipe(v.string(), v.uuid()),
      userId: v.pipe(v.string(), v.uuid()),
      content: v.pipe(v.string(), v.minLength(1)),
      createdAt: v.string(),
    }),
  ),
  createdAt: v.pipe(v.string(), v.isoDateTime()),
  updatedAt: v.optional(v.pipe(v.string(), v.isoDateTime())),
});

export {userSchema, postSchema};

export function validateUser(data: unknown): boolean {
  return v.safeParse(userSchema, data).success;
}

export function validatePost(data: unknown): boolean {
  return v.safeParse(postSchema, data).success;
}
