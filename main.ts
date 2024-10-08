import { App, Plugin, PluginSettingTab, Setting, WorkspaceSidedock, ButtonComponent, addIcon, TFile, Menu, TFolder } from 'obsidian';

interface AutoHideSettings {
	expandSidebar_onClickRibbon: boolean;
	expandSidebar_onClickNoteTitle: boolean;
	lockSidebar: boolean;
	leftPinActive: boolean;
	rightPinActive: boolean;
	homepagePath: string;
	collapseSidebar_onClickDataType: boolean;
	customDataTypes: string[];
}

const DEFAULT_SETTINGS: AutoHideSettings = {
	expandSidebar_onClickRibbon: true,
	expandSidebar_onClickNoteTitle: false,
	lockSidebar: false,
	leftPinActive: false,
	rightPinActive: false,
	homepagePath: "",
	collapseSidebar_onClickDataType: true,
	customDataTypes: ["surfing-view", "canvas", "excalidraw", "mindmapview", "excel-view", "vscode-editor", "code-editor"]
}

export default class AutoHidePlugin extends Plugin {
	settings: AutoHideSettings;
	leftSplit: WorkspaceSidedock;
	rightSplit: WorkspaceSidedock;
	rootSplitEl: HTMLElement;
	leftRibbonEl: HTMLElement;
	rightRibbonEl: HTMLElement;
	workspaceContainerEl: HTMLElement;
	private observer: MutationObserver;

	async onload() {
		await this.loadSettings();

		this.addSettingTab(new AutoHideSettingTab(this.app, this));

		addIcon("oah-pin", `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-pin"><line x1="12" x2="12" y1="17" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/></svg>`);
		addIcon("oah-pin-off", `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-pin-off"><line x1="2" y1="2" x2="22" y2="22"/><line x1="12" y1="17" x2="12" y2="22"/><path d="M9 9v1.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17h14"/><path d="M15 9.34V6h1a2 2 0 0 0 0-4H7.89"/></svg>`);

		this.app.workspace.onLayoutReady(() => {
			this.init();
			this.togglePins();

			this.registerEvents();
			this.observer = new MutationObserver(this.observerCallback.bind(this));
			this.startObserver();
		});
		// Reassigned when workspace is switched
		this.app.workspace.on("layout-change", () => {
			this.init();
			this.togglePins();
			this.addHomeIcon();
			this.handleLayoutChange();
			// if (this.settings.leftPinActive) {
			// 	this.leftSplit.expand();
			// }
			// if (this.settings.rightPinActive) {
			// 	this.rightSplit.expand();
			// }
		});
	}

	onunload() {
		this.removePins();
		this.observer.disconnect();
		this.app.workspace.off("layout-change", this.handleLayoutChange);
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

	private handleLayoutChange = () => {
		// 获取当前活动的标签页
		const activeTab = this.workspaceContainerEl.querySelector('.workspace-tab-header.is-active.mod-active') as HTMLElement;
		const dataType = activeTab.getAttribute("data-type");

		if (activeTab) {
			// 检查面板是否处于分屏状态或堆叠状态
			if (this.isSplitScreen(activeTab) || this.isTabStacked(activeTab) || this.isModalOpen(activeTab)) {
				return;
			}

			if (dataType && this.settings.customDataTypes.includes(dataType)) {
				this.handleDataType(dataType);
			} else {
				if (this.rightSplit.collapsed == true)
					this.rightSplit.expand();
			}
		}
	};

	private handleDataType = (dataType: string) => {
		if (this.settings.customDataTypes.includes(dataType) && this.settings.collapseSidebar_onClickDataType) {
			if (!this.settings.leftPinActive) {
				this.leftSplit.collapse();
			}
			this.rightSplit.collapse();
		}
	};

	private isTabStacked = (element: HTMLElement) => {
		const innerContainer = element.closest('.workspace-tab-header-container-inner');
		const outerContainer = element.closest('.workspace-tab-container');

		if (innerContainer) {
			return false;
		} else if (outerContainer) {
			return true;
		}
		return false;
	};
	private isSplitScreen = (element: HTMLElement) => {
		const rootSplit = element.closest('.workspace-split.mod-vertical.mod-root');
		if (!rootSplit) {
			return false;
		}
		const newTabButtons = rootSplit.querySelectorAll('.workspace-tab-header-new-tab');
		return newTabButtons.length > 1;
	};
	private isModalOpen = (element: HTMLElement) => {
		const root = element.closest('body') || document.documentElement;
		const modal = root.querySelector('.modal');
		return !!modal;
	};


	private startObserver() {
		const config = {
			attributes: true,
			attributeFilter: ["class"],
			subtree: true,
		};
		this.observer.observe(this.workspaceContainerEl, config);
	}

	private observerCallback = (mutationsList: MutationRecord[], observer: MutationObserver) => {
		for (const mutation of mutationsList) {
			if (mutation.type === "attributes" && mutation.attributeName === "class") {
				const target = mutation.target as HTMLElement;
				const dataType = target.getAttribute("data-type");
				if (target.matches(".workspace-tab-header.is-active.mod-active")) {
					// 检查面板是否处于分屏状态或堆叠状态
					if (this.isSplitScreen(target) || this.isTabStacked(target) || this.isModalOpen(target)) {
						//this.rightSplit.collapse();
						return;
					}
					if (dataType && this.settings.customDataTypes.includes(dataType)) {
						this.handleDataType(dataType);
					} else {
						const isLeftSidebar = target.closest('.mod-top-left-space') !== null;
						if (this.rightSplit.collapsed && !isLeftSidebar) {
							this.rightSplit.expand();
						}
					}
				}
			}
		}
	};

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
		// 右键点击显示菜单
		this.registerDomEvent(this.app.workspace.containerEl, "contextmenu", (evt) => { 
			if (evt.target && (evt.target as HTMLElement).classList.contains("view-header-breadcrumb")) {
				evt.stopPropagation();
				evt.preventDefault();

				const target = evt.target as HTMLElement;
				const x = evt.clientX;
				const y = evt.clientY;

				// 调用已有的 showBreadcrumbMenu 函数显示菜单
				const folderNote = (this as any).app.plugins.enabledPlugins.has("folder-notes");
				if(folderNote) {
					this.showBreadcrumbMenu(target, x, y);
				}
			}
		}, { capture: true });
		// 双击触发在文件管理器中显示文件
		this.registerDomEvent(this.app.workspace.containerEl, "dblclick", (evt) => {
			if (evt.target && (evt.target as HTMLElement).classList.contains("view-header-breadcrumb")) {
				evt.stopPropagation();
				evt.preventDefault();

				const dataPath = (evt.target as HTMLElement).dataset.path;
				const fileExplorer = (this.app as any).internalPlugins.getPluginById("file-explorer");

				if (fileExplorer && fileExplorer.enabled) {
					const file = this.app.vault.getAbstractFileByPath(dataPath as string);
					if (file) {
						fileExplorer.instance.revealInFolder(file);
					}
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
						// const newPath = `${dataPath}${ext}`;
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
			if (((evt.target as HTMLElement).closest(".components--Component") !== null) && this.settings.collapseSidebar_onClickDataType) {
				if (!this.settings.leftPinActive) {
					this.leftSplit.collapse();
					return;
				}
				return;
			}
		}, { capture: true });

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
						this.app.workspace.openLinkText(file.path, "", false, { active: true });
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
	
		viewHeaderTitleParents.forEach((viewHeaderTitleParent) => {
			const parentElement = viewHeaderTitleParent.parentElement;
			if (parentElement && !parentElement.querySelector('.homepage-button')) {
				const homeButton = document.createElement('div');
				homeButton.textContent = 'HomePage';
				homeButton.classList.add('homepage-button');
				parentElement.insertBefore(homeButton, viewHeaderTitleParent);
			}
		});
	}
	

	private currentMenu: Menu | null = null;

	private findFileInFolder(folder: string, parentPath: string): { file: TFile | null, targetLeaf: any } {
		const fileExtensions = [".md", ".canvas"];
		let file: TFile | null = null, targetLeaf;
	
		// 处理路径构造
		for (const ext of fileExtensions) {
			// 如果 parentPath 为空，则只使用 folder，避免在路径前添加 /
			const newPath = parentPath ? `${parentPath}/${folder}/${folder}${ext}` : `${folder}/${folder}${ext}`;

			const abstractFile = this.app.vault.getAbstractFileByPath(newPath);
			if (abstractFile instanceof TFile) {
				file = abstractFile;
				const leaves = this.app.workspace.getLeavesOfType(ext === ".md" ? "markdown" : "canvas");
				targetLeaf = leaves.find((leaf) => (leaf.view as any).file && (leaf.view as any).file.path === abstractFile.path);
				if (targetLeaf || file) break;
			}
		}
		return { file, targetLeaf };
	}

	private showBreadcrumbMenu(target: HTMLElement, x: number, y: number) {
		if (this.currentMenu) {
			this.currentMenu.hide();
		}
		// 获取data-path并解析出父文件夹路径
		const dataPath = target.dataset.path as string;
		const parentPath = dataPath.split('/').slice(0, -1).join('/'); // 获取父文件夹路径
		const siblingFolders = this.getSiblingFolders(parentPath); // 获取同级文件夹
		const menu = new Menu();
		
		// 添加同级文件夹作为菜单项
		siblingFolders.forEach(folder => {
			menu.addItem(item => {
				item.setTitle(folder)
					.onClick((e) => {
						// 传递正确的 parentPath
						const { file, targetLeaf } = this.findFileInFolder(folder, parentPath);
						if (file) {
							if (e.ctrlKey) {
								this.app.workspace.openLinkText(file.path, "", true, { active: true });
							} else {
								if (targetLeaf) {
									this.app.workspace.setActiveLeaf(targetLeaf);
								} else {
									this.app.workspace.openLinkText(file.path, "", false, { active: true });
								}
							}
						}
					});
			});
		});
	
		// 显示菜单
		menu.showAtPosition({ x, y });
		this.currentMenu = menu;
	
		// 点击页面其他地方时隐藏菜单栏
		document.addEventListener('click', this.hideCurrentMenu, { capture: true });
	}
	
	private getSiblingFolders(parentPath: string): string[] {
		// 获取所有加载的文件
		const allFiles = this.app.vault.getAllLoadedFiles();
		const siblingFolders: string[] = [];
	
		// 遍历所有文件，找到同级文件夹
		allFiles.forEach(file => {
			// 确保文件是文件夹并且路径与父文件夹路径相同
			if (file instanceof TFolder) {
				const folderPath = file.path;
				const parentFolderPath = folderPath.split('/').slice(0, -1).join('/');
	
				// 检查是否与目标父文件夹路径相同
				if (parentFolderPath === parentPath) {
					// 检查该文件夹中是否存在同名文件
					const hasSameNameFile = allFiles.some((f) => 
						f instanceof TFile && f.path === `${folderPath}/${file.name}.md` || 
						f.path === `${folderPath}/${file.name}.canvas`
					);
	
					// 只有在文件夹中存在同名文件时，才添加到菜单中
					if (hasSameNameFile) {
						siblingFolders.push(file.name); // 添加到同级文件夹数组
					}
				}
			}
		});

		// 按照名称排序
		siblingFolders.sort((a, b) => a.localeCompare(b));
		return siblingFolders; // 返回同级文件夹名称数组
	}	
	

	private hideCurrentMenu = (event: MouseEvent) => {
		if (this.currentMenu) {
			this.currentMenu.hide();
			this.currentMenu = null;
			document.removeEventListener('click', this.hideCurrentMenu, { capture: true });
		}
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
		containerEl.classList.add('auto-hide-plugin-settings');

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
			.setName('Lock sidebar collapse')
			.setDesc('Add a pin that can temporarily lock the sidebar collapse.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.lockSidebar)
				.onChange(async (value) => {
					this.plugin.settings.lockSidebar = value;
					await this.plugin.saveSettings();
					this.plugin.togglePins();
				}));

		new Setting(containerEl).setName('Advanced').setHeading();

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

		new Setting(containerEl)
			.setName('Collapse sidebar on data type click')
			.setDesc('Fold the sidebar when clicking on External links, MarkMind, Components, etc.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.collapseSidebar_onClickDataType)
				.onChange(async (value) => {
					this.plugin.settings.collapseSidebar_onClickDataType = value;
					await this.plugin.saveSettings();
					this.display(); // 重新渲染设置页面
				}));

		if (this.plugin.settings.collapseSidebar_onClickDataType) {
			new Setting(containerEl)
				.setName('Custom data types')
				.setDesc('Add custom foldable view types, one per line. When monitoring, hide all sidebars.')
				.addTextArea(text => text
					.setPlaceholder('Enter custom type')
					.setValue(this.plugin.settings.customDataTypes.join('\n'))
					.onChange(async (value) => {
						this.plugin.settings.customDataTypes = value.split('\n').filter(t => t.trim() !== '');
						await this.plugin.saveSettings();
					}));
		}
	}
}