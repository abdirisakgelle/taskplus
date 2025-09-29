import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'change-me';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '7d';
const COOKIE_NAME = process.env.COOKIE_NAME || 'sid';

/**
 * Sign a JWT token for the given user ID
 * @param {string} userId - The user's MongoDB ObjectId
 * @returns {string} JWT token
 */
export function signToken(userId) {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

/**
 * Verify a JWT token and return the payload
 * @param {string} token - The JWT token
 * @returns {object|null} Decoded payload or null if invalid
 */
export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

/**
 * Set authentication cookie on response
 * @param {Response} res - Express response object
 * @param {string} token - JWT token
 */
export function setAuthCookie(res, token) {
  const isProduction = process.env.NODE_ENV === 'production';
  
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days in milliseconds
  });
}

/**
 * Clear authentication cookie
 * @param {Response} res - Express response object
 */
export function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  });
}

/**
 * Get cookie name for authentication
 * @returns {string} Cookie name
 */
export function getCookieName() {
  return COOKIE_NAME;
}
