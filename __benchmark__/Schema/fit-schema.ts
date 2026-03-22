// ========================================
// ./__benchmark__/Schema/fit-schema.ts
// ========================================
import * as f from '../../src/Fit/__export__';

// ============================================
// Address Schema
// ============================================

const addressSchema = f.shape({
  street: f.String().that(f.min_len(1)),
  city: f.String().that(f.min_len(1)),
  country: f.String().that(f.min_len(2)),
  postalCode: f.String().that(f.matches(/^\d{5,6}$/)),
  coordinates: f.ShapeOpt({
    lat: f.Number().that(f.range(-90, 90)),
    lng: f.Number().that(f.range(-180, 180)),
  }),
});
const userSchema = f.shape({
  id: f.String().that(f.uuid),
  username: f.String().that(f.len_range(3, 20)),
  email: f.String().that(f.email),
  age: f.NumberOpt().that(f.range(0, 150)).that(f.integer),
  isActive: f.Boolean(),
  role: f.OneOf('admin', 'user', 'guest'),
  tags: f.items(f.String().that(f.min_len(1))),
  address: addressSchema,
  metadata: f.Object(),
  createdAt: f.String().that(f.iso_datetime),
  updatedAt: f.StringOpt().that(f.iso_datetime),
  preferences: f.ShapeOpt({
    theme: f.OneOf('light', 'dark', 'system'),
    language: f.String().that(f.min_len(2)),
    notifications: f.Boolean(),
  }),
});

const postSchema = f.shape({
  id: f.toReadonly(f.String().that(f.uuid)),
  title: f.String().that(f.len_range(1, 200)),
  content: f.String().that(f.min_len(1)),
  authorId: f.String().that(f.uuid),
  status: f.OneOf('draft', 'published', 'archived'),
  views: f.fit().that(f.nonNegativeInt),
  likes: f.fit().that(f.nonNegativeInt),
  comments: f.items(
    f.shape({
      id: f.String().that(f.uuid),
      userId: f.String().that(f.uuid),
      content: f.String().that(f.min_len(1)),
      createdAt: f.String(),
    }),
  ),
  createdAt: f.String().that(f.iso_datetime),
  updatedAt: f.StringOpt().that(f.iso_datetime),
});

export {userSchema, postSchema};

export function validateUser(data: unknown): boolean {
  return f.validate(data, userSchema).ok;
}

export function validatePost(data: unknown): boolean {
  return f.validate(data, postSchema).ok;
}
