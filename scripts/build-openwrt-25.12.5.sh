#!/bin/sh
set -eu
# Keep Windows paths with spaces or parentheses out of SDK shell recipes.
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
export PATH
sdk=${1:?Usage: build-openwrt-25.12.5.sh OPENWRT_25.12.5_MEDIATEK_FILOGIC_SDK}
case "$(basename "$sdk")" in
  openwrt-sdk-25.12.5-mediatek-filogic_*) ;;
  *) echo 'Use the OpenWrt 25.12.5 mediatek/filogic SDK.' >&2; exit 1 ;;
esac
grep -q '^REVISION:=r33051-f5dae5ece4$' "$sdk/include/version.mk" || {
  echo 'SDK revision does not match OpenWrt 25.12.5.' >&2; exit 1;
}
workspace=$(CDPATH='' cd -- "$(dirname "$0")/.." && pwd)
name=luci-app-dnscrypt-proxy2-forge
version=$(sed -n 's/^PKG_VERSION:=//p' "$workspace/Makefile")
release=$(sed -n 's/^PKG_RELEASE:=//p' "$workspace/Makefile")
package="$sdk/package/$name"
mkdir -p "$package"
cp -a "$workspace/Makefile" "$workspace/htdocs" "$workspace/root" "$workspace/LICENSE" "$workspace/NOTICE" "$package/"
make -C "$sdk" defconfig
grep -q '^CONFIG_TARGET_mediatek_filogic=y$' "$sdk/.config" || {
  echo 'SDK target must be mediatek/filogic.' >&2; exit 1;
}
grep -q '^CONFIG_USE_APK=y$' "$sdk/.config" || {
  echo 'SDK must use APK packaging.' >&2; exit 1;
}
make -C "$sdk" "package/$name/clean"
make -C "$sdk" "package/$name/compile" V=s
apk=$(find "$sdk/bin/packages/aarch64_cortex-a53" -name "${name}-${version}-r${release}.apk" -print -quit)
[ -n "$apk" ] || { echo 'No APK produced.' >&2; exit 1; }
out="$workspace/artifacts/$version/openwrt-25.12.5-aarch64_cortex-a53"
mkdir -p "$out"
cp "$apk" "$out/"
cp "$workspace/README.md" "$workspace/README.ru.md" "$workspace/LICENSE" "$workspace/NOTICE" "$out/"
(cd "$out" && sha256sum ./*.apk > SHA256SUMS && sha256sum -c SHA256SUMS)
printf 'Package saved to %s\n' "$out"
