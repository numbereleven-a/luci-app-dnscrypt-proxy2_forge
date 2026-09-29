'use strict';
'require baseclass';

function safeConfig(path) {
	return typeof path === 'string' && /^\/etc\/dnscrypt-proxy2\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_.-]+\.toml$/.test(path);
}

function safeService(name) {
	return typeof name === 'string' && /^dnscrypt-proxy(?:[A-Za-z0-9_-]*)$/.test(name);
}

function scriptConfig(content) {
	// Read literal assignments only; never execute or source an init script.
	var program = content.match(/^\s*PROG\s*=\s*['"]?\/usr\/sbin\/dnscrypt-proxy['"]?\s*(?:#.*)?$/m);
	var config = content.match(/^\s*CONFIGFILE\s*=\s*(['"]?)(\/[^\s'";]+)\1\s*(?:#.*)?$/m);
	return program && config && safeConfig(config[2]) ? config[2] : null;
}

function discover(services, scripts) {
	var result = [];
	Object.keys(services).sort().forEach(function(service) {
		if (!safeService(service)) return;
		var instances = services[service].instances || {};
		Object.keys(instances).sort().forEach(function(name) {
			var instance = instances[name], command = instance.command || [];
			if (command[0] !== '/usr/sbin/dnscrypt-proxy') return;
			var index = command.indexOf('-config'), config = command[index + 1];
			if (index < 1 || !safeConfig(config)) return;
			result.push({ id: service + '/' + name, service: service, instance: name,
				config: config, running: instance.running === true, pid: instance.pid || null });
		});
	});
	Object.keys(scripts).sort().forEach(function(service) {
		if (!safeService(service) || result.some(function(row) { return row.service === service; })) return;
		var config = scriptConfig(scripts[service]);
		var named = scripts[service].match(/^\s*procd_open_instance\s+['"]?([A-Za-z0-9_-]+)['"]?\s*$/m);
		var instanceName = named ? named[1] : 'instance1';
		if (config) result.push({ id: service + '/' + instanceName, service: service,
			instance: instanceName, config: config, running: false, pid: null });
	});
	result.forEach(function(row) {
		row.shared = result.filter(function(other) { return other.service === row.service; }).length > 1;
	});
	return result.sort(function(a, b) {
		if (a.service !== b.service) {
			if (a.service === 'dnscrypt-proxy') return -1;
			if (b.service === 'dnscrypt-proxy') return 1;
		}
		return a.id.localeCompare(b.id);
	});
}

function encode(value) {
	if (Array.isArray(value)) return '[' + value.map(encode).join(', ') + ']';
	if (typeof value === 'boolean') return String(value);
	if (typeof value === 'number' && Number.isFinite(value)) return String(value);
	if (typeof value === 'string') return JSON.stringify(value);
	throw new Error('Invalid configuration value');
}

function logDelta(before, after) {
	var counts = Object.create(null);
	before.split('\n').forEach(function(line) { counts[line] = (counts[line] || 0) + 1; });
	return after.split('\n').filter(function(line) {
		if (counts[line]) { counts[line]--; return false; }
		return line.length > 0;
	}).join('\n');
}

function withoutComment(text) {
	var quote = '', escaped = false;
	for (var i = 0; i < text.length; i++) {
		var ch = text[i];
		if (escaped) { escaped = false; continue; }
		if (quote === '"' && ch === '\\') { escaped = true; continue; }
		if (quote) { if (ch === quote) quote = ''; }
		else if (ch === '"' || ch === "'") quote = ch;
		else if (ch === '#') return text.slice(0, i);
	}
	return text;
}

function valueLines(lines, start) {
	var text = withoutComment(lines[start].replace(/^\s*\w+\s*=\s*/, '')).trim();
	var end = start;
	if (/^(?:"""|''')/.test(text)) throw new Error('Use the raw editor for multiline strings');
	if (text.charAt(0) === '[') {
		while (!/\]\s*$/.test(text)) {
			end++;
			if (end >= lines.length || /^\s*\[\w/.test(lines[end])) throw new Error('Unterminated TOML array');
			text += ' ' + withoutComment(lines[end]).trim();
		}
	}
	return { text: text, end: end };
}

function decode(text) {
	text = text.trim();
	if (text === 'true' || text === 'false') return text === 'true';
	if (/^-?\d+$/.test(text)) return Number(text);
	if (text.charAt(0) === '"') return JSON.parse(text);
	if (text.charAt(0) === "'") return text.slice(1, -1);
	if (text.charAt(0) === '[') {
		var body = text.slice(1, -1), values = [], quote = '', escaped = false, start = 0;
		for (var i = 0; i <= body.length; i++) {
			var ch = body[i];
			if (escaped) { escaped = false; continue; }
			if (quote === '"' && ch === '\\') { escaped = true; continue; }
			if (quote) { if (ch === quote) quote = ''; }
			else if (ch === '"' || ch === "'") quote = ch;
			else if (ch === ',' || i === body.length) {
				var item = body.slice(start, i).trim();
				if (item) values.push(decode(item));
				start = i + 1;
			}
		}
		return values;
	}
	return text;
}

function parseToml(content) {
	var result = { _commented: {} }, section = '', lines = content.split('\n');
	for (var i = 0; i < lines.length; i++) {
		var line = lines[i], commented = /^\s*#/.test(line);
		var clean = withoutComment(commented ? line.replace(/^\s*#\s*/, '') : line).trim();
		var table = clean.match(/^\[([^\]]+)\]$/);
		if (table && !commented) { section = table[1]; continue; }
		var match = clean.match(/^(\w+)\s*=\s*(.*)$/);
		if (!match) continue;
		try {
			var value = commented ? { text: match[2], end: i } : valueLines(lines, i);
			var key = (section ? section + '.' : '') + match[1];
			(commented ? result._commented : result)[key] = decode(value.text);
			i = value.end;
		} catch (e) { /* Unsupported values remain available in the raw editor. */ }
	}
	return result;
}

function updateToml(content, updates) {
	var pending = Object.assign({}, updates), section = false, output = [], insertion;
	var lines = content.split('\n');
	for (var i = 0; i < lines.length; i++) {
		var line = lines[i];
		if (/^\s*\[/.test(line)) {
			if (!section) insertion = output.length;
			section = true;
		}
		var match = line.match(/^(\s*)(\w+)\s*=/);
		if (section || !match || !Object.prototype.hasOwnProperty.call(pending, match[2])) {
			output.push(line); continue;
		}
		var key = match[2], value = pending[key];
		var existing = valueLines(lines, i);
		delete pending[key];
		if (value === null) {
			for (var n = i; n <= existing.end; n++) output.push('# ' + lines[n]);
		} else output.push(match[1] + key + ' = ' + encode(value));
		i = existing.end;
	}
	var additions = Object.keys(pending).filter(function(key) { return pending[key] !== null; }).map(function(key) {
		if (!/^\w+$/.test(key)) throw new Error('Invalid configuration key');
		return key + ' = ' + encode(pending[key]);
	});
	output.splice.apply(output, [insertion === undefined ? output.length : insertion, 0].concat(additions));
	return output.join('\n');
}

return baseclass.extend({ safeConfig: safeConfig, safeService: safeService, scriptConfig: scriptConfig,
	discover: discover, updateToml: updateToml, parseToml: parseToml, logDelta: logDelta });
