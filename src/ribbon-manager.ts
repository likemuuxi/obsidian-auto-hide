import type { WorkspaceRibbon } from 'obsidian';
import type AutoHidePlugin from './main';

export default class RibbonManager {
	private ribbonMap: Map<string, HTMLElement> = new Map();
	private ribbonStyleElements: Record<string, HTMLStyleElement> = {};

	constructor(private plugin: AutoHidePlugin) {}

	updateRibbonButtons() {
		const { settings } = this.plugin;
		if (!settings) {
			return;
		}

		this.initializeVaultRibbonButtons();
		this.toggleRibbonButton('vault', settings.restoreVaultSwitcher);
		this.toggleRibbonButton('help', settings.restoreVaultActionsHelp);
		this.toggleRibbonButton('settings', settings.restoreVaultActionsSettings);
		this.applyVaultRibbonStyles();
	}

	cleanup() {
		this.ribbonMap.forEach((el) => el.detach());
		this.ribbonMap.clear();
		Object.values(this.ribbonStyleElements).forEach((el) => el.remove());
		this.ribbonStyleElements = {};
	}

	private initializeVaultRibbonButtons() {
		this.registerRibbonButton('vault', 'Switch vault', 'vault', () => this.plugin.app.openVaultChooser());
		this.registerRibbonButton('help', 'Help', 'help', () => this.plugin.app.openHelp());
		this.registerRibbonButton('settings', 'Settings', 'lucide-settings', () => this.plugin.app.setting.open());
	}

	private registerRibbonButton(id: string, tooltip: string, icon: string, onClick: () => void) {
		if (this.ribbonMap.has(id)) {
			return;
		}

		const leftRibbon = this.getWorkspaceRibbon();
		if (!leftRibbon) {
			return;
		}

		const button = leftRibbon.makeRibbonItemButton(icon, tooltip, (event: MouseEvent) => {
			event.stopPropagation();
			onClick();
		});

		this.ribbonMap.set(id, button);
	}

	private toggleRibbonButton(id: string, show: boolean) {
		const leftRibbon = this.getWorkspaceRibbon();
		const button = this.ribbonMap.get(id);

		if (!leftRibbon || !button) {
			return;
		}

		if (show) {
			if (!button.isConnected) {
				leftRibbon.ribbonSettingEl.appendChild(button);
			}
		} else {
			button.detach();
		}
	}

	private applyVaultRibbonStyles() {
		const { restoreVaultSwitcher, restoreVaultActionsHelp, restoreVaultActionsSettings } = this.plugin.settings;
		const allVisible = restoreVaultSwitcher && restoreVaultActionsHelp && restoreVaultActionsSettings;

		this.updateRibbonStyle('vault-profile', `
			body:not(.is-mobile) .workspace-split.mod-left-split .workspace-sidedock-vault-profile {
				display: ${allVisible ? 'none' : 'flex'};
			}
		`);

		this.updateRibbonStyle('vault-switcher', `
			body:not(.is-mobile) .workspace-split.mod-left-split .workspace-sidedock-vault-profile .workspace-drawer-vault-switcher {
				display: ${restoreVaultSwitcher ? 'none' : 'flex'};
			}
		`);

		this.updateRibbonStyle('vault-actions-help', `
			body:not(.is-mobile) .workspace-split.mod-left-split .workspace-sidedock-vault-profile .workspace-drawer-vault-actions .clickable-icon:has(svg.svg-icon.help) {
				display: ${restoreVaultActionsHelp ? 'none' : 'flex'};
			}
		`);

		this.updateRibbonStyle('vault-actions-settings', `
			body:not(.is-mobile) .workspace-split.mod-left-split .workspace-sidedock-vault-profile .workspace-drawer-vault-actions .clickable-icon:has(svg.svg-icon.lucide-settings) {
				display: ${restoreVaultActionsSettings ? 'none' : 'flex'};
			}
		`);
	}

	private updateRibbonStyle(id: string, css: string) {
		const elementId = `auto-hide-${id}`;
		let styleEl = this.ribbonStyleElements[id];

		if (!styleEl) {
			const existingEl = document.getElementById(elementId);
			if (existingEl && existingEl instanceof HTMLStyleElement) {
				styleEl = existingEl;
			} else {
				styleEl = document.createElement('style');
				styleEl.id = elementId;
				document.head.appendChild(styleEl);
			}
			this.ribbonStyleElements[id] = styleEl;
		}

		styleEl.textContent = css;
	}

	private getWorkspaceRibbon(): WorkspaceRibbon | null {
		const leftRibbon = this.plugin.app.workspace.leftRibbon;
		return leftRibbon ? (leftRibbon as WorkspaceRibbon) : null;
	}
}
