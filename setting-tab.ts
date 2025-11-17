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
	}
}
