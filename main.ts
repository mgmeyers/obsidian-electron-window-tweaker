import { App, debounce, Plugin, PluginSettingTab, Setting } from "obsidian";

interface MyPluginSettings {
  opacity: number;
  alwaysOnTop: boolean;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
  opacity: 1,
  alwaysOnTop: false,
};

export default class MyPlugin extends Plugin {
  settings: MyPluginSettings;

  async onload() {
    await this.loadSettings();

    this.addSettingTab(new SampleSettingTab(this.app, this));

    window
      .require("electron")
      .remote.getCurrentWindow()
      .setOpacity(this.settings.opacity);

    window
      .require("electron")
      .remote.getCurrentWindow()
      .setAlwaysOnTop(this.settings.alwaysOnTop);
  }

  onunload() {
    console.log("TODO: reset all settings");
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

class SampleSettingTab extends PluginSettingTab {
  plugin: MyPlugin;

  constructor(app: App, plugin: MyPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    let { containerEl } = this;

    containerEl.empty();

    new Setting(containerEl)
      .setName("Window opacity percent")
      .addSlider((slider) => {
        slider
          .setLimits(20, 100, 1)
          .setDynamicTooltip()
          .setValue(this.plugin.settings.opacity)
          .onChange(
            debounce(
              async (value) => {
                this.plugin.settings.opacity = value / 100;
                window
                  .require("electron")
                  .remote.getCurrentWindow()
                  .setOpacity(this.plugin.settings.opacity);
                await this.plugin.saveSettings();
              },
              100,
              true
            )
          );
      });

    new Setting(containerEl).setName("Always on top").addToggle((toggle) => {
      toggle.setValue(this.plugin.settings.alwaysOnTop).onChange(
        debounce(
          async (value) => {
            this.plugin.settings.alwaysOnTop = value;
            window
              .require("electron")
              .remote.getCurrentWindow()
              .setAlwaysOnTop(this.plugin.settings.alwaysOnTop);
            await this.plugin.saveSettings();
          },
          100,
          true
        )
      );
    });
  }
}
