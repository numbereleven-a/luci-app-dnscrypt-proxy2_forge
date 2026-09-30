# DNSCrypt-Proxy 2 Forge

[Русская документация](README.ru.md)

A LuCI interface for DNSCrypt-Proxy 2 with **multiple instance support**, **detailed startup and restart output**, and **safer configuration saving**.

Based on [ewgen198409/luci-app-dnscrypt-proxy2](https://github.com/ewgen198409/luci-app-dnscrypt-proxy2), upstream revision [`b9978fe`](https://github.com/ewgen198409/luci-app-dnscrypt-proxy2/tree/b9978fe2f448e8fb7a6aaa03762f97f1c293daba). Forge retains the original settings tabs, resolver selection, TOML editor, and English/Russian interface, and extends them for separate DNSCrypt services.

Current version: **0.1.3-r1**. Tested on **OpenWrt 24.10.1**, **GL.iNet GL-MT6000**, mediatek/filogic, aarch64_cortex-a53. Installation and correct operation on **OpenWrt 23.05.5** have also been verified. A separate **APK build for OpenWrt 25.12.5** is available; its package contents are verified, but router runtime testing is pending.

![Instance overview and service operation output](docs/images/overview.jpg)

*Interface preview with example instances and synthetic startup output.*

## Main features

### Multiple instances

- Discover separate `dnscrypt-proxy*` services and switch between their configurations.
- View every discovered instance in one table, including its status, listen addresses, and TOML path.
- Start, stop, restart, and save settings for the selected service.
- Load resolver lists and logs for the selected configuration, including configurations in subdirectories.
- Discover stopped services from literal `PROG` and `CONFIGFILE` assignments in their init scripts, without executing those scripts.

### Detailed startup and restart output

- Display command stdout/stderr and new DNSCrypt messages in an operation panel.
- Show resolver names and latency when DNSCrypt reports them.
- Follow startup messages for up to 20 seconds and distinguish command errors, process state, confirmed readiness, and unconfirmed readiness.
- Read a configured log file or use a dedicated RPC endpoint to retrieve syslog messages for the selected process.
- Include the previous process ID when collecting restart output and filter out unrelated processes.

### Safer configuration saving

- Update only fields that were actually edited.
- Preserve untouched settings, comments, and sections such as `sources`, `static`, and `anonymized_dns`.
- Detect external configuration changes before saving.
- Warn about unsaved changes when switching instances and prevent conflicting edits between the form and the raw TOML editor.
- Preserve literal special characters and display configuration, logs, errors, and resolver data as text.

## Installation

Download the ZIP for your OpenWrt version from [Releases](https://github.com/numbereleven-a/luci-app-dnscrypt-proxy2_forge/releases) and extract it. Each archive contains the package, `SHA256SUMS`, documentation, and license files. For OpenWrt 24.10.1, verify the extracted IPK checksum and transfer it to the router.

```sh
opkg install /tmp/luci-app-dnscrypt-proxy2-forge_0.1.3-r1_all.ipk
/etc/init.d/rpcd reload
```

For OpenWrt **25.12.5**, download the APK and matching `SHA256SUMS`, then install:

```sh
apk add --allow-untrusted /tmp/luci-app-dnscrypt-proxy2-forge-0.1.3-r1.apk
/etc/init.d/rpcd reload
```

The APK is signed with a local SDK key rather than the official repository key, so this local installation requires `--allow-untrusted`. IPK and APK are separate package formats; choose the package for your OpenWrt version.

Dependencies: `luci-base`, `rpcd-mod-file`, `luci-lib-jsonc`, `lua`, `libubus-lua`, and `dnscrypt-proxy2`.

Refresh LuCI and open **Services → DNSCrypt-Proxy 2 Forge**. The package uses a separate menu entry and can coexist with the original interface. Installing it does not change your DNSCrypt configurations, DHCP/DNS settings, failover setup, or service autostart.

## Usage

Select an instance before editing or using the service buttons.

- **Save** writes the selected configuration.
- **Save & Apply** writes it and restarts the selected service.
- **Start / Stop / Restart** control the selected service and display operation output.
- The **Configuration** tab provides the raw TOML editor. Save raw edits with its own **Save** button, then restart the service to apply them.

## Supported setup and limitations

- Runtime tested: OpenWrt **24.10.1**, GL-MT6000, mediatek/filogic, aarch64_cortex-a53.
- Build and payload verified: OpenWrt **25.12.5**, same target. Runtime testing on that release is pending.
- Verified installation and correct operation on OpenWrt **23.05.5** using the existing architecture-independent IPK.
- Services must be named `dnscrypt-proxy*`, with TOML files under `/etc/dnscrypt-proxy2/`.
- Separate services can be controlled independently. If multiple procd instances share one init service, their settings remain accessible, but service actions are disabled because they could affect every instance in that service.
- Stopped services with dynamically computed configuration paths are not discovered by executing their init scripts.
- The form handles common scalar values and arrays, including multiline arrays. Use the raw editor for more complex TOML.
- The raw editor does not validate configuration syntax with the DNSCrypt binary before saving.
- The external-change check does not lock the file against another writer between the check and the write.
- Syslog output is limited to 250 matching lines from the last 1,000 syslog lines. File logs are available through the package ACL under `/etc/dnscrypt-proxy2/` and `/var/log/dnscrypt-proxy*`.

## Build and checks

Use the **OpenWrt 24.10.1 mediatek/filogic SDK**:

```sh
sh scripts/build-openwrt-24.10.1.sh /path/to/openwrt-sdk-24.10.1-mediatek-filogic_gcc-13.3.0_musl.Linux-x86_64
```

The build checks the SDK version and target. Packages and checksums are saved under `artifacts/0.1.3/openwrt-24.10.1-aarch64_cortex-a53/`.

```sh
node tests/multi-instance.test.cjs
node tests/browser.test.cjs
node tests/security-render.test.cjs
lua tests/rpc-logs.test.lua root/usr/libexec/rpcd/dnscrypt-forge
python scripts/verify-package.py /path/to/luci-app-dnscrypt-proxy2-forge_0.1.3-r1_all.ipk
```

Browser checks require `selenium-webdriver`, Firefox, and geckodriver. Override their locations with `SELENIUM_MODULE_ROOT`, `FIREFOX_BINARY`, and `GECKODRIVER`. RPC checks require Lua 5.1, `luci.jsonc`, and `ubus`.

To build an APK with the **OpenWrt 25.12.5 mediatek/filogic SDK**:

```sh
sh scripts/build-openwrt-25.12.5.sh /path/to/openwrt-sdk-25.12.5-mediatek-filogic_gcc-14.3.0_musl.Linux-x86_64
python scripts/verify-apk-package.py /path/to/luci-app-dnscrypt-proxy2-forge-0.1.3-r1.apk /path/to/sdk/staging_dir/host/bin/apk
```

APK artifacts are saved under `artifacts/0.1.3/openwrt-25.12.5-aarch64_cortex-a53/`. The APK verifier requires Linux and apk-tools 3 from the SDK.

## License and credits

Licensed under **GPL-3.0-or-later**, consistent with the upstream package metadata and README. See [LICENSE](LICENSE) and [NOTICE](NOTICE).

Original project: [ewgen198409/luci-app-dnscrypt-proxy2](https://github.com/ewgen198409/luci-app-dnscrypt-proxy2).
