const { supabase } = require('./supabase');

/**
 * Link WhatsApp account automatically based on phone number
 * @param {string} whatsappPhone - WhatsApp phone number (without country code)
 * @returns {Promise<Object>} Linking result
 */
async function autoLinkWhatsAppAccount(whatsappPhone) {
    try {
        // Format phone number to match database format
        const formattedPhone = `+${whatsappPhone}`;
        
        // Find user with matching phone number
        const { data: existingUser, error: findError } = await supabase
            .from('users')
            .select('id, name, email, phone, whatsapp_linked, whatsapp_phone')
            .eq('phone', formattedPhone)
            .single();
            
        if (findError && findError.code !== 'PGRST116') {
            throw new Error(`Database error: ${findError.message}`);
        }
        
        if (!existingUser) {
            return {
                success: false,
                message: 'No account found with this phone number',
                shouldCreateUser: true
            };
        }
        
        // Check if WhatsApp is already linked
        if (existingUser.whatsapp_linked) {
            return {
                success: true,
                user: existingUser,
                message: 'WhatsApp account already linked',
                alreadyLinked: true
            };
        }
        
        // Link WhatsApp account
        const { data: updatedUser, error: updateError } = await supabase
            .from('users')
            .update({
                whatsapp_linked: true,
                whatsapp_phone: whatsappPhone,
                last_seen: new Date().toISOString()
            })
            .eq('id', existingUser.id)
            .select('id, name, email, phone, whatsapp_linked, whatsapp_phone')
            .single();
            
        if (updateError) {
            throw new Error(`Failed to link WhatsApp account: ${updateError.message}`);
        }
        
        return {
            success: true,
            user: updatedUser,
            message: 'WhatsApp account linked successfully',
            newlyLinked: true
        };
        
    } catch (error) {
        console.error('Error auto-linking WhatsApp account:', error);
        throw error;
    }
}

/**
 * Unlink WhatsApp account from user profile
 * @param {string} userId - User's UUID
 * @returns {Promise<Object>} Updated user object
 */
async function unlinkWhatsAppAccount(userId) {
    try {
        const { data: updatedUser, error } = await supabase
            .from('users')
            .update({
                whatsapp_linked: false,
                whatsapp_phone: null,
                last_seen: new Date().toISOString()
            })
            .eq('id', userId)
            .select('id, name, email, phone, whatsapp_linked, whatsapp_phone')
            .single();
            
        if (error) {
            throw new Error(`Failed to unlink WhatsApp account: ${error.message}`);
        }
        
        return updatedUser;
        
    } catch (error) {
        console.error('Error unlinking WhatsApp account:', error);
        throw error;
    }
}

/**
 * Check if a WhatsApp number is linked to any account
 * @param {string} whatsappPhone - WhatsApp phone number
 * @returns {Promise<Object>} Link status
 */
async function checkWhatsAppLinkStatus(whatsappPhone) {
    try {
        const { data: user, error } = await supabase
            .from('users')
            .select('id, name, whatsapp_linked, whatsapp_phone')
            .eq('whatsapp_phone', whatsappPhone)
            .eq('whatsapp_linked', true)
            .single();
            
        if (error && error.code !== 'PGRST116') {
            throw new Error(`Database error: ${error.message}`);
        }
        
        return {
            isLinked: !!user,
            user: user || null
        };
        
    } catch (error) {
        console.error('Error checking WhatsApp link status:', error);
        throw error;
    }
}

module.exports = {
    autoLinkWhatsAppAccount,
    unlinkWhatsAppAccount,
    checkWhatsAppLinkStatus
};