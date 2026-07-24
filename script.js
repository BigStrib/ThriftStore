(function () {
    'use strict';

    // ─── viewport height (PWA fix) ───
    function setHeight() {
        var h = window.visualViewport
            ? window.visualViewport.height
            : window.innerHeight;
        document.documentElement.style.setProperty('--app-h', h + 'px');
    }

    setHeight();
    window.addEventListener('resize', setHeight);
    window.addEventListener('orientationchange', function () {
        setTimeout(setHeight, 120);
    });
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', setHeight);
        window.visualViewport.addEventListener('scroll', setHeight);
    }

    // re-measure when PWA resumes from background
    document.addEventListener('visibilitychange', function () {
        if (!document.hidden) setTimeout(setHeight, 80);
    });
    window.addEventListener('focus', function () {
        setTimeout(setHeight, 80);
    });

    // also measure tab bar actual height and set bottom offset
    function setTabOffset() {
        var tabs = document.getElementById('tabs');
        if (!tabs) return;
        var h = tabs.getBoundingClientRect().height;
        document.querySelectorAll('.view').forEach(function (v) {
            v.style.bottom = h + 'px';
        });
    }

    setTabOffset();
    window.addEventListener('resize', setTabOffset);
    window.addEventListener('orientationchange', function () {
        setTimeout(setTabOffset, 150);
    });

    // ─── prevent zoom gestures ───
    document.addEventListener('gesturestart', function (e) { e.preventDefault(); }, { passive: false });
    document.addEventListener('gesturechange', function (e) { e.preventDefault(); }, { passive: false });

    var lastTap = 0;
    document.addEventListener('touchend', function (e) {
        var now = Date.now();
        if (now - lastTap < 300 && e.target.closest('button, .chip, .panel-bar, .tab')) {
            e.preventDefault();
        }
        lastTap = now;
    }, { passive: false });

    document.addEventListener('wheel', function (e) {
        if (e.ctrlKey || e.metaKey) e.preventDefault();
    }, { passive: false });

    document.addEventListener('keydown', function (e) {
        if ((e.ctrlKey || e.metaKey) && ['+', '-', '=', '0'].indexOf(e.key) !== -1) {
            e.preventDefault();
        }
    });

    // ─── helpers ───
    function el(id) { return document.getElementById(id); }
    function fmt(n) { return '$' + n.toFixed(2); }
    function short(n) { return n >= 1000 ? '$' + (n / 1000).toFixed(1) + 'k' : '$' + Math.round(n); }
    function safe(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
    function vib(ms) { if (navigator.vibrate) navigator.vibrate(ms); }

    // ─── data ───
    var data = {
        gw: { items: [], disc: 0, opts: [0, 50, 75] },
        sv: { items: [], disc: 0, opts: [0, 25, 50] }
    };

    // ─── dom map ───
    var ui = {};
    ['gw', 'sv'].forEach(function (s) {
        ui[s] = {
            name: el(s + '-name'),
            price: el(s + '-price'),
            add: el(s + '-add'),
            nuke: el(s + '-nuke'),
            list: el(s + '-list'),
            foot: el(s + '-foot'),
            sub: el(s + '-sub'),
            sav: el(s + '-sav'),
            tot: el(s + '-tot'),
            statI: el(s + '-stat-items'),
            statS: el(s + '-stat-saved'),
            peek: el(s + '-peek'),
            fill: el(s + '-fill'),
            badge: el(s + '-badge'),
            panel: el(s + '-panel'),
            bar: el(s + '-panel-bar'),
            badgeCls: s + '-bg'
        };
    });

    // ─── toggle panel ───
    ['gw', 'sv'].forEach(function (s) {
        ui[s].bar.addEventListener('click', function () {
            var p = ui[s].panel;
            var wasClosed = p.classList.contains('shut');
            p.classList.toggle('shut');
            if (wasClosed) {
                setTimeout(function () {
                    ui[s].name.focus({ preventScroll: true });
                }, 350);
            }
        });
    });

    // ─── modal ───
    var mOverlay = el('modal-overlay');
    var mModal = el('modal');
    var mTitle = el('modal-title');
    var mMsg = el('modal-msg');
    var mNo = el('modal-no');
    var mYes = el('modal-yes');
    var mCb = null;

    function askModal(title, msg, btnText, variant) {
        mTitle.textContent = title;
        mMsg.textContent = msg;
        mYes.textContent = btnText || 'Remove';
        mModal.className = 'modal';
        if (variant === 'sv') mModal.classList.add('sv-m');
        else if (variant === 'danger') mModal.classList.add('danger-m');
        mOverlay.classList.add('on');
        vib(10);
        return new Promise(function (res) { mCb = res; });
    }

    function closeModal(val) {
        mOverlay.classList.remove('on');
        if (mCb) { mCb(val); mCb = null; }
    }

    mNo.addEventListener('click', function () { closeModal(false); });
    mYes.addEventListener('click', function () { closeModal(true); });
    mOverlay.addEventListener('click', function (e) {
        if (e.target === mOverlay) closeModal(false);
    });

    // ─── drawer ───
    var dOverlay = el('drawer-overlay');
    var dClose = el('drawer-x');
    var dName = el('ed-name');
    var dPrice = el('ed-price');
    var dChips = el('ed-chips');
    var dFinal = el('ed-final');
    var dSave = el('ed-save');
    var editStore = null, editId = null, editDisc = 0;

    function openDrawer(store, id) {
        editStore = store;
        editId = id;
        var item = data[store].items.filter(function (i) { return i.id === id; })[0];
        if (!item) return;

        dName.value = item.name;
        dPrice.value = item.orig.toFixed(2);
        editDisc = item.disc;

        dChips.innerHTML = '';
        data[store].opts.forEach(function (d) {
            var b = document.createElement('button');
            b.className = 'd-chip';
            b.textContent = d === 0 ? 'Full Price' : d + '% Off';
            b.setAttribute('data-d', d);
            if (d === editDisc) {
                b.classList.add(store === 'sv' ? 'sv-on' : 'on');
            }
            b.addEventListener('click', function () {
                dChips.querySelectorAll('.d-chip').forEach(function (c) {
                    c.classList.remove('on', 'sv-on');
                });
                b.classList.add(store === 'sv' ? 'sv-on' : 'on');
                editDisc = parseInt(b.getAttribute('data-d'));
                calcDrawer();
            });
            dChips.appendChild(b);
        });

        dSave.className = 'd-save' + (store === 'sv' ? ' sv-s' : '');
        calcDrawer();
        dOverlay.classList.add('on');
        setTimeout(function () { dName.focus({ preventScroll: true }); }, 400);
    }

    function closeDrawer() {
        dOverlay.classList.remove('on');
        editStore = null;
        editId = null;
        if (document.activeElement) document.activeElement.blur();
    }

    function calcDrawer() {
        var p = parseFloat(dPrice.value) || 0;
        dFinal.textContent = fmt(p * (1 - editDisc / 100));
    }

    dPrice.addEventListener('input', calcDrawer);

    dSave.addEventListener('click', function () {
        if (!editStore) return;
        var item = data[editStore].items.filter(function (i) { return i.id === editId; })[0];
        if (!item) return;

        var n = dName.value.trim();
        var p = parseFloat(dPrice.value);

        if (!n) {
            dName.classList.add('shake');
            setTimeout(function () { dName.classList.remove('shake'); }, 500);
            return;
        }
        if (isNaN(p) || p < 0) {
            dPrice.classList.add('shake');
            setTimeout(function () { dPrice.classList.remove('shake'); }, 500);
            return;
        }

        item.name = n;
        item.orig = p;
        item.disc = editDisc;
        item.save = p * (editDisc / 100);
        item.final = p - item.save;

        render(editStore);
        closeDrawer();
        vib(5);
    });

    dClose.addEventListener('click', closeDrawer);
    dOverlay.addEventListener('click', function (e) {
        if (e.target === dOverlay) closeDrawer();
    });

    dName.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); dPrice.focus({ preventScroll: true }); }
    });
    dPrice.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); dSave.click(); }
    });

    // ─── tabs ───
    var tabBtns = document.querySelectorAll('.tab');
    var views = {
        goodwill: el('view-goodwill'),
        svdp: el('view-svdp')
    };

    tabBtns.forEach(function (btn) {
        btn.addEventListener('click', function () {
            var t = btn.getAttribute('data-tab');
            tabBtns.forEach(function (b) { b.classList.remove('on'); });
            btn.classList.add('on');

            Object.keys(views).forEach(function (k) { views[k].classList.remove('on'); });
            views[t].classList.add('on');

            views[t].style.animation = 'none';
            views[t].offsetHeight; // reflow
            views[t].style.animation = '';

            if (document.activeElement) document.activeElement.blur();
            vib(5);
            setTabOffset();
        });
    });

    // ─── chips ───
    document.querySelectorAll('.chip').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var s = btn.getAttribute('data-s');
            btn.parentElement.querySelectorAll('.chip').forEach(function (c) { c.classList.remove('on'); });
            btn.classList.add('on');
            data[s].disc = parseInt(btn.getAttribute('data-d'));
            preview(s);
        });
    });

    // ─── preview ───
    function preview(s) {
        var p = parseFloat(ui[s].price.value) || 0;
        var d = data[s].disc;
        var f = p * (1 - d / 100);
        ui[s].peek.textContent = fmt(f);
        ui[s].fill.style.width = (p > 0 ? (f / p) * 100 : 100) + '%';
    }

    ['gw', 'sv'].forEach(function (s) {
        ui[s].price.addEventListener('input', function () { preview(s); });
    });

    // ─── add item ───
    function addItem(s) {
        var n = ui[s].name.value.trim();
        var p = parseFloat(ui[s].price.value);

        var ok = true;
        if (!n) { flash(ui[s].name.closest('.fld')); ok = false; }
        if (isNaN(p) || p <= 0) { flash(ui[s].price.closest('.fld')); ok = false; }
        if (!ok) return;

        var d = data[s].disc;
        var sv = p * (d / 100);
        data[s].items.push({
            id: Date.now() + Math.random(),
            name: n,
            orig: p,
            disc: d,
            save: sv,
            final: p - sv
        });

        ui[s].name.value = '';
        ui[s].price.value = '';
        preview(s);

        ui[s].panel.classList.add('shut');
        if (document.activeElement) document.activeElement.blur();
        vib(5);
        render(s);

        requestAnimationFrame(function () {
            ui[s].list.scrollTop = ui[s].list.scrollHeight;
        });
    }

    // ─── remove ───
    function removeItem(s, id) {
        var item = data[s].items.filter(function (i) { return i.id === id; })[0];
        if (!item) return;

        askModal(
            'Remove Item?',
            '"' + item.name + '" will be removed from your list.',
            'Remove',
            s === 'sv' ? 'sv' : 'gw'
        ).then(function (yes) {
            if (!yes) return;

            var row = ui[s].list.querySelector('[data-id="' + id + '"]');
            if (row) {
                row.style.transition = 'all .28s ease';
                row.style.opacity = '0';
                row.style.transform = 'translateX(30px) scale(.94)';
                row.style.maxHeight = '0';
                row.style.marginBottom = '0';
                row.style.paddingTop = '0';
                row.style.paddingBottom = '0';
                row.style.overflow = 'hidden';

                setTimeout(function () {
                    data[s].items = data[s].items.filter(function (i) { return i.id !== id; });
                    vib(10);
                    render(s);
                }, 300);
            } else {
                data[s].items = data[s].items.filter(function (i) { return i.id !== id; });
                vib(10);
                render(s);
            }
        });
    }

    // ─── clear all ───
    function clearAll(s) {
        if (data[s].items.length === 0) return;

        var len = data[s].items.length;
        askModal(
            'Clear All Items?',
            'All ' + len + ' item' + (len > 1 ? 's' : '') + ' will be removed.',
            'Clear All',
            'danger'
        ).then(function (yes) {
            if (!yes) return;
            data[s].items = [];
            vib(15);
            render(s);
        });
    }

    // ─── render ───
    function render(s) {
        var d = ui[s];
        var items = data[s].items;
        d.list.innerHTML = '';

        if (items.length === 0) {
            d.foot.hidden = true;

            var emp = document.createElement('div');
            emp.className = 'empty';
            emp.innerHTML =
                '<div class="empty-ico">' +
                    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">' +
                        '<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>' +
                        '<line x1="7" y1="7" x2="7.01" y2="7"/>' +
                    '</svg>' +
                '</div>' +
                '<p>No items yet.<br>Tap <strong>New Item</strong> above to start.</p>';
            d.list.appendChild(emp);
        } else {
            d.foot.hidden = false;

            items.forEach(function (item, idx) {
                var row = document.createElement('div');
                row.className = 'irow';
                row.setAttribute('data-id', item.id);
                row.style.animationDelay = (idx * 0.04) + 's';

                var bc = item.disc > 0 ? d.badgeCls : 'no-d';
                var bt = item.disc > 0 ? ('-' + item.disc + '%') : 'FULL';

                var meta;
                if (item.disc > 0) {
                    meta = '<span class="og">' + fmt(item.orig) + '</span>' +
                           '<span class="saved">saved ' + fmt(item.save) + '</span>';
                } else {
                    meta = '<span>Full price</span>';
                }

                row.innerHTML =
                    '<div class="irow-badge ' + bc + '">' + bt + '</div>' +
                    '<div class="irow-body">' +
                        '<div class="irow-name">' + safe(item.name) + '</div>' +
                        '<div class="irow-meta">' + meta + '</div>' +
                    '</div>' +
                    '<div class="irow-price">' + fmt(item.final) + '</div>' +
                    '<div class="irow-acts">' +
                        '<button class="act act-edit" title="Edit">' +
                            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">' +
                                '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>' +
                                '<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>' +
                            '</svg>' +
                        '</button>' +
                        '<button class="act act-del" title="Remove">' +
                            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">' +
                                '<polyline points="3 6 5 6 21 6"/>' +
                                '<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>' +
                                '<line x1="10" y1="11" x2="10" y2="17"/>' +
                                '<line x1="14" y1="11" x2="14" y2="17"/>' +
                            '</svg>' +
                        '</button>' +
                    '</div>';

                row.querySelector('.act-edit').addEventListener('click', function (e) {
                    e.stopPropagation();
                    openDrawer(s, item.id);
                });

                row.querySelector('.act-del').addEventListener('click', function (e) {
                    e.stopPropagation();
                    removeItem(s, item.id);
                });

                d.list.appendChild(row);
            });
        }

        d.badge.textContent = items.length + (items.length === 1 ? ' item' : ' items');

        var subT = 0, totS = 0, totF = 0;
        items.forEach(function (i) {
            subT += i.orig;
            totS += i.save;
            totF += i.final;
        });

        d.sub.textContent = fmt(subT);
        d.sav.textContent = '-' + fmt(totS);
        d.tot.textContent = fmt(totF);
        d.statI.textContent = items.length;
        d.statS.textContent = short(totS);
    }

    // ─── flash validation ───
    function flash(el) {
        if (!el) return;
        el.classList.add('err', 'shake');
        vib(30);
        setTimeout(function () { el.classList.remove('err', 'shake'); }, 600);
    }

    // ─── bindings ───
    ui.gw.add.addEventListener('click', function () { addItem('gw'); });
    ui.sv.add.addEventListener('click', function () { addItem('sv'); });
    ui.gw.nuke.addEventListener('click', function () { clearAll('gw'); });
    ui.sv.nuke.addEventListener('click', function () { clearAll('sv'); });

    ['gw', 'sv'].forEach(function (s) {
        ui[s].name.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') { e.preventDefault(); ui[s].price.focus({ preventScroll: true }); }
        });
        ui[s].price.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') { e.preventDefault(); addItem(s); }
        });
    });

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            if (dOverlay.classList.contains('on')) closeDrawer();
            else if (mOverlay.classList.contains('on')) closeModal(false);
        }
    });

    // ─── init ───
    render('gw');
    render('sv');

})();