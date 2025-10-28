
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcrypt');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

// Salt rounds for bcrypt password hashing
const SALT_ROUNDS = 12;

/**
 * Find existing user by phone number or create new user
 * @param {string} phone - User's phone number
 * @param {string} name - User's name (optional)
 * @returns {Promise<Object>} User object
 */
async function findOrCreateUser(phone, name = null) {
    try {
        // First, try to find existing user
        const { data: existingUser, error: findError } = await supabase
            .from('users')
            .select('*')
            .eq('phone', phone)
            .single();

        if (existingUser && !findError) {
            // Update last_seen timestamp
            const { data: updatedUser, error: updateError } = await supabase
                .from('users')
                .update({ last_seen: new Date().toISOString() })
                .eq('id', existingUser.id)
                .select()
                .single();

            if (updateError) {
                console.error('Error updating user last_seen:', updateError);
                return existingUser; // Return existing user even if update fails
            }
            
            return updatedUser;
        }

        // User doesn't exist, create new one
        const { data: newUser, error: createError } = await supabase
            .from('users')
            .insert([{
                phone: phone,
                name: name,
                last_seen: new Date().toISOString()
            }])
            .select()
            .single();

        if (createError) {
            throw new Error(`Failed to create user: ${createError.message}`);
        }

        return newUser;
    } catch (error) {
        console.error('Error in findOrCreateUser:', error);
        throw error;
    }
}

/**
 * Save a query and its response to the database
 * @param {string} userId - User's UUID
 * @param {string} question - User's question
 * @param {string} answer - AI's response
 * @returns {Promise<Object>} Query object
 */
async function saveQuery(userId, question, answer) {
    try {
        const { data, error } = await supabase
            .from('queries')
            .insert([{
                user_id: userId,
                question: question,
                answer: answer,
                timestamp: new Date().toISOString()
            }])
            .select()
            .single();

        if (error) {
            throw new Error(`Failed to save query: ${error.message}`);
        }

        return data;
    } catch (error) {
        console.error('Error in saveQuery:', error);
        throw error;
    }
}

/**
 * Get user's chat history
 * @param {string} phone - User's phone number
 * @param {number} limit - Maximum number of queries to return
 * @returns {Promise<Array>} Array of query objects
 */
async function getUserHistory(phone, limit = 50) {
    try {
        const { data, error } = await supabase
            .from('queries')
            .select(`
                id,
                question,
                answer,
                timestamp,
                users!inner(phone)
            `)
            .eq('users.phone', phone)
            .order('timestamp', { ascending: false })
            .limit(limit);

        if (error) {
            throw new Error(`Failed to get user history: ${error.message}`);
        }

        return data || [];
    } catch (error) {
        console.error('Error in getUserHistory:', error);
        throw error;
    }
}

/**
 * Get system statistics
 * @returns {Promise<Object>} Statistics object
 */
async function getUserStats() {
    try {
        // Get total users count
        const { count: userCount, error: userError } = await supabase
            .from('users')
            .select('*', { count: 'exact', head: true });

        if (userError) {
            throw new Error(`Failed to get user count: ${userError.message}`);
        }

        // Get total queries count
        const { count: queryCount, error: queryError } = await supabase
            .from('queries')
            .select('*', { count: 'exact', head: true });

        if (queryError) {
            throw new Error(`Failed to get query count: ${queryError.message}`);
        }

        return {
            totalUsers: userCount || 0,
            totalQueries: queryCount || 0
        };
    } catch (error) {
        console.error('Error in getUserStats:', error);
        throw error;
    }
}

/**
 * Get all registered users (for admin commands)
 * @returns {Promise<Array>} Array of user objects
 */
async function getAllUsers() {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('phone, name, last_seen')
            .order('last_seen', { ascending: false });

        if (error) {
            throw new Error(`Failed to get all users: ${error.message}`);
        }

        return data || [];
    } catch (error) {
        console.error('Error in getAllUsers:', error);
        throw error;
    }
}

/**
 * Create a new user account with authentication
 * @param {Object} userData - User registration data
 * @returns {Promise<Object>} Created user object
 */
async function createUser(userData) {
    try {
        const { email, password, phone, name, user_type, location, farm_size, crops_grown } = userData;
        
        // Hash the password
        const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
        
        // Check if user already exists
        const { data: existingUser } = await supabase
            .from('users')
            .select('id')
            .or(`email.eq.${email},phone.eq.${phone}`)
            .single();
            
        if (existingUser) {
            throw new Error('User with this email or phone already exists');
        }
        
        // Create new user
        const { data: newUser, error } = await supabase
            .from('users')
            .insert([{
                email,
                password_hash,
                phone,
                name,
                user_type: user_type || 'farmer',
                location,
                farm_size,
                crops_grown,
                created_at: new Date().toISOString(),
                last_seen: new Date().toISOString()
            }])
            .select('id, email, phone, name, user_type, location, farm_size, crops_grown, whatsapp_linked, created_at')
            .single();
            
        if (error) {
            throw new Error(`Failed to create user: ${error.message}`);
        }
        
        return newUser;
    } catch (error) {
        console.error('Error in createUser:', error);
        throw error;
    }
}

/**
 * Authenticate user with email and password
 * @param {string} email - User's email
 * @param {string} password - User's password
 * @returns {Promise<Object>} User object if authentication successful
 */
async function authenticateUser(email, password) {
    try {
        const { data: user, error } = await supabase
            .from('users')
            .select('id, email, phone, name, user_type, location, farm_size, crops_grown, whatsapp_linked, password_hash')
            .eq('email', email)
            .single();
            
        if (error || !user) {
            throw new Error('Invalid email or password');
        }
        
        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        if (!isValidPassword) {
            throw new Error('Invalid email or password');
        }
        
        // Update last_seen
        await supabase
            .from('users')
            .update({ last_seen: new Date().toISOString() })
            .eq('id', user.id);
            
        // Return user without password hash
        const { password_hash, ...userWithoutPassword } = user;
        return userWithoutPassword;
    } catch (error) {
        console.error('Error in authenticateUser:', error);
        throw error;
    }
}

/**
 * Get user by ID
 * @param {string} userId - User's UUID
 * @returns {Promise<Object>} User object
 */
async function getUserById(userId) {
    try {
        const { data: user, error } = await supabase
            .from('users')
            .select('id, email, phone, name, user_type, location, farm_size, crops_grown, whatsapp_linked, whatsapp_phone, created_at, last_seen')
            .eq('id', userId)
            .single();
            
        if (error) {
            throw new Error(`Failed to get user: ${error.message}`);
        }
        
        return user;
    } catch (error) {
        console.error('Error in getUserById:', error);
        throw error;
    }
}

/**
 * Update user profile
 * @param {string} userId - User's UUID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated user object
 */
async function updateUserProfile(userId, updates) {
    try {
        // Remove sensitive fields that shouldn't be updated directly
        const { password, password_hash, id, created_at, ...allowedUpdates } = updates;
        
        const { data: updatedUser, error } = await supabase
            .from('users')
            .update({
                ...allowedUpdates,
                last_seen: new Date().toISOString()
            })
            .eq('id', userId)
            .select('id, email, phone, name, user_type, location, farm_size, crops_grown, whatsapp_linked, whatsapp_phone')
            .single();
            
        if (error) {
            throw new Error(`Failed to update user profile: ${error.message}`);
        }
        
        return updatedUser;
    } catch (error) {
        console.error('Error in updateUserProfile:', error);
        throw error;
    }
}

/**
 * Update user password
 * @param {string} userId - User's UUID
 * @param {string} currentPassword - Current password
 * @param {string} newPassword - New password
 * @returns {Promise<boolean>} Success status
 */
async function updateUserPassword(userId, currentPassword, newPassword) {
    try {
        // Get current user with password hash
        const { data: user, error: getUserError } = await supabase
            .from('users')
            .select('password_hash')
            .eq('id', userId)
            .single();
            
        if (getUserError || !user) {
            throw new Error('User not found');
        }
        
        // Verify current password
        const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
        if (!isValidPassword) {
            throw new Error('Current password is incorrect');
        }
        
        // Hash new password
        const newPasswordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
        
        // Update password
        const { error: updateError } = await supabase
            .from('users')
            .update({ password_hash: newPasswordHash })
            .eq('id', userId);
            
        if (updateError) {
            throw new Error(`Failed to update password: ${updateError.message}`);
        }
        
        return true;
    } catch (error) {
        console.error('Error in updateUserPassword:', error);
        throw error;
    }
}

/**
 * Link WhatsApp account to user profile
 * @param {string} userId - User's UUID
 * @param {string} whatsappPhone - WhatsApp phone number
 * @returns {Promise<Object>} Updated user object
 */
async function linkWhatsAppAccount(userId, whatsappPhone) {
    try {
        const { data: updatedUser, error } = await supabase
            .from('users')
            .update({
                whatsapp_linked: true,
                whatsapp_phone: whatsappPhone,
                last_seen: new Date().toISOString()
            })
            .eq('id', userId)
            .select('id, email, phone, name, user_type, whatsapp_linked, whatsapp_phone')
            .single();
            
        if (error) {
            throw new Error(`Failed to link WhatsApp account: ${error.message}`);
        }
        
        return updatedUser;
    } catch (error) {
        console.error('Error in linkWhatsAppAccount:', error);
        throw error;
    }
}

/**
 * Find user by WhatsApp phone number
 * @param {string} whatsappPhone - WhatsApp phone number
 * @returns {Promise<Object|null>} User object or null if not found
 */
async function findUserByWhatsApp(whatsappPhone) {
    try {
        const { data: user, error } = await supabase
            .from('users')
            .select('id, email, phone, name, user_type, location, farm_size, crops_grown, whatsapp_linked, whatsapp_phone')
            .eq('whatsapp_phone', whatsappPhone)
            .eq('whatsapp_linked', true)
            .single();
            
        if (error && error.code !== 'PGRST116') { // PGRST116 is "not found" error
            throw new Error(`Failed to find user by WhatsApp: ${error.message}`);
        }
        
        return user || null;
    } catch (error) {
        console.error('Error in findUserByWhatsApp:', error);
        throw error;
    }
}

/**
 * Get user profile with enhanced data for personalized responses
 * @param {string} whatsappPhone - WhatsApp phone number
 * @returns {Promise<Object|null>} Enhanced user profile or null if not found
 */
async function getUserProfileByWhatsApp(whatsappPhone) {
    try {
        const { data: user, error } = await supabase
            .from('users')
            .select(`
                id, 
                name, 
                user_type, 
                location, 
                farm_size, 
                crops_grown, 
                whatsapp_phone,
                created_at
            `)
            .eq('whatsapp_phone', whatsappPhone)
            .eq('whatsapp_linked', true)
            .single();
            
        if (error && error.code !== 'PGRST116') {
            throw new Error(`Failed to get user profile: ${error.message}`);
        }
        
        return user || null;
    } catch (error) {
        console.error('Error in getUserProfileByWhatsApp:', error);
        throw error;
    }
}

module.exports = {
    supabase,
    findOrCreateUser,
    saveQuery,
    getUserHistory,
    getUserStats,
    getAllUsers,
    createUser,
    authenticateUser,
    getUserById,
    updateUserProfile,
    updateUserPassword,
    linkWhatsAppAccount,
    findUserByWhatsApp,
    getUserProfileByWhatsApp
};
