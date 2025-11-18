import { App, PluginSettingTab, Setting } from 'obsidian';
import type AutoHidePlugin from './main';

export default class AutoHideSettingTab extends PluginSettingTab {
	plugin: AutoHidePlugin;

	constructor(app: App, plugin: AutoHidePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.classList.add('auto-hide-plugin-settings');

		new Setting(containerEl).setName('Auto Expand').setHeading();

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

		new Setting(containerEl)
			.setName('Collapse sidebar on data type click')
			.setDesc('Fold the sidebar when clicking on External links, MarkMind, Components, etc.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.collapseSidebar_onClickDataType)
				.onChange(async (value) => {
					this.plugin.settings.collapseSidebar_onClickDataType = value;
					await this.plugin.saveSettings();
					this.display();
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

		new Setting(containerEl).setName('Vault Ribbon Buttons').setHeading();

		new Setting(containerEl)
			.setName('Show vault switcher')
			.setDesc('Toggle the built-in vault switcher button in the ribbon.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.restoreVaultSwitcher)
				.onChange(async (value) => {
					this.plugin.settings.restoreVaultSwitcher = value;
					await this.plugin.saveSettings();
					this.plugin.updateRibbonButtons();
				}));

		new Setting(containerEl)
			.setName('Show help button')
			.setDesc('Toggle the built-in help button in the ribbon.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.restoreVaultActionsHelp)
				.onChange(async (value) => {
					this.plugin.settings.restoreVaultActionsHelp = value;
					await this.plugin.saveSettings();
					this.plugin.updateRibbonButtons();
				}));

		new Setting(containerEl)
			.setName('Show settings button')
			.setDesc('Toggle the built-in settings button in the ribbon.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.restoreVaultActionsSettings)
				.onChange(async (value) => {
					this.plugin.settings.restoreVaultActionsSettings = value;
					await this.plugin.saveSettings();
					this.plugin.updateRibbonButtons();
				}));

		new Setting(containerEl).setName('Others').setHeading();

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
			.setName('HomePage Link')
			.setDesc('Set the link of the web homepage.')
			.addText(text => text
				.setPlaceholder('Enter the path of the web homepage')
				.setValue(this.plugin.settings.homepageLink)
				.onChange(async (value) => {
					this.plugin.settings.homepageLink = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl).setName('Force View Mode').setHeading();

		new Setting(containerEl)
			.setName('Enable force view mode')
			.setDesc('Match note view/edit modes to frontmatter keys, folders, or filename patterns.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.forceViewMode.enabled)
				.onChange(async (value) => {
					this.plugin.settings.forceViewMode.enabled = value;
					await this.plugin.saveSettings();
					this.display();
				}));

		if (!this.plugin.settings.forceViewMode.enabled) {
			return;
		}

		const desc = document.createDocumentFragment();
		desc.append(
			'Frontmatter keys ',
			desc.createEl('code', { text: 'obsidianUIMode' }),
			' and ',
			desc.createEl('code', { text: 'obsidianEditingMode' }),
			' can be used to set preview/source or source/live mode respectively when a file opens.'
		);

		new Setting(containerEl).setDesc(desc);

		new Setting(containerEl)
			.setName('Ignore opened files')
			.setDesc('Keep the current mode for notes that were already open.')
			.addToggle((checkbox) =>
				checkbox
					.setValue(this.plugin.settings.forceViewMode.ignoreOpenFiles)
					.onChange(async (value) => {
						this.plugin.settings.forceViewMode.ignoreOpenFiles = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName('Ignore force view when not in frontmatter')
			.setDesc('Do not force the default mode for notes opened via links.')
			.addToggle((checkbox) => {
				checkbox
					.setValue(this.plugin.settings.forceViewMode.ignoreForceViewAll)
					.onChange(async (value) => {
						this.plugin.settings.forceViewMode.ignoreForceViewAll = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName('Debounce timeout (ms)')
			.setDesc('Delay before applying the mode. Set to 0 to disable debouncing.')
			.addText((cb) => {
				cb.setValue(String(this.plugin.settings.forceViewMode.debounceTimeout)).onChange(async (value) => {
					this.plugin.settings.forceViewMode.debounceTimeout = Number(value);

					await this.plugin.saveSettings();
				});
			});

		const modes = [
			'default',
			'obsidianUIMode: preview',
			'obsidianUIMode: source',
			'obsidianEditingMode: live',
			'obsidianEditingMode: source'
		];

		const createHeader = (text: string) => containerEl.createEl('h3', { text });

		createHeader('Folders');

		const folderDesc = document.createDocumentFragment();
		folderDesc.append(
			'Force a mode for notes under a folder (child folders included).',
			folderDesc.createEl('br'),
			'Folder rules run from top to bottom, so place child folders below parents.'
		);

		new Setting(containerEl).setDesc(folderDesc);

		new Setting(containerEl)
			.setDesc('Add new folder')
			.addButton((button) => {
				button
					.setTooltip('Add another folder to the list')
					.setButtonText('+')
					.setCta()
					.onClick(async () => {
						this.plugin.settings.forceViewMode.folders.push({
							folder: '',
							viewMode: ''
						});
						await this.plugin.saveSettings();
						this.display();
					});
			});

		this.plugin.settings.forceViewMode.folders.forEach((folderMode, index) => {
			const div = containerEl.createEl('div');
			div.addClass('force-view-mode-div');
			div.addClass('force-view-mode-folder');

			const s = new Setting(containerEl)
				.addSearch((cb) => {
					cb.setPlaceholder('Example: folder1/templates')
						.setValue(folderMode.folder)
						.onChange(async (newFolder) => {
							if (newFolder && this.plugin.settings.forceViewMode.folders.some((e) => e.folder == newFolder)) {
								console.error('ForceViewMode: This folder already has a template associated with', newFolder);

								return;
							}

							this.plugin.settings.forceViewMode.folders[index].folder = newFolder;

							await this.plugin.saveSettings();
						});
				})
				.addDropdown((cb) => {
					modes.forEach((mode) => {
						cb.addOption(mode, mode);
					});

					cb.setValue(folderMode.viewMode || 'default').onChange(async (value) => {
						this.plugin.settings.forceViewMode.folders[index].viewMode = value;

						await this.plugin.saveSettings();
					});
				})
				.addExtraButton((cb) => {
					cb.setIcon('cross')
						.setTooltip('Delete')
						.onClick(async () => {
							this.plugin.settings.forceViewMode.folders.splice(index, 1);

							await this.plugin.saveSettings();

							this.display();
						});
				});

			s.infoEl.remove();

			div.appendChild(containerEl.lastChild as Node);
		});

		createHeader('Files');

		const filesDesc = document.createDocumentFragment();
		filesDesc.append(
			'Apply a mode to notes with names matching a pattern (regular expression).',
			filesDesc.createEl('br'),
			'File rules override folder rules, precedence from top to bottom.'
		);

		new Setting(containerEl).setDesc(filesDesc);

		new Setting(containerEl)
			.setDesc('Add new file')
			.addButton((button) => {
				button
					.setTooltip('Add another file to the list')
					.setButtonText('+')
					.setCta()
					.onClick(async () => {
						this.plugin.settings.forceViewMode.files.push({
							filePattern: '',
							viewMode: ''
						});
						await this.plugin.saveSettings();
						this.display();
					});
			});

		this.plugin.settings.forceViewMode.files.forEach((file, index) => {
			const div = containerEl.createEl('div');
			div.addClass('force-view-mode-div');
			div.addClass('force-view-mode-folder');

			const s = new Setting(containerEl)
				.addSearch((cb) => {
					cb.setPlaceholder(`Example: " - All$" or "1900-01"`)
						.setValue(file.filePattern)
						.onChange(async (value) => {
							if (value && this.plugin.settings.forceViewMode.files.some((e) => e.filePattern == value)) {
								console.error('ForceViewMode: Pattern already exists', value);

								return;
							}

							this.plugin.settings.forceViewMode.files[index].filePattern = value;

							await this.plugin.saveSettings();
						});
				})
				.addDropdown((cb) => {
					modes.forEach((mode) => {
						cb.addOption(mode, mode);
					});

					cb.setValue(file.viewMode || 'default').onChange(async (value) => {
						this.plugin.settings.forceViewMode.files[index].viewMode = value;

						await this.plugin.saveSettings();
					});
				})
				.addExtraButton((cb) => {
					cb.setIcon('cross')
						.setTooltip('Delete')
						.onClick(async () => {
							this.plugin.settings.forceViewMode.files.splice(index, 1);

							await this.plugin.saveSettings();

							this.display();
						});
				});

			s.infoEl.remove();

			div.appendChild(containerEl.lastChild as Node);
		});

		createHeader('Frontmatter properties');

		const propertyDesc = document.createDocumentFragment();
		propertyDesc.append(
			'Match frontmatter properties to force a mode. Value is optional; if empty, only the property name must exist.'
		);

		new Setting(containerEl).setDesc(propertyDesc);

		new Setting(containerEl)
			.setDesc('Add property rule')
			.addButton((button) => {
				button
					.setTooltip('Add another property rule')
					.setButtonText('+')
					.setCta()
					.onClick(async () => {
						this.plugin.settings.forceViewMode.frontmatterProperties.push({
							property: '',
							value: '',
							viewMode: ''
						});
						await this.plugin.saveSettings();
						this.display();
					});
			});

		this.plugin.settings.forceViewMode.frontmatterProperties.forEach((rule, index) => {
			const div = containerEl.createEl('div');
			div.addClass('force-view-mode-div');
			div.addClass('force-view-mode-folder');

			const s = new Setting(containerEl)
				.addText((text) => {
					text.setPlaceholder('property (e.g. "page-mode")')
						.setValue(rule.property)
						.onChange(async (value) => {
							this.plugin.settings.forceViewMode.frontmatterProperties[index].property = value;
							await this.plugin.saveSettings();
						});
				})
				.addText((text) => {
					text.setPlaceholder('value (optional)')
						.setValue(rule.value)
						.onChange(async (value) => {
							this.plugin.settings.forceViewMode.frontmatterProperties[index].value = value;
							await this.plugin.saveSettings();
						});
				})
				.addDropdown((cb) => {
					modes.forEach((mode) => {
						cb.addOption(mode, mode);
					});

					cb.setValue(rule.viewMode || 'default').onChange(async (value) => {
						this.plugin.settings.forceViewMode.frontmatterProperties[index].viewMode = value;
						await this.plugin.saveSettings();
					});
				})
				.addExtraButton((cb) => {
					cb.setIcon('cross')
						.setTooltip('Delete')
						.onClick(async () => {
							this.plugin.settings.forceViewMode.frontmatterProperties.splice(index, 1);

							await this.plugin.saveSettings();

							this.display();
						});
				});

			s.infoEl.remove();

			div.appendChild(containerEl.lastChild as Node);
		});

		createHeader('Link suffix rules');

		const suffixDesc = document.createDocumentFragment();
		suffixDesc.append(
			'Force a mode by matching the current note path or name suffix (include extension if needed, e.g. ".canvas" or "-preview.md").'
		);

		new Setting(containerEl).setDesc(suffixDesc);

		new Setting(containerEl)
			.setDesc('Add suffix rule')
			.addButton((button) => {
				button
					.setTooltip('Add another suffix rule')
					.setButtonText('+')
					.setCta()
					.onClick(async () => {
						this.plugin.settings.forceViewMode.linkSuffixes.push({
							suffix: '',
							viewMode: ''
						});
						await this.plugin.saveSettings();
						this.display();
					});
			});

		this.plugin.settings.forceViewMode.linkSuffixes.forEach((rule, index) => {
			const div = containerEl.createEl('div');
			div.addClass('force-view-mode-div');
			div.addClass('force-view-mode-folder');

			const s = new Setting(containerEl)
				.addText((text) => {
					text.setPlaceholder('suffix (e.g. ".canvas" or "-web.md")')
						.setValue(rule.suffix)
						.onChange(async (value) => {
							this.plugin.settings.forceViewMode.linkSuffixes[index].suffix = value;
							await this.plugin.saveSettings();
						});
				})
				.addDropdown((cb) => {
					modes.forEach((mode) => {
						cb.addOption(mode, mode);
					});

					cb.setValue(rule.viewMode || 'default').onChange(async (value) => {
						this.plugin.settings.forceViewMode.linkSuffixes[index].viewMode = value;

						await this.plugin.saveSettings();
					});
				})
				.addExtraButton((cb) => {
					cb.setIcon('cross')
						.setTooltip('Delete')
						.onClick(async () => {
							this.plugin.settings.forceViewMode.linkSuffixes.splice(index, 1);

							await this.plugin.saveSettings();

							this.display();
						});
				});

			s.infoEl.remove();

			div.appendChild(containerEl.lastChild as Node);
		});
	}
}
