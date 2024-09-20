import { App, Plugin, PluginSettingTab, Setting, WorkspaceSidedock, ButtonComponent, addIcon, TFile, WorkspaceLeaf } from 'obsidian';

interface AutoHideSettings {
	expandSidebar_onClickRibbon: boolean;
	expandSidebar_onClickNoteTitle: boolean;
	lockSidebar: boolean;
	leftPinActive: boolean;
	rightPinActive: boolean;
	homepagePath: string;
	collapseSidebar_onClickDataType: boolean;
}

const DEFAULT_SETTINGS: AutoHideSettings = {
	expandSidebar_onClickRibbon: false,
	expandSidebar_onClickNoteTitle: false,
	lockSidebar: false,
	leftPinActive: false,
	rightPinActive: false,
	homepagePath: "",
	collapseSidebar_onClickDataType: true,
}

// 在文件顶部或类外部定义这个常量
const COLLAPSIBLE_DATA_TYPES = ["surfing-view", "canvas", "excalidraw", "mindmapview", "excel-view", "vscode-editor", "code-editor"];

export default class AutoHidePlugin extends Plugin {
	settings: AutoHideSettings;
	leftSplit: WorkspaceSidedock;
	rightSplit: WorkspaceSidedock;
	rootSplitEl: HTMLElement;
	leftRibbonEl: HTMLElement;
	rightRibbonEl: HTMLElement;
	workspaceContainerEl: HTMLElement;

	async onload() {
		await this.loadSettings();

		this.addSettingTab(new AutoHideSettingTab(this.app, this));

		addIcon("oah-pin", `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-pin"><line x1="12" x2="12" y1="17" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/></svg>`);
		addIcon("oah-pin-off", `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-pin-off"><line x1="2" y1="2" x2="22" y2="22"/><line x1="12" y1="17" x2="12" y2="22"/><path d="M9 9v1.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17h14"/><path d="M15 9.34V6h1a2 2 0 0 0 0-4H7.89"/></svg>`);
		
		this.app.workspace.onLayoutReady(() => {
			this.init();
			this.registerEvents();
			this.togglePins();
		});
		// Reassigned when workspace is switched
		this.app.workspace.on("layout-change", () => {
			this.init();
			this.togglePins();
			this.addHomeIcon();
			// if (this.settings.leftPinActive) {
			// 	this.leftSplit.expand();
			// }
			// if (this.settings.rightPinActive) {
			// 	this.rightSplit.expand();
			// }
		});

		this.registerEvent(
			this.app.workspace.on('active-leaf-change', (leaf) => {
				if (leaf) {
					setTimeout(() => {
						this.handleLeafChange(leaf);
					}, 0);
				}
			})
		);
	}

	onunload() {
		this.removePins();
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	init() {
		this.leftSplit = this.app.workspace.leftSplit;
		this.rightSplit = this.app.workspace.rightSplit;
		this.workspaceContainerEl = (this.app.workspace as any).containerEl;
		this.rootSplitEl = (this.app.workspace.rootSplit as any).containerEl;
		this.leftRibbonEl = (this.app.workspace.leftRibbon as any).containerEl;
		this.rightRibbonEl = (this.app.workspace.rightRibbon as any).containerEl;
	}

	registerEvents() {
		this.registerDomEvent(this.app.workspace.containerEl, "focus", (evt) => {
			if (evt.target && (evt.target as HTMLElement).classList.contains("view-header-title")) {
				this.removeHomeIcon();
				return;
			}
		}, { capture: true });
		this.registerDomEvent(this.app.workspace.containerEl, "blur", (evt) => {
			if (evt.target && (evt.target as HTMLElement).classList.contains("view-header-title")) {
				setTimeout(() => {
					this.addHomeIcon();
				}, 200);
				return;
			}
		}, { capture: true });
		this.registerDomEvent(this.app.workspace.containerEl, "auxclick", (evt) => { // 右键在文件管理器中显示
			if (evt.target && (evt.target as HTMLElement).classList.contains("view-header-breadcrumb")) {
				evt.stopPropagation();
				evt.preventDefault();
				const dataPath = (evt.target as HTMLElement).dataset.path;
				const fileExplorer = (this.app as any).internalPlugins.getPluginById("file-explorer");
				if (fileExplorer && fileExplorer.enabled) {
					const file = this.app.vault.getAbstractFileByPath(dataPath as string);
					if (file) fileExplorer.instance.revealInFolder(file);
				}
			}
		}, { capture: true });
		this.registerDomEvent(this.app.workspace.containerEl, "click", (evt) => { // 阻止 folder note 弹出文件管理器
			if (evt.target && (evt.target as HTMLElement).classList.contains("view-header-breadcrumb") && (evt.target as HTMLElement).classList.contains("has-folder-note")) {
				evt.stopPropagation();
				evt.preventDefault();
				const dataPath = (evt.target as HTMLElement).dataset.path;
				const fileExtensions = [".md", ".canvas"];
				let file: TFile | null = null, targetLeaf;
				if (dataPath) {
					for (const ext of fileExtensions) {
						const newPath = `${dataPath}/${dataPath.split("/").pop()}${ext}`;
						const abstractFile = this.app.vault.getAbstractFileByPath(newPath);
						if (abstractFile instanceof TFile) {
							file = abstractFile;
							const leaves = this.app.workspace.getLeavesOfType(ext === ".md" ? "markdown" : "canvas");
							targetLeaf = leaves.find((leaf) => (leaf.view as any).file && (leaf.view as any).file.path === abstractFile.path);
							if (targetLeaf || file) break;
						}
					}
				}
				if (file && !evt.ctrlKey) {
					if (targetLeaf) {
						this.app.workspace.setActiveLeaf(targetLeaf);
					} else {
						this.app.workspace.getLeaf(false).openFile(file);
					}
				} else if (file && evt.ctrlKey) {
					if (targetLeaf) {
						this.app.workspace.setActiveLeaf(targetLeaf);
					} else {
						this.app.workspace.getLeaf(true).openFile(file);
					}
				}
				if (!this.settings.leftPinActive) {
					this.leftSplit.collapse();
				}
			}
			if (((evt.target as HTMLElement).closest(".contribution-widget, .mm-mindmap-container") !== null) && this.settings.collapseSidebar_onClickDataType) {
				if (!this.settings.leftPinActive) {
					this.leftSplit.collapse();
				}
				return;
			}
		}, { capture: true });


		// const isTabStacked = (element: HTMLElement) => {
		// 	const innerContainer = element.closest('.workspace-tab-header-container-inner');
		// 	const outerContainer = element.closest('.workspace-tab-container');

		// 	if (innerContainer) {
		// 		return false;
		// 	} else if (outerContainer) {
		// 		return true;
		// 	}
		// 	return false;
		// };
		// const isSplitScreen = (element: HTMLElement) => {
		// 	const rootSplit = element.closest('.workspace-split.mod-vertical.mod-root');
		// 	if (!rootSplit) {
		// 		return false;
		// 	}
		// 	const newTabButtons = rootSplit.querySelectorAll('.workspace-tab-header-new-tab');
		// 	return newTabButtons.length > 1;
		// };
		// const isModalOpen = (element: HTMLElement) => {
		// 	const root = element.closest('body') || document.documentElement;
		// 	const modal = root.querySelector('.modal');
		// 	return !!modal;
		// };


		const handleDataType = (dataType: string) => {
			if (COLLAPSIBLE_DATA_TYPES.includes(dataType) && this.settings.collapseSidebar_onClickDataType) {
				if (!this.settings.leftPinActive) {
					this.leftSplit.collapse();
				}
				this.rightSplit.collapse();
			}
		};
		const isTabStacked = (element: HTMLElement) => {
			const innerContainer = element.closest('.workspace-tab-header-container-inner');
			const outerContainer = element.closest('.workspace-tab-container');

			if (innerContainer) {
				return false;
			} else if (outerContainer) {
				return true;
			}
			return false;
		};
		const isSplitScreen = (element: HTMLElement) => {
			const rootSplit = element.closest('.workspace-split.mod-vertical.mod-root');
			if (!rootSplit) {
				return false;
			}
			const newTabButtons = rootSplit.querySelectorAll('.workspace-tab-header-new-tab');
			return newTabButtons.length > 1;
		};
		const isModalOpen = (element: HTMLElement) => {
			const root = element.closest('body') || document.documentElement;
			const modal = root.querySelector('.modal');
			return !!modal;
		};
		const startObserver = () => {
			observer.observe(this.workspaceContainerEl, config);
		};
		const observerCallback = (mutationsList: MutationRecord[], observer: MutationObserver) => {
			for (const mutation of mutationsList) {
				if (mutation.type === "attributes" && mutation.attributeName === "class") {
					const target = mutation.target;
					if (
						(target as HTMLElement).matches &&
						(target as HTMLElement).matches(".workspace-tab-header.is-active.mod-active") &&
						(target as HTMLElement).getAttribute
					) {
						// 检查面板是否处于分屏状态或堆叠状态
						if (isSplitScreen(target as HTMLElement) || isTabStacked(target as HTMLElement) || isModalOpen(target as HTMLElement)) {
							//this.rightSplit.collapse();
							return;
						}
						const dataType = (target as HTMLElement).getAttribute("data-type");
						if (dataType && COLLAPSIBLE_DATA_TYPES.includes(dataType)) {
							handleDataType(dataType);
						} else {
							this.rightSplit.expand();
						}
					}
				}
			}
		};
		const observer = new MutationObserver(observerCallback);
		const config = {
			attributes: true,
			attributeFilter: ["class"],
			subtree: true,
		};
		startObserver();

		this.registerDomEvent(this.app.workspace.containerEl, "click", (evt) => {
			if (!this.rootSplitEl.contains(evt.target as HTMLElement)) {
				return;
			}
			if ((evt.target as HTMLElement).closest(".workspace-tab-header-container") !== null) {
				return;
			}
			if ((evt.target as HTMLElement).classList.contains("cm-hashtag") || (evt.target as HTMLElement).classList.contains("tag")) {
				return;
			}
			if ((evt.target as HTMLElement).closest(".multi-select-pill-content") !== null) {
				return;
			}
			const preventsClassList = ["snw-reference"];
			if (preventsClassList.some((e) => (evt.target as HTMLElement).classList.contains(e))) {
				return;
			}
			if ((evt.target as HTMLElement).classList.contains("view-header-breadcrumb")) {
				return;
			}
			if ((evt.target as HTMLElement).classList.contains("homepage-button")) {
				const homepagePath = this.settings.homepagePath;
				const file = this.app.vault.getAbstractFileByPath(homepagePath);
				if (file instanceof TFile) {
					const leaves = this.app.workspace.getLeavesOfType("markdown");
					const existingLeaf = leaves.find(leaf => (leaf.view as any).file?.path === file.path);
					if (existingLeaf) {
						this.app.workspace.setActiveLeaf(existingLeaf);
					} else {
						this.app.workspace.openLinkText(file.path, "", true, { active: true });
					}
				}
				if (!this.settings.leftPinActive) {
					this.leftSplit.collapse();
				}
				return;
			}
			if ((evt.target as HTMLElement).classList.contains("view-header-title") && this.settings.expandSidebar_onClickNoteTitle) {
				if (this.leftSplit.collapsed == true)
					this.leftSplit.expand();
				return;
			}
			if (!this.settings.leftPinActive) {
				this.leftSplit.collapse();
			}
			// if (!this.settings.rightPinActive) {
			//   this.rightSplit.collapse();
			// }
		});

		this.registerDomEvent(this.leftRibbonEl, "click", (evt) => {
			if (this.settings.expandSidebar_onClickRibbon) {
				if (evt.target == this.leftRibbonEl) {
					if (this.leftSplit.collapsed == true)
						this.leftSplit.expand();
				}
			}
		});
		this.registerDomEvent(this.rightRibbonEl, "click", (evt) => {
			if (this.settings.expandSidebar_onClickRibbon) {
				if (evt.target == this.rightRibbonEl) {
					if (this.rightSplit.collapsed == true)
						this.rightSplit.expand();
				}
			}
		});
	}

	togglePins() {
		if (!this.settings.lockSidebar) {
			this.removePins();
			return;
		}
		if (document.getElementsByClassName("auto-hide-button").length == 0) {
			this.addPins();
		}
	}
	addHomeIcon() {
		const viewHeaderTitleParents = document.querySelectorAll('.view-header-title-parent');
		const homeButton = document.createElement('div');
		homeButton.textContent = 'HomePage';
		homeButton.classList.add('homepage-button');
		viewHeaderTitleParents.forEach((viewHeaderTitleParent) => {
			const parentElement = viewHeaderTitleParent.parentElement;
			if (parentElement && !parentElement.querySelector('.homepage-button')) {
				parentElement.insertBefore(homeButton.cloneNode(true), viewHeaderTitleParent);
			}
		});
	}
	removeHomeIcon() {
		const buttons = document.querySelectorAll('.homepage-button');
		buttons.forEach(button => {
			button.remove();
		});
	}
	addPins() {
		const tabHeaderContainers = document.getElementsByClassName("workspace-tab-header-container");
		const lb = new ButtonComponent(tabHeaderContainers[0] as HTMLElement)
			.setIcon(this.settings.leftPinActive ? "oah-pin-off" : "oah-pin")
			.setClass("auto-hide-button")
			.onClick(async () => {
				this.settings.leftPinActive = !this.settings.leftPinActive;
				await this.saveSettings();
				if (this.settings.leftPinActive) {
					lb.setIcon("oah-pin-off");
				} else {
					lb.setIcon("oah-pin");
				}
			});
		// const rb = new ButtonComponent(tabHeaderContainers[2] as HTMLElement)
		// .setIcon(this.settings.rightPinActive ? "oah-pin-off" : "oah-pin")
		// .setClass("auto-hide-button")
		// .onClick(async () => {
		// 	this.settings.rightPinActive = !this.settings.rightPinActive;
		// 	await this.saveSettings();
		// 	if (this.settings.rightPinActive) {
		// 		rb.setIcon("oah-pin-off");
		// 	} else {
		// 		rb.setIcon("oah-pin");
		// 	}
		// });
	}
	removePins() {
		const pins = document.getElementsByClassName("auto-hide-button");
		while (pins.length) {
			if (pins.item(0) != null) {
				pins[0].remove();
			}
		}
	}
}


class AutoHideSettingTab extends PluginSettingTab {
	plugin: AutoHidePlugin;

	constructor(app: App, plugin: AutoHidePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl('h2', { text: 'Settings for Auto Hide plugin.' });

		new Setting(containerEl)
			.setName('Expand the sidebar with a ribbon')
			.setDesc('Click on the blank area of ribbon to expand the sidebar.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.expandSidebar_onClickRibbon)
				.onChange(async (value) => {
					this.plugin.settings.expandSidebar_onClickRibbon = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Expand the sidebar with a note title')
			.setDesc('Click on the note title to expand the left sidebar.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.expandSidebar_onClickNoteTitle)
				.onChange(async (value) => {
					this.plugin.settings.expandSidebar_onClickNoteTitle = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Collapse sidebar on data type click')
			.setDesc('Fold the sidebar when clicking on External links, MarkMind, Components, etc.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.collapseSidebar_onClickDataType)
				.onChange(async (value) => {
					this.plugin.settings.collapseSidebar_onClickDataType = value;
					await this.plugin.saveSettings();
				}));

		containerEl.createEl('h4', { text: 'EXPERIMENTAL!' });

		new Setting(containerEl)
			.setName('Lock sidebar collapse')
			.setDesc('Add a pin that can temporarily lock the sidebar collapse.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.lockSidebar)
				.onChange(async (value) => {
					this.plugin.settings.lockSidebar = value;
					await this.plugin.saveSettings();
					this.plugin.togglePins();
				}));

		new Setting(containerEl)
		.setName('HomePage Path')
		.setDesc('Set the path of the HomePage file.')
		.addText(text => text
			.setPlaceholder('Enter the path of the homepage file')
			.setValue(this.plugin.settings.homepagePath)
			.onChange(async (value) => {
				this.plugin.settings.homepagePath = value;
				await this.plugin.saveSettings();
			}));
	}
}