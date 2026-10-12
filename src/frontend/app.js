// Spotlight Frontend: Pure Fast Search & Launch Pipeline with Windows Theme & App Icons

const searchInput = document.getElementById("searchInput");
const clearBtn = document.getElementById("clearBtn");
const resultsList = document.getElementById("resultsList");
const emptyState = document.getElementById("emptyState");
const hotkeyHint = document.getElementById("hotkeyHint");

let flatResults = [];
let selectedIndex = 0;
let debounceTimeout = null;

const escapeHtml = (str) =>
	String(str || "").replace(
		/[&<>"']/g,
		(m) =>
			({
				"&": "&amp;",
				"<": "&lt;",
				">": "&gt;",
				'"': "&quot;",
				"'": "&#39;",
			})[m],
	);

// System Theme Adaptation
async function initTheme() {
	try {
		const theme = await tiny.theme.get();
		if (theme && theme.dark === false) {
			document.body.classList.add("light-theme");
		} else {
			document.body.classList.remove("light-theme");
		}
	} catch (_e) {}

	tiny.theme.on((theme) => {
		if (theme && theme.dark === false) {
			document.body.classList.add("light-theme");
		} else {
			document.body.classList.remove("light-theme");
		}
	});
}

// Icon renderer: Native app icon or Fluent vector icon
function renderItemIcon(item) {
	if (item.icon) {
		return `<img class="row-app-icon" src="${escapeHtml(item.icon)}" alt="" />`;
	}

	let svgContent = "";
	const type = item.iconType || item.type;

	switch (type) {
		case "calc":
			svgContent = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="4" y="2" width="16" height="20" rx="2"/>
        <line x1="8" y1="6" x2="16" y2="6"/>
        <line x1="16" y1="14" x2="16" y2="18"/>
        <path d="M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M8 18h.01M12 18h.01"/>
      </svg>`;
			break;

		case "unit":
			svgContent = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
      </svg>`;
			break;

		case "lock":
			svgContent = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
      </svg>`;
			break;

		case "moon":
		case "sleep":
			svgContent = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
      </svg>`;
			break;

		case "shut":
		case "shutdown":
		case "power":
			svgContent = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18.36 6.64a9 9 0 1 1-12.73 0"/>
        <line x1="12" y1="2" x2="12" y2="12"/>
      </svg>`;
			break;

		case "restart":
		case "reboot":
			svgContent = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="23 4 23 10 17 10"/>
        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
      </svg>`;
			break;

		case "globe":
		case "web":
			svgContent = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="2" y1="12" x2="22" y2="12"/>
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
      </svg>`;
			break;

		default:
			// Default application Fluent icon
			svgContent = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="7" height="7"/>
        <rect x="14" y="3" width="7" height="7"/>
        <rect x="14" y="14" width="7" height="7"/>
        <rect x="3" y="14" width="7" height="7"/>
      </svg>`;
			break;
	}

	return `<div class="row-fallback-icon">${svgContent}</div>`;
}

async function doSearch() {
	const query = searchInput.value;
	clearBtn.style.display = query ? "flex" : "none";

	try {
		const res = await tiny.api.call("search", { query });
		const categories = res.results || [];
		renderResults(categories);
	} catch (err) {
		console.error("Search error:", err);
	}
}

function renderResults(categories) {
	resultsList.innerHTML = "";
	flatResults = [];
	selectedIndex = 0;

	if (categories.length === 0) {
		emptyState.style.display = "flex";
		resultsList.style.display = "none";
		return;
	}

	emptyState.style.display = "none";
	resultsList.style.display = "block";

	let globalIndex = 0;

	for (const cat of categories) {
		if (!cat.items || cat.items.length === 0) continue;

		const group = document.createElement("div");
		group.className = "result-group";

		const header = document.createElement("div");
		header.className = "group-header";
		header.textContent = cat.category;
		group.appendChild(header);

		for (const item of cat.items) {
			const idx = globalIndex++;
			flatResults.push(item);

			const row = document.createElement("div");
			row.className = `result-row${idx === 0 ? " selected" : ""}`;
			row.dataset.index = idx;

			const badgeText =
				item.type === "app"
					? "App"
					: item.type === "calc"
						? "Calculation"
						: item.type === "unit" || item.type === "currency"
							? "Conversion"
							: item.type === "system"
								? "System"
								: item.type === "web"
									? "Web"
									: "Action";

			row.innerHTML = `
        <div class="row-icon-container">
          ${renderItemIcon(item)}
        </div>
        <div class="row-content">
          <div class="row-title">${escapeHtml(item.title)}</div>
          <div class="row-subtitle">${escapeHtml(item.subtitle)}</div>
        </div>
        <div class="row-badge">${badgeText}</div>
      `;

			row.addEventListener("click", () => {
				selectAndExecute(idx);
			});

			row.addEventListener("mouseenter", () => {
				setSelectedIndex(idx);
			});

			group.appendChild(row);
		}

		resultsList.appendChild(group);
	}

	updateSelectionView();
}

function setSelectedIndex(newIndex) {
	if (flatResults.length === 0) return;
	if (newIndex < 0) newIndex = 0;
	if (newIndex >= flatResults.length) newIndex = flatResults.length - 1;

	selectedIndex = newIndex;
	updateSelectionView();
}

function updateSelectionView() {
	const rows = resultsList.querySelectorAll(".result-row");
	rows.forEach((r, idx) => {
		if (idx === selectedIndex) {
			r.classList.add("selected");
			r.scrollIntoView({ block: "nearest" });
		} else {
			r.classList.remove("selected");
		}
	});
}

async function selectAndExecute(idx) {
	const item = flatResults[idx];
	if (!item) return;

	try {
		await tiny.api.call("executeItem", { item });
	} catch (err) {
		console.error("Execute error:", err);
	}
}

// Keyboard navigation
searchInput.addEventListener("keydown", (e) => {
	if (e.key === "ArrowDown") {
		e.preventDefault();
		if (selectedIndex < flatResults.length - 1) {
			setSelectedIndex(selectedIndex + 1);
		} else {
			setSelectedIndex(0);
		}
	} else if (e.key === "ArrowUp") {
		e.preventDefault();
		if (selectedIndex > 0) {
			setSelectedIndex(selectedIndex - 1);
		} else {
			setSelectedIndex(flatResults.length - 1);
		}
	} else if (e.key === "Enter") {
		e.preventDefault();
		if (flatResults.length > 0) {
			selectAndExecute(selectedIndex);
		}
	} else if (e.key === "Escape") {
		e.preventDefault();
		if (searchInput.value) {
			searchInput.value = "";
			doSearch();
		} else {
			tiny.api.call("hideWindow");
		}
	}
});

searchInput.addEventListener("input", () => {
	clearTimeout(debounceTimeout);
	debounceTimeout = setTimeout(() => {
		doSearch();
	}, 50);
});

clearBtn.addEventListener("click", () => {
	searchInput.value = "";
	searchInput.focus();
	doSearch();
});

// Configure hotkey hint according to system
if (tiny.system.isMacOS()) {
	hotkeyHint.textContent = "Cmd+Space";
} else if (tiny.system.isWindows()) {
	hotkeyHint.textContent = "Ctrl+Shift+Space";
} else {
	hotkeyHint.textContent = "Ctrl+Space";
}

// Window focus handling
window.addEventListener("focus", () => {
	searchInput.focus();
	searchInput.select();
	tiny.api.call("centerWindow");
});

// Initialize theme & initial search
initTheme();
doSearch();
