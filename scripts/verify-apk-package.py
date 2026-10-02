"""Verify an OpenWrt APK with the SDK's apk-tools 3 executable."""
import json
from pathlib import Path
import re
import subprocess
import sys
import tempfile

root = Path(__file__).resolve().parents[1]
package = Path(sys.argv[1]).resolve()
apk = sys.argv[2]
expected = {
    'usr/libexec/rpcd/dnscrypt-forge-files': root / 'root/usr/libexec/rpcd/dnscrypt-forge-files',
    'usr/libexec/rpcd/dnscrypt-forge': root / 'root/usr/libexec/rpcd/dnscrypt-forge',
    'www/luci-static/resources/dnscrypt-forge-v13r8.js': root / 'htdocs/luci-static/resources/dnscrypt-forge-v13r8.js',
    'www/luci-static/resources/view/dnscrypt-proxy2-forge/dnscrypt-proxy2-v13r8.js': root / 'htdocs/luci-static/resources/view/dnscrypt-proxy2-forge/dnscrypt-proxy2-v13r8.js',
    'usr/share/luci/menu.d/luci-app-dnscrypt-proxy2-forge.json': root / 'root/usr/share/luci/menu.d/luci-app-dnscrypt-proxy2-forge.json',
    'usr/share/rpcd/acl.d/luci-app-dnscrypt-proxy2-forge.json': root / 'root/usr/share/rpcd/acl.d/luci-app-dnscrypt-proxy2-forge.json',
    'usr/share/doc/luci-app-dnscrypt-proxy2-forge/LICENSE': root / 'LICENSE',
    'usr/share/doc/luci-app-dnscrypt-proxy2-forge/NOTICE': root / 'NOTICE',
}

metadata = subprocess.check_output([apk, 'adbdump', str(package)], text=True)

with tempfile.TemporaryDirectory() as folder:
    subprocess.run([apk, 'extract', '--allow-untrusted', '--no-chown', '--destination', folder, str(package)], check=True)
    extracted = Path(folder)
    files = {str(p.relative_to(extracted)) for p in extracted.rglob('*') if p.is_file()}
    bookkeeping = 'lib/apk/packages/luci-app-dnscrypt-proxy2-forge.list'
    assert files == set(expected) | {bookkeeping}, files - set(expected)
    for name, source in expected.items():
        content = (extracted / name).read_bytes()
        assert content == source.read_bytes(), 'Outdated payload: ' + name
        assert not re.search(rb'(?i)[a-z]:\\(?:Temp|Users)\\|/(?:home|Users)/[^/\s]+/|192\.168\.\d+\.\d+', content), 'Private payload: ' + name
        if name.endswith('.json'):
            json.loads(content)
    info = metadata.split('paths:', 1)[0]
    assert re.search(r'^  name: luci-app-dnscrypt-proxy2-forge$', info, re.M)
    assert re.search(r'^  arch: noarch$', info, re.M)
    makefile = (root / 'Makefile').read_text()
    version = re.search(r'^PKG_VERSION:=(.+)$', makefile, re.M)[1]
    release = re.search(r'^PKG_RELEASE:=(.+)$', makefile, re.M)[1]
    assert re.search(r'^  version: ' + re.escape(version + '-r' + release) + r'$', info, re.M)
    assert re.search(r'^  license: GPL-3\.0-or-later$', info, re.M)
    for dependency in ['luci-base', 'rpcd-mod-file', 'luci-lib-jsonc', 'lua', 'libubus-lua', 'dnscrypt-proxy2']:
        assert re.search(r'^    - ' + re.escape(dependency) + r'(?:[-<>=~].*)?$', info, re.M), 'Missing dependency: ' + dependency
    assert not re.search(r'(?i)[a-z]:\\(?:Temp|Users)\\|/(?:home|Users)/[^/\s]+/|192\.168\.\d+\.\d+', metadata)
subprocess.run([apk, 'verify', '--allow-untrusted', str(package)], check=True)
print('Verified APK: exact source payload, bookkeeping, dependencies, architecture, license and integrity')
