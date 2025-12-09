// ============================================
// DATA & STATE MANAGEMENT
// ============================================

// Default Menu Data (fallback)
const defaultMenuData = {
    starters: [
        { id: 1, name: 'Chicken Wings', price: 180, category: 'starters' },
        { id: 2, name: 'Paneer Tikka', price: 160, category: 'starters' },
        { id: 3, name: 'Spring Rolls', price: 120, category: 'starters' },
        { id: 4, name: 'Garlic Bread', price: 100, category: 'starters' }
    ],
    main: [
        { id: 5, name: 'Butter Chicken', price: 280, category: 'main' },
        { id: 6, name: 'Paneer Butter Masala', price: 240, category: 'main' },
        { id: 7, name: 'Biryani', price: 220, category: 'main' },
        { id: 8, name: 'Pasta Alfredo', price: 200, category: 'main' }
    ],
    drinks: [
        { id: 9, name: 'Coke', price: 60, category: 'drinks' },
        { id: 10, name: 'Fresh Lime Soda', price: 50, category: 'drinks' },
        { id: 11, name: 'Mango Lassi', price: 80, category: 'drinks' },
        { id: 12, name: 'Coffee', price: 70, category: 'drinks' }
    ],
    desserts: [
        { id: 13, name: 'Ice Cream', price: 90, category: 'desserts' },
        { id: 14, name: 'Gulab Jamun', price: 70, category: 'desserts' },
        { id: 15, name: 'Brownie', price: 110, category: 'desserts' },
        { id: 16, name: 'Fruit Salad', price: 100, category: 'desserts' }
    ]
};

// Enhanced application state
let state = {
    currentTable: null,
    currentOrders: {},      // { tableNumber: { items: [] } }
    kitchenOrders: [],      // All orders
    tableStatus: {},        // { tableNumber: 'active' | 'vacated' }
    ownerBills: [],         // Completed bills
    currentFilter: 'all',
    pendingVacation: null,
    unavailableItems: [],   // ID array
    lastResetDate: null,
    menu: null              // Dynamic Menu Object
};

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

function initializeApp() {
    loadTheme();
    loadStateFromStorage();

    // Initialize Menu if empty
    if (!state.menu || Object.keys(state.menu).length === 0) {
        console.log('Initializing default menu data...');
        state.menu = JSON.parse(JSON.stringify(defaultMenuData)); // Deep copy
        saveStateToStorage();
    }

    // Check and perform daily reset if needed
    checkDailyReset();

    // Clear all table statuses on app start to fix stuck tables
    state.tableStatus = {};

    renderTables();
    renderMenu();
    setupEventListeners();
    setupThemeToggle();
    updateUI();
    renderKitchenOrders();
    renderBillingView();
}

// ============================================
// LOCAL STORAGE
// ============================================

function loadStateFromStorage() {
    const saved = localStorage.getItem('waiterMenuState');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            state.currentOrders = parsed.currentOrders || {};
            state.kitchenOrders = parsed.kitchenOrders || [];
            state.tableStatus = parsed.tableStatus || {};
            state.ownerBills = parsed.ownerBills || [];
            state.unavailableItems = parsed.unavailableItems || [];
            state.lastResetDate = parsed.lastResetDate || null;
            state.menu = parsed.menu || null;

            // Migrate old data: add default status if missing
            state.kitchenOrders.forEach(order => {
                if (!order.status) order.status = 'pending';
            });
        } catch (e) {
            console.error('Error loading state:', e);
        }
    }
}

function saveStateToStorage() {
    try {
        localStorage.setItem('waiterMenuState', JSON.stringify({
            currentOrders: state.currentOrders,
            kitchenOrders: state.kitchenOrders,
            tableStatus: state.tableStatus,
            ownerBills: state.ownerBills,
            unavailableItems: state.unavailableItems,
            lastResetDate: state.lastResetDate,
            menu: state.menu
        }));
    } catch (e) {
        console.error('Error saving state:', e);
    }
}

// ============================================
// THEME MANAGEMENT
// ============================================

function loadTheme() {
    const savedTheme = localStorage.getItem('waiterMenuTheme') || 'normal';
    setTheme(savedTheme);
}

function setTheme(themeName) {
    document.documentElement.setAttribute('data-theme', themeName);
    localStorage.setItem('waiterMenuTheme', themeName);

    // Update toggle button states
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === themeName);
    });
}

function setupThemeToggle() {
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const theme = btn.dataset.theme;
            setTheme(theme);
        });
    });
}

// ============================================
// RENDER FUNCTIONS
// ============================================

function renderTables() {
    const tableGrid = document.getElementById('table-grid');
    const tableCount = 8;

    tableGrid.innerHTML = '';

    for (let i = 1; i <= tableCount; i++) {
        const btn = document.createElement('button');
        btn.className = 'table-btn';
        btn.dataset.table = i;

        // Check if table is vacated
        const isVacated = state.tableStatus[i] === 'vacated';
        if (isVacated) {
            btn.classList.add('vacated');
        }

        // Count active orders for this table
        const activeOrders = state.kitchenOrders.filter(
            order => order.table === i && order.status !== 'served'
        );

        btn.innerHTML = `
            <span class="table-icon">🪑</span>
            <span>Table ${i}</span>
            ${activeOrders.length > 0 ? `<span class="order-count-badge">${activeOrders.length}</span>` : ''}
        `;

        // Always allow selection to enable reset
        btn.addEventListener('click', () => selectTable(i));

        tableGrid.appendChild(btn);
    }
}

function renderMenu() {
    renderMenuCategory('starters', state.menu.starters);
    renderMenuCategory('main', state.menu.main);
    renderMenuCategory('drinks', state.menu.drinks);
    renderMenuCategory('desserts', state.menu.desserts);
}

function renderMenuCategory(category, items) {
    const container = document.getElementById(`menu-${category}`);
    container.innerHTML = '';

    items.forEach(item => {
        const isUnavailable = state.unavailableItems.includes(item.id);
        const itemEl = document.createElement('div');
        itemEl.className = `menu-item ${isUnavailable ? 'unavailable' : ''}`;

        itemEl.innerHTML = `
            <div class="item-info">
                <div class="item-name">
                    ${item.name}
                    ${isUnavailable ? '<span class="unavailable-badge">Unavailable</span>' : ''}
                </div>
                <div class="item-price">₹${item.price}</div>
            </div>
            <button class="add-btn" data-item-id="${item.id}" ${isUnavailable ? 'disabled' : ''}>
                ${isUnavailable ? '🚫' : '+'}
            </button>
        `;

        if (!isUnavailable) {
            const addBtn = itemEl.querySelector('.add-btn');
            addBtn.addEventListener('click', () => addItemToOrder(item));
        }

        container.appendChild(itemEl);
    });
}

function renderOrderSummary() {
    const orderItemsEl = document.getElementById('order-items');
    const totalAmountEl = document.getElementById('total-amount');

    if (!state.currentTable) {
        orderItemsEl.innerHTML = '<p class="empty-state">Select a table first</p>';
        totalAmountEl.textContent = '₹0';
        return;
    }

    const order = state.currentOrders[state.currentTable];

    if (!order || !order.items || order.items.length === 0) {
        orderItemsEl.innerHTML = '<p class="empty-state">No items added yet</p>';
        totalAmountEl.textContent = '₹0';
        return;
    }

    // Group items by id and sum quantities
    const groupedItems = {};
    order.items.forEach(item => {
        if (groupedItems[item.id]) {
            groupedItems[item.id].quantity++;
        } else {
            groupedItems[item.id] = { ...item, quantity: 1 };
        }
    });

    let html = '';
    let total = 0;

    Object.values(groupedItems).forEach(item => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;

        html += `
            <div class="order-item">
                <span class="order-item-name">${item.name}</span>
                <span class="order-item-qty">×${item.quantity}</span>
                <span class="order-item-price">₹${itemTotal}</span>
            </div>
        `;
    });

    orderItemsEl.innerHTML = html;
    totalAmountEl.textContent = `₹${total}`;
}

function renderTableStatus(tableNumber) {
    const statusOrdersEl = document.getElementById('status-orders');
    const selectedTableBadge = document.getElementById('selected-table-badge');

    if (!tableNumber) {
        statusOrdersEl.innerHTML = '<p class="empty-state">Select a table to view status</p>';
        selectedTableBadge.textContent = 'No Table';
        return;
    }

    selectedTableBadge.textContent = `Table ${tableNumber}`;

    // Get all orders for this table
    const tableOrders = state.kitchenOrders.filter(order => order.table === tableNumber);

    if (tableOrders.length === 0) {
        statusOrdersEl.innerHTML = '<p class="empty-state">No orders for this table yet</p>';
        return;
    }

    // Sort by timestamp (newest first)
    tableOrders.sort((a, b) => b.timestamp - a.timestamp);

    let html = '';

    tableOrders.forEach(order => {
        const orderTime = new Date(order.timestamp).toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit'
        });

        // Group items
        const groupedItems = {};
        order.items.forEach(item => {
            if (groupedItems[item.id]) {
                groupedItems[item.id].quantity++;
            } else {
                groupedItems[item.id] = { ...item, quantity: 1 };
            }
        });

        let itemsHtml = '';
        let total = 0;

        Object.values(groupedItems).forEach(item => {
            const itemTotal = item.price * item.quantity;
            total += itemTotal;
            itemsHtml += `${item.name} x${item.quantity}, `;
        });

        itemsHtml = itemsHtml.slice(0, -2); // Remove trailing comma

        html += `
            <div class="status-order-card ${order.status}">
                <div class="status-order-header">
                    <span class="status-order-time">${orderTime}</span>
                    <span class="status-badge ${order.status}">${order.status.toUpperCase()}</span>
                </div>
                <div class="status-order-items">${itemsHtml}</div>
                <div class="status-order-total">Total: ₹${total}</div>
            </div>
        `;
    });

    statusOrdersEl.innerHTML = html;

    // Update button states
    updateTableActionButtons(tableNumber);
}

function updateTableActionButtons(tableNumber) {
    const markServedBtn = document.getElementById('mark-served-btn');
    const vacateBtn = document.getElementById('vacate-table-btn');

    const tableOrders = state.kitchenOrders.filter(order => order.table === tableNumber);
    const hasReadyOrders = tableOrders.some(order => order.status === 'ready');
    const hasAnyOrders = tableOrders.length > 0;

    markServedBtn.disabled = !hasReadyOrders;
    vacateBtn.disabled = !hasAnyOrders;
}

function renderKitchenOrders() {
    const grid = document.getElementById('kitchen-grid');
    if (!grid) return;

    let filtered = state.kitchenOrders;
    if (state.currentFilter && state.currentFilter !== 'all') {
        filtered = filtered.filter(o => o.status === state.currentFilter);
    }

    if (filtered.length === 0) {
        grid.innerHTML = '<div class="empty-state">No active orders</div>';
        return;
    }

    grid.innerHTML = filtered.map(order => {
        // Calculate items
        let itemsHtml = order.items.map(item => `
            <div class="order-item-row">
                <span class="qty">${item.quantity}x</span>
                <span class="name">${item.name}</span>
            </div>
        `).join('');

        // Determine Status Color/Logic
        let statusBadge = '';
        let actionBtn = '';

        if (order.status === 'pending') {
            statusBadge = '<span class="status-badge pending">PENDING</span>';
            actionBtn = `<button class="btn btn-block btn-warning" onclick="updateOrderStatus(${order.id}, 'preparing')">Start Preparing</button>`;
        } else if (order.status === 'preparing') {
            statusBadge = '<span class="status-badge preparing">PREPARING</span>';
            actionBtn = `<button class="btn btn-block btn-success" onclick="updateOrderStatus(${order.id}, 'ready')">Mark Ready</button>`;
        } else {
            statusBadge = '<span class="status-badge ready">READY</span>';
            actionBtn = `<button class="btn btn-block btn-disabled" disabled>Ready</button>`;
        }

        const time = new Date(order.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        return `
            <div class="card order-card">
                <div class="card-header">
                    <span class="table-tag">Table ${order.table}</span>
                    <span class="time-tag">${time}</span>
                </div>
                <div class="card-status">${statusBadge}</div>
                <div class="card-body">
                    ${itemsHtml}
                </div>
                <div class="card-footer">
                    ${actionBtn}
                </div>
            </div>
        `;
    }).join('');
}

function setKitchenFilter(filter, btnElement) {
    state.currentFilter = filter;

    // Update active class
    if (btnElement) {
        document.querySelectorAll('.btn-filter').forEach(b => b.classList.remove('active'));
        btnElement.classList.add('active');
    }

    renderKitchenOrders();
}

function toggleManageItemsModal() {
    const modal = document.getElementById('manage-items-modal');
    modal.classList.toggle('hidden');
    if (!modal.classList.contains('hidden')) {
        renderManageItemsList();
    }
}

function renderManageItemsList() {
    const container = document.getElementById('manage-items-list');
    if (!container) return;

    let html = '';
    Object.keys(state.menu).forEach(cat => {
        html += `<h4 class="category-header">${cat.charAt(0).toUpperCase() + cat.slice(1)}</h4>`;
        state.menu[cat].forEach(item => {
            const isUnavailable = state.unavailableItems.includes(item.id);
            html += `
                <div class="item-toggle-row">
                    <div class="item-toggle-info">
                        <span class="item-toggle-name">${item.name}</span>
                        <input type="checkbox" ${!isUnavailable ? 'checked' : ''} onchange="toggleItemAvailability(${item.id})">
                        <span class="slider round"></span>
                    </label>
                </div>
            `;
        });
    });
    container.innerHTML = html;
}

function renderBillingView() {
    const grid = document.getElementById('billing-grid');
    if (!grid) return;

    if (!state.ownerBills || state.ownerBills.length === 0) {
        grid.innerHTML = '<div class="empty-state">No bills found</div>';
        return;
    }

    // Sort by timestamp descending
    const sortedBills = [...state.ownerBills].sort((a, b) => b.timestamp - a.timestamp);

    grid.innerHTML = sortedBills.map(bill => {
        const date = new Date(bill.timestamp).toLocaleString();
        const itemCount = bill.items.reduce((sum, i) => sum + i.quantity, 0);

        return `
            <div class="card bill-card">
                <div class="card-header">
                    <span class="table-tag">Table ${bill.table}</span>
                    <span class="price-tag">₹${bill.grandTotal}</span>
                </div>
                <div class="card-body">
                    <p class="bill-date">${date}</p>
                    <p class="bill-summary">${itemCount} items</p>
                </div>
                <div class="card-footer">
                    <button class="btn btn-sm btn-outline" onclick="openBillDetails(${bill.id})">View Details</button>
                    ${state.editMode ? `<button class="btn btn-sm btn-danger" onclick="deleteBill(${bill.id})">Delete</button>` : ''}
                </div>
            </div>
        `;
    }).join('');
}

function openBillDetails(billId) {
    const bill = state.ownerBills.find(b => b.id === billId);
    if (!bill) return;

    const body = document.getElementById('modal-bill-body');
    const tableNum = document.getElementById('modal-table-num');
    const modal = document.getElementById('bill-details-modal');

    tableNum.innerText = bill.table;

    // Items List
    let itemsHtml = bill.items.map((item, index) => `
        <div class="detail-row">
            <div class="detail-info">
                <span>${item.name} (x${item.quantity})</span>
                <span class="detail-subtext">@ ₹${item.price} each</span>
            </div>
            <div class="detail-actions">
                <span class="detail-price">₹${item.price * item.quantity}</span>
                ${state.editMode ? `<button class="btn-icon-danger" onclick="deleteBillItem(${bill.id}, ${index})" title="Remove Item">🗑️</button>` : ''}
            </div>
        </div>
    `).join('');

    // Totals
    itemsHtml += `
    <div class="detail-total-row">
        <strong>Grand Total</strong>
        <strong>₹${bill.grandTotal}</strong>
    </div>`;

    // Edit Mode Controls
    if (state.editMode) {
        itemsHtml += `
            <div class="edit-bill-controls">
                <hr class="divider">
                <button class="btn btn-sm btn-outline btn-block" onclick="addItemToBill(${bill.id})">➕ Add Item to Bill</button>
            </div>
        `;
    }

    body.innerHTML = itemsHtml;
    modal.classList.remove('hidden');
}

function closeBillModal() {
    document.getElementById('bill-details-modal').classList.add('hidden');
}

function toggleEditMode() {
    const isLocked = !state.editMode;
    if (isLocked) {
        const pwd = prompt("Enter Admin Password:");
        if (pwd === "admin123") {
            state.editMode = true;
            document.getElementById('edit-mode-btn').innerText = "🔓 Unlocked";
            renderBillingView();
        } else {
            alert("Wrong Password");
        }
    } else {
        state.editMode = false;
        document.getElementById('edit-mode-btn').innerText = "🔒 Edit Mode";
        renderBillingView();
    }
}

function deleteBill(id) {
    if (confirm("Delete this bill record?")) {
        const idx = state.ownerBills.findIndex(b => b.id === id);
        if (idx !== -1) {
            state.ownerBills.splice(idx, 1);
            saveStateToStorage();
            renderBillingView();
        }
    }
}

// ============================================
// BILL DETAIL PANEL
// ============================================

function showBillDetails(billIndex) {
    const sortedBills = [...state.ownerBills].sort((a, b) => b.timestamp - a.timestamp);
    const bill = sortedBills[billIndex];

    if (!bill) return;

    const panel = document.getElementById('detail-panel');
    const overlay = document.getElementById('detail-panel-overlay');
    const title = document.getElementById('detail-panel-title');
    const body = document.getElementById('detail-panel-body');

    title.textContent = `Table ${bill.table} Bill`;

    const billTime = new Date(bill.timestamp).toLocaleString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    let itemsHtml = '';
    bill.items.forEach(item => {
        const itemTotal = item.price * item.quantity;
        itemsHtml += `
            <div class="detail-item">
                <span class="detail-item-name">${item.name}</span>
                <div class="detail-item-info">
                    <span class="detail-item-qty">× ${item.quantity}</span>
                    <span class="detail-item-price">₹${itemTotal}</span>
                </div>
            </div>
        `;
    });

    body.innerHTML = `
        <div class="detail-table-info">
            <span class="detail-table-number">Table ${bill.table}</span>
            <span class="detail-table-time">${billTime}</span>
        </div>
        <div class="detail-items-list">
            ${itemsHtml}
        </div>
        <div class="detail-total">
            <span class="detail-total-label">Grand Total</span>
            <span class="detail-total-amount">₹${bill.grandTotal}</span>
        </div>
    `;

    panel.classList.add('show');
    overlay.classList.add('show');
}

function closeBillDetailsPanel() {
    const panel = document.getElementById('detail-panel');
    const overlay = document.getElementById('detail-panel-overlay');
    panel.classList.remove('show');
    overlay.classList.remove('show');
}

// Make function globally accessible
window.showBillDetails = showBillDetails;

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
    // View toggle
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const view = e.currentTarget.dataset.view;
            switchView(view);
        });
    });

    // Order actions
    document.getElementById('clear-order-btn').addEventListener('click', clearOrder);
    document.getElementById('send-to-kitchen-btn').addEventListener('click', sendToKitchen);

    // Table actions
    document.getElementById('mark-served-btn').addEventListener('click', markReadyItemsServed);
    document.getElementById('vacate-table-btn').addEventListener('click', initiateTableVacation);

    // Kitchen filters
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const status = e.currentTarget.dataset.status;
            filterKitchenOrders(status);
        });
    });



    // Daily Report button
    // Daily Report button
    const reportBtn = document.getElementById('download-daily-report-btn');
    if (reportBtn) {
        reportBtn.addEventListener('click', generateDailyReport);
    }

    // Edit Mode button
    const editBtn = document.getElementById('edit-mode-btn');
    if (editBtn) {
        editBtn.addEventListener('click', toggleEditMode);
    }
}

// ============================================
// ACTION FUNCTIONS
// ============================================

function selectTable(tableNumber) {
    // Reset table status to active when selected
    if (state.tableStatus[tableNumber] === 'vacated') {
        state.tableStatus[tableNumber] = 'active';
        saveStateToStorage();
    }

    state.currentTable = tableNumber;

    // Ensure order object exists for this table
    if (!state.currentOrders[tableNumber]) {
        state.currentOrders[tableNumber] = {
            table: tableNumber,
            items: []
        };
    }

    updateUI();
    renderTableStatus(tableNumber);
    showToast(`Table ${tableNumber} selected`, 'success');
}

function addItemToOrder(item) {
    if (!state.currentTable) {
        showToast('Please select a table first', 'error');
        return;
    }

    state.currentOrders[state.currentTable].items.push(item);
    saveStateToStorage();
    renderOrderSummary();
    updateUI(); // Enable the Send to Kitchen button
    showToast(`${item.name} added`, 'success');
}

function clearOrder() {
    if (!state.currentTable) {
        showToast('No table selected', 'error');
        return;
    }

    state.currentOrders[state.currentTable].items = [];
    saveStateToStorage();
    renderOrderSummary();
    updateUI(); // Update button state after clearing
    showToast('Order cleared', 'success');
}

function sendToKitchen() {
    console.log('Send to kitchen clicked, current table:', state.currentTable);

    if (!state.currentTable) {
        showToast('Please select a table first', 'error');
        return;
    }

    const order = state.currentOrders[state.currentTable];
    console.log('Current order:', order);

    if (!order || !order.items || order.items.length === 0) {
        showToast('No items to send', 'error');
        return;
    }

    // Create kitchen order (do NOT overwrite existing orders)
    const kitchenOrder = {
        id: Date.now(),
        table: state.currentTable,
        items: [...order.items],
        timestamp: Date.now(),
        status: 'pending'
    };

    console.log('Created kitchen order:', kitchenOrder);
    state.kitchenOrders.push(kitchenOrder);

    // Clear current order for new items
    state.currentOrders[state.currentTable].items = [];

    saveStateToStorage();
    renderOrderSummary();
    renderKitchenOrders();
    renderTableStatus(state.currentTable);
    renderTables(); // Update order count badges
    updateUI();

    console.log('Kitchen orders after send:', state.kitchenOrders);
    showToast(`Order sent to kitchen for Table ${state.currentTable}`, 'success');
}

function updateOrderStatus(orderId, status) {
    console.log('Updating order status:', orderId, status);
    const order = state.kitchenOrders.find(o => o.id === orderId);
    if (order) {
        order.status = status;
        saveStateToStorage();
        renderKitchenOrders();

        // Update table status panel if this table is currently selected
        if (state.currentTable && order.table === state.currentTable) {
            renderTableStatus(state.currentTable);
        }

        renderTables(); // Update order count badges
        showToast(`Order status updated to ${status}`, 'success');
    }
}

// Make function globally accessible for onclick handlers
window.updateOrderStatus = updateOrderStatus;

function markReadyItemsServed() {
    if (!state.currentTable) {
        showToast('No table selected', 'error');
        return;
    }

    // Find all ready orders for this table
    const readyOrders = state.kitchenOrders.filter(
        order => order.table === state.currentTable && order.status === 'ready'
    );

    if (readyOrders.length === 0) {
        showToast('No ready items to mark as served', 'error');
        return;
    }

    // Update all ready orders to served
    readyOrders.forEach(order => {
        order.status = 'served';
    });

    saveStateToStorage();
    renderTableStatus(state.currentTable);
    renderKitchenOrders();
    renderTables();

    showToast(`Marked ${readyOrders.length} order(s) as served for Table ${state.currentTable}`, 'success');
}

function initiateTableVacation() {
    if (!state.currentTable) {
        showToast('No table selected', 'error');
        return;
    }

    const tableNumber = state.currentTable;

    // Get all orders for this table
    const tableOrders = state.kitchenOrders.filter(order => order.table === tableNumber);

    if (tableOrders.length === 0) {
        showToast('No orders to bill for this table', 'error');
        return;
    }

    // Group all items from all orders
    const allItems = {};
    let grandTotal = 0;

    tableOrders.forEach(order => {
        order.items.forEach(item => {
            if (allItems[item.id]) {
                allItems[item.id].quantity++;
            } else {
                allItems[item.id] = { ...item, quantity: 1 };
            }
            grandTotal += item.price;
        });
    });

    const groupedItems = Object.values(allItems);

    // Store pending vacation data
    state.pendingVacation = {
        table: tableNumber,
        orders: tableOrders,
        items: groupedItems,
        grandTotal: grandTotal
    };

    // Show bill modal
    showBillModal(tableNumber, groupedItems, grandTotal);
}

function showBillModal(tableNumber, items, grandTotal) {
    const modal = document.getElementById('bill-modal');
    const modalTableNumber = document.getElementById('modal-table-number');
    const billTable = document.getElementById('bill-table');
    const billDatetime = document.getElementById('bill-datetime');
    const billItems = document.getElementById('bill-items');
    const billGrandTotal = document.getElementById('bill-grand-total');

    // Set table number in modal title
    modalTableNumber.textContent = `Table ${tableNumber}`;
    billTable.textContent = `Table ${tableNumber}`;
    billDatetime.textContent = new Date().toLocaleString('en-IN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    // Generate detailed items list (showing unit price and subtotal)
    let itemsHtml = '';
    items.forEach(item => {
        const itemTotal = item.price * item.quantity;
        itemsHtml += `
            <div class="bill-item">
                <span class="bill-item-name">${item.name}</span>
                <span class="bill-item-details">
                    <span class="bill-item-unit-price">₹${item.price}</span>
                    <span class="bill-item-qty">× ${item.quantity}</span>
                </span>
                <span class="bill-item-price">₹${itemTotal}</span>
            </div>
        `;
    });

    billItems.innerHTML = itemsHtml;
    billGrandTotal.textContent = `₹${grandTotal}`;

    modal.classList.add('show');
}

function closeBillModal() {
    const modal = document.getElementById('bill-modal');
    modal.classList.remove('show');
    state.pendingVacation = null;
}

function confirmTableVacation() {
    if (!state.pendingVacation) {
        showToast('No pending vacation', 'error');
        return;
    }

    const { table, orders, items, grandTotal } = state.pendingVacation;

    // Create owner bill record
    const bill = {
        id: Date.now(),
        table: table,
        timestamp: Date.now(),
        orders: orders,
        items: items,
        grandTotal: grandTotal,
        paymentStatus: 'pending'
    };

    // Add to owner bills
    state.ownerBills.push(bill);

    // Mark table as active (available for next customer)
    state.tableStatus[table] = 'active';

    // Clear current order for this table
    state.currentOrders[table] = {
        table: table,
        items: []
    };

    // Remove orders for this table from kitchen (archive them)
    state.kitchenOrders = state.kitchenOrders.filter(order => order.table !== table);

    // Save state
    saveStateToStorage();

    // Close modal
    closeBillModal();

    // Update UI
    renderTables();
    renderBillingView();
    renderKitchenOrders();

    // Deselect table
    if (state.currentTable === table) {
        state.currentTable = null;
        renderOrderSummary();
        renderTableStatus(null);
    }

    updateUI();

    showToast(`Table ${table} vacated. Bill generated successfully!`, 'success');
}

function switchView(view) {
    console.log('Switching to view:', view);

    // Update view buttons
    document.querySelectorAll('.view-btn').forEach(btn => {
        const targetView = btn.dataset.view;
        if (targetView === view) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Update view content visibility
    ['waiter', 'kitchen', 'billing'].forEach(v => {
        const el = document.getElementById(`${v}-view`);
        if (el) {
            el.style.display = (v === view) ? 'block' : 'none';
        }
    });

    console.log('Active view:', view);

    // Refresh respective view when switching to it
    if (view === 'kitchen') {
        renderKitchenOrders();
    } else if (view === 'billing') {
        renderBillingView();
    }
}

// ============================================
// UI UPDATE HELPERS
// ============================================

function updateUI() {
    // Update table selection
    document.querySelectorAll('.table-btn').forEach(btn => {
        const tableNum = parseInt(btn.dataset.table);
        btn.classList.toggle('active', tableNum === state.currentTable);
    });

    // Update table badge
    const tableBadge = document.getElementById('current-table-badge');
    if (state.currentTable) {
        tableBadge.textContent = `Table ${state.currentTable}`;
        tableBadge.classList.remove('no-table');
    } else {
        tableBadge.textContent = 'No Table Selected';
        tableBadge.classList.add('no-table');
    }

    // Update order summary
    renderOrderSummary();

    // Update send button
    const sendBtn = document.getElementById('send-to-kitchen-btn');
    const hasItems = state.currentTable &&
        state.currentOrders[state.currentTable] &&
        state.currentOrders[state.currentTable].items.length > 0;
    sendBtn.disabled = !hasItems;
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast show ${type}`;

    setTimeout(() => {
        toast.classList.remove('show');
    }, 2500);
}

// Image placeholders (lazy loaded)


// ============================================
// MENU ITEM AVAILABILITY MANAGEMENT (REFINED)
// ============================================

function checkDailyReset() {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    if (state.lastResetDate !== today) {
        // New day - reset all unavailable items
        if (state.unavailableItems.length > 0) {
            state.unavailableItems = [];
            state.lastResetDate = today;
            saveStateToStorage();
            showToast('Menu items reset for new day - all items available', 'success');
        } else {
            // Just update the date
            state.lastResetDate = today;
            saveStateToStorage();
        }
    }
}




function toggleItemAvailability(itemId) {
    const index = state.unavailableItems.indexOf(itemId);
    let message = '';
    let type = '';

    if (index > -1) {
        // Make available
        state.unavailableItems.splice(index, 1);
        message = 'Item marked as AVAILABLE';
        type = 'success';
    } else {
        // Mark unavailable
        state.unavailableItems.push(itemId);
        message = 'Item marked as UNAVAILABLE';
        type = 'warning';
    }

    saveStateToStorage();
    if (typeof renderManageItemsList === 'function') {
        renderManageItemsList(); // Update Kitchen Panel
    }
    renderMenu(); // Update Waiter UI
    showToast(message, type);
}

function manualResetAllItems() {
    if (!checkAdminPassword()) {
        showToast('Incorrect password', 'error');
        return;
    }

    const confirmed = confirm('Reset All Items to Available?\n\nThis will make everything available again for today.');

    if (!confirmed) return;

    state.unavailableItems = [];
    state.lastResetDate = new Date().toISOString().split('T')[0];
    saveStateToStorage();

    if (typeof renderManageItemsList === 'function') {
        renderManageItemsList();
    }

    renderMenu();
    showToast('All items reset to AVAILABLE', 'success');
}

function printBillFromModal() {
    const tableNum = document.getElementById('modal-table-num').innerText;
    const items = document.getElementById('modal-bill-body').innerText;

    // Simple print window
    const win = window.open('', '', 'width=400,height=600');
    win.document.write(`
        <html>
        <head><title>Bill Table ${tableNum}</title></head>
        <body style="font-family: monospace; padding: 20px;">
            <h3>Bill - Table ${tableNum}</h3>
            <p>${new Date().toLocaleString()}</p>
            <hr>
            <pre>${items}</pre>
            <hr>
            <p style="text-align:center;">Thank You!</p>
        </body>
        </html>
    `);
    win.document.close();
    win.print();
}

// Make functions globally accessible
// Make functions globally accessible
window.toggleItemAvailability = toggleItemAvailability;
window.manualResetAllItems = manualResetAllItems;
window.printBillFromModal = printBillFromModal;
window.toggleManageItemsModal = toggleManageItemsModal;
window.setKitchenFilter = setKitchenFilter;
window.generateDailyReport = generateDailyReport;
window.toggleEditMode = toggleEditMode;

// ============================================
// PASSWORD PROTECTION
// ============================================

function checkAdminPassword() {
    const password = prompt('Enter admin password to continue:');
    return password === 'admin123';
}

// ============================================
// DAILY REPORT PDF GENERATION
// ============================================

function generateDailyReport() {
    try {
        // Show date picker
        const selectedDate = prompt('Enter date for report (YYYY-MM-DD format):\n\nExamples:\n- Today: ' + new Date().toISOString().split('T')[0] + '\n- Yesterday: ' + new Date(Date.now() - 86400000).toISOString().split('T')[0], new Date().toISOString().split('T')[0]);

        if (!selectedDate) {
            showToast('Report generation cancelled', 'error');
            return;
        }

        // Parse selected date
        const reportDate = new Date(selectedDate + 'T00:00:00');
        if (isNaN(reportDate.getTime())) {
            showToast('Invalid date format. Please use YYYY-MM-DD', 'error');
            return;
        }

        const dayStart = new Date(reportDate.setHours(0, 0, 0, 0));
        const dayEnd = new Date(reportDate.setHours(23, 59, 59, 999));

        // Filter bills for selected date
        const dateBills = state.ownerBills.filter(bill => {
            const billDate = new Date(bill.timestamp);
            return billDate >= dayStart && billDate <= dayEnd;
        });

        if (dateBills.length === 0) {
            showToast(`No bills found for ${selectedDate}`, 'error');
            return;
        }

        // Create PDF using jsPDF
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        // Title
        const reportDateFormatted = new Date(selectedDate).toLocaleDateString('en-IN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text('Daily Sales Report', 105, 15, { align: 'center' });

        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.text(reportDateFormatted, 105, 23, { align: 'center' });

        let y = 35;
        let grandTotal = 0;

        // Group bills by table
        const billsByTable = {};
        dateBills.forEach(bill => {
            if (!billsByTable[bill.table]) {
                billsByTable[bill.table] = [];
            }
            billsByTable[bill.table].push(bill);
        });

        // Iterate through each table
        Object.keys(billsByTable).sort((a, b) => parseInt(a) - parseInt(b)).forEach(tableNum => {
            const tableBills = billsByTable[tableNum];
            let tableTotal = 0;

            // Table header
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text(`Table ${tableNum}`, 15, y);
            y += 7;

            // Items
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');

            tableBills.forEach(bill => {
                bill.items.forEach(item => {
                    const itemTotal = item.price * item.quantity;
                    tableTotal += itemTotal;

                    doc.text(`${item.name} x${item.quantity}`, 20, y);
                    doc.text(`Rs.${itemTotal}`, 180, y, { align: 'right' });
                    y += 5;

                    if (y > 270) {
                        doc.addPage();
                        y = 15;
                    }
                });
            });

            // Table subtotal
            doc.setFont('helvetica', 'bold');
            doc.text(`Subtotal:`, 20, y);
            doc.text(`Rs.${tableTotal}`, 180, y, { align: 'right' });
            y += 8;
            doc.setFont('helvetica', 'normal');

            grandTotal += tableTotal;

            if (y > 260) {
                doc.addPage();
                y = 15;
            }
        });

        // Grand Total
        y += 5;
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.line(15, y, 195, y);
        y += 7;
        doc.text('GRAND TOTAL:', 15, y);
        doc.text(`Rs.${grandTotal}`, 180, y, { align: 'right' });

        // Save PDF
        const filename = `Daily_Report_${selectedDate}.pdf`;
        doc.save(filename);

        showToast(`Report for ${selectedDate} downloaded successfully!`, 'success');
    } catch (error) {
        console.error('Error generating PDF:', error);
        showToast('Error generating PDF report', 'error');
    }
}



// ============================================
// MENU EDIT SYSTEM (CRUD)
// ============================================

function openEditMenuModal() {
    document.getElementById('edit-menu-modal').classList.remove('hidden');
    renderEditMenuList();
}

function closeEditMenuModal() {
    document.getElementById('edit-menu-modal').classList.add('hidden');
}

function renderEditMenuList() {
    const list = document.getElementById('edit-menu-list');
    const search = document.getElementById('edit-menu-search').value.toLowerCase();

    if (!list) return;

    let html = '';

    Object.keys(state.menu).forEach(category => {
        state.menu[category].forEach(item => {
            // Search filter
            if (search && !item.name.toLowerCase().includes(search)) return;

            html += `
                <div class="manage-item-row">
                    <div class="manage-item-info">
                        <span class="manage-item-name">${item.name}</span>
                        <span class="manage-item-price">₹${item.price}</span>
                        <span class="status-badge" style="background:#eee;color:#666">${category}</span>
                    </div>
                    <div class="manage-group-actions">
                        <button class="btn btn-sm btn-outline" onclick="editMenuItem(${item.id}, '${category}')">Edit</button>
                        <button class="btn btn-sm btn-danger" onclick="deleteMenuItem(${item.id}, '${category}')">Delete</button>
                    </div>
                </div>
            `;
        });
    });

    list.innerHTML = html || '<p class="empty-state">No items found</p>';
}

function handleAddItem(e) {
    e.preventDefault();
    const form = e.target;
    const name = form.name.value.trim();
    const price = parseInt(form.price.value);
    const category = form.category.value;
    const image = form.image.value.trim();

    if (!name || isNaN(price)) {
        showToast('Invalid input', 'error');
        return;
    }

    // Generate new ID (find max id across all categories)
    let maxId = 0;
    Object.values(state.menu).forEach(cat => {
        cat.forEach(item => {
            if (item.id > maxId) maxId = item.id;
        });
    });
    const newId = maxId + 1;

    const newItem = {
        id: newId,
        name: name,
        price: price,
        category: category,
        image: image || null // Optional
    };

    // Add to state
    state.menu[category].push(newItem);
    saveStateToStorage();

    // Refresh views
    renderEditMenuList();
    renderMenu(); // Waiter
    if (typeof renderManageItemsList === 'function') renderManageItemsList(); // Kitchen

    showToast(`Added ${name} to Menu`, 'success');
    form.reset();
}

function deleteMenuItem(id, category) {
    if (!checkAdminPassword()) {
        showToast('Deletion requires admin password', 'error');
        return;
    }

    if (!confirm('Are you sure you want to delete this item?')) return;

    const index = state.menu[category].findIndex(i => i.id === id);
    if (index > -1) {
        state.menu[category].splice(index, 1);
        saveStateToStorage();

        // Refresh
        renderEditMenuList();
        renderMenu();
        if (typeof renderManageItemsList === 'function') renderManageItemsList();

        showToast('Item deleted', 'success');
    }
}

function editMenuItem(id, category) {
    const item = state.menu[category].find(i => i.id === id);
    if (!item) return;

    const newName = prompt('Edit Item Name:', item.name);
    if (newName === null) return; // Cancelled

    const newPrice = prompt('Edit Item Price (₹):', item.price);
    if (newPrice === null) return;

    const priceVal = parseInt(newPrice);
    if (!newName || isNaN(priceVal)) {
        showToast('Invalid input', 'error');
        return;
    }

    // Update
    item.name = newName;
    item.price = priceVal;
    saveStateToStorage();

    // Refresh
    renderEditMenuList();
    renderMenu();
    if (typeof renderManageItemsList === 'function') renderManageItemsList();

    showToast('Item updated', 'success');
}

// Make functions globally accessible
window.openEditMenuModal = openEditMenuModal;
window.closeEditMenuModal = closeEditMenuModal;
window.renderEditMenuList = renderEditMenuList;
window.handleAddItem = handleAddItem;
window.deleteMenuItem = deleteMenuItem;
window.editMenuItem = editMenuItem;

// Re-export existing ones just in case
window.toggleItemAvailability = toggleItemAvailability;
window.manualResetAllItems = manualResetAllItems;
window.printBillFromModal = printBillFromModal;
window.toggleManageItemsModal = toggleManageItemsModal;
window.setKitchenFilter = setKitchenFilter;
window.generateDailyReport = generateDailyReport;
window.toggleEditMode = toggleEditMode;

// ============================================
// BILLING EDIT Logic
// ============================================

function deleteBillItem(billId, itemIndex) {
    const bill = state.ownerBills.find(b => b.id === billId);
    if (!bill) return;

    if (!confirm('Remove this item from the bill?')) return;

    const item = bill.items[itemIndex];
    bill.grandTotal -= (item.price * item.quantity);
    bill.items.splice(itemIndex, 1);

    if (bill.items.length === 0) {
        bill.grandTotal = 0;
    }

    saveStateToStorage();
    openBillDetails(billId); // Pass ID
    renderBillingView();
    showToast('Item removed from bill', 'success');
}

function addItemToBill(billId) {
    const bill = state.ownerBills.find(b => b.id === billId);
    if (!bill) return;

    const input = prompt('Enter Item Name or Menu ID to add:');
    if (!input) return;

    let itemToAdd = null;
    const trimmed = input.trim().toLowerCase();

    // Try finding by ID
    const searchId = parseInt(trimmed);
    if (!isNaN(searchId)) {
        Object.values(state.menu).forEach(cat => {
            const found = cat.find(i => i.id === searchId);
            if (found) itemToAdd = { ...found, quantity: 1 };
        });
    }

    // Try finding by Name
    if (!itemToAdd) {
        Object.values(state.menu).forEach(cat => {
            const found = cat.find(i => i.name.toLowerCase() === trimmed);
            if (found) itemToAdd = { ...found, quantity: 1 };
        });
    }

    // New Item?
    if (!itemToAdd) {
        if (confirm(`Item "${input}" not found in menu. Add as new custom item?`)) {
            const priceStr = prompt('Enter Price for ' + input + ':');
            if (priceStr && !isNaN(parseInt(priceStr))) {
                itemToAdd = {
                    id: Date.now(),
                    name: input,
                    price: parseInt(priceStr),
                    quantity: 1,
                    category: 'custom'
                };

                // Add to menu (Main)
                if (confirm('Add this new item to the "Main Course" menu permanently?')) {
                    // Generate new ID
                    let maxId = 0;
                    Object.values(state.menu).forEach(c => c.forEach(i => { if (i.id > maxId) maxId = i.id; }));
                    const newMenuId = maxId + 1;

                    state.menu['main'].push({
                        id: newMenuId,
                        name: itemToAdd.name,
                        price: itemToAdd.price,
                        category: 'main'
                    });

                    // Use the new ID for this item too?
                    itemToAdd.id = newMenuId;
                    itemToAdd.category = 'main';

                    saveStateToStorage();
                    renderMenu(); // Update waiter
                    if (typeof renderManageItemsList === 'function') renderManageItemsList();
                }
            } else {
                return;
            }
        } else {
            return;
        }
    } else {
        // Existing Item found.
    }

    // Check dupe in bill
    const existingIndex = bill.items.findIndex(i => i.name === itemToAdd.name && i.price === itemToAdd.price);
    if (existingIndex > -1) {
        bill.items[existingIndex].quantity += 1;
    } else {
        bill.items.push(itemToAdd);
    }

    bill.grandTotal += itemToAdd.price;

    saveStateToStorage();
    openBillDetails(billId);
    renderBillingView();
    showToast('Item added to bill', 'success');
}

window.deleteBillItem = deleteBillItem;
window.addItemToBill = addItemToBill;
