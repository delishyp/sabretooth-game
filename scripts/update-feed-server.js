// Local generic update feed for the Windows upgrade check. Loopback only.
const fs = require('fs');
const http = require('http');
const path = require('path');

const port = Number(process.argv[2]);
const root = path.resolve(process.argv[3]);
if (!port || !process.argv[3]) {
  console.error('usage: update-feed-server.js <port> <directory>');
  process.exit(2);
}

const server = http.createServer((req, res) => {
  const raw = decodeURIComponent((req.url || '/').split('?')[0]);
  // path.join on Windows treats a leading slash as an absolute path and drops root.
  const rel = (raw === '/' ? 'latest.yml' : raw).replace(/^[/\\]+/, '');
  const file = path.normalize(path.join(root, rel));
  const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep;
  if (file !== root && !file.startsWith(rootWithSep)) {
    res.writeHead(403);
    res.end();
    return;
  }
  fs.stat(file, (err, stat) => {
    if (err || !stat.isFile()) {
      console.log(req.method + ' ' + raw + ' 404');
      res.writeHead(404);
      res.end();
      return;
    }
    const range = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range || '');
    if (range) {
      const start = Number(range[1]);
      const end = range[2] ? Number(range[2]) : stat.size - 1;
      if (start > end || end >= stat.size) {
        res.writeHead(416);
        res.end();
        return;
      }
      console.log(req.method + ' ' + raw + ' 206 ' + start + '-' + end);
      res.writeHead(206, {
        'Content-Type': 'application/octet-stream',
        'Accept-Ranges': 'bytes',
        'Content-Range': 'bytes ' + start + '-' + end + '/' + stat.size,
        'Content-Length': end - start + 1,
      });
      fs.createReadStream(file, { start, end }).pipe(res);
      return;
    }
    console.log(req.method + ' ' + raw + ' 200 ' + stat.size);
    res.writeHead(200, {
      'Content-Type': 'application/octet-stream',
      'Accept-Ranges': 'bytes',
      'Content-Length': stat.size,
    });
    fs.createReadStream(file).pipe(res);
  });
});

server.listen(port, '127.0.0.1', () => {
  console.log('feed http://127.0.0.1:' + port + '/ from ' + root);
});
