document.addEventListener('DOMContentLoaded', async () => {
    // Check authentication
    const token = localStorage.getItem('authToken');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    // Initialize marketplace
    await initializeMarketplace();
    
    // Set up event listeners
    setupEventListeners();
    
    // Load initial products
    await loadProducts();
    
    // Load shopping cart
    loadShoppingCart();
});

let currentUser = null;
let currentProducts = [];
let currentPage = 0;
let isLoading = false;
let shoppingCart = [];
let currentView = 'grid';

async function initializeMarketplace() {
    try {
        // Get user profile
        const response = await fetch('/api/auth/profile', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to load profile');
        }
        
        const data = await response.json();
        currentUser = data.user;
        
        // Update user name display
        document.getElementById('userName').textContent = currentUser.name;
        
        // Load cart from localStorage
        const savedCart = localStorage.getItem('shoppingCart');
        if (savedCart) {
            shoppingCart = JSON.parse(savedCart);
            updateCartBadge();
        }
        
    } catch (error) {
        console.error('Error initializing marketplace:', error);
        // Redirect to login if authentication fails
        if (error.message.includes('Failed to load profile')) {
            localStorage.removeItem('authToken');
            window.location.href = 'login.html';
        }
    }
}

function setupEventListeners() {
    // Navigation
    document.getElementById('logoutBtn').addEventListener('click', () => {
        localStorage.removeItem('authToken');
        localStorage.removeItem('shoppingCart');
        window.location.href = 'login.html';
    });
    
    // Filter toggle for mobile
    document.getElementById('filterToggle').addEventListener('click', toggleFilterSidebar);
    
    // View toggle
    document.getElementById('viewToggle').addEventListener('click', toggleView);
    document.getElementById('gridViewBtn').addEventListener('click', () => setView('grid'));
    document.getElementById('listViewBtn').addEventListener('click', () => setView('list'));
    
    // Filter controls
    document.getElementById('applyFilters').addEventListener('click', applyFilters);
    document.getElementById('clearFilters').addEventListener('click', clearAllFilters);
    
    // Search input with debounce
    let searchTimeout;
    document.getElementById('searchInput').addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            applyFilters();
        }, 500);
    });
    
    // Filter change events
    ['categoryFilter', 'locationFilter', 'minPrice', 'maxPrice', 'bulkPricingFilter', 'sortBy'].forEach(id => {
        document.getElementById(id).addEventListener('change', applyFilters);
    });
    
    // Load more button
    document.getElementById('loadMoreBtn').addEventListener('click', loadMoreProducts);
    
    // Shopping cart
    document.getElementById('cartBtn').addEventListener('click', toggleCart);
    document.getElementById('closeCart').addEventListener('click', closeCart);
    document.getElementById('clearCartBtn').addEventListener('click', clearCart);
    document.getElementById('checkoutBtn').addEventListener('click', proceedToCheckout);
    
    // Modal close events
    document.getElementById('productModal').addEventListener('click', (e) => {
        if (e.target.id === 'productModal') {
            closeProductModal();
        }
    });
    
    document.getElementById('bulkOrderModal').addEventListener('click', (e) => {
        if (e.target.id === 'bulkOrderModal') {
            closeBulkOrderModal();
        }
    });
    
    document.getElementById('closeBulkOrderModal').addEventListener('click', closeBulkOrderModal);
}

async function loadProducts(reset = true) {
    if (isLoading) return;
    
    isLoading = true;
    
    try {
        if (reset) {
            currentPage = 0;
            currentProducts = [];
        }
        
        const filters = getActiveFilters();
        filters.limit = 12;
        filters.offset = currentPage * 12;
        
        const queryParams = new URLSearchParams();
        Object.entries(filters).forEach(([key, value]) => {
            if (value !== '' && value !== null && value !== undefined) {
                queryParams.append(key, value);
            }
        });
        
        const response = await fetch(`/api/marketplace/products?${queryParams}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to load products');
        }
        
        const data = await response.json();
        const products = data.data || [];
        
        if (reset) {
            currentProducts = products;
            displayProducts(products);
        } else {
            currentProducts = [...currentProducts, ...products];
            appendProducts(products);
        }
        
        // Update results count
        updateResultsCount(currentProducts.length, data.total || currentProducts.length);
        
        // Show/hide load more button
        const loadMoreContainer = document.getElementById('loadMoreContainer');
        if (products.length === 12) {
            loadMoreContainer.classList.remove('hidden');
        } else {
            loadMoreContainer.classList.add('hidden');
        }
        
        // Show no results if empty
        const noResults = document.getElementById('noResults');
        if (currentProducts.length === 0) {
            noResults.classList.remove('hidden');
        } else {
            noResults.classList.add('hidden');
        }
        
        currentPage++;
        
    } catch (error) {
        console.error('Error loading products:', error);
        showError('Failed to load products. Please try again.');
    } finally {
        isLoading = false;
    }
}

function getActiveFilters() {
    const filters = {};
    
    const search = document.getElementById('searchInput').value.trim();
    if (search) filters.search = search;
    
    const category = document.getElementById('categoryFilter').value;
    if (category) filters.category = category;
    
    const location = document.getElementById('locationFilter').value;
    if (location) filters.location = location;
    
    const minPrice = document.getElementById('minPrice').value;
    if (minPrice) filters.min_price = minPrice;
    
    const maxPrice = document.getElementById('maxPrice').value;
    if (maxPrice) filters.max_price = maxPrice;
    
    const bulkPricing = document.getElementById('bulkPricingFilter').checked;
    if (bulkPricing) filters.has_bulk_pricing = true;
    
    const sortBy = document.getElementById('sortBy').value;
    if (sortBy) {
        const [field, order] = sortBy.split(':');
        filters.sort_by = field;
        filters.sort_order = order;
    }
    
    return filters;
}

function displayProducts(products) {
    const container = document.getElementById('productsContainer');
    
    if (products.length === 0) {
        container.innerHTML = '';
        return;
    }
    
    container.innerHTML = products.map(product => createProductCard(product)).join('');
}

function appendProducts(products) {
    const container = document.getElementById('productsContainer');
    const newProductsHTML = products.map(product => createProductCard(product)).join('');
    container.insertAdjacentHTML('beforeend', newProductsHTML);
}

function createProductCard(product) {
    const hasBulkPricing = product.bulk_pricing && Object.keys(product.bulk_pricing).length > 0;
    const isInStock = product.stock_quantity > 0;
    
    return `
        <div class="bg-white rounded-xl shadow-lg product-card fade-in" data-product-id="${product.id}">
            <div class="relative">
                ${product.image_url ? 
                    `<img src="${product.image_url}" alt="${product.name}" class="w-full h-48 object-cover rounded-t-xl">` :
                    `<div class="w-full h-48 bg-gradient-to-br from-green-100 to-emerald-100 rounded-t-xl flex items-center justify-center">
                        <i class="fas fa-seedling text-4xl text-green-600"></i>
                    </div>`
                }
                ${hasBulkPricing ? 
                    '<div class="absolute top-2 left-2 bg-purple-600 text-white px-2 py-1 rounded-full text-xs font-bold">BULK PRICING</div>' : ''
                }
                ${!isInStock ? 
                    '<div class="absolute top-2 right-2 bg-red-600 text-white px-2 py-1 rounded-full text-xs font-bold">OUT OF STOCK</div>' : ''
                }
            </div>
            
            <div class="p-4">
                <div class="flex items-start justify-between mb-2">
                    <h3 class="font-bold text-gray-800 text-lg truncate flex-1 mr-2">${product.name}</h3>
                    <button onclick="toggleFavorite('${product.id}')" class="text-gray-400 hover:text-red-500 transition-colors">
                        <i class="far fa-heart"></i>
                    </button>
                </div>
                
                <p class="text-gray-600 text-sm mb-3 line-clamp-2">${product.description || 'No description available'}</p>
                
                <div class="flex items-center justify-between mb-3">
                    <div class="flex items-center space-x-2">
                        <i class="fas fa-map-marker-alt text-gray-400 text-sm"></i>
                        <span class="text-gray-600 text-sm">${product.location || 'Location not specified'}</span>
                    </div>
                    <div class="flex items-center space-x-2">
                        <i class="fas fa-boxes text-gray-400 text-sm"></i>
                        <span class="text-gray-600 text-sm">${product.stock_quantity} ${product.unit_type}</span>
                    </div>
                </div>
                
                <div class="flex items-center justify-between mb-4">
                    <div>
                        <span class="text-2xl font-bold text-green-600">KES ${product.unit_price.toLocaleString()}</span>
                        <span class="text-gray-500 text-sm">/${product.unit_type}</span>
                    </div>
                    ${product.wholesaler ? 
                        `<div class="text-right">
                            <p class="text-xs text-gray-500">Sold by</p>
                            <p class="text-sm font-medium text-gray-700">${product.wholesaler.name}</p>
                        </div>` : ''
                    }
                </div>
                
                ${hasBulkPricing ? 
                    `<div class="bg-purple-50 border border-purple-200 rounded-lg p-3 mb-4">
                        <div class="flex items-center justify-between">
                            <span class="text-sm font-medium text-purple-800">Bulk Pricing Available</span>
                            <button onclick="showBulkPricing('${product.id}')" class="text-purple-600 hover:text-purple-700 text-sm">
                                View Tiers <i class="fas fa-chevron-right ml-1"></i>
                            </button>
                        </div>
                    </div>` : ''
                }
                
                <div class="flex space-x-2">
                    <button onclick="viewProduct('${product.id}')" 
                            class="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-3 rounded-lg transition-colors text-sm">
                        <i class="fas fa-eye mr-2"></i>View Details
                    </button>
                    ${isInStock ? 
                        `<button onclick="addToCart('${product.id}', 1)" 
                                class="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 px-3 rounded-lg transition-colors text-sm">
                            <i class="fas fa-cart-plus mr-2"></i>Add to Cart
                        </button>` :
                        `<button disabled class="flex-1 bg-gray-300 text-gray-500 py-2 px-3 rounded-lg cursor-not-allowed text-sm">
                            Out of Stock
                        </button>`
                    }
                </div>
                
                ${currentUser.user_type === 'farmer' && hasBulkPricing ? 
                    `<button onclick="showBulkOrderOptions('${product.id}')" 
                            class="w-full mt-2 bg-purple-600 hover:bg-purple-700 text-white py-2 px-3 rounded-lg transition-colors text-sm">
                        <i class="fas fa-users mr-2"></i>Join Bulk Order
                    </button>` : ''
                }
            </div>
        </div>
    `;
}

async function viewProduct(productId) {
    try {
        showLoading();
        
        const response = await fetch(`/api/marketplace/products/${productId}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to load product details');
        }
        
        const data = await response.json();
        const product = data.data;
        
        showProductModal(product);
        
    } catch (error) {
        console.error('Error loading product details:', error);
        showError('Failed to load product details');
    } finally {
        hideLoading();
    }
}

function showProductModal(product) {
    const modal = document.getElementById('productModal');
    const hasBulkPricing = product.bulk_pricing && Object.keys(product.bulk_pricing).length > 0;
    const isInStock = product.stock_quantity > 0;
    
    modal.innerHTML = `
        <div class="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <!-- Modal Header -->
            <div class="flex items-center justify-between p-6 border-b border-gray-200">
                <h2 class="text-2xl font-bold text-gray-800">${product.name}</h2>
                <button onclick="closeProductModal()" class="text-gray-500 hover:text-gray-700">
                    <i class="fas fa-times text-2xl"></i>
                </button>
            </div>
            
            <!-- Modal Content -->
            <div class="p-6">
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <!-- Product Image -->
                    <div>
                        ${product.image_url ? 
                            `<img src="${product.image_url}" alt="${product.name}" class="w-full h-80 object-cover rounded-xl">` :
                            `<div class="w-full h-80 bg-gradient-to-br from-green-100 to-emerald-100 rounded-xl flex items-center justify-center">
                                <i class="fas fa-seedling text-6xl text-green-600"></i>
                            </div>`
                        }
                    </div>
                    
                    <!-- Product Details -->
                    <div>
                        <div class="mb-6">
                            <div class="flex items-center justify-between mb-4">
                                <span class="text-3xl font-bold text-green-600">KES ${product.unit_price.toLocaleString()}</span>
                                <span class="text-gray-500">per ${product.unit_type}</span>
                            </div>
                            
                            ${!isInStock ? 
                                '<div class="bg-red-100 border border-red-300 text-red-700 px-4 py-2 rounded-lg mb-4">Out of Stock</div>' : ''
                            }
                            
                            <div class="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span class="text-gray-500">Category:</span>
                                    <span class="font-medium ml-2">${product.category || 'Not specified'}</span>
                                </div>
                                <div>
                                    <span class="text-gray-500">Stock:</span>
                                    <span class="font-medium ml-2">${product.stock_quantity} ${product.unit_type}</span>
                                </div>
                                <div>
                                    <span class="text-gray-500">Location:</span>
                                    <span class="font-medium ml-2">${product.location || 'Not specified'}</span>
                                </div>
                                <div>
                                    <span class="text-gray-500">Seller:</span>
                                    <span class="font-medium ml-2">${product.wholesaler?.name || 'Unknown'}</span>
                                </div>
                            </div>
                        </div>
                        
                        <div class="mb-6">
                            <h3 class="font-bold text-gray-800 mb-2">Description</h3>
                            <p class="text-gray-600">${product.description || 'No description available'}</p>
                        </div>
                        
                        ${hasBulkPricing ? 
                            `<div class="mb-6">
                                <h3 class="font-bold text-gray-800 mb-3">Bulk Pricing Tiers</h3>
                                <div class="bg-purple-50 border border-purple-200 rounded-lg p-4">
                                    ${Object.entries(product.bulk_pricing).map(([qty, price]) => `
                                        <div class="flex justify-between items-center py-2 border-b border-purple-200 last:border-b-0">
                                            <span class="text-purple-800">${qty}+ ${product.unit_type}</span>
                                            <span class="font-bold text-purple-600">KES ${parseFloat(price).toLocaleString()} each</span>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>` : ''
                        }
                        
                        ${isInStock ? 
                            `<div class="mb-6">
                                <label class="block text-sm font-medium text-gray-700 mb-2">Quantity</label>
                                <div class="flex items-center space-x-3">
                                    <button onclick="decreaseQuantity()" class="bg-gray-200 hover:bg-gray-300 w-10 h-10 rounded-lg flex items-center justify-center">
                                        <i class="fas fa-minus"></i>
                                    </button>
                                    <input type="number" id="productQuantity" value="1" min="1" max="${product.stock_quantity}" 
                                           class="w-20 text-center border border-gray-300 rounded-lg py-2">
                                    <button onclick="increaseQuantity(${product.stock_quantity})" class="bg-gray-200 hover:bg-gray-300 w-10 h-10 rounded-lg flex items-center justify-center">
                                        <i class="fas fa-plus"></i>
                                    </button>
                                    <span class="text-gray-500 text-sm">of ${product.stock_quantity} available</span>
                                </div>
                            </div>
                            
                            <div class="flex space-x-3">
                                <button onclick="addToCartFromModal('${product.id}')" 
                                        class="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 px-4 rounded-lg transition-colors">
                                    <i class="fas fa-cart-plus mr-2"></i>Add to Cart
                                </button>
                                <button onclick="buyNow('${product.id}')" 
                                        class="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-lg transition-colors">
                                    <i class="fas fa-bolt mr-2"></i>Buy Now
                                </button>
                            </div>` :
                            `<div class="text-center">
                                <button disabled class="w-full bg-gray-300 text-gray-500 py-3 px-4 rounded-lg cursor-not-allowed">
                                    Out of Stock
                                </button>
                            </div>`
                        }
                        
                        ${currentUser.user_type === 'farmer' && hasBulkPricing && isInStock ? 
                            `<button onclick="showBulkOrderOptions('${product.id}')" 
                                    class="w-full mt-3 bg-purple-600 hover:bg-purple-700 text-white py-3 px-4 rounded-lg transition-colors">
                                <i class="fas fa-users mr-2"></i>Join Bulk Order
                            </button>` : ''
                        }
                    </div>
                </div>
            </div>
        </div>
    `;
    
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function closeProductModal() {
    const modal = document.getElementById('productModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

function increaseQuantity(maxQuantity) {
    const input = document.getElementById('productQuantity');
    const currentValue = parseInt(input.value);
    if (currentValue < maxQuantity) {
        input.value = currentValue + 1;
    }
}

function decreaseQuantity() {
    const input = document.getElementById('productQuantity');
    const currentValue = parseInt(input.value);
    if (currentValue > 1) {
        input.value = currentValue - 1;
    }
}

function addToCart(productId, quantity = 1) {
    const product = currentProducts.find(p => p.id === productId);
    if (!product) return;
    
    // Check if product already in cart
    const existingItem = shoppingCart.find(item => item.product_id === productId);
    
    if (existingItem) {
        existingItem.quantity += quantity;
    } else {
        shoppingCart.push({
            product_id: productId,
            product: product,
            quantity: quantity,
            unit_price: product.unit_price
        });
    }
    
    saveCart();
    updateCartBadge();
    showSuccess(`${product.name} added to cart`);
}

function addToCartFromModal(productId) {
    const quantity = parseInt(document.getElementById('productQuantity').value);
    addToCart(productId, quantity);
    closeProductModal();
}

function removeFromCart(productId) {
    shoppingCart = shoppingCart.filter(item => item.product_id !== productId);
    saveCart();
    updateCartBadge();
    updateCartDisplay();
}

function updateCartQuantity(productId, newQuantity) {
    const item = shoppingCart.find(item => item.product_id === productId);
    if (item) {
        if (newQuantity <= 0) {
            removeFromCart(productId);
        } else {
            item.quantity = newQuantity;
            saveCart();
            updateCartDisplay();
        }
    }
}

function saveCart() {
    localStorage.setItem('shoppingCart', JSON.stringify(shoppingCart));
}

function loadShoppingCart() {
    const savedCart = localStorage.getItem('shoppingCart');
    if (savedCart) {
        shoppingCart = JSON.parse(savedCart);
        updateCartBadge();
    }
}

function updateCartBadge() {
    const badge = document.getElementById('cartBadge');
    const totalItems = shoppingCart.reduce((sum, item) => sum + item.quantity, 0);
    
    if (totalItems > 0) {
        badge.textContent = totalItems;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

function toggleCart() {
    const sidebar = document.getElementById('cartSidebar');
    if (sidebar.classList.contains('translate-x-full')) {
        openCart();
    } else {
        closeCart();
    }
}

function openCart() {
    const sidebar = document.getElementById('cartSidebar');
    sidebar.classList.remove('translate-x-full');
    updateCartDisplay();
}

function closeCart() {
    const sidebar = document.getElementById('cartSidebar');
    sidebar.classList.add('translate-x-full');
}

function updateCartDisplay() {
    const itemsContainer = document.getElementById('cartItems');
    const footer = document.getElementById('cartFooter');
    const totalElement = document.getElementById('cartTotal');
    
    if (shoppingCart.length === 0) {
        itemsContainer.innerHTML = `
            <div class="text-center text-gray-500 py-8">
                <i class="fas fa-shopping-cart text-4xl mb-4"></i>
                <p>Your cart is empty</p>
                <p class="text-sm">Add some products to get started</p>
            </div>
        `;
        footer.classList.add('hidden');
        return;
    }
    
    const total = shoppingCart.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
    
    itemsContainer.innerHTML = shoppingCart.map(item => `
        <div class="border-b border-gray-200 pb-4 mb-4">
            <div class="flex items-start space-x-3">
                <div class="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    ${item.product.image_url ? 
                        `<img src="${item.product.image_url}" alt="${item.product.name}" class="w-full h-full object-cover rounded-lg">` :
                        `<i class="fas fa-seedling text-green-600"></i>`
                    }
                </div>
                <div class="flex-1 min-w-0">
                    <h4 class="font-medium text-gray-800 truncate">${item.product.name}</h4>
                    <p class="text-sm text-gray-600">KES ${item.unit_price.toLocaleString()} per ${item.product.unit_type}</p>
                    <div class="flex items-center justify-between mt-2">
                        <div class="flex items-center space-x-2">
                            <button onclick="updateCartQuantity('${item.product_id}', ${item.quantity - 1})" 
                                    class="w-6 h-6 bg-gray-200 hover:bg-gray-300 rounded flex items-center justify-center text-xs">
                                <i class="fas fa-minus"></i>
                            </button>
                            <span class="text-sm font-medium">${item.quantity}</span>
                            <button onclick="updateCartQuantity('${item.product_id}', ${item.quantity + 1})" 
                                    class="w-6 h-6 bg-gray-200 hover:bg-gray-300 rounded flex items-center justify-center text-xs">
                                <i class="fas fa-plus"></i>
                            </button>
                        </div>
                        <button onclick="removeFromCart('${item.product_id}')" 
                                class="text-red-500 hover:text-red-700 text-sm">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
            <div class="text-right mt-2">
                <span class="font-bold text-green-600">KES ${(item.quantity * item.unit_price).toLocaleString()}</span>
            </div>
        </div>
    `).join('');
    
    totalElement.textContent = `KES ${total.toLocaleString()}`;
    footer.classList.remove('hidden');
}

function clearCart() {
    if (confirm('Are you sure you want to clear your cart?')) {
        shoppingCart = [];
        saveCart();
        updateCartBadge();
        updateCartDisplay();
        showSuccess('Cart cleared');
    }
}

async function proceedToCheckout() {
    if (shoppingCart.length === 0) {
        showError('Your cart is empty');
        return;
    }
    
    // For now, redirect to a checkout page or show a modal
    // In a full implementation, this would handle the checkout process
    showSuccess('Checkout functionality coming soon!');
}

async function loadMoreProducts() {
    await loadProducts(false);
}

function applyFilters() {
    loadProducts(true);
}

function clearAllFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('categoryFilter').value = '';
    document.getElementById('locationFilter').value = '';
    document.getElementById('minPrice').value = '';
    document.getElementById('maxPrice').value = '';
    document.getElementById('bulkPricingFilter').checked = false;
    document.getElementById('sortBy').value = 'created_at:desc';
    
    loadProducts(true);
}

function toggleFilterSidebar() {
    const sidebar = document.getElementById('filterSidebar');
    sidebar.classList.toggle('hidden');
}

function toggleView() {
    currentView = currentView === 'grid' ? 'list' : 'grid';
    setView(currentView);
}

function setView(view) {
    currentView = view;
    const container = document.getElementById('productsContainer');
    const gridBtn = document.getElementById('gridViewBtn');
    const listBtn = document.getElementById('listViewBtn');
    
    if (view === 'grid') {
        container.className = 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6';
        gridBtn.className = 'p-2 text-green-600 bg-green-100 rounded';
        listBtn.className = 'p-2 text-gray-600 hover:text-green-600 hover:bg-green-100 rounded';
    } else {
        container.className = 'space-y-4';
        gridBtn.className = 'p-2 text-gray-600 hover:text-green-600 hover:bg-green-100 rounded';
        listBtn.className = 'p-2 text-green-600 bg-green-100 rounded';
    }
    
    // Re-render products with new view
    displayProducts(currentProducts);
}

function updateResultsCount(showing, total) {
    const element = document.getElementById('resultsCount');
    element.textContent = `Showing ${showing} of ${total} products`;
}

async function showBulkOrderOptions(productId) {
    // This would show SACCO bulk order options
    // For now, show a placeholder
    showSuccess('Bulk order functionality coming soon!');
}

async function showBulkPricing(productId) {
    try {
        const response = await fetch(`/api/marketplace/products/${productId}/bulk-pricing`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to load bulk pricing');
        }
        
        const data = await response.json();
        const pricing = data.data;
        
        // Show bulk pricing in a modal or tooltip
        showSuccess(`Bulk pricing loaded for ${pricing.product_name}`);
        
    } catch (error) {
        console.error('Error loading bulk pricing:', error);
        showError('Failed to load bulk pricing');
    }
}

function toggleFavorite(productId) {
    // Placeholder for favorite functionality
    showSuccess('Favorites functionality coming soon!');
}

async function buyNow(productId) {
    const quantity = parseInt(document.getElementById('productQuantity').value);
    addToCart(productId, quantity);
    closeProductModal();
    openCart();
}

function closeBulkOrderModal() {
    const modal = document.getElementById('bulkOrderModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

function showLoading() {
    document.getElementById('loadingIndicator').classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loadingIndicator').classList.add('hidden');
}

function showSuccess(message) {
    // Simple success notification
    const notification = document.createElement('div');
    notification.className = 'fixed top-4 right-4 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-50';
    notification.innerHTML = `<i class="fas fa-check mr-2"></i>${message}`;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

function showError(message) {
    // Simple error notification
    const notification = document.createElement('div');
    notification.className = 'fixed top-4 right-4 bg-red-600 text-white px-6 py-3 rounded-lg shadow-lg z-50';
    notification.innerHTML = `<i class="fas fa-exclamation-triangle mr-2"></i>${message}`;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 5000);
}