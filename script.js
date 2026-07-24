(function () {
    'use strict';

    /* ========== DATA ========== */
    const stores = {
        gw: { items: [], discount: 0, discounts: [0, 50, 75] },
        sv: { items: [], discount: 0, discounts: [0, 25, 50] },
    };

    /* ========== HELPERS ========== */
    const $ = (id) => document.getElementById(id);
    const $$ = (sel) => document.querySelectorAll(sel);
    const currency = (n) => '$' + n.toFixed(2);
    const shortCur = (n) => n >= 1000 ? '$' + (n / 1000).toFixed(1) + 'k' : '$' + Math.round(n);
    const esc = (s) => { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; };

    /* ========== PREVENT ZOOM (mobile only, don't block scroll) ========== */
    document.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });
    document.addEventListener('gesturechange', (e) => e.preventDefault(), { passive: false });

    let lastTap = 0;
    document.addEventListener('touchend', (e) => {
        const now = Date.now();
        const target = e.target;
        const isInteractive = target.closest('button, .chip, .new-item-toggle, .tab-btn, .toggle-icon-wrap');
        if (now - lastTap < 300 && isInteractive) {
            e.preventDefault();
        }
        lastTap = now;
    }, { passive: false });

    document.addEventListener('wheel', (e) => {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
        }
    }, { passive: false });

    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '-' || e.key === '=' || e.key === '0')) {
            e.preventDefault();
        }
    });

    /* ========== VIEWPORT HEIGHT FIX (iOS + PWA) ========== */
    function setVH() {
        const vh = (window.visualViewport ? window.visualViewport.height : window.innerHeight) * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
    }

    setVH();
    window.addEventListener('resize', setVH);
    window.addEventListener('orientationchange', () => setTimeout(setVH, 150));

    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', setVH);
    }

    // PWA / standalone: recalculate on visibility change & load
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
        || window.navigator.standalone === true;

    if (isStandalone) {
        window.addEventListener('load', () => setTimeout(setVH, 100));
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) setTimeout(setVH, 100);
        });
    }

    /* ========== DOM REFS ========== */
    const dom = {
        gw: {
            name: $('gw-name'), price: $('gw-price'),
            addBtn: $('gw-add'), clearBtn: $('gw-clear'),
            list: $('gw-list'),
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
            list: $('sv-list'),
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
            const isCollapsed = sec.classList.contains('collapsed');
            sec.classList.toggle('collapsed');
            if (isCollapsed) {
                setTimeout(() => {
                    dom[s].name.focus({ preventScroll: true });
                }, 380);
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
        if (navigator.vibrate) navigator.vibrate(10);
        return new Promise((r) => { modalResolve = r; });
    }

    function hideModal(result) {
        modalOverlay.classList.remove('show');
        if (modalResolve) { modalResolve(result); modalResolve = null; }
    }

    modalCancel.addEventListener('click', () => hideModal(false));
    modalConfirm.addEventListener('click', () => hideModal(true));
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) hideModal(false);
    });

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
            btn.textContent = d === 0 ? 'Full Price' : d + '% Off';
            btn.dataset.discount = d;
            if (d === editDiscount) {
                btn.classList.add(store === 'sv' ? 'sv-edit-active' : 'active');
            }
            btn.addEventListener('click', () => {
                editDiscountGroup.querySelectorAll('.edit-chip').forEach((c) => {
                    c.classList.remove('active', 'sv-edit-active');
                });
                btn.classList.add(store === 'sv' ? 'sv-edit-active' : 'active');
                editDiscount = parseInt(btn.dataset.discount);
                updateEditPreview();
            });
            editDiscountGroup.appendChild(btn);
        });

        drawerSave.className = 'drawer-save' + (store === 'sv' ? ' sv-save' : '');
        updateEditPreview();
        drawerOverlay.classList.add('show');
        setTimeout(() => editName.focus({ preventScroll: true }), 420);
    }

    function closeDrawer() {
        drawerOverlay.classList.remove('show');
        editingStore = null;
        editingId = null;
        document.activeElement?.blur();
    }

    function updateEditPreview() {
        const p = parseFloat(editPrice.value) || 0;
        editPreviewValue.textContent = currency(p * (1 - editDiscount / 100));
    }

    editPrice.addEventListener('input', updateEditPreview);

    drawerSave.addEventListener('click', () => {
        const item = stores[editingStore]?.items.find((i) => i.id === editingId);
        if (!item) return;

        const name = editName.value.trim();
        const price = parseFloat(editPrice.value);

        if (!name) {
            editName.classList.add('shake');
            setTimeout(() => editName.classList.remove('shake'), 500);
            return;
        }
        if (isNaN(price) || price < 0) {
            editPrice.classList.add('shake');
            setTimeout(() => editPrice.classList.remove('shake'), 500);
            return;
        }

        item.name = name;
        item.originalPrice = price;
        item.discount = editDiscount;
        item.savings = price * (editDiscount / 100);
        item.finalPrice = price - item.savings;

        render(editingStore);
        closeDrawer();
        if (navigator.vibrate) navigator.vibrate(5);
    });

    drawerClose.addEventListener('click', closeDrawer);
    drawerOverlay.addEventListener('click', (e) => {
        if (e.target === drawerOverlay) closeDrawer();
    });

    editName.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); editPrice.focus({ preventScroll: true }); }
    });
    editPrice.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); drawerSave.click(); }
    });

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

            document.activeElement?.blur();
            if (navigator.vibrate) navigator.vibrate(5);
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
        if (isNaN(price) || price <= 0) { flash(d.price.closest('.input-group')); ok = false; }
        if (!ok) return;

        const disc = stores[store].discount;
        const savings = price * (disc / 100);
        stores[store].items.push({
            id: Date.now() + Math.random(),
            name,
            originalPrice: price,
            discount: disc,
            savings,
            finalPrice: price - savings,
        });

        d.name.value = '';
        d.price.value = '';
        updatePreview(store);

        d.section.classList.add('collapsed');
        document.activeElement?.blur();

        if (navigator.vibrate) navigator.vibrate(5);

        render(store);

        requestAnimationFrame(() => {
            d.list.scrollTop = d.list.scrollHeight;
        });
    }

    /* ========== REMOVE ========== */
    async function removeItem(store, id) {
        const item = stores[store].items.find((i) => i.id === id);
        if (!item) return;

        const variant = store === 'sv' ? 'sv' : 'gw';
        const ok = await showModal(
            'Remove Item?',
            `"${item.name}" will be removed from your list.`,
            'Remove',
            variant
        );
        if (!ok) return;

        const row = dom[store].list.querySelector(`[data-id="${id}"]`);
        if (row) {
            row.style.transition = 'all 0.3s cubic-bezier(0.4,0,0.2,1)';
            row.style.opacity = '0';
            row.style.transform = 'translateX(40px) scale(0.92)';
            row.style.maxHeight = '0';
            row.style.marginBottom = '0';
            row.style.paddingTop = '0';
            row.style.paddingBottom = '0';
            row.style.overflow = 'hidden';
            await new Promise((r) => setTimeout(r, 320));
        }

        stores[store].items = stores[store].items.filter((i) => i.id !== id);
        if (navigator.vibrate) navigator.vibrate(10);
        render(store);
    }

    /* ========== CLEAR ALL ========== */
    async function clearAll(store) {
        if (stores[store].items.length === 0) return;

        const ok = await showModal(
            'Clear All Items?',
            `All ${stores[store].items.length} item${stores[store].items.length > 1 ? 's' : ''} will be removed.`,
            'Clear All',
            'danger'
        );
        if (!ok) return;

        stores[store].items = [];
        if (navigator.vibrate) navigator.vibrate(15);
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
            e.innerHTML = `
                <div class="empty-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
                        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
                        <line x1="7" y1="7" x2="7.01" y2="7"/>
                    </svg>
                </div>
                <p>No items yet.<br>Tap <strong>New Item</strong> above to start.</p>
            `;
            d.list.appendChild(e);
        } else {
            d.totals.style.display = '';

            items.forEach((item, index) => {
                const row = document.createElement('div');
                row.className = 'item-row';
                row.dataset.id = item.id;
                row.style.animationDelay = `${index * 0.04}s`;

                const bc = item.discount > 0 ? d.badge : 'no-disc';
                const bt = item.discount > 0 ? `-${item.discount}%` : 'FULL';

                let meta;
                if (item.discount > 0) {
                    meta = `<span class="og">${currency(item.originalPrice)}</span>`;
                    meta += `<span class="sv-tag">saved ${currency(item.savings)}</span>`;
                } else {
                    meta = '<span>Full price</span>';
                }

                row.innerHTML = `
                    <div class="item-badge ${bc}">${bt}</div>
                    <div class="item-body">
                        <div class="item-name">${esc(item.name)}</div>
                        <div class="item-sub">${meta}</div>
                    </div>
                    <div class="item-price">${currency(item.finalPrice)}</div>
                    <div class="item-actions">
                        <button class="item-action-btn edit-btn" title="Edit" aria-label="Edit ${esc(item.name)}">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                        </button>
                        <button class="item-action-btn del-btn" title="Remove" aria-label="Remove ${esc(item.name)}">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
                                <line x1="10" y1="11" x2="10" y2="17"/>
                                <line x1="14" y1="11" x2="14" y2="17"/>
                            </svg>
                        </button>
                    </div>
                `;

                row.querySelector('.edit-btn').addEventListener('click', (e) => {
                    e.stopPropagation();
                    openDrawer(store, item.id);
                });

                row.querySelector('.del-btn').addEventListener('click', (e) => {
                    e.stopPropagation();
                    removeItem(store, item.id);
                });

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

    /* ========== VALIDATION FLASH ========== */
    function flash(el) {
        if (!el) return;
        el.classList.add('input-error', 'shake');
        if (navigator.vibrate) navigator.vibrate(30);
        setTimeout(() => el.classList.remove('input-error', 'shake'), 600);
    }

    /* ========== EVENT BINDINGS ========== */
    dom.gw.addBtn.addEventListener('click', () => addItem('gw'));
    dom.sv.addBtn.addEventListener('click', () => addItem('sv'));
    dom.gw.clearBtn.addEventListener('click', () => clearAll('gw'));
    dom.sv.clearBtn.addEventListener('click', () => clearAll('sv'));

    ['gw', 'sv'].forEach((s) => {
        dom[s].name.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); dom[s].price.focus({ preventScroll: true }); }
        });
        dom[s].price.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); addItem(s); }
        });
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (drawerOverlay.classList.contains('show')) closeDrawer();
            else if (modalOverlay.classList.contains('show')) hideModal(false);
        }
    });

    /* ========== INITIAL RENDER ========== */
    render('gw');
    render('sv');

})();