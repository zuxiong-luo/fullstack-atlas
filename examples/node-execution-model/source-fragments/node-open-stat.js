function readFileAfterOpen(err, fd) {
  const context = this.context;

  if (err) {
    context.callback(err);
    return;
  }

  context.fd = fd;

  const req = new FSReqCallback();
  req.oncomplete = readFileAfterStat;
  req.context = context;
  binding.fstat(fd, false, req);
}

function readFileAfterStat(err, stats) {
  const context = this.context;

  if (err)
    return context.close(err);

  // TODO(BridgeAR): Check if allocating a smaller chunk is better performance
  // wise, similar to the promise based version (less peak memory and chunked
  // stringify operations vs multiple C++/JS boundary crossings).
  const size = context.size = isFileType(stats, S_IFREG) ? stats[8] : 0;

  if (size > kIoMaxLength) {
    err = new ERR_FS_FILE_TOO_LARGE(size);
    return context.close(err);
  }

  try {
    if (size === 0) {
      // TODO(BridgeAR): If an encoding is set, use the StringDecoder to concat
      // the result and reuse the buffer instead of allocating a new one.
      context.buffers = [];
    } else {
      context.buffer = Buffer.allocUnsafeSlow(size);
    }
  } catch (err) {
    return context.close(err);
  }
  context.read();
}
