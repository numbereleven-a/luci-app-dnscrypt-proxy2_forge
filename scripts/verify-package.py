"""Check the exact runtime payload and public metadata in a built IPK."""
import io
import json
from pathlib import Path
import re
import sys
import tarfile

root = Path(__file__).resolve().parents[1]
package = Path(sys.argv[1])
expected = {
    'usr/libexec/rpcd/dnscrypt-forge': root / 'root/usr/libexec/rpcd/dnscrypt-forge',
    'www/luci-static/resources/dnscrypt-forge-v013r1.js': root / 'htdocs/luci-static/resources/dnscrypt-forge-v013r1.js',
    'www/luci-static/resources/view/dnscrypt-proxy2-forge/dnscrypt-proxy2-v013r1.js': root / 'htdocs/luci-static/resources/view/dnscrypt-proxy2-forge/dnscrypt-proxy2-v013r1.js',
    'usr/share/luci/menu.d/luci-app-dnscrypt-proxy2-forge.json': root / 'root/usr/share/luci/menu.d/luci-app-dnscrypt-proxy2-forge.json',
    'usr/share/rpcd/acl.d/luci-app-dnscrypt-proxy2-forge.json': root / 'root/usr/share/rpcd/acl.d/luci-app-dnscrypt-proxy2-forge.json',
    'usr/share/doc/luci-app-dnscrypt-proxy2-forge/LICENSE': root / 'LICENSE',
    'usr/share/doc/luci-app-dnscrypt-proxy2-forge/NOTICE': root / 'NOTICE',
}
forbidden = re.compile(rb'(?i)[a-z]:\\(?:Temp|Users)\\|/(?:home|Users)/[^/\s]+/|192\.168\.\d+\.\d+')
with tarfile.open(package) as archive:
    assert {entry.name.lstrip('./') for entry in archive.getmembers()} == {'debian-binary', 'control.tar.gz', 'data.tar.gz'}
    with tarfile.open(fileobj=io.BytesIO(archive.extractfile('./control.tar.gz').read())) as control:
        metadata = control.extractfile('./control').read()
        assert b'Architecture: all' in metadata
        version = re.search(r'^PKG_VERSION:=(.+)$', (root / 'Makefile').read_text(), re.M)[1]
        release = re.search(r'^PKG_RELEASE:=(.+)$', (root / 'Makefile').read_text(), re.M)[1]
        assert ('Version: ' + version + '-r' + release).encode() in metadata
        assert all(dependency.encode() in metadata for dependency in ['luci-base', 'rpcd-mod-file', 'luci-lib-jsonc', 'lua', 'libubus-lua', 'dnscrypt-proxy2'])
        for entry in control.getmembers():
            if entry.isfile():
                assert not forbidden.search(control.extractfile(entry).read()), f'Unexpected private metadata: {entry.name}'
    with tarfile.open(fileobj=io.BytesIO(archive.extractfile('./data.tar.gz').read())) as payload:
        files = {entry.name.lstrip('./'): entry for entry in payload.getmembers() if entry.isfile()}
        assert set(files) == set(expected), 'Unexpected payload files'
        for name, source in expected.items():
            content = payload.extractfile(files[name]).read()
            assert content == source.read_bytes(), f'Outdated payload: {name}'
            assert not forbidden.search(content), f'Unexpected private content: {name}'
            if name.endswith('.json'):
                json.loads(content)
print('Verified: seven expected files, source equality, menu/ACL JSON, dependencies, license, clean public metadata')
