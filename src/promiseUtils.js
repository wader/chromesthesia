'use strict';

function delay(t) {
  return new Promise(function(resolve) {
    setTimeout(resolve, t);
  });
}

function retry(maxRepeat, retryInterval, fn) {
  return fn().catch(err => {
    if (maxRepeat == 0) {
      return Promise.reject(err);
    }
    return delay(retryInterval).then(() => retry(maxRepeat-1, retryInterval, fn))
  });
}
