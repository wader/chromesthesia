'use strict';

// functions to use array as a set. useful when variables will be
// serialized by sendMessage etc.

// compare two arrays as sets
function arraySetEqual(a, b) {
  let as = new Set(a);
  let bs = new Set(b);
  if (as.size !== bs.size) {
    return false;
  }
  for (let e in bs) {
    if (!as.has(e)) {
      return false;
    }
  }
  return true;
}

// union of all array sets
function arraySetUnion() {
  let n = new Set();
  for (let i = 0; i < arguments.length; i++) {
    for (let e of arguments[i]) {
      n.add(e);
    }
  }
  return Array.from(n);
}

// first set minus all other sets
function arraySetMinus() {
  let n = new Set(arguments[0]);
  for (let i = 1; i < arguments.length; i++) {
    let a = arguments[i];
    for (let j = 0; j < a.length; j++) {
      n.delete(a[j]);
    }
  }
  return Array.from(n);
}
