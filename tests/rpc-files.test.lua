-- Run on OpenWrt with the backend path; all data stays under /opt/test/.
local fs = require('nixio.fs')
local json = require('luci.jsonc')
local nixio = require('nixio')
local backend = assert(arg[1])
local root = '/opt/test/forge-files-' .. nixio.getpid() .. '/'
assert(fs.mkdir(root,'700'))
local source = assert(fs.readfile(backend)):gsub('^#![^\n]*\n',''):gsub('/etc/dnscrypt%-proxy2/',root)
local config, rules = root .. 'config.toml', root .. 'rules.txt'
assert(fs.writefile(config,"server_names = ['test']\n"))
assert(fs.chmod(config,'644'))
local output, request, realprint, realread = nil, nil, print, io.read
print = function(text) output = json.parse(text) end
io.read = function() return json.stringify(request) end
local function run(method, params)
  params.config=params.config or config;params.path=params.path or rules; request=params
  output=nil;arg={'call',method};assert(loadstring(source))()
  return assert(output)
end
local realpopen=io.popen
local catalog={}
for i=1,800 do catalog[i]={name='resolver-'..i,proto='DoH',addrs={'192.0.2.1:443'},stamp=string.rep('x',500)} end
local catalogOutput='[NOTICE] source loaded\n'..json.stringify(catalog)..'\n[NOTICE] finished'
local calls=0
io.popen=function(command)
  calls=calls+1;assert(command=='/usr/sbin/dnscrypt-proxy -config '..config..' -list-all -json 2>&1')
  local index=1
  return {read=function(_,size)local value=catalogOutput:sub(index,index+size-1);index=index+size;return value~='' and value or nil end,close=function()return true end}
end
local result=run('resolvers',{all=true});assert(#result.servers==800,result.error)
assert(result.servers[1].stamp==nil and result.servers[1].name=='resolver-1')
assert(#json.stringify(result)<262144 and #catalogOutput>262144)
assert(run('resolvers',{all='true'}).error)
assert(run('resolvers',{all=true,config=root..'bad;command.toml'}).error)
assert(calls==1)
io.popen=realpopen
local metadata=run('stat',{});assert(metadata.editable and metadata.size==0 and not metadata.exists)
local huge=root..'adb_list.overall';assert(fs.writefile(huge,string.rep('x',1048577)))
metadata=run('stat',{path=huge});assert(not metadata.editable and metadata.size==1048577 and metadata.limit==1048576)
assert(run('read',{path=huge}).error:find('SSH',1,true))
local boundary=root..'boundary.txt';assert(fs.writefile(boundary,string.rep('x',1048576)))
assert(run('stat',{path=boundary}).editable)
assert(#run('read',{path=boundary}).content==1048576)
local boundaryNew=root..'boundary-new.txt'
assert(run('write',{path=boundaryNew,content=string.rep('x',1048576),expected='',exists=false}).saved)
assert(fs.stat(boundaryNew).size==1048576)
local small=root..'small.overall';assert(fs.writefile(small,'example.test'))
assert(run('read',{path=small}).content=='example.test')
local result=run('read',{});assert(result.content=='' and result.exists==false)
result=run('write',{content='one',expected='',exists=false});assert(result.saved)
assert(fs.stat(rules).modestr=='rw-r--r--')
result=run('write',{content='bad',expected='',exists=false});assert(result.error and fs.readfile(rules)=='one')
for i=1,12 do
  local old=fs.readfile(rules)
  result=run('write',{content=tostring(i),expected=old,exists=true});assert(result.saved,result.error)
  -- Each call runs as a separate process in rpcd. Vary the mocked pid here.
  local realpid=nixio.getpid; nixio.getpid=function()return realpid()+i end
end
local versions=run('versions',{}).versions;assert(#versions==10,#versions)
local previous=run('version',{id=versions[1].id}).content;assert(type(previous)=='string')
assert(run('version',{id='../config.toml'}).error)
assert(run('read',{path='/etc/passwd'}).error)
assert(run('read',{path=root..'../outside.txt'}).error)
assert(run('write',{content=string.rep('x',1048577),expected='12',exists=true}).error)
assert(fs.symlink(config,root..'link.txt'))
assert(run('read',{path=root..'link.txt'}).error)
local old=fs.readfile(config)
assert(run('write',{path=config,content=old..'# edited\n',expected=old,exists=true}).saved)
assert(fs.stat(config).modestr=='rw-r--r--')
assert(#run('versions',{path=config}).versions==1)
print=realprint;io.read=realread
realprint('Passed file RPC: creation, permissions, stale writes, ten revisions, preview, isolation, size limits and symlink/path rejection')
-- Remove only this test's verified directory.
assert(root:match('^/opt/test/forge%-files%-%d+/$'))
fs.remove(root:sub(1,-2))
