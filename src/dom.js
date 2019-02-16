'use strict';

// dom('a') -> <a/>
// dom('a', 'text') -> <a>text</a>
// dom('a', {href: 'url'}, 'text') -> <a href="url">text</a>
// dom('button', {click: (e) => { ... }}, ...) -> <button> with click event handler
// dom('a', dom('b')) -> <a><b></a>
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
        } else if (v !== undefined && v !== null) {
          elm.setAttribute(p, v);
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
