  do {
    errno = 0;
    r = connect(uv__stream_fd(handle), addr, addrlen);
  } while (r == -1 && errno == EINTR);

  /* We not only check the return value, but also check the errno != 0.
   * Because in rare cases connect() will return -1 but the errno
   * is 0 (for example, on Android 4.3, OnePlus phone A0001_12_150227)
   * and actually the tcp three-way handshake is completed.
   */
  if (r == -1 && errno != 0) {
    if (errno == EINPROGRESS)
      ; /* not an error */
    else if (errno == ECONNREFUSED
#if defined(__OpenBSD__)
      || errno == EINVAL
#endif
      )
    /* If we get ECONNREFUSED (Solaris) or EINVAL (OpenBSD) wait until the
     * next tick to report the error. Solaris and OpenBSD wants to report
     * immediately -- other unixes want to wait.
     */
      handle->delayed_error = UV__ERR(ECONNREFUSED);
    else
      return UV__ERR(errno);
  }
