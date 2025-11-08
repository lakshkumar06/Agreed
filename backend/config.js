export const JWT_SECRET = process.env.JWT_SECRET;

export function requireJwtSecret() {
  if (!JWT_SECRET || JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be set to at least 32 characters');
  }
  return JWT_SECRET;
}
