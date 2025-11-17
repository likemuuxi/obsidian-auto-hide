import { Plugin, WorkspaceSidedock, WorkspaceLeaf, ButtonComponent, addIcon, TFile, Menu, TFolder, Platform, MarkdownView, Editor } from 'obsidian';
import AutoHideSettingTab from './setting-tab';
import { AutoHideSettings, DEFAULT_SETTINGS } from './settings';
import { cleanMarkdownFormatting } from './markdown-utils';
import RibbonManager from './ribbon-manager';

declare module 'obsidian' {
	interface WorkspaceRibbon {
		ribbonSettingEl: HTMLElement;
		makeRibbonItemButton(icon: string, tooltip: string, onClick: (e: MouseEvent) => void): HTMLElement;
	}

	interface App {
		setting: {
			open: () => void;
		};

		openVaultChooser(): void;
		openHelp(): void;
	}
}

export default class AutoHidePlugin extends Plugin {
	settings: AutoHideSettings;
	leftSplit: WorkspaceSidedock;
	rightSplit: WorkspaceSidedock;
	rootSplitEl: HTMLElement;
	leftRibbonEl: HTMLElement;
	rightRibbonEl: HTMLElement;
	workspaceContainerEl: HTMLElement;
	private clickListener: (event: MouseEvent) => void;
    private observer: MutationObserver | null = null;
    private leftPinButton: ButtonComponent | null = null;
    private currentMenu: Menu | null = null;
	private menuOpenTimer: NodeJS.Timeout | null = null;
    private menuCloseTimer: NodeJS.Timeout | null = null;
    private isMouseOverMenu = false;
    private layoutChangeHandler: (() => void) | null = null;
	private ribbonManager: RibbonManager | null = null;

	// ===== Lifecycle & Settings =====
	async onload() {
		await this.loadSettings();
		this.ribbonManager = new RibbonManager(this);

		this.addSettingTab(new AutoHideSettingTab(this.app, this));

		this.addCommand({
			id: 'clean-markdown-formatting',
			name: 'Clean up Markdown grammar',
			editorCallback: (editor: Editor) => cleanMarkdownFormatting(editor)
		});

		addIcon("oah-pin", `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-pin"><line x1="12" x2="12" y1="17" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/></svg>`);
		addIcon("oah-pin-off", `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-pin-off"><line x1="2" y1="2" x2="22" y2="22"/><line x1="12" y1="17" x2="12" y2="22"/><path d="M9 9v1.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17h14"/><path d="M15 9.34V6h1a2 2 0 0 0 0-4H7.89"/></svg>`);

		this.setupTabClickListener();

		this.app.workspace.onLayoutReady(() => {
			this.init();
			this.togglePins();
			this.updateRibbonButtons();

			this.registerEvents();
			this.observer = new MutationObserver(this.observerCallback.bind(this));
			this.startObserver();
		});
		// Reassigned when workspace is switched
		this.layoutChangeHandler = () => {
			this.init();
			this.togglePins();
			this.updateRibbonButtons();
			this.addHomeIcon();
			this.handleLayoutChange();
		};

		// 注册事件监听器
		this.registerEvent(
			this.app.workspace.on("layout-change", this.layoutChangeHandler)
		);
	}

	onunload() {
		this.removePins();
		if (this.observer) {
			this.observer.disconnect();
			this.observer = null;
		}
		document.removeEventListener("click", this.clickListener);
		// 清理菜单相关
		this.closeBreadcrumbMenu();
		if (this.menuCloseTimer) {
			clearTimeout(this.menuCloseTimer);
			this.menuCloseTimer = null;
		}
	
		// 清理 pin 按钮
		if (this.leftPinButton) {
			this.leftPinButton = null;
		}
		if (this.ribbonManager) {
			this.ribbonManager.cleanup();
		}
	
		this.isMouseOverMenu = false;
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	// ===== Workspace & Layout =====
	init() {
		this.leftSplit = this.app.workspace.leftSplit;
		this.rightSplit = this.app.workspace.rightSplit;
		this.workspaceContainerEl = (this.app.workspace as any).containerEl;
		this.rootSplitEl = (this.app.workspace.rootSplit as any).containerEl;
		this.leftRibbonEl = (this.app.workspace.leftRibbon as any).containerEl;
		this.rightRibbonEl = (this.app.workspace.rightRibbon as any).containerEl;
	}

	private setupTabClickListener() {
		this.clickListener = (event: MouseEvent) => {
			const target = event.target as HTMLElement;
			
			// 查找最近的 `.workspace-tab-header`
			const header = target.closest(".workspace-tab-header") as HTMLElement;
			if (!header) return;
	
			const dataType = header.getAttribute("data-type");
			const isPinned = Boolean(header.querySelector(".workspace-tab-header-status-icon.mod-pinned"));
			
			// 检查条件：仅在 Markdown 且非移动端且未固定的情况下执行
			if (dataType !== "markdown" || Platform.isMobile || isPinned) {
				return;
			}
	
			const outlineAlreadyOpen = Array.from(this.app.workspace.getLeavesOfType("outline")).some(
				(leaf: any) => leaf.view.containerEl.closest(".workspace-tab-header.is-active")
			);
			
			if (!outlineAlreadyOpen) {
				const mainLeaf = this.app.workspace.getLeaf(false);
				const outlinePlugin = (this.app as any).internalPlugins.getEnabledPluginById("outline");
			
				if (outlinePlugin) {
					(this.app as any).commands.executeCommandById("outline:open");
				}
			
				requestAnimationFrame(() => {
					this.app.workspace.setActiveLeaf(mainLeaf, false, true);
				});
			}
		};
	
		// 添加点击监听器
		document.addEventListener("click", this.clickListener, { once: true });
	}
	
	private handleLayoutChange = () => {
		// 在处理新布局前清理旧的资源
		this.closeBreadcrumbMenu();
		if (this.menuCloseTimer) {
			clearTimeout(this.menuCloseTimer);
			this.menuCloseTimer = null;
		}
		// 获取当前活动的标签页
		this.app.workspace.onLayoutReady(() => {
			const activeTab = this.workspaceContainerEl.querySelector('.workspace-tab-header.is-active.mod-active') as HTMLElement;
			if (!activeTab) return;
			const dataType = activeTab.getAttribute("data-type");
			const isPinned = Boolean(activeTab.querySelector(".workspace-tab-header-status-icon.mod-pinned"));
			// 若标签页是markdown且未固定，且非移动端，检查大纲视图
			if (dataType === "markdown" && !isPinned && !Platform.isMobile) {
				const activeOutlineTab = this.workspaceContainerEl.querySelector('.workspace-tab-header.is-active[data-type="outline"]') as HTMLElement;
				if (!activeOutlineTab) {
					const mainLeaf = this.app.workspace.getLeaf(false);
					const outlinePlugin = (this.app as any).internalPlugins.getEnabledPluginById("outline");
					if (outlinePlugin) {
						(this.app as any).commands.executeCommandById("outline:open");
					}

					requestAnimationFrame(() => {
						this.app.workspace.setActiveLeaf(mainLeaf, false, true);
					});
				}
			}

			// 检查面板是否处于分屏、堆叠或模态状态
			if (this.isSplitScreen(activeTab) || this.isTabStacked(activeTab) || this.isModalOpen(activeTab)) {
				return;
			}

			// 如果dataType是自定义类型
			if (dataType && this.settings.customDataTypes.includes(dataType)) {
				this.handleDataType(dataType);
			} else {
				// 控制rightSplit展开
				if (this.rightSplit.collapsed && !Platform.isMobile) {
					this.rightSplit.expand();
				}
			}
		});
	};
	
	
	private handleDataType = (dataType: string) => {
		if (this.settings.customDataTypes.includes(dataType) && this.settings.collapseSidebar_onClickDataType) {
			if (!this.settings.leftPinActive) {
				this.app.workspace.onLayoutReady(() => this.leftSplit.collapse());
			}
			this.app.workspace.onLayoutReady(() => this.rightSplit.collapse());
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

	// ===== Ribbon Management =====
	updateRibbonButtons() {
		this.ribbonManager?.updateRibbonButtons();
	}

	// ===== Workspace Events & Observers =====
	private startObserver() {
		const config = {
			attributes: true,
			attributeFilter: ["class"],
			subtree: true,
		};
		if(this.observer) this.observer.observe(this.workspaceContainerEl, config);
	}

	private observerCallback = (mutationsList: MutationRecord[], observer: MutationObserver) => {
		for (const mutation of mutationsList) {
			if (mutation.type === "attributes" && mutation.attributeName === "class") {
				const target = mutation.target as HTMLElement;
				const dataType = target.getAttribute("data-type");
				if (target.matches(".workspace-tab-header.is-active.mod-active")) {
					if (this.isSplitScreen(target) || this.isTabStacked(target) || this.isModalOpen(target)) {
						return;
					}
					
					if (dataType && this.settings.customDataTypes.includes(dataType)) {
						this.handleDataType(dataType);
					} else {
						if (dataType != "file-explorer" && this.rightSplit.collapsed) {
							if (!Platform.isMobile) {
								this.app.workspace.onLayoutReady(() => this.rightSplit.expand());
							}
						}
					}
				}
			}
		}
	};
	
	registerEvents() {
		this.registerDomEvent(this.app.workspace.containerEl, "dblclick", (evt) => {
			const activeLeaf = this.app.workspace.getMostRecentLeaf();
			if (!activeLeaf) return;

			const view = activeLeaf.view;
			if (view instanceof MarkdownView && view.getMode() === "preview") {
				// Prevent default behavior
				evt.preventDefault();
				evt.stopPropagation();

				// Execute the toggle edit/preview mode command
				(this.app as any).commands.executeCommandById("markdown:toggle-preview");
			}
		});
		this.registerDomEvent(this.app.workspace.containerEl, "focus", (evt) => {
			if (evt.target && (evt.target as HTMLElement).classList.contains("view-header-title")) {
				this.removeHomeIcon();
				return;
			}
		}, { capture: true });
		this.registerDomEvent(this.app.workspace.containerEl, "blur", (evt) => {
			if (evt.target && (evt.target as HTMLElement).classList.contains("view-header-title")) {
				this.addHomeIcon();
				return;
				// setTimeout(() => {
				// 	// console.log("Available commands:", Object.keys((this.app as any).commands.commands));
				// 	(this.app as any).commands.executeCommandById("workspace:edit-file-title");
				// 	const escEvent = new KeyboardEvent("keydown", {
				// 		key: "Escape",
				// 		code: "Escape",
				// 		keyCode: 27,
				// 		which: 27,
				// 		bubbles: true
				// 	});
				// 	document.dispatchEvent(escEvent);
				// }, 200);
			}
		}, { capture: true });
		
		// 右键点击显示菜单
		this.registerDomEvent(this.app.workspace.containerEl, "contextmenu", (evt) => { 
			if (evt.target && (evt.target as HTMLElement).classList.contains("view-header-breadcrumb")) {
				evt.stopPropagation();
				evt.preventDefault();
				this.showMenuAtPosition(evt.target as HTMLElement, evt.clientX, evt.clientY);
			}
		}, { capture: true });

		// 悬浮显示菜单
		// this.registerDomEvent(this.app.workspace.containerEl, "mouseover", (evt) => {
		// 	if (evt.target && (evt.target as HTMLElement).classList.contains("view-header-breadcrumb")) {
		// 		// 清除已存在的关闭定时器
		// 		if (this.menuCloseTimer) {
		// 			clearTimeout(this.menuCloseTimer);
		// 			this.menuCloseTimer = null;
		// 		}
		
		// 		// 设置一个新的打开定时器
		// 		this.menuOpenTimer = setTimeout(() => {
		// 			this.showMenuAtPosition(evt.target as HTMLElement, evt.clientX, evt.clientY);
		// 		}, 500); // 1秒后显示菜单
		// 	}
		// });
		
		// this.registerDomEvent(this.app.workspace.containerEl, "mouseout", (evt) => {
		// 	if (evt.target && (evt.target as HTMLElement).classList.contains("view-header-breadcrumb")) {
		// 		// 清除打开定时器
		// 		if (this.menuOpenTimer) {
		// 			clearTimeout(this.menuOpenTimer);
		// 			this.menuOpenTimer = null;
		// 		}
		
		// 		if (!this.isMouseOverMenu) {
		// 			this.menuCloseTimer = setTimeout(() => {
		// 				this.closeBreadcrumbMenu();
		// 			}, 500);
		// 		}
		// 	}
		// });

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
					this.app.workspace.onLayoutReady(() => this.leftSplit.collapse());
				}
			}
			if (((evt.target as HTMLElement).closest(".contribution-widget, .mm-mindmap-container") !== null) && this.settings.collapseSidebar_onClickDataType) {
				if (!this.settings.leftPinActive) {
					this.app.workspace.onLayoutReady(() => this.leftSplit.collapse());
				}
				return;
			}
			if (((evt.target as HTMLElement).closest(".components--Component") !== null) && this.settings.collapseSidebar_onClickDataType) {
				if (!this.settings.leftPinActive) {
					this.app.workspace.onLayoutReady(() => this.leftSplit.collapse());
					return;
				}
				return;
			}
			if (((evt.target as HTMLElement).closest(".cm-mindmap-container") !== null) && this.settings.collapseSidebar_onClickDataType) {
				if (!this.settings.leftPinActive) {
					this.app.workspace.onLayoutReady(() => this.leftSplit.collapse());
					return;
				}
				return;
			}
		}, { capture: true });

		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			if ((evt.target as HTMLElement).classList.contains("homepage-button")) {
				const activeLeaf = this.app.workspace.getMostRecentLeaf();
				if (!activeLeaf) return;
				const activeView = activeLeaf.view;  // 获取该标签页的视图对象
			
				const viewType = activeView.getViewType();
				if (viewType != "webviewer") {
					const file = this.app.vault.getAbstractFileByPath(this.settings.homepagePath);
					if (file instanceof TFile) {
						const leaves = this.app.workspace.getLeavesOfType("markdown");
						const existingLeaf = leaves.find(leaf => (leaf.view as any).file?.path === file.path);

						if (existingLeaf) {
							const viewState =  existingLeaf.getViewState();
							if (!viewState.pinned) {
								this.app.workspace.setActiveLeaf(existingLeaf);
							} else {
								this.app.workspace.revealLeaf(existingLeaf);
							}
						} else {
							this.app.workspace.openLinkText(file.path, "", false, { active: true });
						}
					}
				} else {
					activeLeaf.setViewState({
						type: "webviewer",
						active: true,
						state: {
							url: this.settings.homepageLink,
							target: "_self",
						}
					});
				}
				if (!this.settings.leftPinActive) {
					this.app.workspace.onLayoutReady(() => this.leftSplit.collapse());
				}
			}
		});

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
			if ((evt.target as HTMLElement).classList.contains("view-header-title") && this.settings.expandSidebar_onClickNoteTitle) {
				if (this.leftSplit.collapsed == true) {
					if (!Platform.isMobile) {
						this.app.workspace.onLayoutReady(() => this.leftSplit.expand());
					}
				}
				return;
			}
			if (!this.settings.leftPinActive) {
				if (!Platform.isMobile) {
					this.app.workspace.onLayoutReady(() => this.leftSplit.collapse());
				}
			}
			// if (!this.settings.rightPinActive) {
			//	this.app.workspace.onLayoutReady(() => this.rightSplit.collapse());
			// }
		});

		this.registerDomEvent(this.leftRibbonEl, "click", (evt) => {
			if (this.settings.expandSidebar_onClickRibbon) {
				if (evt.target == this.leftRibbonEl) {
					if (this.leftSplit.collapsed == true) {
						if (!Platform.isMobile) {
							this.app.workspace.onLayoutReady(() => this.leftSplit.expand());
						}
					}
				}
			}
		});
		this.registerDomEvent(this.leftRibbonEl, "dblclick", async (evt) => {
			if (this.settings.expandSidebar_onClickRibbon) {
				if (evt.target == this.leftRibbonEl) {
					if (this.leftSplit.collapsed == true) {
						if (!Platform.isMobile) {
							this.app.workspace.onLayoutReady(() => this.leftSplit.expand());
						}
					}
					// 更新设置
					this.settings.leftPinActive = true;
					await this.saveSettings();
					
					// 使用保存的引用更新图标
					this.updatePinButtonIcon();
				}
			}
		});
		this.registerDomEvent(this.rightRibbonEl, "click", (evt) => {
			if (this.settings.expandSidebar_onClickRibbon) {
				if (evt.target == this.rightRibbonEl) {
					if (this.rightSplit.collapsed == true) {
						if (!Platform.isMobile) {
							this.app.workspace.onLayoutReady(() => this.rightSplit.expand());
						}
					}
				}
			}
		});
	}

	// ===== Homepage & Breadcrumb Navigation =====
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

	removeHomeIcon() {
		const buttons = document.querySelectorAll('.homepage-button');
		buttons.forEach(button => {
			button.remove();
		});
	}
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

	// 抽取共同的显示菜单逻辑
	private showMenuAtPosition(target: HTMLElement, x: number, y: number): void {
		const folderNote = (this as any).app.plugins.enabledPlugins.has("folder-notes");
		if(folderNote) {
			this.showBreadcrumbMenu(target, x, y);
		}
	}

	private showBreadcrumbMenu(target: HTMLElement, x: number, y: number) {
		if (this.currentMenu) {
			this.currentMenu.hide();
		}

		// const dataPath = target.dataset.path as string;
		// console.log("dataPath: " + dataPath);
		// const file = this.app.workspace.getActiveFile();

		// let fullPath;
		// if (file instanceof TFile) {
		// 	fullPath = file.path; // 例如 "Cannoli College/2. Special arrows.md"
		// 	console.log("file path: " + fullPath);
		// }

		// const currentFolder = (target.ariaLabel as string).split('/').pop() || ''; // 获取当前文件夹名
		// console.log("currentFolder: " + currentFolder);

		// // 取出当前文件的上一级文件夹路径
		// let parentPath = "";
		// let currentPath = "";
		// if (fullPath && fullPath.includes(currentFolder)) {
		// 	parentPath = fullPath.split(`/${currentFolder}`)[0];
		// 	if (!parentPath.includes("/")) {
		// 		parentPath = "";
		// 		currentPath = currentFolder;
		// 	} else {
		// 		currentPath = parentPath + "/" + currentFolder;
		// 	}
		// }
		// console.log("parentPath:", parentPath);
		// console.log("currentPath:", currentPath);

		const { parentPath, currentPath } = this.getPathsFromBreadcrumb(target);
		const currentFolder = currentPath.split('/').pop() || '';

		const siblingFolders = this.getSiblingFolders(parentPath)
			.filter(folder => folder !== currentFolder); // 排除当前文件夹
		
		const menu = new Menu();
		
		// 对文件夹进行升序排序
		siblingFolders.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

		siblingFolders.forEach(folder => {
			menu.addItem(item => {
				item.setTitle(folder)
					.setIcon("folder")
					.onClick((e) => {
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
						this.closeBreadcrumbMenu();
					});
			});
		});
		// 添加分割线
		menu.addSeparator();

		// 获取目标文件夹内的文件，排除目标文件夹本身
		const targetFolderFiles = this.app.vault.getAbstractFileByPath(currentPath);
		if (targetFolderFiles instanceof TFolder) {
			// 获取当前文件的名称
			const file = this.app.workspace.getActiveFile();
			let activateFileName = "";
			if (file instanceof TFile) {
				activateFileName = file.name;
			}

			// 对文件进行升序排序，排除与目标文件夹和当前文件同名的文件
			const sortedFiles = targetFolderFiles.children
				.filter((file): file is TFile => file instanceof TFile)
				.filter(file => {
					const fileNameWithoutExt = file.name.replace(/\.[^/.]+$/, ""); // 移除文件扩展名
					const activateFileNameWithoutExt = activateFileName.replace(/\.[^/.]+$/, ""); // 当前文件名（去除扩展名）
					// 排除与目标文件夹和当前文件同名的文件
					return fileNameWithoutExt !== currentFolder && fileNameWithoutExt !== activateFileNameWithoutExt;
				})
				.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

			sortedFiles.forEach(file => {
				// 设置显示的文件名（.md文件不显示后缀）
				const displayName = file.extension === 'md'
					? file.name.replace(/\.[^/.]+$/, "")  // 移除文件扩展名
					: file.name;

				menu.addItem(item => {
					item.setTitle(displayName)
						.setIcon("document")
						.onClick((e) => {
							if (e.ctrlKey) {
								this.app.workspace.openLinkText(file.path, "", true, { active: true });
							} else {
								this.app.workspace.openLinkText(file.path, "", false, { active: true });
							}
							this.closeBreadcrumbMenu();
						});
				});
			});
		}
		menu.showAtPosition({ x, y });
		this.currentMenu = menu;

		requestAnimationFrame(() => {
			const menuEl = document.querySelector('.menu');
			if (menuEl) {
				menuEl.classList.add('auto-hide-menu');
			}
		});
		// 等待DOM更新后添加事件监听 悬浮
		// requestAnimationFrame(() => {
		// 	const menuContainer = document.querySelector('.menu') as HTMLElement;
		// 	if (menuContainer) {
		// 		menuContainer.addEventListener('mouseenter', () => {
		// 			this.isMouseOverMenu = true;
		// 			if (this.menuCloseTimer) {
		// 				clearTimeout(this.menuCloseTimer);
		// 				this.menuCloseTimer = null;
		// 			}
		// 		});
				
		// 		menuContainer.addEventListener('mouseleave', () => {
		// 			this.isMouseOverMenu = false;
		// 			this.menuCloseTimer = setTimeout(() => {
		// 				this.closeBreadcrumbMenu();
		// 			}, 500);
		// 		});
		// 	}
		// });
	}

	private closeBreadcrumbMenu(): void {
		if (this.currentMenu) {
			this.currentMenu.hide();
			this.currentMenu = null;
		}
		// 移除可能存在的事件监听器
		document.removeEventListener('click', this.hideCurrentMenu, { capture: true });
	}

	private getPathsFromBreadcrumb(target: HTMLElement): { currentPath: string; parentPath: string } {
		// 1) 父容器
		const container = target.closest(".view-header-title-parent") as HTMLElement | null;
		if (!container) return { currentPath: "", parentPath: "" };

		// 2) 所有层级段
		const crumbs = Array.from(container.querySelectorAll<HTMLElement>(".view-header-breadcrumb"));
		const idx = crumbs.indexOf(target);
		if (idx < 0) return { currentPath: "", parentPath: "" };

		// 3) 抽取每段的名称
		//    首段若存在 data-path 则优先使用. 其余段使用 aria-label 或文本
		const segs = crumbs.map((el, i) => {
			if (i === 0) {
			const dp = (el as HTMLElement).dataset?.path?.trim();
			if (dp) return dp; // 如 "Cannoli College"
			}
			return el.getAttribute("aria-label")?.trim() || el.textContent?.trim() || "";
		});

		// 4) 只保留有效段
		const clean = segs.filter(Boolean);

		// 5) 计算 currentPath 与 parentPath
		const currentPath = clean.slice(0, idx + 1).join("/");              // 被点这一层的完整路径
		const parentPath = idx === 0 ? "" : clean.slice(0, idx).join("/");  // 根目录返回空字符串

		return { currentPath, parentPath };
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

	// ===== Sidebar Pin Controls =====
	togglePins() {
		if (!this.settings.lockSidebar) {
			this.removePins();
			return;
		}
		if (document.getElementsByClassName("auto-hide-button").length == 0) {
			this.addPins();
		}
	}

	// addPins() {
	// 	const tabHeaderContainers = document.getElementsByClassName("workspace-tab-header-container");
	// 	const lb = new ButtonComponent(tabHeaderContainers[0] as HTMLElement)
	// 		.setIcon(this.settings.leftPinActive ? "oah-pin-off" : "oah-pin")
	// 		.setClass("auto-hide-button")
	// 		.onClick(async () => {
	// 			this.settings.leftPinActive = !this.settings.leftPinActive;
	// 			await this.saveSettings();
	// 			if (this.settings.leftPinActive) {
	// 				lb.setIcon("oah-pin-off");
	// 			} else {
	// 				lb.setIcon("oah-pin");
	// 			}
	// 		});
	// 	// const rb = new ButtonComponent(tabHeaderContainers[2] as HTMLElement)
	// 	// .setIcon(this.settings.rightPinActive ? "oah-pin-off" : "oah-pin")
	// 	// .setClass("auto-hide-button")
	// 	// .onClick(async () => {
	// 	// 	this.settings.rightPinActive = !this.settings.rightPinActive;
	// 	// 	await this.saveSettings();
	// 	// 	if (this.settings.rightPinActive) {
	// 	// 		rb.setIcon("oah-pin-off");
	// 	// 	} else {
	// 	// 		rb.setIcon("oah-pin");
	// 	// 	}
	// 	// });
	// }

	addPins() {
		const tabHeaderContainers = document.getElementsByClassName("workspace-tab-header-container");
		this.leftPinButton = new ButtonComponent(tabHeaderContainers[0] as HTMLElement)
			.setIcon(this.settings.leftPinActive ? "oah-pin-off" : "oah-pin")
			.setClass("auto-hide-button")
			.onClick(async () => {
				this.settings.leftPinActive = !this.settings.leftPinActive;
				await this.saveSettings();
				this.updatePinButtonIcon();
			});
		
		this.updatePinButtonIcon();
	}

	removePins() {
		const pins = document.getElementsByClassName("auto-hide-button");
		while (pins.length) {
			if (pins.item(0) != null) {
				pins[0].remove();
			}
		}
	}
	
	private updatePinButtonIcon() {
		if (this.leftPinButton) {
			this.leftPinButton.setIcon(this.settings.leftPinActive ? "oah-pin-off" : "oah-pin");
		}
	}
}
