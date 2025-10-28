const { supabase } = require('./supabase');

/**
 * SACCO Group Management Service
 * Handles SACCO group creation, membership, and bulk ordering functionality
 */

/**
 * Create a new SACCO group
 * @param {string} creatorId - ID of the user creating the group
 * @param {Object} saccoData - SACCO group data
 * @returns {Object} Created SACCO group
 */
async function createSACCO(creatorId, saccoData) {
    try {
        const { name, description, region, member_limit } = saccoData;
        
        // Validate required fields
        if (!name || !region) {
            throw new Error('SACCO name and region are required');
        }
        
        // Check if SACCO name already exists in the region
        const { data: existingSACCO } = await supabase
            .from('sacco_groups')
            .select('id')
            .eq('name', name.trim())
            .eq('region', region.trim())
            .single();
            
        if (existingSACCO) {
            throw new Error('A SACCO group with this name already exists in this region');
        }
        
        // Create SACCO group
        const { data: newSACCO, error } = await supabase
            .from('sacco_groups')
            .insert({
                name: name.trim(),
                description: description?.trim() || null,
                region: region.trim(),
                admin_id: creatorId,
                member_limit: member_limit || 50
            })
            .select()
            .single();
            
        if (error) {
            console.error('Error creating SACCO group:', error);
            throw new Error('Failed to create SACCO group');
        }
        
        // Automatically add creator as first member
        await joinSACCO(creatorId, newSACCO.id);
        
        return newSACCO;
        
    } catch (error) {
        console.error('Error in createSACCO:', error);
        throw error;
    }
}

/**
 * Get SACCO groups with optional filtering
 * @param {Object} filters - Filter criteria
 * @returns {Array} Array of SACCO groups
 */
async function getSACCOGroups(filters = {}) {
    try {
        let query = supabase
            .from('sacco_groups')
            .select(`
                *,
                admin:users!sacco_groups_admin_id_fkey(id, name, phone, location),
                member_count:sacco_memberships(count)
            `);
            
        // Apply filters
        if (filters.region) {
            query = query.ilike('region', `%${filters.region}%`);
        }
        
        if (filters.search) {
            query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
        }
        
        // Order by creation date (newest first)
        query = query.order('created_at', { ascending: false });
        
        const { data: saccoGroups, error } = await query;
        
        if (error) {
            console.error('Error fetching SACCO groups:', error);
            throw new Error('Failed to fetch SACCO groups');
        }
        
        // Process member count
        const processedGroups = saccoGroups.map(group => ({
            ...group,
            member_count: group.member_count?.[0]?.count || 0
        }));
        
        return processedGroups;
        
    } catch (error) {
        console.error('Error in getSACCOGroups:', error);
        throw error;
    }
}

/**
 * Get SACCO groups by region
 * @param {string} region - Region to filter by
 * @returns {Array} Array of SACCO groups in the region
 */
async function getSACCOsByRegion(region) {
    return getSACCOGroups({ region });
}

/**
 * Get SACCO group by ID with detailed information
 * @param {string} saccoId - SACCO group ID
 * @returns {Object} SACCO group with members and statistics
 */
async function getSACCOById(saccoId) {
    try {
        const { data: sacco, error } = await supabase
            .from('sacco_groups')
            .select(`
                *,
                admin:users!sacco_groups_admin_id_fkey(id, name, phone, location),
                members:sacco_memberships(
                    id,
                    joined_at,
                    status,
                    user:users(id, name, phone, location, farm_size, crops_grown)
                )
            `)
            .eq('id', saccoId)
            .single();
            
        if (error) {
            console.error('Error fetching SACCO group:', error);
            throw new Error('SACCO group not found');
        }
        
        return sacco;
        
    } catch (error) {
        console.error('Error in getSACCOById:', error);
        throw error;
    }
}

/**
 * Join a SACCO group
 * @param {string} userId - ID of the user joining
 * @param {string} saccoId - ID of the SACCO group
 * @returns {Object} Membership record
 */
async function joinSACCO(userId, saccoId) {
    try {
        // Check if SACCO exists and get member limit
        const { data: sacco, error: saccoError } = await supabase
            .from('sacco_groups')
            .select('id, member_limit')
            .eq('id', saccoId)
            .single();
            
        if (saccoError || !sacco) {
            throw new Error('SACCO group not found');
        }
        
        // Check if user is already a member
        const { data: existingMembership } = await supabase
            .from('sacco_memberships')
            .select('id, status')
            .eq('sacco_id', saccoId)
            .eq('user_id', userId)
            .single();
            
        if (existingMembership) {
            if (existingMembership.status === 'active') {
                throw new Error('User is already a member of this SACCO group');
            } else if (existingMembership.status === 'pending') {
                throw new Error('User already has a pending membership request');
            }
        }
        
        // Check member limit
        const { count: currentMembers } = await supabase
            .from('sacco_memberships')
            .select('*', { count: 'exact', head: true })
            .eq('sacco_id', saccoId)
            .eq('status', 'active');
            
        if (currentMembers >= sacco.member_limit) {
            throw new Error('SACCO group has reached its member limit');
        }
        
        // Create membership record
        const { data: membership, error } = await supabase
            .from('sacco_memberships')
            .insert({
                sacco_id: saccoId,
                user_id: userId,
                status: 'active' // Direct join for now, can be changed to 'pending' for approval workflow
            })
            .select(`
                *,
                sacco:sacco_groups(id, name, region),
                user:users(id, name, phone)
            `)
            .single();
            
        if (error) {
            console.error('Error joining SACCO group:', error);
            throw new Error('Failed to join SACCO group');
        }
        
        return membership;
        
    } catch (error) {
        console.error('Error in joinSACCO:', error);
        throw error;
    }
}

/**
 * Leave a SACCO group
 * @param {string} userId - ID of the user leaving
 * @param {string} saccoId - ID of the SACCO group
 * @returns {boolean} Success status
 */
async function leaveSACCO(userId, saccoId) {
    try {
        // Check if user is a member
        const { data: membership } = await supabase
            .from('sacco_memberships')
            .select('id')
            .eq('sacco_id', saccoId)
            .eq('user_id', userId)
            .single();
            
        if (!membership) {
            throw new Error('User is not a member of this SACCO group');
        }
        
        // Check if user is the admin
        const { data: sacco } = await supabase
            .from('sacco_groups')
            .select('admin_id')
            .eq('id', saccoId)
            .single();
            
        if (sacco && sacco.admin_id === userId) {
            throw new Error('SACCO admin cannot leave the group. Please transfer admin rights first.');
        }
        
        // Remove membership
        const { error } = await supabase
            .from('sacco_memberships')
            .delete()
            .eq('sacco_id', saccoId)
            .eq('user_id', userId);
            
        if (error) {
            console.error('Error leaving SACCO group:', error);
            throw new Error('Failed to leave SACCO group');
        }
        
        return true;
        
    } catch (error) {
        console.error('Error in leaveSACCO:', error);
        throw error;
    }
}

/**
 * Get SACCO groups that a user is a member of
 * @param {string} userId - User ID
 * @returns {Array} Array of SACCO groups
 */
async function getUserSACCOs(userId) {
    try {
        const { data: memberships, error } = await supabase
            .from('sacco_memberships')
            .select(`
                id,
                joined_at,
                status,
                sacco:sacco_groups(
                    id,
                    name,
                    description,
                    region,
                    member_limit,
                    created_at,
                    admin:users!sacco_groups_admin_id_fkey(id, name, phone)
                )
            `)
            .eq('user_id', userId)
            .eq('status', 'active')
            .order('joined_at', { ascending: false });
            
        if (error) {
            console.error('Error fetching user SACCO groups:', error);
            throw new Error('Failed to fetch user SACCO groups');
        }
        
        return memberships.map(membership => ({
            ...membership.sacco,
            membership_id: membership.id,
            joined_at: membership.joined_at,
            membership_status: membership.status
        }));
        
    } catch (error) {
        console.error('Error in getUserSACCOs:', error);
        throw error;
    }
}

/**
 * Get SACCO group members
 * @param {string} saccoId - SACCO group ID
 * @returns {Array} Array of members
 */
async function getSACCOMembers(saccoId) {
    try {
        const { data: members, error } = await supabase
            .from('sacco_memberships')
            .select(`
                id,
                joined_at,
                status,
                user:users(id, name, phone, location, farm_size, crops_grown, user_type)
            `)
            .eq('sacco_id', saccoId)
            .eq('status', 'active')
            .order('joined_at', { ascending: true });
            
        if (error) {
            console.error('Error fetching SACCO members:', error);
            throw new Error('Failed to fetch SACCO members');
        }
        
        return members;
        
    } catch (error) {
        console.error('Error in getSACCOMembers:', error);
        throw error;
    }
}

/**
 * Get SACCO group statistics
 * @param {string} saccoId - SACCO group ID
 * @returns {Object} SACCO statistics
 */
async function getSACCOStats(saccoId) {
    try {
        // Get basic SACCO info
        const { data: sacco } = await supabase
            .from('sacco_groups')
            .select('id, name, created_at, member_limit')
            .eq('id', saccoId)
            .single();
            
        if (!sacco) {
            throw new Error('SACCO group not found');
        }
        
        // Get member count
        const { count: memberCount } = await supabase
            .from('sacco_memberships')
            .select('*', { count: 'exact', head: true })
            .eq('sacco_id', saccoId)
            .eq('status', 'active');
            
        // Get bulk order count
        const { count: bulkOrderCount } = await supabase
            .from('bulk_orders')
            .select('*', { count: 'exact', head: true })
            .eq('sacco_id', saccoId);
            
        // Get total amount of bulk orders
        const { data: bulkOrderTotals } = await supabase
            .from('bulk_orders')
            .select('total_amount')
            .eq('sacco_id', saccoId);
            
        const totalOrderValue = bulkOrderTotals?.reduce((sum, order) => sum + (order.total_amount || 0), 0) || 0;
        
        return {
            sacco_id: saccoId,
            name: sacco.name,
            created_at: sacco.created_at,
            member_count: memberCount || 0,
            member_limit: sacco.member_limit,
            bulk_order_count: bulkOrderCount || 0,
            total_order_value: totalOrderValue,
            utilization_rate: ((memberCount || 0) / sacco.member_limit * 100).toFixed(1)
        };
        
    } catch (error) {
        console.error('Error in getSACCOStats:', error);
        throw error;
    }
}

/**
 * Transfer SACCO admin rights
 * @param {string} currentAdminId - Current admin user ID
 * @param {string} newAdminId - New admin user ID
 * @param {string} saccoId - SACCO group ID
 * @returns {Object} Updated SACCO group
 */
async function transferSACCOAdmin(currentAdminId, newAdminId, saccoId) {
    try {
        // Verify current admin
        const { data: sacco } = await supabase
            .from('sacco_groups')
            .select('admin_id')
            .eq('id', saccoId)
            .single();
            
        if (!sacco || sacco.admin_id !== currentAdminId) {
            throw new Error('Only the current admin can transfer admin rights');
        }
        
        // Verify new admin is a member
        const { data: membership } = await supabase
            .from('sacco_memberships')
            .select('id')
            .eq('sacco_id', saccoId)
            .eq('user_id', newAdminId)
            .eq('status', 'active')
            .single();
            
        if (!membership) {
            throw new Error('New admin must be an active member of the SACCO group');
        }
        
        // Transfer admin rights
        const { data: updatedSACCO, error } = await supabase
            .from('sacco_groups')
            .update({ admin_id: newAdminId })
            .eq('id', saccoId)
            .select()
            .single();
            
        if (error) {
            console.error('Error transferring SACCO admin:', error);
            throw new Error('Failed to transfer admin rights');
        }
        
        return updatedSACCO;
        
    } catch (error) {
        console.error('Error in transferSACCOAdmin:', error);
        throw error;
    }
}

module.exports = {
    createSACCO,
    getSACCOGroups,
    getSACCOsByRegion,
    getSACCOById,
    joinSACCO,
    leaveSACCO,
    getUserSACCOs,
    getSACCOMembers,
    getSACCOStats,
    transferSACCOAdmin
};