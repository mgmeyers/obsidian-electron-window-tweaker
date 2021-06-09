import {
  addIcon,
  App,
  debounce,
  Menu,
  Plugin,
  PluginSettingTab,
  setIcon,
  Setting,
  SliderComponent,
  ToggleComponent,
} from "obsidian";

interface ElectronWindowTweakerSettings {
  opacity: number;
  alwaysOnTop: boolean;
}

const DEFAULT_SETTINGS: ElectronWindowTweakerSettings = {
  opacity: 1,
  alwaysOnTop: false,
};

const ICON_SVG = `<path d="M71.533 33.333H54.167l3.358 -20.146C57.946 10.646 55.992 8.333 53.413 8.333H31.946C29.908 8.333 28.171 9.808 27.838 11.813l-6.946 41.667C20.467 56.021 22.425 58.333 25 58.333h16.667v33.333l33.375 -51.913C76.825 36.979 74.833 33.333 71.533 33.333z" fill="currentColor"/>`;

const setAlwaysOnTop = (on: boolean) => {
  window.require("electron").remote.getCurrentWindow().setAlwaysOnTop(on);
};

const setOpacity = (opacity: number) => {
  window.require("electron").remote.getCurrentWindow().setOpacity(opacity);
};

export default class ElectronWindowTweaker extends Plugin {
  settings: ElectronWindowTweakerSettings;
  statusBarIcon: HTMLElement;

  async onload() {
    await this.loadSettings();

    this.addSettingTab(new SampleSettingTab(this.app, this));
    this.setupStatusBar();

    setOpacity(this.settings.opacity);
    setAlwaysOnTop(this.settings.alwaysOnTop);
  }

  setupStatusBar() {
    this.statusBarIcon = this.addStatusBarItem();
    this.statusBarIcon.addClass('ewt-statusbar-button');
    addIcon("bolt", ICON_SVG);
    setIcon(this.statusBarIcon, "bolt");

    this.registerDomEvent(this.statusBarIcon, "click", (e) => {
      const menu = new Menu(this.app)
        .addItem((item) => {
          item.setTitle('Always on top')

          const itemDom = (item as any).dom as HTMLElement;
          const toggleComponent = new ToggleComponent(itemDom)
            .setValue(this.settings.alwaysOnTop)
            .setDisabled(true);

          const toggle = async () => {
            this.settings.alwaysOnTop = !this.settings.alwaysOnTop;
            toggleComponent.setValue(this.settings.alwaysOnTop);
            setAlwaysOnTop(this.settings.alwaysOnTop);
            await this.saveSettings();
          };

          item.onClick((e) => {
            e.preventDefault();
            e.stopImmediatePropagation();
            toggle();
          });
        })
        .addItem((item) => {
          item.setTitle('Opacity');

          const itemDom = (item as any).dom as HTMLElement;

          new SliderComponent(itemDom)
            .setLimits(50, 100, 1)
            .setValue(this.settings.opacity * 100)
            .onChange(
              debounce(
                async (value) => {
                  this.settings.opacity = value / 100;
                  setOpacity(this.settings.opacity);
                  await this.saveSettings();
                },
                100,
                true
              )
            );

          item.onClick((e) => {
            e.preventDefault();
            e.stopImmediatePropagation();
          });
        })
        .showAtPosition({ x: e.clientX, y: e.clientY });

      ((menu as any).dom as HTMLElement).addClass("ewt-statusbar-menu");
    });
  }

  onunload() {
    setOpacity(DEFAULT_SETTINGS.opacity);
    setAlwaysOnTop(DEFAULT_SETTINGS.alwaysOnTop);
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

class SampleSettingTab extends PluginSettingTab {
  plugin: ElectronWindowTweaker;

  constructor(app: App, plugin: ElectronWindowTweaker) {
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
          .setLimits(50, 100, 1)
          .setDynamicTooltip()
          .setValue(this.plugin.settings.opacity * 100)
          .onChange(
            debounce(
              async (value) => {
                this.plugin.settings.opacity = value / 100;
                setOpacity(this.plugin.settings.opacity);
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
            setAlwaysOnTop(this.plugin.settings.alwaysOnTop);
            await this.plugin.saveSettings();
          },
          100,
          true
        )
      );
    });
  }
}
