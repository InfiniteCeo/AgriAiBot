const { supabase } = require('./supabase');

/**
 * Send marketplace notification to linked WhatsApp users
 * @param {Object} notification - Notification data
 * @param {Function} sendMessageCallback - Function to send WhatsApp message
 */
async function sendMarketplaceNotification(notification, sendMessageCallback) {
    try {
        // Get all users with linked WhatsApp accounts
        const { data: users, error } = await supabase
            .from('users')
            .select('whatsapp_phone, name, location, crops_grown')
            .eq('whatsapp_linked', true)
            .not('whatsapp_phone', 'is', null);
            
        if (error) {
            throw new Error(`Failed to get users: ${error.message}`);
        }
        
        if (!users || users.length === 0) {
            console.log('No linked WhatsApp users found for marketplace notification');
            return;
        }
        
        // Filter users based on notification criteria
        const targetUsers = filterUsersForNotification(users, notification);
        
        // Send notifications to target users
        for (const user of targetUsers) {
            try {
                const personalizedMessage = createPersonalizedMarketplaceMessage(notification, user);
                await sendMessageCallback(`${user.whatsapp_phone}@s.whatsapp.net`, personalizedMessage);
                
                // Add small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 1000));
                
            } catch (error) {
                console.error(`Failed to send notification to ${user.whatsapp_phone}:`, error);
            }
        }
        
        console.log(`Marketplace notification sent to ${targetUsers.length} users`);
        
    } catch (error) {
        console.error('Error sending marketplace notification:', error);
        throw error;
    }
}

/**
 * Send SACCO group update to members
 * @param {string} saccoId - SACCO group ID
 * @param {Object} update - Update data
 * @param {Function} sendMessageCallback - Function to send WhatsApp message
 */
async function sendSACCOGroupUpdate(saccoId, update, sendMessageCallback) {
    try {
        // Get SACCO members with linked WhatsApp accounts
        const { data: members, error } = await supabase
            .from('sacco_memberships')
            .select(`
                users!inner(
                    whatsapp_phone,
                    name,
                    whatsapp_linked
                ),
                sacco_groups!inner(
                    name
                )
            `)
            .eq('sacco_id', saccoId)
            .eq('status', 'active')
            .eq('users.whatsapp_linked', true)
            .not('users.whatsapp_phone', 'is', null);
            
        if (error) {
            throw new Error(`Failed to get SACCO members: ${error.message}`);
        }
        
        if (!members || members.length === 0) {
            console.log('No linked WhatsApp users found in SACCO group');
            return;
        }
        
        const saccoName = members[0].sacco_groups.name;
        
        // Send updates to all members
        for (const member of members) {
            try {
                const personalizedMessage = createPersonalizedSACCOMessage(update, member.users, saccoName);
                await sendMessageCallback(`${member.users.whatsapp_phone}@s.whatsapp.net`, personalizedMessage);
                
                // Add small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 1000));
                
            } catch (error) {
                console.error(`Failed to send SACCO update to ${member.users.whatsapp_phone}:`, error);
            }
        }
        
        console.log(`SACCO update sent to ${members.length} members`);
        
    } catch (error) {
        console.error('Error sending SACCO group update:', error);
        throw error;
    }
}

/**
 * Send bulk order notification to SACCO members
 * @param {string} bulkOrderId - Bulk order ID
 * @param {string} notificationType - Type of notification (new, deadline, finalized)
 * @param {Function} sendMessageCallback - Function to send WhatsApp message
 */
async function sendBulkOrderNotification(bulkOrderId, notificationType, sendMessageCallback) {
    try {
        // Get bulk order details with SACCO members
        const { data: bulkOrder, error } = await supabase
            .from('bulk_orders')
            .select(`
                *,
                products!inner(
                    name,
                    unit_type
                ),
                sacco_groups!inner(
                    name
                ),
                sacco_memberships!inner(
                    users!inner(
                        whatsapp_phone,
                        name,
                        whatsapp_linked
                    )
                )
            `)
            .eq('id', bulkOrderId)
            .single();
            
        if (error) {
            throw new Error(`Failed to get bulk order: ${error.message}`);
        }
        
        // Filter for linked WhatsApp users
        const linkedMembers = bulkOrder.sacco_memberships
            .filter(membership => 
                membership.users.whatsapp_linked && 
                membership.users.whatsapp_phone
            );
            
        if (linkedMembers.length === 0) {
            console.log('No linked WhatsApp users found for bulk order notification');
            return;
        }
        
        // Send notifications based on type
        for (const membership of linkedMembers) {
            try {
                const personalizedMessage = createBulkOrderMessage(
                    bulkOrder, 
                    notificationType, 
                    membership.users
                );
                
                await sendMessageCallback(
                    `${membership.users.whatsapp_phone}@s.whatsapp.net`, 
                    personalizedMessage
                );
                
                // Add small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 1000));
                
            } catch (error) {
                console.error(`Failed to send bulk order notification to ${membership.users.whatsapp_phone}:`, error);
            }
        }
        
        console.log(`Bulk order notification sent to ${linkedMembers.length} members`);
        
    } catch (error) {
        console.error('Error sending bulk order notification:', error);
        throw error;
    }
}

/**
 * Filter users based on notification criteria
 * @param {Array} users - All users
 * @param {Object} notification - Notification data
 * @returns {Array} Filtered users
 */
function filterUsersForNotification(users, notification) {
    return users.filter(user => {
        // Filter by location if specified
        if (notification.targetLocation && user.location) {
            if (!user.location.toLowerCase().includes(notification.targetLocation.toLowerCase())) {
                return false;
            }
        }
        
        // Filter by crops if specified
        if (notification.targetCrops && user.crops_grown && user.crops_grown.length > 0) {
            const userCrops = user.crops_grown.map(crop => crop.toLowerCase());
            const targetCrops = notification.targetCrops.map(crop => crop.toLowerCase());
            
            const hasMatchingCrop = targetCrops.some(targetCrop => 
                userCrops.some(userCrop => userCrop.includes(targetCrop))
            );
            
            if (!hasMatchingCrop) {
                return false;
            }
        }
        
        return true;
    });
}

/**
 * Create personalized marketplace message
 * @param {Object} notification - Notification data
 * @param {Object} user - User data
 * @returns {string} Personalized message
 */
function createPersonalizedMarketplaceMessage(notification, user) {
    const greeting = user.name ? `Hello ${user.name}! 👋` : 'Hello! 👋';
    
    let message = `🛒 **Marketplace Opportunity**\n\n${greeting}\n\n`;
    
    switch (notification.type) {
        case 'new_product':
            message += `🆕 **New Product Available**\n`;
            message += `📦 ${notification.productName}\n`;
            message += `💰 Price: KSh ${notification.price}/${notification.unit}\n`;
            if (notification.location) {
                message += `📍 Location: ${notification.location}\n`;
            }
            message += `\n📱 Contact seller or visit our marketplace to order!`;
            break;
            
        case 'price_drop':
            message += `📉 **Price Drop Alert**\n`;
            message += `📦 ${notification.productName}\n`;
            message += `💰 New Price: KSh ${notification.newPrice}/${notification.unit}\n`;
            message += `🔻 Was: KSh ${notification.oldPrice}/${notification.unit}\n`;
            message += `💾 Save: KSh ${notification.oldPrice - notification.newPrice}/${notification.unit}\n`;
            message += `\n⏰ Limited time offer - order now!`;
            break;
            
        case 'stock_alert':
            message += `⚠️ **Low Stock Alert**\n`;
            message += `📦 ${notification.productName}\n`;
            message += `📊 Only ${notification.remainingStock} ${notification.unit} left!\n`;
            message += `💰 Price: KSh ${notification.price}/${notification.unit}\n`;
            message += `\n🏃‍♂️ Order quickly before it runs out!`;
            break;
            
        default:
            message += notification.message || 'New marketplace update available!';
    }
    
    return message;
}

/**
 * Create personalized SACCO message
 * @param {Object} update - Update data
 * @param {Object} user - User data
 * @param {string} saccoName - SACCO group name
 * @returns {string} Personalized message
 */
function createPersonalizedSACCOMessage(update, user, saccoName) {
    const greeting = user.name ? `Hello ${user.name}! 👋` : 'Hello! 👋';
    
    let message = `👥 **${saccoName} Update**\n\n${greeting}\n\n`;
    
    switch (update.type) {
        case 'meeting':
            message += `📅 **Upcoming Meeting**\n`;
            message += `🗓️ Date: ${update.date}\n`;
            message += `⏰ Time: ${update.time}\n`;
            message += `📍 Location: ${update.location}\n`;
            if (update.agenda) {
                message += `📋 Agenda: ${update.agenda}\n`;
            }
            message += `\n👥 Please attend to discuss important group matters.`;
            break;
            
        case 'announcement':
            message += `📢 **Group Announcement**\n\n`;
            message += update.message;
            break;
            
        case 'payment_reminder':
            message += `💰 **Payment Reminder**\n`;
            message += `📋 ${update.description}\n`;
            message += `💵 Amount: KSh ${update.amount}\n`;
            message += `📅 Due Date: ${update.dueDate}\n`;
            message += `\n💳 Please make your payment on time.`;
            break;
            
        default:
            message += update.message || 'New group update available!';
    }
    
    return message;
}

/**
 * Create bulk order notification message
 * @param {Object} bulkOrder - Bulk order data
 * @param {string} notificationType - Type of notification
 * @param {Object} user - User data
 * @returns {string} Personalized message
 */
function createBulkOrderMessage(bulkOrder, notificationType, user) {
    const greeting = user.name ? `Hello ${user.name}! 👋` : 'Hello! 👋';
    const productName = bulkOrder.products.name;
    const saccoName = bulkOrder.sacco_groups.name;
    
    let message = `📦 **Bulk Order Update - ${saccoName}**\n\n${greeting}\n\n`;
    
    switch (notificationType) {
        case 'new':
            message += `🆕 **New Bulk Order Started**\n`;
            message += `📦 Product: ${productName}\n`;
            message += `💰 Unit Price: KSh ${bulkOrder.unit_price}/${bulkOrder.products.unit_type}\n`;
            message += `🎯 Target Quantity: ${bulkOrder.total_quantity} ${bulkOrder.products.unit_type}\n`;
            if (bulkOrder.deadline) {
                message += `⏰ Deadline: ${new Date(bulkOrder.deadline).toLocaleDateString()}\n`;
            }
            message += `\n💡 Join now to get better prices through group buying!`;
            break;
            
        case 'deadline':
            const deadline = new Date(bulkOrder.deadline);
            const now = new Date();
            const hoursLeft = Math.max(0, Math.ceil((deadline - now) / (1000 * 60 * 60)));
            
            message += `⏰ **Bulk Order Deadline Approaching**\n`;
            message += `📦 Product: ${productName}\n`;
            message += `⏰ Time Left: ${hoursLeft} hours\n`;
            message += `📊 Current Orders: ${bulkOrder.current_quantity || 0}/${bulkOrder.total_quantity} ${bulkOrder.products.unit_type}\n`;
            message += `\n🏃‍♂️ Last chance to join this bulk order!`;
            break;
            
        case 'finalized':
            message += `✅ **Bulk Order Finalized**\n`;
            message += `📦 Product: ${productName}\n`;
            message += `📊 Final Quantity: ${bulkOrder.total_quantity} ${bulkOrder.products.unit_type}\n`;
            message += `💰 Total Amount: KSh ${bulkOrder.total_amount}\n`;
            message += `\n📋 Order has been placed with the supplier. Delivery details will follow.`;
            break;
            
        case 'delivered':
            message += `🚚 **Bulk Order Delivered**\n`;
            message += `📦 Product: ${productName}\n`;
            message += `📍 Collection Point: ${bulkOrder.collection_point || 'TBD'}\n`;
            message += `\n📞 Contact group admin to arrange collection.`;
            break;
            
        default:
            message += `📦 Update on bulk order for ${productName}`;
    }
    
    return message;
}

/**
 * Send market intelligence recommendations to users
 * @param {string} userId - User ID (optional, if null sends to all users)
 * @param {Object} recommendation - Recommendation data
 * @param {Function} sendMessageCallback - Function to send WhatsApp message
 */
async function sendMarketIntelligenceNotification(userId, recommendation, sendMessageCallback) {
    try {
        let targetUsers = [];
        
        if (userId) {
            // Send to specific user
            const { data: user, error } = await supabase
                .from('users')
                .select('whatsapp_phone, name, location, crops_grown')
                .eq('id', userId)
                .eq('whatsapp_linked', true)
                .not('whatsapp_phone', 'is', null)
                .single();
                
            if (error || !user) {
                console.log('User not found or WhatsApp not linked');
                return;
            }
            
            targetUsers = [user];
        } else {
            // Send to all linked users (for general market alerts)
            const { data: users, error } = await supabase
                .from('users')
                .select('whatsapp_phone, name, location, crops_grown')
                .eq('whatsapp_linked', true)
                .not('whatsapp_phone', 'is', null);
                
            if (error) {
                throw new Error(`Failed to get users: ${error.message}`);
            }
            
            targetUsers = users || [];
        }
        
        if (targetUsers.length === 0) {
            console.log('No target users found for market intelligence notification');
            return;
        }
        
        // Send notifications to target users
        for (const user of targetUsers) {
            try {
                const personalizedMessage = createMarketIntelligenceMessage(recommendation, user);
                await sendMessageCallback(`${user.whatsapp_phone}@s.whatsapp.net`, personalizedMessage);
                
                // Add small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 1000));
                
            } catch (error) {
                console.error(`Failed to send market intelligence notification to ${user.whatsapp_phone}:`, error);
            }
        }
        
        console.log(`Market intelligence notification sent to ${targetUsers.length} users`);
        
    } catch (error) {
        console.error('Error sending market intelligence notification:', error);
        throw error;
    }
}

/**
 * Send price alerts to users
 * @param {string} userId - User ID
 * @param {Object} priceAlert - Price alert data
 * @param {Function} sendMessageCallback - Function to send WhatsApp message
 */
async function sendPriceAlertNotification(userId, priceAlert, sendMessageCallback) {
    try {
        // Get user with WhatsApp link
        const { data: user, error } = await supabase
            .from('users')
            .select('whatsapp_phone, name, location, crops_grown')
            .eq('id', userId)
            .eq('whatsapp_linked', true)
            .not('whatsapp_phone', 'is', null)
            .single();
            
        if (error || !user) {
            console.log('User not found or WhatsApp not linked for price alert');
            return;
        }
        
        const personalizedMessage = createPriceAlertMessage(priceAlert, user);
        await sendMessageCallback(`${user.whatsapp_phone}@s.whatsapp.net`, personalizedMessage);
        
        console.log(`Price alert sent to ${user.whatsapp_phone}`);
        
    } catch (error) {
        console.error('Error sending price alert notification:', error);
        throw error;
    }
}

/**
 * Send bulk purchase opportunity alerts to SACCO groups
 * @param {Array} saccoIds - SACCO group IDs (optional, if empty sends to all)
 * @param {Object} opportunity - Bulk purchase opportunity data
 * @param {Function} sendMessageCallback - Function to send WhatsApp message
 */
async function sendBulkOpportunityNotification(saccoIds, opportunity, sendMessageCallback) {
    try {
        let query = supabase
            .from('sacco_memberships')
            .select(`
                users!inner(
                    whatsapp_phone,
                    name,
                    whatsapp_linked
                ),
                sacco_groups!inner(
                    id,
                    name,
                    region
                )
            `)
            .eq('status', 'active')
            .eq('users.whatsapp_linked', true)
            .not('users.whatsapp_phone', 'is', null);
            
        if (saccoIds && saccoIds.length > 0) {
            query = query.in('sacco_id', saccoIds);
        }
        
        const { data: members, error } = await query;
        
        if (error) {
            throw new Error(`Failed to get SACCO members: ${error.message}`);
        }
        
        if (!members || members.length === 0) {
            console.log('No linked WhatsApp users found in target SACCO groups');
            return;
        }
        
        // Group members by SACCO to avoid duplicate messages
        const membersBySacco = {};
        members.forEach(member => {
            const saccoId = member.sacco_groups.id;
            if (!membersBySacco[saccoId]) {
                membersBySacco[saccoId] = {
                    sacco: member.sacco_groups,
                    members: []
                };
            }
            membersBySacco[saccoId].members.push(member.users);
        });
        
        // Send notifications to each SACCO group
        for (const [saccoId, saccoData] of Object.entries(membersBySacco)) {
            for (const user of saccoData.members) {
                try {
                    const personalizedMessage = createBulkOpportunityMessage(opportunity, user, saccoData.sacco);
                    await sendMessageCallback(`${user.whatsapp_phone}@s.whatsapp.net`, personalizedMessage);
                    
                    // Add small delay to avoid rate limiting
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                } catch (error) {
                    console.error(`Failed to send bulk opportunity notification to ${user.whatsapp_phone}:`, error);
                }
            }
        }
        
        console.log(`Bulk opportunity notification sent to ${members.length} SACCO members`);
        
    } catch (error) {
        console.error('Error sending bulk opportunity notification:', error);
        throw error;
    }
}

/**
 * Send personalized recommendations to a user
 * @param {string} userId - User ID
 * @param {Object} recommendations - Personalized recommendations data
 * @param {Function} sendMessageCallback - Function to send WhatsApp message
 */
async function sendPersonalizedRecommendations(userId, recommendations, sendMessageCallback) {
    try {
        // Get user with WhatsApp link
        const { data: user, error } = await supabase
            .from('users')
            .select('whatsapp_phone, name, location, crops_grown')
            .eq('id', userId)
            .eq('whatsapp_linked', true)
            .not('whatsapp_phone', 'is', null)
            .single();
            
        if (error || !user) {
            console.log('User not found or WhatsApp not linked for personalized recommendations');
            return;
        }
        
        // Split recommendations into digestible chunks if too long
        const message = typeof recommendations === 'string' ? recommendations : 
                       recommendations.recommendations || JSON.stringify(recommendations);
        
        const chunks = splitMessageIntoChunks(message, 1500); // WhatsApp message limit consideration
        
        for (let i = 0; i < chunks.length; i++) {
            const chunkMessage = i === 0 ? chunks[i] : `📱 **Continued...**\n\n${chunks[i]}`;
            await sendMessageCallback(`${user.whatsapp_phone}@s.whatsapp.net`, chunkMessage);
            
            // Add delay between chunks
            if (i < chunks.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        
        console.log(`Personalized recommendations sent to ${user.whatsapp_phone} in ${chunks.length} message(s)`);
        
    } catch (error) {
        console.error('Error sending personalized recommendations:', error);
        throw error;
    }
}

/**
 * Create market intelligence notification message
 * @param {Object} recommendation - Recommendation data
 * @param {Object} user - User data
 * @returns {string} Personalized message
 */
function createMarketIntelligenceMessage(recommendation, user) {
    const greeting = user.name ? `Hello ${user.name}! 👋` : 'Hello! 👋';
    
    let message = `🧠 **Market Intelligence Alert**\n\n${greeting}\n\n`;
    
    switch (recommendation.type) {
        case 'market_trends':
            message += `📊 **Market Trends Update**\n\n`;
            message += `📈 Key insights for your farming decisions:\n\n`;
            // Extract key points from AI analysis
            if (recommendation.analysis) {
                const keyPoints = extractKeyPoints(recommendation.analysis);
                message += keyPoints.slice(0, 3).map(point => `• ${point}`).join('\n');
            }
            message += `\n\n💡 Check the full analysis in your dashboard for detailed recommendations.`;
            break;
            
        case 'demand_forecast':
            message += `🔮 **Demand Forecast Alert**\n\n`;
            message += `📦 Product: ${recommendation.product_category}\n`;
            message += `📅 Forecast Period: ${recommendation.forecast_period}\n\n`;
            if (recommendation.forecast) {
                const keyPoints = extractKeyPoints(recommendation.forecast);
                message += keyPoints.slice(0, 2).map(point => `• ${point}`).join('\n');
            }
            message += `\n\n📱 View full forecast details in your profile.`;
            break;
            
        case 'seasonal_alert':
            message += `🌱 **Seasonal Farming Alert**\n\n`;
            message += `📅 This is the optimal time for:\n`;
            if (recommendation.activities) {
                message += recommendation.activities.slice(0, 3).map(activity => `• ${activity}`).join('\n');
            }
            message += `\n\n⏰ Don't miss these seasonal opportunities!`;
            break;
            
        default:
            message += recommendation.message || 'New market intelligence available for your farming decisions.';
    }
    
    return message;
}

/**
 * Create price alert notification message
 * @param {Object} priceAlert - Price alert data
 * @param {Object} user - User data
 * @returns {string} Personalized message
 */
function createPriceAlertMessage(priceAlert, user) {
    const greeting = user.name ? `Hello ${user.name}! 👋` : 'Hello! 👋';
    
    let message = `💰 **Price Alert**\n\n${greeting}\n\n`;
    
    if (priceAlert.alerts) {
        // Extract buy now alerts and wait alerts from AI response
        const buyNowAlerts = extractAlertsFromText(priceAlert.alerts, 'Buy Now');
        const waitAlerts = extractAlertsFromText(priceAlert.alerts, 'Wait');
        
        if (buyNowAlerts.length > 0) {
            message += `💚 **Good Time to Buy:**\n`;
            message += buyNowAlerts.slice(0, 2).map(alert => `• ${alert}`).join('\n');
            message += `\n\n`;
        }
        
        if (waitAlerts.length > 0) {
            message += `⏰ **Consider Waiting:**\n`;
            message += waitAlerts.slice(0, 2).map(alert => `• ${alert}`).join('\n');
            message += `\n\n`;
        }
    }
    
    message += `📱 Check your profile for detailed price analysis and optimal timing recommendations.`;
    
    return message;
}

/**
 * Create bulk purchase opportunity message
 * @param {Object} opportunity - Bulk opportunity data
 * @param {Object} user - User data
 * @param {Object} sacco - SACCO group data
 * @returns {string} Personalized message
 */
function createBulkOpportunityMessage(opportunity, user, sacco) {
    const greeting = user.name ? `Hello ${user.name}! 👋` : 'Hello! 👋';
    
    let message = `🎯 **Bulk Purchase Opportunity - ${sacco.name}**\n\n${greeting}\n\n`;
    
    if (opportunity.opportunities) {
        // Extract top opportunities from AI analysis
        const topOpportunities = extractOpportunitiesFromText(opportunity.opportunities);
        
        if (topOpportunities.length > 0) {
            message += `💎 **Top Opportunity:**\n`;
            message += `${topOpportunities[0]}\n\n`;
            
            if (topOpportunities.length > 1) {
                message += `📋 **Other Opportunities:**\n`;
                message += topOpportunities.slice(1, 3).map(opp => `• ${opp.split('\n')[0]}`).join('\n');
                message += `\n\n`;
            }
        }
    }
    
    message += `🤝 Coordinate with your SACCO group to take advantage of bulk pricing!\n\n`;
    message += `📱 Contact your group admin or check the marketplace for details.`;
    
    return message;
}

/**
 * Extract key points from AI-generated text
 * @param {string} text - AI-generated text
 * @returns {Array} Array of key points
 */
function extractKeyPoints(text) {
    const lines = text.split('\n');
    const keyPoints = [];
    
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('•') || trimmed.startsWith('-')) {
            keyPoints.push(trimmed.substring(1).trim());
        } else if (trimmed.includes(':') && trimmed.length < 100) {
            keyPoints.push(trimmed);
        }
    }
    
    return keyPoints.slice(0, 5); // Return top 5 key points
}

/**
 * Extract alerts from AI-generated text
 * @param {string} text - AI-generated text
 * @param {string} alertType - Type of alert to extract
 * @returns {Array} Array of alerts
 */
function extractAlertsFromText(text, alertType) {
    const lines = text.split('\n');
    const alerts = [];
    let inSection = false;
    
    for (const line of lines) {
        const trimmed = line.trim();
        
        if (trimmed.includes(alertType) && trimmed.includes('**')) {
            inSection = true;
            continue;
        }
        
        if (inSection && trimmed.startsWith('•')) {
            alerts.push(trimmed.substring(1).trim());
        } else if (inSection && trimmed.includes('**') && !trimmed.includes(alertType)) {
            break; // End of section
        }
    }
    
    return alerts;
}

/**
 * Extract opportunities from AI-generated text
 * @param {string} text - AI-generated text
 * @returns {Array} Array of opportunities
 */
function extractOpportunitiesFromText(text) {
    const opportunities = [];
    const sections = text.split('💎 **Opportunity');
    
    for (let i = 1; i < sections.length && i <= 3; i++) {
        const section = sections[i];
        const lines = section.split('\n').slice(0, 6); // First few lines of each opportunity
        const opportunity = lines.join('\n').trim();
        if (opportunity) {
            opportunities.push(opportunity);
        }
    }
    
    return opportunities;
}

/**
 * Split long messages into chunks
 * @param {string} message - Long message
 * @param {number} maxLength - Maximum length per chunk
 * @returns {Array} Array of message chunks
 */
function splitMessageIntoChunks(message, maxLength = 1500) {
    if (message.length <= maxLength) {
        return [message];
    }
    
    const chunks = [];
    const paragraphs = message.split('\n\n');
    let currentChunk = '';
    
    for (const paragraph of paragraphs) {
        if ((currentChunk + paragraph).length <= maxLength) {
            currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
        } else {
            if (currentChunk) {
                chunks.push(currentChunk);
                currentChunk = paragraph;
            } else {
                // Paragraph is too long, split by sentences
                const sentences = paragraph.split('. ');
                for (const sentence of sentences) {
                    if ((currentChunk + sentence).length <= maxLength) {
                        currentChunk += (currentChunk ? '. ' : '') + sentence;
                    } else {
                        if (currentChunk) {
                            chunks.push(currentChunk);
                        }
                        currentChunk = sentence;
                    }
                }
            }
        }
    }
    
    if (currentChunk) {
        chunks.push(currentChunk);
    }
    
    return chunks;
}

module.exports = {
    sendMarketplaceNotification,
    sendSACCOGroupUpdate,
    sendBulkOrderNotification,
    sendMarketIntelligenceNotification,
    sendPriceAlertNotification,
    sendBulkOpportunityNotification,
    sendPersonalizedRecommendations,
    createPersonalizedMarketplaceMessage,
    createPersonalizedSACCOMessage,
    createBulkOrderMessage,
    createMarketIntelligenceMessage,
    createPriceAlertMessage,
    createBulkOpportunityMessage
};