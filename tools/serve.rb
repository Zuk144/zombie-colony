# Dev server: static files with caching disabled, so ES module edits always load.
#   ruby tools/serve.rb            → http://localhost:8125
#   ruby tools/serve.rb --lan      → also reachable from an iPad/phone on the same Wi-Fi
require 'webrick'
require 'socket'

root = File.expand_path('..', __dir__)
port = (ENV['PORT'] || 8125).to_i
lan = ARGV.include?('--lan')

server = WEBrick::HTTPServer.new(
  Port: port,
  BindAddress: lan ? '0.0.0.0' : '127.0.0.1',
  DocumentRoot: root,
  AccessLog: [],
  Logger: WEBrick::Log.new($stderr, WEBrick::Log::WARN),
  RequestCallback: ->(_req, res) { res['Cache-Control'] = 'no-store' },
)
server.config[:MimeTypes]['js'] = 'text/javascript'

puts "Holdout dev server: http://localhost:#{port}"
if lan
  ip = Socket.ip_address_list.find { |a| a.ipv4_private? }&.ip_address
  puts "On your iPad (same Wi-Fi): http://#{ip}:#{port}" if ip
end
trap('INT') { server.shutdown }
trap('TERM') { server.shutdown }
server.start
