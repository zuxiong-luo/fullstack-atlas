
  char* buf = buffer_data + off;
  uv_buf_t uvbuf = uv_buf_init(buf, len);

  if (argc > 5) {  // read(fd, buffer, offset, len, pos, req)
    FSReqBase* req_wrap_async = GetReqWrap(args, 5);
    CHECK_NOT_NULL(req_wrap_async);
    FS_ASYNC_TRACE_BEGIN0(UV_FS_READ, req_wrap_async)
    AsyncCall(env, req_wrap_async, args, "read", UTF8, AfterInteger,
              uv_fs_read, fd, &uvbuf, 1, pos);
  } else {  // read(fd, buffer, offset, len, pos)
