
  if (err == 0) {
    AsyncHooks::DefaultTriggerAsyncIdScope trigger_scope(wrap);
    ConnectWrap* req_wrap =
        new ConnectWrap(env, req_wrap_obj, AsyncWrap::PROVIDER_TCPCONNECTWRAP);
    err = req_wrap->Dispatch(uv_tcp_connect,
                             &wrap->handle_,
                             reinterpret_cast<const sockaddr*>(&addr),
                             AfterConnect);
    if (err) {
      delete req_wrap;
    } else {
