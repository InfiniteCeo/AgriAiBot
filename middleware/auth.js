const jwt = require('jsonwebtoken');
const { getUserById } = require('../services/supabase');

// JWT secret key - should be in environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * Generate JWT token for user
 * @param {Object} user - User object
 * @returns {string} JWT token
 */
function generateToken(user) {
    const payload = {
        userId: user.id,
        email: user.email,
        userType: user.user_type
    };
    
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Verify JWT token
 * @param {string} token - JWT token
 * @returns {Object} Decoded token payload
 */
function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        throw new Error('Invalid or expired token');
    }
}

/**
 * Authentication middleware - verifies JWT token
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
async function authenticateToken(req, res, next) {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
        
        if (!token) {
            return res.status(401).json({ 
                error: 'Access token required',
                message: 'Please provide a valid authentication token'
            });
        }
        
        const decoded = verifyToken(token);
        
        // Get full user data
        const user = await getUserById(decoded.userId);
        if (!user) {
            return res.status(401).json({ 
                error: 'Invalid token',
                message: 'User not found'
            });
        }
        
        req.user = user;
        next();
    } catch (error) {
        console.error('Authentication error:', error);
        return res.status(403).json({ 
            error: 'Invalid token',
            message: error.message
        });
    }
}

/**
 * Role-based authorization middleware
 * @param {Array<string>} allowedRoles - Array of allowed user types
 * @returns {Function} Express middleware function
 */
function requireRole(allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ 
                error: 'Authentication required',
                message: 'Please authenticate first'
            });
        }
        
        if (!allowedRoles.includes(req.user.user_type)) {
            return res.status(403).json({ 
                error: 'Insufficient permissions',
                message: `Access denied. Required roles: ${allowedRoles.join(', ')}`
            });
        }
        
        next();
    };
}

/**
 * Optional authentication middleware - doesn't fail if no token provided
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
async function optionalAuth(req, res, next) {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        
        if (token) {
            const decoded = verifyToken(token);
            const user = await getUserById(decoded.userId);
            if (user) {
                req.user = user;
            }
        }
        
        next();
    } catch (error) {
        // Continue without authentication if token is invalid
        next();
    }
}

/**
 * Admin-only middleware
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function requireAdmin(req, res, next) {
    return requireRole(['admin'])(req, res, next);
}

/**
 * Farmer or Admin middleware
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function requireFarmerOrAdmin(req, res, next) {
    return requireRole(['farmer', 'admin'])(req, res, next);
}

/**
 * Wholesaler or Admin middleware
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function requireWholesalerOrAdmin(req, res, next) {
    return requireRole(['wholesaler', 'admin'])(req, res, next);
}

/**
 * Extract user ID from token without full authentication
 * @param {string} token - JWT token
 * @returns {string|null} User ID or null if invalid
 */
function extractUserIdFromToken(token) {
    try {
        const decoded = verifyToken(token);
        return decoded.userId;
    } catch (error) {
        return null;
    }
}

module.exports = {
    generateToken,
    verifyToken,
    authenticateToken,
    requireRole,
    optionalAuth,
    requireAdmin,
    requireFarmerOrAdmin,
    requireWholesalerOrAdmin,
    extractUserIdFromToken
};