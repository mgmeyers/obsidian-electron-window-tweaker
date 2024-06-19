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

const vibrancySettings = [
  "default",
  "content",
  "fullscreen-ui",
  "header",
  "hud",
  "menu",
  "popover",
  "selection",
  "sheet",
  "sidebar",
  "titlebar",
  "tooltip",
  "under-page",
  "under-window",
  "window",
] as const;

type Vibrancy = typeof vibrancySettings[number];

interface ElectronWindowTweakerSettings {
  opacity: number;
  alwaysOnTop: boolean;
  vibrancy: Vibrancy;
  trafficLightsPosX: number;
  trafficLightsPosY: number;
}

const DEFAULT_SETTINGS: ElectronWindowTweakerSettings = {
  opacity: 1,
  alwaysOnTop: false,
  vibrancy: "default",
  trafficLightsPosX: 7,
  trafficLightsPosY: 6,
};

const ICON_SVG = `<path d="M41.667 20.833a4.167 4.167 0 1 0 4.167 4.167A4.167 4.167 0 0 0 41.667 20.833ZM25 20.833A4.167 4.167 0 1 0 29.167 25 4.167 4.167 0 0 0 25 20.833Zm33.333 0a4.167 4.167 0 1 0 4.167 4.167A4.167 4.167 0 0 0 58.333 20.833Zm25 -16.667H16.667A12.5 12.5 0 0 0 4.167 16.667V83.333a12.5 12.5 0 0 0 12.5 12.5H83.333a12.5 12.5 0 0 0 12.5 -12.5V16.667A12.5 12.5 0 0 0 83.333 4.167Zm4.167 79.167a4.167 4.167 0 0 1 -4.167 4.167H16.667a4.167 4.167 0 0 1 -4.167 -4.167V45.833H87.5ZM87.5 37.5H12.5V16.667A4.167 4.167 0 0 1 16.667 12.5H83.333a4.167 4.167 0 0 1 4.167 4.167Z" fill="currentColor"/>`;

const setAlwaysOnTop = (on: boolean) => {
  window.require("electron").remote.getCurrentWindow().setAlwaysOnTop(on);
};

const setOpacity = (opacity: number) => {
  window.require("electron").remote.getCurrentWindow().setOpacity(opacity);
};

const setVibrancy = (vibrancy: Vibrancy, isTranslucent: boolean) => {
  if (vibrancy === "default" && isTranslucent) {
    return window
      .require("electron")
      .remote.getCurrentWindow()
      .setVibrancy("window");
  }

  if (vibrancy === "default") {
    document.body.removeClass("is-translucent");
    return window
      .require("electron")
      .remote.getCurrentWindow()
      .setVibrancy(null);
  }

  document.body.addClass("is-translucent");
  window.require("electron").remote.getCurrentWindow().setVibrancy(vibrancy);
};

const setTrafficLightsPos = (
  styleTag: HTMLStyleElement,
  x: number,
  y: number
) => {
  styleTag.innerText = `
      :root {
        --ewt-traffic-light-x: ${x}px;
        --ewt-traffic-light-y: ${y}px;
      }
    `
    .trim()
    .replace(/[\r\n\s]+/g, " ");

  window
    .require("electron")
    .remote.getCurrentWindow()
    .setWindowButtonPosition({ x, y });
};

export default class ElectronWindowTweaker extends Plugin {
  settings: ElectronWindowTweakerSettings;
  statusBarIcon: HTMLElement;
  styleTag: HTMLStyleElement;

  getIsTranslucent() {
    return !!(this.app.vault as any).getConfig("translucency") as boolean;
  }

  async onload() {
    await this.loadSettings();

    this.styleTag = document.createElement("style");
    this.styleTag.id = "ewt-styles";
    document.getElementsByTagName("head")[0].appendChild(this.styleTag);

    this.addSettingTab(new SettingsTab(this.app, this));
    this.app.workspace.onLayoutReady(() => {
      setTimeout(() => {
        // Really shove this baby to the end
        this.setupStatusBar();
      });
    });

    setOpacity(this.settings.opacity);
    setAlwaysOnTop(this.settings.alwaysOnTop);

    if (process.platform === "darwin") {
      setVibrancy(this.settings.vibrancy, this.getIsTranslucent());
      setTrafficLightsPos(
        this.styleTag,
        this.settings.trafficLightsPosX,
        this.settings.trafficLightsPosY
      );
    }

    this.addCommand({
      id: "ewt-increase-opacity",
      name: "Increase opacity",
      callback: async () => {
        if (this.settings.opacity === 1) return;
        this.settings.opacity = Math.min(this.settings.opacity + 0.05, 1);
        setOpacity(this.settings.opacity);
        await this.saveSettings();
      },
    });

    this.addCommand({
      id: "ewt-decrease-opacity",
      name: "Decrease opacity",
      callback: async () => {
        if (this.settings.opacity === 0) return;
        this.settings.opacity = Math.max(this.settings.opacity - 0.05, 0);
        setOpacity(this.settings.opacity);
        await this.saveSettings();
      },
    });

    this.addCommand({
      id: "ewt-toggle-on-top",
      name: "Toggle always on top",
      callback: async () => {
        this.settings.alwaysOnTop = !this.settings.alwaysOnTop;
        setAlwaysOnTop(this.settings.alwaysOnTop);
        await this.saveSettings();
      },
    });
  }

  setupStatusBar() {
    this.statusBarIcon = this.addStatusBarItem();
    this.statusBarIcon.addClass("ewt-statusbar-button");
    addIcon("electron-window", ICON_SVG);
    setIcon(this.statusBarIcon, "electron-window");

    this.registerDomEvent(this.statusBarIcon, "click", (e) => {
      const statusBarRect =
        this.statusBarIcon.parentElement.getBoundingClientRect();
      const statusBarIconRect = this.statusBarIcon.getBoundingClientRect();

      const menu = new Menu(this.app).addItem((item) => {
        item.setTitle("Always on top");

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
      });

      const menuDom = (menu as any).dom as HTMLElement;
      menuDom.addClass("ewt-statusbar-menu");

      const item = menuDom.createDiv("menu-item");
      item.createDiv({ cls: "menu-item-icon" });
      item.createDiv({ text: "Opacity", cls: "menu-item-title" });
      item.onClickEvent((e) => e.stopPropagation());

      new SliderComponent(item)
        .setLimits(50, 100, 1)
        .setValue(this.settings.opacity * 100)
        .onChange(
          debounce(
            async (value) => {
              console.log(value);
              this.settings.opacity = value / 100;
              setOpacity(this.settings.opacity);
              await this.saveSettings();
            },
            100,
            true
          )
        );

      menu.showAtPosition({
        x: statusBarIconRect.right + 5,
        y: statusBarRect.top - 5,
      });
    });
  }

  onunload() {
    setOpacity(DEFAULT_SETTINGS.opacity);
    setAlwaysOnTop(DEFAULT_SETTINGS.alwaysOnTop);
    setVibrancy(DEFAULT_SETTINGS.vibrancy, this.getIsTranslucent());
    setTrafficLightsPos(
      this.styleTag,
      DEFAULT_SETTINGS.trafficLightsPosX,
      DEFAULT_SETTINGS.trafficLightsPosY
    );

    this.styleTag.remove();
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

class SettingsTab extends PluginSettingTab {
  plugin: ElectronWindowTweaker;

  constructor(app: App, plugin: ElectronWindowTweaker) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    let { containerEl } = this;

    containerEl.empty();

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

    if (process.platform === "darwin") {
      new Setting(containerEl)
        .setName("Window vibrancy")
        .setDesc("Note: this can cause lag on some systems")
        .addDropdown((dropdown) => {
          dropdown
            .addOptions(
              vibrancySettings.reduce<Record<string, string>>(
                (opts, setting) => {
                  opts[setting] = setting;
                  return opts;
                },
                {}
              )
            )
            .setValue(this.plugin.settings.vibrancy)
            .onChange(async (value) => {
              this.plugin.settings.vibrancy = value as Vibrancy;
              setVibrancy(
                this.plugin.settings.vibrancy,
                this.plugin.getIsTranslucent()
              );
              await this.plugin.saveSettings();
            });
        });

      new Setting(containerEl)
        .setName("Traffic lights X position")
        .addText((input) => {
          input.inputEl.setAttribute("type", "number");
          input
            .setValue(this.plugin.settings.trafficLightsPosX.toString())
            .onChange(
              debounce(
                async (value) => {
                  const n = parseInt(value);

                  if (isNaN(n)) {
                    return;
                  }

                  this.plugin.settings.trafficLightsPosX = n;
                  setTrafficLightsPos(
                    this.plugin.styleTag,
                    this.plugin.settings.trafficLightsPosX,
                    this.plugin.settings.trafficLightsPosY
                  );
                  await this.plugin.saveSettings();
                },
                100,
                true
              )
            );
        });

      new Setting(containerEl)
        .setName("Traffic lights Y position")
        .addText((input) => {
          input.inputEl.setAttribute("type", "number");
          input
            .setValue(this.plugin.settings.trafficLightsPosY.toString())
            .onChange(
              debounce(
                async (value) => {
                  const n = parseInt(value);

                  if (isNaN(n)) {
                    return;
                  }

                  this.plugin.settings.trafficLightsPosY = n;
                  setTrafficLightsPos(
                    this.plugin.styleTag,
                    this.plugin.settings.trafficLightsPosX,
                    this.plugin.settings.trafficLightsPosY
                  );
                  await this.plugin.saveSettings();
                },
                100,
                true
              )
            );
        });
    }
  }
}
