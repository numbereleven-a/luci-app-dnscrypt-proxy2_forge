#!/bin/sh
set -eu
sdk=${1:?Usage: build-openwrt-24.10.1.sh OPENWRT_24.10.1_MEDIATEK_FILOGIC_SDK}
case "$(basename "$sdk")" in
  openwrt-sdk-24.10.1-mediatek-filogic_*) ;;
  *) echo 'Use the OpenWrt 24.10.1 mediatek/filogic SDK.' >&2; exit 1 ;;
esac
grep -q '^REVISION:=r28597-0425664679$' "$sdk/include/version.mk" || {
  echo 'SDK revision does not match OpenWrt 24.10.1.' >&2; exit 1;
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
make -C "$sdk" "package/$name/clean"
make -C "$sdk" "package/$name/compile" V=s
ipk=$(find "$sdk/bin/packages/aarch64_cortex-a53" -name "${name}_${version}-r${release}_all.ipk" -print -quit)
[ -n "$ipk" ] || { echo 'No IPK produced.' >&2; exit 1; }
out="$workspace/artifacts/$version/openwrt-24.10.1-aarch64_cortex-a53"
mkdir -p "$out"
cp "$ipk" "$out/"
cp "$workspace/README.md" "$workspace/LICENSE" "$workspace/NOTICE" "$out/"
(cd "$out" && sha256sum ./*.ipk > SHA256SUMS && sha256sum -c SHA256SUMS)
printf 'Package saved to %s\n' "$out"
