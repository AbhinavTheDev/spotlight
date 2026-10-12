// Centralized Quick Action & Windows Start Menu Search Pipeline
// Windows Fluent / Modern UI Adapted Desktop Search with Native Icons

const SCAN_TIMEOUT_MS = 25_000; // Kill PowerShell after 25s if hung
const CACHE_FILE = `${tjs.env.LOCALAPPDATA || tjs.env.APPDATA || tjs.env.TEMP || "."}/spotlight-apps-cache.json`;

// Self-contained PowerShell script executed via -EncodedCommand (Base64 UTF-16LE).
// Zero external file dependency, works identically in development and native builds.
const PS_APP_SCAN_SCRIPT = `
Add-Type -AssemblyName System.Drawing
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function Extract-FileIconBase64($filePath) {
    try {
        $icon = [System.Drawing.Icon]::ExtractAssociatedIcon($filePath)
        if ($icon) {
            $bmp = $icon.ToBitmap()
            $ms = New-Object System.IO.MemoryStream
            $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
            $b64 = [Convert]::ToBase64String($ms.ToArray())
            $ms.Dispose(); $bmp.Dispose(); $icon.Dispose()
            return $b64
        }
    } catch {}
    return $null
}

$dirs = @(
  'C:\\ProgramData\\Microsoft\\Windows\\Start Menu\\Programs',
  [System.IO.Path]::Combine($env:APPDATA, 'Microsoft\\Windows\\Start Menu\\Programs')
)
$lnks = Get-ChildItem -Path $dirs -Recurse -Filter *.lnk -ErrorAction SilentlyContinue
$lnkMap = @{}
foreach ($l in $lnks) {
    $k = $l.BaseName.Trim().ToLower()
    if (-not $lnkMap.ContainsKey($k)) { $lnkMap[$k] = $l.FullName }
}

$apps = Get-StartApps
$results = @()
foreach ($a in $apps) {
    $targetPath = $null
    $icon = $null
    if ($a.AppID -match '\\.exe$' -or $a.AppID -match '\\.msc$') {
        $targetPath = $a.AppID
    } else {
        $k = $a.Name.Trim().ToLower()
        if ($lnkMap.ContainsKey($k)) { $targetPath = $lnkMap[$k] }
    }
    if ($targetPath -and (Test-Path $targetPath -ErrorAction SilentlyContinue)) {
        $icon = Extract-FileIconBase64 $targetPath
    }
    $results += [PSCustomObject]@{
        Name = $a.Name
        AppID = $a.AppID
        Path = $targetPath
        Icon = $icon
    }
}

$results | ConvertTo-Json -Compress
`;

// Helper: Convert string to UTF-16LE Base64 for PowerShell -EncodedCommand
function toUtf16LeBase64(str) {
	const bytes = new Uint8Array(str.length * 2);
	for (let i = 0; i < str.length; i++) {
		const code = str.charCodeAt(i);
		bytes[i * 2] = code & 0xff;
		bytes[i * 2 + 1] = (code >> 8) & 0xff;
	}
	let binary = "";
	for (let i = 0; i < bytes.length; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary);
}

const ENCODED_PS_SCRIPT = toUtf16LeBase64(PS_APP_SCAN_SCRIPT);

class AppScanner {
	constructor() {
		this.apps = [];
		this.bootScanPromise = null;
		this.bootScanCompleted = false;

		// Load persistent disk cache immediately on startup
		this.loadDiskCache();
	}

	async loadDiskCache() {
		try {
			const content = await tjs.readFile(CACHE_FILE);
			if (content && content.length > 0) {
				const list = JSON.parse(new TextDecoder().decode(content));
				if (Array.isArray(list) && list.length > 0) {
					this.apps = list;
					console.log(
						`AppScanner: Loaded ${this.apps.length} applications from disk cache`,
					);
				}
			}
		} catch (_) {
			// First boot; cache file does not exist yet
		}
	}

	async saveDiskCache() {
		try {
			if (this.apps.length > 0) {
				await tjs.writeFile(CACHE_FILE, JSON.stringify(this.apps));
			}
		} catch (e) {
			console.warn("AppScanner: Failed to save disk cache:", e);
		}
	}

	// Runs strictly ONCE at boot time — never spawned on searches or user actions
	async scanOnceAtBoot() {
		if (this.bootScanCompleted) return this.apps;
		if (this.bootScanPromise) return this.bootScanPromise;

		this.bootScanPromise = this._doScan();
		try {
			return await this.bootScanPromise;
		} finally {
			this.bootScanPromise = null;
		}
	}

	async _doScan() {
		let proc = null;
		let killTimer = null;

		try {
			console.log("AppScanner: Starting single boot-time application scan...");
			proc = tjs.spawn(
				[
					"powershell",
					"-NoProfile",
					"-NonInteractive",
					"-ExecutionPolicy",
					"Bypass",
					"-EncodedCommand",
					ENCODED_PS_SCRIPT,
				],
				{ stdout: "pipe", stderr: "ignore" },
			);

			killTimer = setTimeout(() => {
				try {
					proc.kill("SIGKILL");
				} catch {}
				console.error(
					"AppScanner: PowerShell boot scan timed out, process terminated",
				);
			}, SCAN_TIMEOUT_MS);

			const chunks = [];
			const reader = proc.stdout.getReader();
			while (true) {
				const { value, done } = await reader.read();
				if (done) break;
				if (value) chunks.push(value);
			}

			const status = await proc.wait();
			clearTimeout(killTimer);
			killTimer = null;

			if (status.exit_status !== 0) {
				console.error(
					`AppScanner: PowerShell exited with code ${status.exit_status}`,
				);
				return this.apps;
			}

			const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
			const merged = new Uint8Array(totalLength);
			let offset = 0;
			for (const chunk of chunks) {
				merged.set(chunk, offset);
				offset += chunk.length;
			}

			const jsonStr = new TextDecoder().decode(merged).trim();
			if (jsonStr) {
				const rawApps = JSON.parse(jsonStr);
				const list = Array.isArray(rawApps) ? rawApps : [rawApps];

				this.apps = list
					.filter((a) => a?.Name && a.AppID)
					.map((a) => {
						const name = a.Name.trim();
						const appId = a.AppID.trim();
						const isUwp = appId.includes("!") || appId.includes("_");
						const isExe =
							appId.toLowerCase().endsWith(".exe") ||
							appId.toLowerCase().endsWith(".msc");

						return {
							id: `app:${appId}`,
							type: "app",
							title: name,
							subtitle: isUwp ? "Windows App" : isExe ? appId : "Application",
							appId: appId,
							path: a.Path || null,
							icon: a.Icon ? `data:image/png;base64,${a.Icon}` : null,
							category: "Applications",
						};
					});

				this.bootScanCompleted = true;
				console.log(
					`AppScanner: Boot scan completed. Indexed ${this.apps.length} applications.`,
				);
				await this.saveDiskCache();
			}
		} catch (err) {
			console.error("AppScanner boot scan error:", err);
		} finally {
			if (killTimer) clearTimeout(killTimer);
		}

		return this.apps;
	}

	// 100% In-memory search: NEVER executes PowerShell
	search(query) {
		const q = query.trim().toLowerCase();
		if (!q) return [];

		const prefixMatches = [];
		const containsMatches = [];

		for (const app of this.apps) {
			const name = app.title.toLowerCase();
			if (name.startsWith(q)) {
				prefixMatches.push(app);
			} else if (name.includes(q) || app.subtitle.toLowerCase().includes(q)) {
				containsMatches.push(app);
			}
		}

		return [...prefixMatches, ...containsMatches];
	}

	// 100% In-memory top apps: NEVER executes PowerShell
	getTopApps(count = 8) {
		return this.apps.slice(0, count);
	}

	async launch(appId, path) {
		try {
			if (
				path &&
				(path.toLowerCase().endsWith(".lnk") ||
					path.toLowerCase().endsWith(".exe") ||
					path.toLowerCase().endsWith(".msc"))
			) {
				tjs.spawn(["cmd.exe", "/c", "start", '""', path], {
					stdout: "ignore",
					stderr: "ignore",
				});
				return { success: true };
			}

			if (
				appId.toLowerCase().endsWith(".exe") ||
				appId.toLowerCase().endsWith(".msc")
			) {
				tjs.spawn(["cmd.exe", "/c", "start", '""', appId], {
					stdout: "ignore",
					stderr: "ignore",
				});
				return { success: true };
			}

			tjs.spawn(["explorer.exe", `shell:AppsFolder\\${appId}`], {
				stdout: "ignore",
				stderr: "ignore",
			});
			return { success: true };
		} catch (err) {
			console.error("Launch error:", err);
			return { success: false, error: err.message };
		}
	}
}

// Quick Actions Engine (Math, Units, Web Search, System Commands)
class QuickActionEngine {
	constructor() {
		this.systemCommands = [
			{
				id: "sys:lock",
				title: "Lock",
				subtitle: "Lock this PC",
				cmd: ["rundll32.exe", "user32.dll,LockWorkStation"],
				icon: "lock",
				keywords: [
					"lock",
					"lock screen",
					"lockscreen",
					"lock computer",
					"lock pc",
					"session",
					"workstation",
				],
			},
			{
				id: "sys:sleep",
				title: "Sleep",
				subtitle: "Put PC to sleep",
				cmd: [
					"powershell.exe",
					"-WindowStyle",
					"Hidden",
					"-NoProfile",
					"-Command",
					"Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Application]::SetSuspendState([System.Windows.Forms.PowerState]::Suspend, $false, $false)",
				],
				icon: "moon",
				keywords: ["sleep", "standby", "suspend"],
			},
			{
				id: "sys:restart",
				title: "Restart",
				subtitle: "Restart PC",
				cmd: ["shutdown.exe", "/r", "/t", "0"],
				icon: "restart",
				keywords: ["restart", "reboot", "reset"],
			},
			{
				id: "sys:shutdown",
				title: "Shut Down",
				subtitle: "Shut down PC",
				cmd: ["shutdown.exe", "/s", "/t", "0"],
				icon: "shut",
				keywords: [
					"shutdown",
					"shut down",
					"power off",
					"poweroff",
					"turn off",
				],
			},
		];
	}

	search(query) {
		const q = query.trim();
		if (!q) return [];

		const actions = [];

		// 1. Math Calculation
		const calcResult = this.tryCalculate(q);
		if (calcResult) {
			actions.push(calcResult);
		}

		// 2. Unit Conversion
		const convResult = this.tryConvert(q);
		if (convResult) {
			actions.push(convResult);
		}

		// 3. System Commands match
		const lowerQ = q.toLowerCase();
		const compactQ = lowerQ.replace(/[\s\-_]+/g, "");
		for (const cmd of this.systemCommands) {
			const titleLower = cmd.title.toLowerCase();
			const compactTitle = titleLower.replace(/[\s\-_]+/g, "");
			const keywords = cmd.keywords || [];

			const matches =
				titleLower.startsWith(lowerQ) ||
				titleLower.includes(lowerQ) ||
				(compactQ.length >= 2 && compactTitle.includes(compactQ)) ||
				keywords.some((k) => {
					const kLower = k.toLowerCase();
					const compactK = kLower.replace(/[\s\-_]+/g, "");
					return (
						kLower.startsWith(lowerQ) ||
						kLower.includes(lowerQ) ||
						(compactQ.length >= 2 && compactK.includes(compactQ))
					);
				});

			if (matches) {
				actions.push({
					id: cmd.id,
					type: "system",
					title: cmd.title,
					subtitle: cmd.subtitle,
					cmd: cmd.cmd,
					category: "Quick Actions",
					iconType: cmd.icon,
				});
			}
		}

		// 4. Web Search fallback
		if (q.length > 0) {
			actions.push({
				id: "web:search",
				type: "web",
				title: `Search Web for "${q}"`,
				subtitle: "Open in default browser",
				url: `https://www.google.com/search?q=${encodeURIComponent(q)}`,
				category: "Web Search",
				iconType: "globe",
			});
		}

		return actions;
	}

	tryCalculate(expr) {
		const clean = expr.trim();
		if (!/^[\d\s+\-*/().^%]+$/.test(clean) || !/\d/.test(clean)) {
			return null;
		}

		if (!/[+\-*/^%]/.test(clean)) return null;

		try {
			const sanitized = clean
				.replace(/\^/g, "**")
				.replace(/×/g, "*")
				.replace(/÷/g, "/");

			const res = new Function(`return (${sanitized});`)();
			if (
				typeof res === "number" &&
				!Number.isNaN(res) &&
				Number.isFinite(res)
			) {
				const formatted = Number.isInteger(res)
					? res.toString()
					: res.toFixed(6).replace(/\.?0+$/, "");
				return {
					id: `calc:${formatted}`,
					type: "calc",
					title: formatted,
					subtitle: `= ${clean}`,
					copyValue: formatted,
					category: "Calculator",
					iconType: "calc",
				};
			}
		} catch (_e) {}
		return null;
	}

	tryConvert(query) {
		const match = query.match(
			/^([\d.]+)\s*([a-zA-Z°]+)\s*(?:to|in|as)\s*([a-zA-Z°]+)$/i,
		);
		if (!match) return null;

		const val = parseFloat(match[1]);
		const fromUnit = match[2].toLowerCase();
		const toUnit = match[3].toLowerCase();

		// Length
		const length = {
			m: 1,
			km: 1000,
			cm: 0.01,
			mm: 0.001,
			ft: 0.3048,
			in: 0.0254,
			mi: 1609.344,
			yd: 0.9144,
		};

		if (length[fromUnit] && length[toUnit]) {
			const inMeters = val * length[fromUnit];
			const result = inMeters / length[toUnit];
			const fmt = this.formatNumber(result);
			return {
				id: `unit:${fmt}`,
				type: "unit",
				title: `${fmt} ${toUnit}`,
				subtitle: `${val} ${fromUnit} = ${fmt} ${toUnit}`,
				copyValue: fmt,
				category: "Conversion",
				iconType: "unit",
			};
		}

		// Weight
		const weight = {
			kg: 1,
			g: 0.001,
			mg: 0.000001,
			lb: 0.45359237,
			lbs: 0.45359237,
			oz: 0.0283495,
		};

		if (weight[fromUnit] && weight[toUnit]) {
			const inKg = val * weight[fromUnit];
			const result = inKg / weight[toUnit];
			const fmt = this.formatNumber(result);
			return {
				id: `unit:${fmt}`,
				type: "unit",
				title: `${fmt} ${toUnit}`,
				subtitle: `${val} ${fromUnit} = ${fmt} ${toUnit}`,
				copyValue: fmt,
				category: "Conversion",
				iconType: "unit",
			};
		}

		// Temperature
		if (
			["c", "f", "k"].includes(fromUnit) &&
			["c", "f", "k"].includes(toUnit)
		) {
			let c = val;
			if (fromUnit === "f") c = (val - 32) * (5 / 9);
			if (fromUnit === "k") c = val - 273.15;

			let res = c;
			if (toUnit === "f") res = c * (9 / 5) + 32;
			if (toUnit === "k") res = c + 273.15;

			const fmt = this.formatNumber(res);
			return {
				id: `unit:${fmt}`,
				type: "unit",
				title: `${fmt} °${toUnit.toUpperCase()}`,
				subtitle: `${val}°${fromUnit.toUpperCase()} = ${fmt}°${toUnit.toUpperCase()}`,
				copyValue: fmt,
				category: "Conversion",
				iconType: "unit",
			};
		}

		return null;
	}

	formatNumber(n) {
		if (Number.isInteger(n)) return n.toString();
		return parseFloat(n.toFixed(4)).toString();
	}

	async execute(action, app) {
		if (action.type === "web" && action.url) {
			await app.shell.open(action.url);
			return { success: true };
		}

		if (action.type === "system" && action.cmd) {
			try {
				tjs.spawn(action.cmd, { stdout: "ignore", stderr: "ignore" });
			} catch (err) {
				console.error("System command execution error:", err);
			}
			return { success: true };
		}

		if (
			(action.type === "calc" ||
				action.type === "unit" ||
				action.type === "currency") &&
			action.copyValue
		) {
			await app.clipboard.write({ text: action.copyValue });
			return { success: true, copied: true };
		}

		return { success: true };
	}
}

// Module instances
const appScanner = new AppScanner();
const quickActionEngine = new QuickActionEngine();

let mainWindow = null;
let isVisible = false;
let globalApp = null;

// Backend API exposed to tinyjs frontend
export const api = {
	async search({ query = "" }) {
		const q = query.trim();
		if (!q) {
			const topApps = appScanner.getTopApps(6);
			return {
				results: [
					{
						category: "Quick Actions",
						items: quickActionEngine.systemCommands.map((cmd) => ({
							id: cmd.id,
							type: "system",
							title: cmd.title,
							subtitle: cmd.subtitle,
							cmd: cmd.cmd,
							category: "Quick Actions",
							iconType: cmd.icon,
						})),
					},
					{
						category: "Top Applications",
						items: topApps,
					},
				],
			};
		}

		const appResults = appScanner.search(q);
		const actionResults = quickActionEngine.search(q);

		const categories = [];

		const topMathAndUnits = actionResults.filter(
			(a) => a.type === "calc" || a.type === "unit",
		);
		const systemQuickActions = actionResults.filter((a) => a.type === "system");
		const webActions = actionResults.filter((a) => a.type === "web");

		// 1. Calculations & conversions always first if evaluated
		if (topMathAndUnits.length > 0) {
			categories.push({
				category: topMathAndUnits[0].category,
				items: topMathAndUnits,
			});
		}

		// 2. Concise Quick Actions (System Commands) matched by query
		if (systemQuickActions.length > 0) {
			categories.push({
				category: "Quick Actions",
				items: systemQuickActions,
			});
		}

		// 3. Applications
		if (appResults.length > 0) {
			categories.push({
				category: "Applications",
				items: appResults.slice(0, 8),
			});
		}

		// 4. Web Search fallback
		if (webActions.length > 0) {
			categories.push({
				category: "Web Search",
				items: webActions,
			});
		}

		return { results: categories };
	},

	async executeItem({ item }) {
		if (!item) return { success: false };

		try {
			if (item.type === "app" && item.appId) {
				await appScanner.launch(item.appId, item.path);
				await hideMainWindowInternal();
				return { success: true };
			}

			await quickActionEngine.execute(item, globalApp);
			await hideMainWindowInternal();
			return { success: true };
		} catch (err) {
			console.error("executeItem error:", err);
			return { success: false, error: err.message };
		}
	},

	async toggleWindow() {
		if (isVisible) {
			await hideMainWindowInternal();
		} else {
			await showMainWindowInternal();
		}
		return { visible: isVisible };
	},

	async hideWindow() {
		await hideMainWindowInternal();
		return { visible: false };
	},

	async centerWindow() {
		if (globalApp && mainWindow) {
			const win = globalApp.window(mainWindow.id);
			await win.center();
		}
		return { success: true };
	},
};

async function showMainWindowInternal() {
	const windows = await globalApp.windows();
	if (windows.length > 0) {
		const win = globalApp.window(windows[0]);
		await win.center();
		await win.show({ activate: true });
		mainWindow = { id: windows[0] };
	} else {
		const winId = "spotlight";
		globalApp.openWindow(winId, {
			page: "index.html",
			size: "720x460",
			chrome: {
				frame: false,
				transparent: true,
				vibrancy: "under-window",
				windowControls: false,
				squareCorners: false,
				acceptsFirstMouse: true,
				menu: false,
			},
			placement: "center",
		});
		mainWindow = { id: winId };
	}
	isVisible = true;
}

async function hideMainWindowInternal() {
	if (mainWindow) {
		const win = globalApp.window(mainWindow.id);
		await win.hide();
		isVisible = false;
	}
}

// Hotkey handler (export for tinyjs)
export async function onHotkey(_info, _app) {
	try {
		await api.toggleWindow();
	} catch (error) {
		console.error("Error toggling window:", error);
	}
}

// Window closed handler
export function onWindowClosed(windowId, _app) {
	if (windowId === mainWindow?.id) {
		mainWindow = null;
		isVisible = false;
	}
}

// Backend initialization
export function init(app) {
	globalApp = app;

	// Run the application scan ONCE at boot in the background
	appScanner
		.scanOnceAtBoot()
		.catch((err) => console.error("Boot scan error:", err));

	setTimeout(async () => {
		try {
			const windows = await app.windows();
			if (windows.length === 0) {
				await showMainWindowInternal();
			}
		} catch (_e) {}
	}, 400);

	const isWindows = tjs.env && tjs.env.OS === "Windows_NT";
	const isMacOS =
		globalThis.navigator &&
		/mac|darwin/i.test(globalThis.navigator.platform || "");
	const hotkey = isWindows
		? "ctrl+shift+space"
		: isMacOS
			? "cmd+space"
			: "ctrl+space";

	try {
		app.hotkey.register("toggleSpotlight", hotkey);
		console.log(`Registered Spotlight hotkey: ${hotkey}`);
	} catch (e) {
		console.error("Failed to register hotkey:", e);
	}
}
