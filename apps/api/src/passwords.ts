import argon2 from 'argon2';

/**
 * Argon2id password hashing shared by the API, the provisioning CLI and tests.
 * Parameters follow the OWASP Password Storage Cheat Sheet minimum
 * (19 MiB memory, 2 iterations, 1 lane).
 */
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1
  });
}

export async function verifyPassword(
  passwordHash: string,
  password: string
): Promise<boolean> {
  try {
    return await argon2.verify(passwordHash, password);
  } catch {
    return false;
  }
}
