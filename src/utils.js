'use strict';

// creates a new state transition function
// reduce(state, action) -> state
//   use action to get to a new state
// update(oldState, newState, defer) -> void
//   perform ui updates etc
//   use defer(fn) to run code that might trigger state transitions
function createState(initialState, reduce, update) {
  let currentState = initialState;
  let defers = [];

  let defer = fn => {
    defers.push(fn);
  };

  let transition = action => {
    let oldState = currentState;
    currentState = reduce(currentState, action);
    update(oldState, currentState, defer);
    if (defers.length > 0) {
      let oldDefers = defers;
      defers = [];
      oldDefers.forEach(fn => fn());
    }
  };

  return transition;
}

// reduce using an object mapping properties to an object mapping actions
// to reduce function properties
// {
//   propName: {
//     actionName: (propState, propAction) => ...
//   }
// }
// ex:
// state {count: 1}
// reduce map object: {
//   count: {
//     add: (propState, propAction) => propState + propAction
//   }
// }
// given action {add: 2}
// new state would be {count: 3}
function reduceProps(state, action, props) {
  let n = Object.assign({}, state);

  for (let p in props) {
    if (!props.hasOwnProperty(p)) {
      continue;
    }

    for (let a in action) {
      if (!action.hasOwnProperty(a)) {
        continue;
      }

      let fn = props[p][a];
      if (!fn) {
        continue;
      }

      n[p] = fn(n[p], action[a]);
    }
  }

  return n;
}

// dom('a') -> <a/>
// dom('a', 'text') -> <a>text</a>
// dom('a', {href: 'url'}, 'text') -> <a href="url">text</a>
// dom('button', {click: (e) => { ... }}, ...) -> <button> with click event handler
// dom('a', dom('b') -> <a><b></a>
// dom('span', [['nested'], 'arrays', dom('b')]) -> <span>nested arrays <b></span>
// undefined and null are ignored
function dom() {
  let elm = document.createElement(arguments[0]);

  for(let i = 1; i < arguments.length; i++) {
    let arg = arguments[i];

    if (typeof(arg) === 'string') {
      elm.textContent = arg;
    } else if (arg instanceof Element || arg instanceof Array) {
      let flatAppend = arg => {
        if (arg instanceof Element) {
          arg = [arg];
        }
        arg.forEach(e => {
          if (typeof(e) === 'string') {
            elm.appendChild(document.createTextNode(e));
          } else if (e instanceof Element) {
            elm.appendChild(e);
          } else if (e instanceof Array) {
            flatAppend(e);
          } else if (e === undefined || e === null) {
            // nop
          } else {
            throw('invalid element ' + e);
          }
        });
      };
      flatAppend(arg);
    } else if (arg !== null && typeof(arg) === 'object') {
      Object.keys(arg).forEach(p => {
        let v = arg[p];
        if (typeof(v) === 'function') {
          elm.addEventListener(p, v);
        } else {
          elm.setAttribute(p, arg[p]);
        }
      });
    } else if (arg === undefined || arg === null) {
      // nop
    } else {
      throw('invalid arg ' + arg);
    }
  }

  return elm;
}

const H = {
  div: dom.bind(undefined, 'div'),
  span: dom.bind(undefined, 'span'),
  button: dom.bind(undefined, 'button'),
  input: dom.bind(undefined, 'input'),
  a: dom.bind(undefined, 'a'),
  label: dom.bind(undefined, 'label'),
  p: dom.bind(undefined, 'p'),
  ul: dom.bind(undefined, 'ul'),
  li: dom.bind(undefined, 'li')
};

function replaceChildren(elm, child) {
  while(elm.children.length > 0) {
    elm.removeChild(elm.firstChild);
  }
  elm.appendChild(child);
}

// usefull for wav debug
function saveData(data, fileName) {
  var a = document.createElement('a');
  a.style = 'display: none';
  document.body.appendChild(a);
  var blob = new Blob([data], {type: 'octet/stream'});
  var url = window.URL.createObjectURL(blob);
  a.href = url;
  a.download = fileName;
  a.click();
  window.URL.revokeObjectURL(url);
}

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

function reloadOnChange() {
  let ws = new WebSocket('ws://127.0.0.1:8000/.devd.livereload');
  ws.onmessage = () => {
    // reload current tab with some delay
    // require permissions in manifest
    // chrome.tabs.executeScript(null, {
    //   code: 'setTimeout(function() { document.location.reload(); }, 200);'
    // });

    // reload extension
    chrome.runtime.reload();
  };
}
