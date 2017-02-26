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
    let oldDefers = defers;
    defers = [];
    oldDefers.forEach(fn => fn());
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
