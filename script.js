(function () {
    'use strict';

    const stores = {
        gw: { items: [], discount: 0, discounts: [0, 50, 75] },
        sv: { items: [], discount: 0, discounts: [0, 25, 50] },
    };

    const $ = (id) => document.getElementById(id);
    const $$ = (sel) => document.querySelectorAll(sel);
    const currency = (n) => '$' + n.toFixed(2);
    const shortCur = (n) => n >= 1000 ? '$' + (n / 1000).toFixed(1) + 'k' : '$' + Math.round(n);
    const esc = (s) => { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; };

    const dom = {
        gw: {
            name: $('gw-name'), price: $('gw-price'),
            addBtn: $('gw-add'), clearBtn: $('gw-clear'),
            list: $('gw-list'), empty: $('gw-empty'),
            totals: $('gw-totals'), sub: $('gw-sub'),
            save: $('gw-save'), total: $('gw-total'),
            pillItems: $('gw-pill-items'), pillSaved: $('gw-pill-saved'),
            previewAmt: $('gw-preview-amt'), previewBar: $('gw-preview-bar'),
            count: $('gw-count'), badge: 'gw-badge',
            section: $('gw-section'), toggle: $('gw-toggle'),
        },
        sv: {
            name: $('sv-name'), price: $('sv-price'),
            addBtn: $('sv-add'), clearBtn: $('sv-clear'),
            list: $('sv-list'), empty: $('sv-empty'),
            totals: $('sv-totals'), sub: $('sv-sub'),
            save: $('sv-save'), total: $('sv-total'),
            pillItems: $('sv-pill-items'), pillSaved: $('sv-pill-saved'),
            previewAmt: $('sv-preview-amt'), previewBar: $('sv-preview-bar'),
            count: $('sv-count'), badge: 'sv-badge',
            section: $('sv-section'), toggle: $('sv-toggle'),
        },
    };

    /* ========== TOGGLE PANEL ========== */
    ['gw', 'sv'].forEach((s) => {
        dom[s].toggle.addEventListener('click', () => {
            const sec = dom[s].section;
            sec.classList.toggle('collapsed');
            if (!sec.classList.contains('collapsed')) {
                setTimeout(() => dom[s].name.focus(), 380);
            }
        });
    });

    /* ========== MODAL ========== */
    const modalOverlay = $('modal-overlay');
    const modal = $('modal');
    const modalTitle = $('modal-title');
    const modalMsg = $('modal-message');
    const modalCancel = $('modal-cancel');
    const modalConfirm = $('modal-confirm');
    let modalResolve = null;

    function showModal(title, message, confirmText, variant) {
        modalTitle.textContent = title;
        modalMsg.textContent = message;
        modalConfirm.textContent = confirmText || 'Remove';
        modal.className = 'modal';
        if (variant === 'sv') modal.classList.add('sv-modal');
        else if (variant === 'danger') modal.classList.add('danger-modal');
        modalOverlay.classList.add('show');
        return new Promise((r) => { modalResolve = r; });
    }

    function hideModal(result) {
        modalOverlay.classList.remove('show');
        if (modalResolve) { modalResolve(result); modalResolve = null; }
    }

    modalCancel.addEventListener('click', () => hideModal(false));
    modalConfirm.addEventListener('click', () => hideModal(true));
    modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) hideModal(false); });

    /* ========== EDIT DRAWER ========== */
    const drawerOverlay = $('drawer-overlay');
    const drawerClose = $('drawer-close');
    const editName = $('edit-name');
    const editPrice = $('edit-price');
    const editDiscountGroup = $('edit-discount-group');
    const editPreviewValue = $('edit-preview-value');
    const drawerSave = $('drawer-save');
    let editingStore = null, editingId = null, editDiscount = 0;

    function openDrawer(store, itemId) {
        editingStore = store;
        editingId = itemId;
        const item = stores[store].items.find((i) => i.id === itemId);
        if (!item) return;

        editName.value = item.name;
        editPrice.value = item.originalPrice.toFixed(2);
        editDiscount = item.discount;

        editDiscountGroup.innerHTML = '';
        stores[store].discounts.forEach((d) => {
            const btn = document.createElement('button');
            btn.className = 'edit-chip';
            btn.textContent = d === 0 ? 'Full' : d + '% Off';
            btn.dataset.discount = d;
            if (d === editDiscount) btn.classList.add(store === 'sv' ? 'sv-edit-active' : 'active');
            btn.addEventListener('click', () => {
                editDiscountGroup.querySelectorAll('.edit-chip').forEach((c) => c.classList.remove('active', 'sv-edit-active'));
                btn.classList.add(store === 'sv' ? 'sv-edit-active' : 'active');
                editDiscount = parseInt(btn.dataset.discount);
                updateEditPreview();
            });
            editDiscountGroup.appendChild(btn);
        });

        drawerSave.className = 'drawer-save' + (store === 'sv' ? ' sv-save' : '');
        updateEditPreview();
        drawerOverlay.classList.add('show');
        setTimeout(() => editName.focus(), 400);
    }

    function closeDrawer() {
        drawerOverlay.classList.remove('show');
        editingStore = null; editingId = null;
    }

    function updateEditPreview() {
        const p = parseFloat(editPrice.value) || 0;
        editPreviewValue.textContent = currency(p * (1 - editDiscount / 100));
    }

    editPrice.addEventListener('input', updateEditPreview);

    drawerSave.addEventListener('click', () => {
        const item = stores[editingStore].items.find((i) => i.id === editingId);
        if (!item) return;
        const name = editName.value.trim();
        const price = parseFloat(editPrice.value);
        if (!name || isNaN(price) || price < 0) return;
        item.name = name;
        item.originalPrice = price;
        item.discount = editDiscount;
        item.savings = price * (editDiscount / 100);
        item.finalPrice = price - item.savings;
        render(editingStore);
        closeDrawer();
    });

    drawerClose.addEventListener('click', closeDrawer);
    drawerOverlay.addEventListener('click', (e) => { if (e.target === drawerOverlay) closeDrawer(); });
    editName.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); editPrice.focus(); } });
    editPrice.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); drawerSave.click(); } });

    /* ========== TABS ========== */
    const tabBtns = $$('.tab-btn');
    const pages = { goodwill: $('page-goodwill'), svdp: $('page-svdp') };

    tabBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            tabBtns.forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');
            Object.values(pages).forEach((p) => p.classList.remove('active'));
            pages[tab].classList.add('active');
            pages[tab].style.animation = 'none';
            pages[tab].offsetHeight;
            pages[tab].style.animation = '';
        });
    });

    /* ========== CHIPS ========== */
    $$('.chip').forEach((btn) => {
        btn.addEventListener('click', () => {
            const store = btn.dataset.store;
            btn.parentElement.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
            btn.classList.add('active');
            stores[store].discount = parseInt(btn.dataset.discount);
            updatePreview(store);
        });
    });

    /* ========== LIVE PREVIEW ========== */
    function updatePreview(store) {
        const d = dom[store];
        const price = parseFloat(d.price.value) || 0;
        const disc = stores[store].discount;
        const final = price * (1 - disc / 100);
        d.previewAmt.textContent = currency(final);
        d.previewBar.style.width = (price > 0 ? (final / price) * 100 : 100) + '%';
    }

    ['gw', 'sv'].forEach((s) => {
        dom[s].price.addEventListener('input', () => updatePreview(s));
    });

    /* ========== ADD ITEM ========== */
    function addItem(store) {
        const d = dom[store];
        const name = d.name.value.trim();
        const price = parseFloat(d.price.value);
        let ok = true;
        if (!name) { flash(d.name.closest('.input-group')); ok = false; }
        if (isNaN(price) || price < 0) { flash(d.price.closest('.input-group')); ok = false; }
        if (!ok) return;

        const disc = stores[store].discount;
        const savings = price * (disc / 100);
        stores[store].items.push({
            id: Date.now() + Math.random(),
            name, originalPrice: price,
            discount: disc, savings, finalPrice: price - savings,
        });

        d.name.value = '';
        d.price.value = '';
        updatePreview(store);

        // Collapse panel after adding
        d.section.classList.add('collapsed');
        render(store);
    }

    /* ========== REMOVE ========== */
    async function removeItem(store, id) {
        const item = stores[store].items.find((i) => i.id === id);
        if (!item) return;
        const variant = store === 'sv' ? 'sv' : 'gw';
        const ok = await showModal('Remove Item?', `"${item.name}" will be removed.`, 'Remove', variant);
        if (!ok) return;

        const row = dom[store].list.querySelector(`[data-id="${id}"]`);
        if (row) {
            row.style.transition = 'all 0.3s cubic-bezier(0.4,0,0.2,1)';
            row.style.opacity = '0';
            row.style.transform = 'translateX(30px) scale(0.95)';
            row.style.maxHeight = '0';
            row.style.marginBottom = '0';
            row.style.padding = '0 12px';
            row.style.overflow = 'hidden';
            await new Promise((r) => setTimeout(r, 300));
        }
        stores[store].items = stores[store].items.filter((i) => i.id !== id);
        render(store);
    }

    /* ========== CLEAR ALL ========== */
    async function clearAll(store) {
        if (stores[store].items.length === 0) return;
        const ok = await showModal('Clear All Items?', `All ${stores[store].items.length} items will be removed.`, 'Clear All', 'danger');
        if (!ok) return;
        stores[store].items = [];
        render(store);
    }

    /* ========== RENDER ========== */
    function render(store) {
        const d = dom[store];
        const items = stores[store].items;
        d.list.innerHTML = '';

        if (items.length === 0) {
            d.totals.style.display = 'none';
            const e = document.createElement('div');
            e.className = 'empty-state';
            e.innerHTML = `<div class="empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg></div><p>No items yet.<br>Tap <strong>New Item</strong> to start.</p>`;
            d.list.appendChild(e);
        } else {
            d.totals.style.display = '';
            items.forEach((item) => {
                const row = document.createElement('div');
                row.className = 'item-row';
                row.dataset.id = item.id;
                const bc = item.discount > 0 ? d.badge : 'no-disc';
                const bt = item.discount > 0 ? `-${item.discount}%` : 'FULL';
                const meta = item.discount > 0
                    ? `<span class="og">${currency(item.originalPrice)}</span><span class="sv-tag">saved ${currency(item.savings)}</span>`
                    : '<span>Full price</span>';

                row.innerHTML = `
                    <div class="item-badge ${bc}">${bt}</div>
                    <div class="item-body">
                        <div class="item-name">${esc(item.name)}</div>
                        <div class="item-sub">${meta}</div>
                    </div>
                    <div class="item-price">${currency(item.finalPrice)}</div>
                    <div class="item-actions">
                        <button class="item-action-btn edit-btn" title="Edit"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                        <button class="item-action-btn del-btn" title="Remove"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></button>
                    </div>`;

                row.querySelector('.edit-btn').addEventListener('click', () => openDrawer(store, item.id));
                row.querySelector('.del-btn').addEventListener('click', () => removeItem(store, item.id));
                d.list.appendChild(row);
            });
        }

        d.count.textContent = items.length + (items.length === 1 ? ' item' : ' items');
        const subTotal = items.reduce((s, i) => s + i.originalPrice, 0);
        const totalSave = items.reduce((s, i) => s + i.savings, 0);
        const grand = items.reduce((s, i) => s + i.finalPrice, 0);
        d.sub.textContent = currency(subTotal);
        d.save.textContent = '-' + currency(totalSave);
        d.total.textContent = currency(grand);
        d.pillItems.textContent = items.length;
        d.pillSaved.textContent = shortCur(totalSave);
    }

    function flash(el) {
        el.classList.add('input-error', 'shake');
        setTimeout(() => el.classList.remove('input-error', 'shake'), 500);
    }

    /* ========== BINDINGS ========== */
    dom.gw.addBtn.addEventListener('click', () => addItem('gw'));
    dom.sv.addBtn.addEventListener('click', () => addItem('sv'));
    dom.gw.clearBtn.addEventListener('click', () => clearAll('gw'));
    dom.sv.clearBtn.addEventListener('click', () => clearAll('sv'));

    ['gw', 'sv'].forEach((s) => {
        dom[s].name.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); dom[s].price.focus(); } });
        dom[s].price.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addItem(s); } });
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (drawerOverlay.classList.contains('show')) closeDrawer();
            else if (modalOverlay.classList.contains('show')) hideModal(false);
        }
    });

    let ltt = 0;
    document.addEventListener('touchend', (e) => {
        const n = Date.now();
        if (n - ltt <= 300 && e.target.closest('button')) e.preventDefault();
        ltt = n;
    }, false);
})();