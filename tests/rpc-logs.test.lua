local json = require('luci.jsonc')
local backend = assert(arg[1], 'Pass the RPC backend path')
local request, services, output, loglines
local real_print = print
package.loaded.ubus = { connect = function()
  return { call = function(_, object, method, params)
    assert(object == 'service' and method == 'list')
    assert(params.name == request.service)
    return services
  end, close = function() end }
end }
io.read = function() return json.stringify(request) end
io.popen = function(command)
  assert(command == '/sbin/logread -l 1000 2>/dev/null')
  local index = 0
  return { lines = function() return function() index = index + 1; return loglines[index] end end,
    close = function() return true end }
end
print = function(value) output = json.parse(value) end
os.exit = function() error('rpc-exit') end
local function run()
  arg = { 'call', 'logs' }
  output = nil
  local success, message = pcall(dofile, backend)
  assert(success or tostring(message):match('rpc%-exit'), message)
  return assert(output)
end
request = {service='dnscrypt-proxy-backup', instance='instance1', previous_pid=100}
services = {['dnscrypt-proxy-backup']={instances={instance1={running=true,pid=200,command={'/usr/sbin/dnscrypt-proxy'}}}}}
loglines = {
  'timestamp daemon.info dnscrypt-proxy-backup[100]: old startup',
  'timestamp daemon.info dnscrypt-proxy-backup[200]: resolver OK (rtt: 17ms)',
  'timestamp daemon.info dnscrypt-proxy-backup[200]: Ready',
  'timestamp daemon.info dnscrypt-proxy[300]: other instance',
  'timestamp daemon.info dnsmasq[200]: unrelated message'
}
local result = run()
assert(result.running and result.pid == 200)
assert(result.log:find('old startup',1,true) and result.log:find('17ms',1,true))
assert(not result.log:find('other instance',1,true) and not result.log:find('unrelated',1,true))
request.previous_pid=0
assert(not run().log:find('old startup',1,true))
services = {}
request.previous_pid=100
result = run()
assert(not result.running and result.pid == 0 and result.log:find('old startup',1,true))
request.service='dnscrypt-proxy;reboot'
assert(run().error == 'Invalid service or instance')
request.service='dnscrypt-proxy-backup'
services = {['dnscrypt-proxy-backup']={instances={instance1={command={'/usr/sbin/dnsmasq'}}}}}
assert(run().error == 'Not a DNSCrypt instance')
services = {['dnscrypt-proxy-backup']={instances={instance1={running=true,pid=200,command={'/usr/sbin/dnscrypt-proxy'}}}}}
loglines = {}
for i=1,300 do loglines[i]='timestamp daemon.info dnscrypt-proxy-backup[200]: entry '..i end
result = run()
local count = 0
for _ in result.log:gmatch('[^\n]+') do count = count + 1 end
assert(count == 250 and not result.log:find(': entry 1\n',1,true))
real_print('Passed RPC logs: PID isolation, previous process, stopped service, validation, bounded output')
