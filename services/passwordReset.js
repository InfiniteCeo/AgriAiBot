const crypto = require('crypto');
const { supabase } = require('./supabase');
const bcrypt = require('bcrypt');

// Salt rounds for bcrypt password hashing
const SALT_ROUNDS = 12;

/**
 * Generate password reset token
 * @param {string} email - User's email
 * @returns {Promise<string>} Reset token
 */
async function generatePasswordResetToken(email) {
    try {
        // Check if user exists
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id, email')
            .eq('email', email.toLowerCase().trim())
            .single();
            
        if (userError || !user) {
            throw new Error('User not found');
        }
        
        // Generate secure random token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 3600000); // 1 hour from now
        
        // Store reset token in database (create password_reset_tokens table if needed)
        const { error: tokenError } = await supabase
            .from('password_reset_tokens')
            .insert([{
                user_id: user.id,
                token: resetToken,
                expires_at: expiresAt.toISOString(),
                used: false
            }]);
            
        if (tokenError) {
            throw new Error(`Failed to create reset token: ${tokenError.message}`);
        }
        
        return resetToken;
    } catch (error) {
        console.error('Error generating password reset token:', error);
        throw error;
    }
}

/**
 * Verify password reset token
 * @param {string} token - Reset token
 * @returns {Promise<Object>} User object if token is valid
 */
async function verifyPasswordResetToken(token) {
    try {
        const { data: tokenData, error } = await supabase
            .from('password_reset_tokens')
            .select(`
                id,
                user_id,
                expires_at,
                used,
                users!inner(id, email)
            `)
            .eq('token', token)
            .eq('used', false)
            .single();
            
        if (error || !tokenData) {
            throw new Error('Invalid or expired reset token');
        }
        
        // Check if token has expired
        const now = new Date();
        const expiresAt = new Date(tokenData.expires_at);
        
        if (now > expiresAt) {
            throw new Error('Reset token has expired');
        }
        
        return tokenData.users;
    } catch (error) {
        console.error('Error verifying password reset token:', error);
        throw error;
    }
}

/**
 * Reset password using token
 * @param {string} token - Reset token
 * @param {string} newPassword - New password
 * @returns {Promise<boolean>} Success status
 */
async function resetPassword(token, newPassword) {
    try {
        // Verify token and get user
        const user = await verifyPasswordResetToken(token);
        
        // Hash new password
        const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
        
        // Update user password
        const { error: updateError } = await supabase
            .from('users')
            .update({ password_hash: passwordHash })
            .eq('id', user.id);
            
        if (updateError) {
            throw new Error(`Failed to update password: ${updateError.message}`);
        }
        
        // Mark token as used
        const { error: tokenError } = await supabase
            .from('password_reset_tokens')
            .update({ used: true })
            .eq('token', token);
            
        if (tokenError) {
            console.error('Error marking token as used:', tokenError);
            // Don't throw error here as password was already updated
        }
        
        return true;
    } catch (error) {
        console.error('Error resetting password:', error);
        throw error;
    }
}

/**
 * Clean up expired reset tokens
 * @returns {Promise<number>} Number of tokens cleaned up
 */
async function cleanupExpiredTokens() {
    try {
        const now = new Date().toISOString();
        
        const { data, error } = await supabase
            .from('password_reset_tokens')
            .delete()
            .lt('expires_at', now)
            .select('id');
            
        if (error) {
            throw new Error(`Failed to cleanup expired tokens: ${error.message}`);
        }
        
        return data ? data.length : 0;
    } catch (error) {
        console.error('Error cleaning up expired tokens:', error);
        throw error;
    }
}

module.exports = {
    generatePasswordResetToken,
    verifyPasswordResetToken,
    resetPassword,
    cleanupExpiredTokens
};