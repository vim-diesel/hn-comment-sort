const DEFAULTS = {
    sortMode: "rank",
    sortReplies: false,
    topLevelOnly: false,
    showToolbar: true
};

const api = globalThis.browser ?? globalThis.chrome ?? null;

const elements = {
    sortMode: document.getElementById("sort-mode"),
    sortReplies: document.getElementById("sort-replies"),
    topLevelOnly: document.getElementById("top-level"),
    showToolbar: document.getElementById("show-toolbar"),
    reset: document.getElementById("reset"),
    status: document.getElementById("status")
};

let statusTimer = null;

function getSettings() {
    return new Promise((resolve) => {
        try {
            const result = api?.storage?.local?.get({ ...DEFAULTS });
            if (result && typeof result.then === "function") {
                result.then((value) => resolve({ ...DEFAULTS, ...value }), () => resolve({ ...DEFAULTS }));
            } else {
                resolve({ ...DEFAULTS });
            }
        } catch {
            resolve({ ...DEFAULTS });
        }
    });
}

function saveSettings(patch) {
    try {
        const result = api?.storage?.local?.set(patch);
        if (result && typeof result.then === "function") {
            result.then(showSaved, showError);
        } else {
            showSaved();
        }
    } catch {
        showError();
    }
}

function showSaved() {
    setStatus("Saved");
}

function showError() {
    setStatus("Could not save");
}

function setStatus(message) {
    elements.status.textContent = message;
    window.clearTimeout(statusTimer);
    statusTimer = window.setTimeout(() => {
        elements.status.textContent = "";
    }, 1400);
}

function render(settings) {
    elements.sortMode.value = settings.sortMode;
    elements.sortReplies.checked = Boolean(settings.sortReplies);
    elements.topLevelOnly.checked = Boolean(settings.topLevelOnly);
    elements.showToolbar.checked = settings.showToolbar !== false;
}

async function init() {
    const settings = await getSettings();
    render(settings);

    elements.sortMode.addEventListener("change", () => {
        saveSettings({ sortMode: elements.sortMode.value });
    });

    elements.sortReplies.addEventListener("change", () => {
        saveSettings({ sortReplies: elements.sortReplies.checked });
    });

    elements.topLevelOnly.addEventListener("change", () => {
        saveSettings({ topLevelOnly: elements.topLevelOnly.checked });
    });

    elements.showToolbar.addEventListener("change", () => {
        saveSettings({ showToolbar: elements.showToolbar.checked });
    });

    elements.reset.addEventListener("click", async () => {
        render({ ...DEFAULTS });
        try {
            const result = api?.storage?.local?.set({ ...DEFAULTS });
            if (result && typeof result.then === "function") {
                await result;
            }
            setStatus("Reset");
        } catch {
            showError();
        }
    });
}

init();
