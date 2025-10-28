// Market Intelligence Dashboard JavaScript

let currentRecommendationId = null;
let recommendations = [];

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', function() {
    loadRecommendations();
    loadMarketStats();
    
    // Set up tab change handlers
    document.querySelectorAll('[data-bs-toggle="tab"]').forEach(tab => {
        tab.addEventListener('shown.bs.tab', function(e) {
            const target = e.target.getAttribute('href');
            loadTabContent(target);
        });
    });
});

/**
 * Load all recommendations
 */
async function loadRecommendations() {
    try {
        showLoading(true);
        
        const response = await fetch('/api/market-intelligence/recommendations', {
            headers: {
                'Authorization': `Bearer ${getAuthToken()}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to load recommendations');
        }
        
        const data = await response.json();
        recommendations = data.data || [];
        
        displayRecommendations(recommendations);
        updateAlertCount();
        
    } catch (error) {
        console.error('Error loading recommendations:', error);
        showError('Failed to load recommendations. Please try again.');
    } finally {
        showLoading(false);
    }
}

/**
 * Display recommendations in the UI
 */
function displayRecommendations(recs) {
    const container = document.getElementById('recommendationsContainer');
    const emptyState = document.getElementById('emptyState');
    
    if (!recs || recs.length === 0) {
        container.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }
    
    emptyState.style.display = 'none';
    
    container.innerHTML = recs.map(rec => `
        <div class="col-md-6 mb-3">
            <div class="card recommendation-card ${!rec.is_read ? 'unread' : ''}" 
                 onclick="showRecommendationDetail('${rec.id}')">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <span class="badge bg-${getTypeColor(rec.type)} recommendation-type">
                            ${getTypeLabel(rec.type)}
                        </span>
                        <small class="text-muted">
                            ${formatDate(rec.created_at)}
                        </small>
                    </div>
                    <h6 class="card-title">${rec.title}</h6>
                    <p class="card-text text-truncate" style="max-height: 60px; overflow: hidden;">
                        ${extractPreview(rec.description)}
                    </p>
                    <div class="d-flex justify-content-between align-items-center">
                        <small class="text-muted">
                            <i class="fas fa-clock me-1"></i>
                            ${getTimeAgo(rec.created_at)}
                        </small>
                        ${!rec.is_read ? '<span class="badge bg-primary">New</span>' : ''}
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

/**
 * Load content for specific tab
 */
async function loadTabContent(tabId) {
    const type = getTypeFromTab(tabId);
    
    if (type) {
        const filteredRecs = recommendations.filter(rec => rec.type === type);
        displayTabContent(tabId, filteredRecs);
    } else if (tabId === '#bulk-orders') {
        await loadBulkOpportunities();
    }
}

/**
 * Display content for specific tab
 */
function displayTabContent(tabId, recs) {
    const containerId = getContainerIdFromTab(tabId);
    const container = document.getElementById(containerId);
    
    if (!container) return;
    
    if (!recs || recs.length === 0) {
        container.innerHTML = `
            <div class="col-12 text-center py-4">
                <i class="fas fa-info-circle fa-2x text-muted mb-2"></i>
                <p class="text-muted">No ${getTypeLabel(getTypeFromTab(tabId))} available</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = recs.map(rec => `
        <div class="col-md-6 mb-3">
            <div class="card recommendation-card ${!rec.is_read ? 'unread' : ''}" 
                 onclick="showRecommendationDetail('${rec.id}')">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <span class="badge bg-${getTypeColor(rec.type)} recommendation-type">
                            ${getTypeLabel(rec.type)}
                        </span>
                        <small class="text-muted">
                            ${formatDate(rec.created_at)}
                        </small>
                    </div>
                    <h6 class="card-title">${rec.title}</h6>
                    <p class="card-text recommendation-content" style="max-height: 100px; overflow: hidden;">
                        ${extractPreview(rec.description)}
                    </p>
                    ${!rec.is_read ? '<span class="badge bg-primary">New</span>' : ''}
                </div>
            </div>
        </div>
    `).join('');
}

/**
 * Load market statistics
 */
async function loadMarketStats() {
    try {
        // Load market trends
        const trendsResponse = await fetch('/api/market-intelligence/trends?timeframe=7d', {
            headers: {
                'Authorization': `Bearer ${getAuthToken()}`
            }
        });
        
        if (trendsResponse.ok) {
            const trendsData = await trendsResponse.json();
            updateTrendStatus(trendsData.data);
        }
        
        // Load bulk opportunities
        const bulkResponse = await fetch('/api/market-intelligence/bulk-opportunities', {
            headers: {
                'Authorization': `Bearer ${getAuthToken()}`
            }
        });
        
        if (bulkResponse.ok) {
            const bulkData = await bulkResponse.json();
            updateBulkOpportunities(bulkData.data);
        }
        
    } catch (error) {
        console.error('Error loading market stats:', error);
    }
}

/**
 * Generate new recommendations
 */
async function generateRecommendations() {
    try {
        showLoading(true);
        
        const response = await fetch('/api/market-intelligence/recommendations/generate', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${getAuthToken()}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to generate recommendations');
        }
        
        const data = await response.json();
        showSuccess('New insights generated successfully!');
        
        // Reload recommendations
        await loadRecommendations();
        
    } catch (error) {
        console.error('Error generating recommendations:', error);
        showError('Failed to generate new insights. Please try again.');
    } finally {
        showLoading(false);
    }
}

/**
 * Generate price alerts
 */
async function generatePriceAlerts() {
    try {
        const response = await fetch('/api/market-intelligence/price-alerts', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${getAuthToken()}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ product_ids: [] }) // Empty array means use user's crops
        });
        
        if (!response.ok) {
            throw new Error('Failed to generate price alerts');
        }
        
        const data = await response.json();
        showSuccess('Price alerts generated successfully!');
        
        // Reload recommendations to show new alerts
        await loadRecommendations();
        
    } catch (error) {
        console.error('Error generating price alerts:', error);
        showError('Failed to generate price alerts. Please try again.');
    }
}

/**
 * Load bulk opportunities
 */
async function loadBulkOpportunities() {
    try {
        const response = await fetch('/api/market-intelligence/bulk-opportunities', {
            headers: {
                'Authorization': `Bearer ${getAuthToken()}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to load bulk opportunities');
        }
        
        const data = await response.json();
        displayBulkOpportunities(data.data);
        
    } catch (error) {
        console.error('Error loading bulk opportunities:', error);
        showError('Failed to load bulk opportunities.');
    }
}

/**
 * Display bulk opportunities
 */
function displayBulkOpportunities(opportunities) {
    const container = document.getElementById('bulkOpportunitiesContainer');
    
    if (!opportunities || !opportunities.opportunities) {
        container.innerHTML = `
            <div class="col-12 text-center py-4">
                <i class="fas fa-boxes fa-2x text-muted mb-2"></i>
                <p class="text-muted">No bulk opportunities available at the moment</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = `
        <div class="col-12">
            <div class="card">
                <div class="card-body">
                    <h5 class="card-title">
                        <i class="fas fa-boxes text-warning me-2"></i>
                        Bulk Purchase Opportunities
                    </h5>
                    <div class="recommendation-content">
                        ${opportunities.opportunities}
                    </div>
                    <small class="text-muted">
                        Generated: ${formatDate(opportunities.generated_at)}
                    </small>
                </div>
            </div>
        </div>
    `;
}

/**
 * Show recommendation detail modal
 */
function showRecommendationDetail(recommendationId) {
    const rec = recommendations.find(r => r.id === recommendationId);
    if (!rec) return;
    
    currentRecommendationId = recommendationId;
    
    document.getElementById('modalTitle').textContent = rec.title;
    document.getElementById('modalContent').innerHTML = `
        <div class="mb-3">
            <span class="badge bg-${getTypeColor(rec.type)} recommendation-type">
                ${getTypeLabel(rec.type)}
            </span>
            <span class="ms-2 text-muted">${formatDate(rec.created_at)}</span>
        </div>
        <div class="recommendation-content">
            ${rec.description}
        </div>
    `;
    
    const modal = new bootstrap.Modal(document.getElementById('recommendationModal'));
    modal.show();
}

/**
 * Mark recommendation as read
 */
async function markAsRead() {
    if (!currentRecommendationId) return;
    
    try {
        const response = await fetch(`/api/market-intelligence/recommendations/${currentRecommendationId}/read`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${getAuthToken()}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to mark as read');
        }
        
        // Update local data
        const rec = recommendations.find(r => r.id === currentRecommendationId);
        if (rec) {
            rec.is_read = true;
        }
        
        // Refresh display
        displayRecommendations(recommendations);
        updateAlertCount();
        
        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('recommendationModal'));
        modal.hide();
        
    } catch (error) {
        console.error('Error marking as read:', error);
        showError('Failed to update recommendation status.');
    }
}

// Utility functions
function getAuthToken() {
    return localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
}

function getTypeColor(type) {
    const colors = {
        'personalized': 'primary',
        'price_alert': 'warning',
        'bulk_order': 'success',
        'market_opportunity': 'info',
        'timing': 'secondary'
    };
    return colors[type] || 'secondary';
}

function getTypeLabel(type) {
    const labels = {
        'personalized': 'Personal Advice',
        'price_alert': 'Price Alert',
        'bulk_order': 'Bulk Opportunity',
        'market_opportunity': 'Market Opportunity',
        'timing': 'Optimal Timing'
    };
    return labels[type] || 'Recommendation';
}

function getTypeFromTab(tabId) {
    const types = {
        '#personalized': 'personalized',
        '#price-alerts': 'price_alert',
        '#bulk-orders': 'bulk_order'
    };
    return types[tabId];
}

function getContainerIdFromTab(tabId) {
    const containers = {
        '#personalized': 'personalizedRecommendations',
        '#price-alerts': 'priceAlertsContainer',
        '#bulk-orders': 'bulkOpportunitiesContainer'
    };
    return containers[tabId];
}

function extractPreview(text) {
    if (!text) return '';
    
    // Remove markdown formatting and extract first few lines
    const cleaned = text.replace(/[*#_`]/g, '').replace(/\n+/g, ' ');
    return cleaned.length > 150 ? cleaned.substring(0, 150) + '...' : cleaned;
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function getTimeAgo(dateString) {
    const now = new Date();
    const date = new Date(dateString);
    const diffInHours = Math.floor((now - date) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;
    
    return formatDate(dateString);
}

function updateAlertCount() {
    const unreadCount = recommendations.filter(r => !r.is_read).length;
    document.getElementById('alertCount').textContent = unreadCount;
}

function updateTrendStatus(trendsData) {
    const statusElement = document.getElementById('trendStatus');
    if (trendsData && trendsData.analysis) {
        // Extract trend direction from analysis
        const analysis = trendsData.analysis.toLowerCase();
        if (analysis.includes('rising') || analysis.includes('increasing')) {
            statusElement.innerHTML = '<i class="fas fa-arrow-up trend-up"></i> Rising';
        } else if (analysis.includes('falling') || analysis.includes('declining')) {
            statusElement.innerHTML = '<i class="fas fa-arrow-down trend-down"></i> Declining';
        } else {
            statusElement.innerHTML = '<i class="fas fa-minus trend-stable"></i> Stable';
        }
    } else {
        statusElement.textContent = 'No data';
    }
}

function updateBulkOpportunities(opportunitiesData) {
    const element = document.getElementById('bulkOpportunities');
    if (opportunitiesData && opportunitiesData.products_analyzed) {
        element.textContent = `${opportunitiesData.products_analyzed} products`;
    } else {
        element.textContent = 'No data';
    }
}

function showLoading(show) {
    const spinner = document.querySelector('.loading-spinner');
    if (spinner) {
        spinner.style.display = show ? 'block' : 'none';
    }
}

function showSuccess(message) {
    // Simple alert for now - could be enhanced with toast notifications
    alert('Success: ' + message);
}

function showError(message) {
    // Simple alert for now - could be enhanced with toast notifications
    alert('Error: ' + message);
}