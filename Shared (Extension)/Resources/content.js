/*
 * HN Comment Sort
 *
 * Adds Reddit-style comment ordering and top-level-only browsing to Hacker
 * News item pages. Runs entirely in the page; makes no network requests.
 */
(() => {
    "use strict";

    // Safari can evaluate this content script more than once for the same
    // page, and a second installed copy of the extension can inject alongside
    // the first. Claim the document synchronously, before any await, so only
    // one instance ever builds the toolbar and per-comment expanders. The
    // marker lives in the DOM because isolated worlds do not share globals.
    const INSTANCE_ATTR = "data-hns-instance";

    function claimDocument() {
        const root = document.documentElement;
        if (root.hasAttribute(INSTANCE_ATTR)) return false;

        root.setAttribute(INSTANCE_ATTR, "");

        // Remove the UI a previous instance left behind if it is no longer
        // running, so a re-injected script starts from a clean page.
        for (const node of document.querySelectorAll(".hns-bar, .hns-expander")) {
            node.remove();
        }
        for (const row of document.querySelectorAll("tr.comtr.hns-hidden, tr.comtr.hns-flash")) {
            row.classList.remove("hns-hidden", "hns-flash");
        }
        for (const table of document.querySelectorAll("table.hns-reordering")) {
            table.classList.remove("hns-reordering");
        }
        root.classList.remove("hns-top-only");

        return true;
    }

    if (!claimDocument()) return;

    window.addEventListener("pagehide", () => {
        document.documentElement.removeAttribute(INSTANCE_ATTR);
    });

    const DEFAULTS = Object.freeze({
        sortMode: "rank",
        sortReplies: false,
        topLevelOnly: false,
        showToolbar: true
    });

    const SORT_KEYS = ["rank", "newest", "oldest", "replies"];

    const SORT_LABELS = {
        rank: "top",
        newest: "newest",
        oldest: "oldest",
        replies: "most replies"
    };

    const SORT_MESSAGES = {
        rank: "Sorted by Hacker News rank",
        newest: "Sorted by newest",
        oldest: "Sorted by oldest",
        replies: "Sorted by most replies"
    };

    const state = {
        table: null,
        comments: [],
        byId: new Map(),
        roots: [],
        expanded: new Set(),
        settings: { ...DEFAULTS },
        bar: null,
        status: null,
        lastTopLevelOnly: false,
        initialized: false
    };

    const api = (() => {
        try {
            return globalThis.browser ?? globalThis.chrome ?? null;
        } catch {
            return null;
        }
    })();

    /* ---------------------------------------------------------------------
     * Storage
     * ------------------------------------------------------------------- */

    function storageGet(defaults) {
        return new Promise((resolve) => {
            try {
                const result = api?.storage?.local?.get(defaults);
                if (result && typeof result.then === "function") {
                    result.then((value) => resolve(value || defaults), () => resolve(defaults));
                } else {
                    resolve(defaults);
                }
            } catch {
                resolve(defaults);
            }
        });
    }

    function storageSet(patch) {
        try {
            const result = api?.storage?.local?.set(patch);
            if (result && typeof result.catch === "function") {
                result.catch(() => {});
            }
        } catch {
            /* Settings simply won't persist; the page still works. */
        }
    }

    async function loadSettings() {
        const stored = await storageGet({ ...DEFAULTS });
        const settings = { ...DEFAULTS };

        for (const key of Object.keys(DEFAULTS)) {
            if (stored && stored[key] !== undefined) {
                settings[key] = stored[key];
            }
        }

        if (!SORT_KEYS.includes(settings.sortMode)) {
            settings.sortMode = DEFAULTS.sortMode;
        }

        settings.sortReplies = Boolean(settings.sortReplies);
        settings.topLevelOnly = Boolean(settings.topLevelOnly);
        settings.showToolbar = settings.showToolbar !== false;

        return settings;
    }

    /* ---------------------------------------------------------------------
     * Parsing
     * ------------------------------------------------------------------- */

    function parseComments() {
        const table = document.querySelector("table.comment-tree");
        if (!table) return false;

        const rows = Array.from(table.querySelectorAll("tr.athing.comtr"));
        if (rows.length === 0) return false;

        state.table = table;
        state.comments = rows.map((row, index) => {
            const indentElement = row.querySelector("td.ind");
            const indentValue = Number.parseInt(indentElement?.getAttribute("indent") ?? "0", 10);

            const ageElement = row.querySelector(".comhead .age");
            const timeText = ageElement?.getAttribute("title") || "";
            const hasTimezone = /(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(timeText);
            let timestamp = Date.parse(hasTimezone || !timeText ? timeText : `${timeText}Z`);
            if (!Number.isFinite(timestamp)) timestamp = Number.NaN;

            const toggle = row.querySelector("a.togg");
            const replyValue = Number.parseInt(toggle?.getAttribute("n") ?? "", 10);

            return {
                id: row.id || `hns-${index}`,
                row,
                indent: Number.isFinite(indentValue) ? indentValue : 0,
                timestamp,
                replyCount: Number.isFinite(replyValue) ? replyValue : 0,
                domIndex: index,
                parent: null,
                children: [],
                expander: null
            };
        });

        buildTree();
        return true;
    }

    function buildTree() {
        state.byId.clear();
        state.roots = [];
        state.expanded.clear();

        const stack = [];

        for (const comment of state.comments) {
            while (stack.length > 0 && stack[stack.length - 1].indent >= comment.indent) {
                stack.pop();
            }

            const parent = stack[stack.length - 1] || null;
            comment.parent = parent;

            if (parent) {
                parent.children.push(comment);
            } else {
                state.roots.push(comment);
            }

            state.byId.set(comment.id, comment);
            stack.push(comment);
        }

        // HN's [n] attribute is the total number of descendants. Fall back to
        // counting the tree if a row is missing it.
        for (const comment of state.comments) {
            if (comment.replyCount === 0 && comment.children.length > 0) {
                comment.replyCount = countDescendants(comment);
            }
        }
    }

    function countDescendants(comment) {
        let total = 0;
        for (const child of comment.children) {
            total += 1 + countDescendants(child);
        }
        return total;
    }

    /* ---------------------------------------------------------------------
     * Sorting
     * ------------------------------------------------------------------- */

    const comparators = {
        rank: (a, b) => a.domIndex - b.domIndex,
        newest: (a, b) => {
            const at = Number.isFinite(a.timestamp) ? a.timestamp : -Infinity;
            const bt = Number.isFinite(b.timestamp) ? b.timestamp : -Infinity;
            return (bt - at) || (a.domIndex - b.domIndex);
        },
        oldest: (a, b) => {
            const at = Number.isFinite(a.timestamp) ? a.timestamp : Infinity;
            const bt = Number.isFinite(b.timestamp) ? b.timestamp : Infinity;
            return (at - bt) || (a.domIndex - b.domIndex);
        },
        replies: (a, b) => (b.replyCount - a.replyCount) || (a.domIndex - b.domIndex)
    };

    function sortTree() {
        const comparator = comparators[state.settings.sortMode] || comparators.rank;

        const restoreOriginalChildOrder = (nodes) => {
            for (const node of nodes) {
                node.children.sort(comparators.rank);
                restoreOriginalChildOrder(node.children);
            }
        };

        state.roots.sort(comparator);

        if (state.settings.sortReplies) {
            const sortChildren = (nodes) => {
                for (const node of nodes) {
                    node.children.sort(comparator);
                    sortChildren(node.children);
                }
            };
            sortChildren(state.roots);
        } else {
            restoreOriginalChildOrder(state.roots);
        }
    }

    function flatten(nodes, output = []) {
        for (const node of nodes) {
            output.push(node);
            flatten(node.children, output);
        }
        return output;
    }

    function reorderRows(ordered) {
        if (ordered.length === 0) return;

        const firstRow = state.comments[0]?.row;
        const parent = firstRow?.parentNode;
        if (!parent) return;

        const rowsInDom = Array.from(parent.children).filter((child) =>
            child.matches("tr.athing.comtr")
        );
        const lastRow = rowsInDom[rowsInDom.length - 1] || firstRow;
        const reference = lastRow.nextElementSibling;
        const table = state.table;

        // Move rows one at a time, from the end of the new order backwards.
        // Moving them into a DocumentFragment would briefly empty the table,
        // collapsing the page height and making Safari clamp/jump the scroll
        // position (and briefly paint a blank page).
        if (table) table.classList.add("hns-reordering");

        let cursor = reference;
        for (let index = ordered.length - 1; index >= 0; index -= 1) {
            const row = ordered[index].row;
            if (row.nextElementSibling !== cursor) {
                parent.insertBefore(row, cursor);
            }
            cursor = row;
        }

        if (table) {
            requestAnimationFrame(() => {
                requestAnimationFrame(() => table.classList.remove("hns-reordering"));
            });
        }
    }

    function captureAnchor() {
        if (!state.table) return null;

        const rows = state.table.querySelectorAll("tr.athing.comtr");
        for (const row of rows) {
            if (row.classList.contains("hns-hidden")) continue;
            const rect = row.getBoundingClientRect();
            if (rect.bottom > 0 && rect.top < window.innerHeight) {
                const comment = state.byId.get(row.id);
                let root = comment;
                while (root?.parent) root = root.parent;
                const rootRect = root ? root.row.getBoundingClientRect() : null;
                return {
                    id: row.id,
                    top: rect.top,
                    rootId: root?.id ?? null,
                    rootTop: rootRect ? rootRect.top : rect.top
                };
            }
        }
        return null;
    }

    function restoreAnchor(anchor) {
        if (!anchor) return;

        const comment = state.byId.get(anchor.id);
        if (!comment) return;

        if (!comment.row.classList.contains("hns-hidden")) {
            const delta = comment.row.getBoundingClientRect().top - anchor.top;
            if (Math.abs(delta) > 1 && typeof window.scrollBy === "function") {
                window.scrollBy(0, delta);
            }
            return;
        }

        // The anchored row was just hidden by top-level-only mode. Keep its
        // thread root where it was instead of jumping to the top of the page.
        const root = anchor.rootId ? state.byId.get(anchor.rootId) : null;
        if (root && !root.row.classList.contains("hns-hidden")) {
            const delta = root.row.getBoundingClientRect().top - anchor.rootTop;
            if (Math.abs(delta) > 1 && typeof window.scrollBy === "function") {
                window.scrollBy(0, delta);
            }
        }
    }

    function applyLayout({ keepScroll = false } = {}) {
        const anchor = keepScroll ? null : captureAnchor();
        sortTree();
        reorderRows(flatten(state.roots));
        applyVisibility();
        if (anchor) restoreAnchor(anchor);
    }

    /* ---------------------------------------------------------------------
     * Top-level-only mode
     * ------------------------------------------------------------------- */

    function isVisibleInTopLevelMode(comment) {
        let parent = comment.parent;
        while (parent) {
            if (!state.expanded.has(parent.id)) return false;
            parent = parent.parent;
        }
        return true;
    }

    function applyVisibility() {
        const enabled = state.settings.topLevelOnly;

        document.documentElement.classList.toggle("hns-top-only", enabled);

        for (const comment of state.comments) {
            const hidden = enabled && !isVisibleInTopLevelMode(comment);
            comment.row.classList.toggle("hns-hidden", hidden);
        }

        updateExpanders();
        updateBar();
    }

    function toggleExpanded(comment) {
        if (state.expanded.has(comment.id)) {
            state.expanded.delete(comment.id);
        } else {
            state.expanded.add(comment.id);
        }

        applyVisibility();
        announce(state.expanded.has(comment.id) ? "Replies shown" : "Replies hidden");
    }

    function expandAll() {
        for (const comment of state.comments) {
            if (comment.children.length > 0) state.expanded.add(comment.id);
        }
        applyVisibility();
        announce("All replies shown");
    }

    function collapseAll() {
        state.expanded.clear();
        applyVisibility();
        announce("Showing top-level comments only");
    }

    function createExpander(comment) {
        const host =
            comment.row.querySelector(".navs") ||
            comment.row.querySelector(".comhead") ||
            comment.row.querySelector("td.default");
        if (!host) return;

        const button = document.createElement("button");
        button.type = "button";
        button.className = "hns-expander";
        button.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            toggleExpanded(comment);
        });

        host.appendChild(button);
        comment.expander = button;
    }

    function updateExpanders() {
        for (const comment of state.comments) {
            const button = comment.expander;
            if (!button) continue;

            const expanded = state.expanded.has(comment.id);
            const count = comment.replyCount;

            button.textContent = expanded ? "[\u2212]" : `[+${count}]`;
            button.setAttribute("aria-expanded", String(expanded));

            const label = expanded
                ? "Hide replies"
                : `Show ${count} ${count === 1 ? "reply" : "replies"}`;
            button.setAttribute("aria-label", label);
            button.title = label;
        }
    }

    /* ---------------------------------------------------------------------
     * Toolbar
     * ------------------------------------------------------------------- */

    function makeButton(text, className) {
        const button = document.createElement("button");
        button.type = "button";
        if (className) button.className = className;
        button.textContent = text;
        return button;
    }

    function makeSeparator(text = "\u00b7") {
        const separator = document.createElement("span");
        separator.className = "hns-sep";
        separator.setAttribute("aria-hidden", "true");
        separator.textContent = text;
        return separator;
    }

    function buildBar() {
        const bar = document.createElement("div");
        bar.className = "hns-bar";
        bar.setAttribute("role", "group");
        bar.setAttribute("aria-label", "Comment sorting");

        const sortGroup = document.createElement("span");
        sortGroup.className = "hns-sort";

        const label = document.createElement("span");
        label.textContent = "sort: ";
        sortGroup.appendChild(label);

        SORT_KEYS.forEach((key, index) => {
            if (index > 0) sortGroup.appendChild(makeSeparator());
            const button = makeButton(SORT_LABELS[key]);
            button.dataset.sort = key;
            button.addEventListener("click", () => setSetting("sortMode", key));
            if (key === "rank") {
                button.title = "HN's own ranking (HN does not publish comment scores)";
            }
            sortGroup.appendChild(button);
        });

        const toggleLabel = document.createElement("label");
        toggleLabel.className = "hns-check hns-secondary";

        const toggle = document.createElement("input");
        toggle.type = "checkbox";
        toggle.id = "hns-top-only";
        toggle.addEventListener("change", () => setSetting("topLevelOnly", toggle.checked));

        toggleLabel.appendChild(toggle);
        toggleLabel.appendChild(document.createTextNode(" top-level only"));

        const actions = document.createElement("span");
        actions.className = "hns-actions";

        const expandAllButton = makeButton("expand all");
        expandAllButton.addEventListener("click", expandAll);

        const collapseAllButton = makeButton("collapse all");
        collapseAllButton.addEventListener("click", collapseAll);

        actions.appendChild(expandAllButton);
        actions.appendChild(makeSeparator("|"));
        actions.appendChild(collapseAllButton);

        const status = document.createElement("span");
        status.className = "hns-sr-only";
        status.setAttribute("aria-live", "polite");

        bar.appendChild(sortGroup);
        bar.appendChild(toggleLabel);
        bar.appendChild(actions);
        bar.appendChild(status);

        state.bar = bar;
        state.status = status;
    }

    function ensureBar() {
        if (!state.bar) buildBar();

        if (!state.settings.showToolbar) {
            if (state.bar.isConnected) state.bar.remove();
            return;
        }

        if (!state.bar.isConnected && state.table?.parentNode) {
            state.table.parentNode.insertBefore(state.bar, state.table);
        }
    }

    function updateBar() {
        if (!state.bar) return;

        state.bar.classList.toggle("hns-mode-on", state.settings.topLevelOnly);

        for (const button of state.bar.querySelectorAll("button[data-sort]")) {
            button.setAttribute("aria-pressed", String(button.dataset.sort === state.settings.sortMode));
        }

        const checkbox = state.bar.querySelector("#hns-top-only");
        if (checkbox) checkbox.checked = state.settings.topLevelOnly;
    }

    function announce(message) {
        if (!state.status) return;
        state.status.textContent = "";
        requestAnimationFrame(() => {
            if (state.status) state.status.textContent = message;
        });
    }

    /* ---------------------------------------------------------------------
     * Settings / rendering
     * ------------------------------------------------------------------- */

    function setSetting(key, value) {
        if (state.settings[key] === value) return;

        state.settings[key] = value;
        const keepScroll = key === "sortMode" || key === "sortReplies";
        renderAll({
            message: key === "sortMode" ? SORT_MESSAGES[value] : "",
            keepScroll
        });
        storageSet({ [key]: value });
    }

    function renderAll({ message = "", keepScroll = false } = {}) {
        if (!state.initialized) return;

        const enabled = Boolean(state.settings.topLevelOnly);
        if (enabled && !state.lastTopLevelOnly) {
            state.expanded.clear();
        }
        state.lastTopLevelOnly = enabled;

        ensureBar();
        applyLayout({ keepScroll });

        if (message) announce(message);
    }

    function onStorageChanged(changes, area) {
        if (area && area !== "local") return;

        let changed = false;
        let keepScroll = false;
        for (const key of Object.keys(DEFAULTS)) {
            if (changes[key] && state.settings[key] !== changes[key].newValue) {
                state.settings[key] = changes[key].newValue;
                changed = true;
                if (key === "sortMode" || key === "sortReplies") keepScroll = true;
            }
        }

        if (changed) renderAll({ keepScroll });
    }

    /* ---------------------------------------------------------------------
     * Deep links / hash navigation
     * ------------------------------------------------------------------- */

    function expandAncestors(comment) {
        for (let parent = comment.parent; parent; parent = parent.parent) {
            state.expanded.add(parent.id);
        }
    }

    function scrollToComment(comment, smooth) {
        try {
            comment.row.scrollIntoView({
                block: "center",
                behavior: smooth ? "smooth" : "auto"
            });
        } catch {
            comment.row.scrollIntoView();
        }

        comment.row.classList.remove("hns-flash");
        void comment.row.offsetWidth;
        comment.row.classList.add("hns-flash");
        window.setTimeout(() => comment.row.classList.remove("hns-flash"), 1800);
    }

    function revealComment(comment, smooth = false) {
        if (state.settings.topLevelOnly) {
            expandAncestors(comment);
            applyVisibility();
        }
        scrollToComment(comment, smooth);
    }

    function handleHash(initial = false) {
        const raw = window.location.hash.replace(/^#/, "");
        if (!raw) return;

        let id = raw;
        try {
            id = decodeURIComponent(raw);
        } catch {
            /* keep the raw value */
        }

        const comment = state.byId.get(id);
        if (!comment) return;

        revealComment(comment, !initial);
    }

    function onDocumentClick(event) {
        if (!(event.target instanceof Element)) return;

        const link = event.target.closest('a[href^="#"]');
        if (!link) return;

        const id = link.getAttribute("href")?.slice(1);
        const comment = id ? state.byId.get(id) : null;
        if (!comment) return;

        if (state.settings.topLevelOnly) {
            const known = state.expanded.size;
            expandAncestors(comment);
            const revealed = state.expanded.size !== known;
            applyVisibility();

            // HN handles its own clicky links with preventDefault +
            // scrollIntoView. Re-scroll after revealing hidden ancestors so
            // links to hidden comments land in the right place.
            if (revealed) {
                requestAnimationFrame(() => scrollToComment(comment, false));
            }
        }
    }

    /* ---------------------------------------------------------------------
     * Init
     * ------------------------------------------------------------------- */

    async function init() {
        if (!parseComments()) return;

        state.settings = await loadSettings();
        state.lastTopLevelOnly = state.settings.topLevelOnly;
        state.initialized = true;

        for (const comment of state.comments) {
            if (comment.children.length > 0) createExpander(comment);
        }

        ensureBar();
        applyLayout({ keepScroll: true });

        window.addEventListener("hashchange", () => handleHash(false));
        document.addEventListener("click", onDocumentClick, true);

        if (api?.storage?.onChanged?.addListener) {
            api.storage.onChanged.addListener(onStorageChanged);
        }

        if (window.location.hash) {
            window.setTimeout(() => handleHash(true), 0);
        }
    }

    init();
})();
