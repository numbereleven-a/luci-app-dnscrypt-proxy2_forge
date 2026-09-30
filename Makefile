include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-dnscrypt-proxy2-forge
PKG_VERSION:=1.3
PKG_RELEASE:=6
PKG_LICENSE:=GPL-3.0-or-later

include $(INCLUDE_DIR)/package.mk

define Package/$(PKG_NAME)
  SECTION:=luci
  CATEGORY:=LuCI
  SUBMENU:=3. Applications
  TITLE:=DNSCrypt-Proxy 2 Forge multi-instance interface
  DEPENDS:=+luci-base +rpcd-mod-file +luci-lib-jsonc +lua +libubus-lua +dnscrypt-proxy2
  PKGARCH:=all
endef

define Package/$(PKG_NAME)/description
  LuCI interface for separate DNSCrypt-Proxy 2 instances on OpenWrt.
endef

define Build/Configure
endef
define Build/Compile
endef

define Package/$(PKG_NAME)/postinst
#!/bin/sh
rm -f "$${IPKG_INSTROOT}"/tmp/luci-indexcache.*.json
endef

define Package/$(PKG_NAME)/install
	$(INSTALL_DIR) $(1)/www/luci-static/resources/view/dnscrypt-proxy2-forge
	$(INSTALL_DATA) ./htdocs/luci-static/resources/view/dnscrypt-proxy2-forge/dnscrypt-proxy2-v13r6.js $(1)/www/luci-static/resources/view/dnscrypt-proxy2-forge/
	$(INSTALL_DIR) $(1)/www/luci-static/resources
	$(INSTALL_DATA) ./htdocs/luci-static/resources/dnscrypt-forge-v13r6.js $(1)/www/luci-static/resources/
	$(INSTALL_DIR) $(1)/usr/share/luci/menu.d $(1)/usr/share/rpcd/acl.d
	$(INSTALL_DATA) ./root/usr/share/luci/menu.d/*.json $(1)/usr/share/luci/menu.d/
	$(INSTALL_DATA) ./root/usr/share/rpcd/acl.d/*.json $(1)/usr/share/rpcd/acl.d/
	$(INSTALL_DIR) $(1)/usr/libexec/rpcd
	$(INSTALL_BIN) ./root/usr/libexec/rpcd/dnscrypt-forge ./root/usr/libexec/rpcd/dnscrypt-forge-files $(1)/usr/libexec/rpcd/
	$(INSTALL_DIR) $(1)/usr/share/doc/$(PKG_NAME)
	$(INSTALL_DATA) ./LICENSE ./NOTICE $(1)/usr/share/doc/$(PKG_NAME)/
endef

$(eval $(call BuildPackage,$(PKG_NAME)))
