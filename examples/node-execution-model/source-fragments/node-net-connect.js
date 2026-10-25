  if (addressType === 6 || addressType === 4) {
    const req = new TCPConnectWrap();
    req.oncomplete = afterConnect;
    req.address = address;
    req.port = port;
    req.localAddress = localAddress;
    req.localPort = localPort;
    req.addressType = addressType;

    if (addressType === 4)
      err = self._handle.connect(req, address, port);
    else
      err = self._handle.connect6(req, address, port);
  } else {
