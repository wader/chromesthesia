'use strict';

// reloadOnChange();

// uses only JSON friendly types so that sendMessage works
const initialState = {
  options: {
    captureDuration: defaultOptions.captureDuration,
    showForAllTabs: defaultOptions.showForAllTabs
  },
  capture: {
    status: 'idle'
  },
  allTabIds: [],
  audibleTabIds: [],
  usedInTabIds: []
};

function validMatchersForOptions(options) {
  return matchers.filter(m => m.validOptions(options[m.name]) && m);
}

function reduce(state, action) {
  return reduceProps(state, action, {
    options: {
      changeOptions: (propState, propAction) => Object.assign({}, propState, propAction)
    },
    capture: {
      openPageAction: (propState, _propAction) => {
        if (validMatchersForOptions(state.options).length === 0) {
          return {status: 'options'};
        } else if (propState.status === 'idle' || propState.status === 'options') {
          return {
            status: 'capturing',
            tabId: action.openPageAction.tabId,
            start: Date.now()
          };
        } else {
          return propState;
        }
      },
      startCapture: (_propState, _propAction) => ({
        status: 'capturing',
        tabId: action.startCapture.tabId,
        start: Date.now()
      }),
      captureResult: (propState, propAction) => Object.assign({status: 'result'}, propAction)
    },
    allTabIds: {
      createTabs: (propState, propAction) => arraySetUnion(propState, propAction),
      removeTabs: (propState, propAction) => arraySetMinus(propState, propAction)
    },
    audibleTabIds: {
      removeTabs: (propState, propAction) => arraySetMinus(propState, propAction),
      changeTabIsAudible: (propState, propAction) => {
        let n = Array.from(propState);
        if (propAction.audible) {
          return arraySetUnion(n, [propAction.tabId]);
        } else {
          return arraySetMinus(n, [propAction.tabId]);
        }
      }
    },
    usedInTabIds: {
      openPageAction: (propState, propAction) => arraySetUnion(propState, [propAction.tabId]),
      removeTabs: (propState, propAction) => arraySetMinus(propState, propAction)
    }
  });
}

function update(oldState, newState, defer) {
  let oldIsCapturing = oldState.capture.status == 'capturing';
  let newIsCapturing = newState.capture.status == 'capturing';

  if (!oldIsCapturing && newIsCapturing) {
    defer(() => captureAndMatch(newState.options));

    newState.allTabIds.forEach(tabId => {
      chrome.tabs.get(tabId, () => {
        if (!chrome.runtime.lastError) {
          chrome.pageAction.setIcon({
            tabId: tabId,
            path: 'icons/iconCapturing38.png'
          });
        }
      });
    });
  } else if (oldIsCapturing && !newIsCapturing) {
    newState.allTabIds.forEach(tabId => {
      chrome.tabs.get(tabId, () => {
        if (!chrome.runtime.lastError) {
          chrome.pageAction.setIcon({
            tabId: tabId,
            path: 'icons/icon38.png'
          });
        }
      });
    });
  }

  let oldHasValidMatches = validMatchersForOptions(oldState.options).length > 0;
  let oldPageActionVisibleIds;
  if (oldIsCapturing || !oldHasValidMatches || oldState.options.showForAllTabs) {
    oldPageActionVisibleIds = oldState.allTabIds;
  } else {
    oldPageActionVisibleIds = arraySetUnion(oldState.audibleTabIds, oldState.usedInTabIds);
  }
  let newHasValidMatches = validMatchersForOptions(newState.options).length > 0;
  let newPageActionVisibleIds;
  if (newIsCapturing || !newHasValidMatches || newState.options.showForAllTabs) {
    newPageActionVisibleIds = newState.allTabIds;
  } else {
    newPageActionVisibleIds = arraySetUnion(newState.audibleTabIds, newState.usedInTabIds);
  }

  if (!arraySetEqual(oldPageActionVisibleIds, newPageActionVisibleIds)) {
    let removedIds = arraySetMinus(oldState.allTabIds, newState.allTabIds);
    let hideIds = arraySetMinus(oldPageActionVisibleIds, newPageActionVisibleIds, removedIds);
    let showIds = arraySetMinus(newPageActionVisibleIds, oldPageActionVisibleIds, removedIds);

    // TODO: there is some kind of tab remove race.
    // should chrome.tabs.get and lastError really be needed?
    hideIds.forEach(tabId => {
      chrome.tabs.get(tabId, () => {
        if (!chrome.runtime.lastError) {
          chrome.pageAction.hide(tabId);
        }
      });
    });
    showIds.forEach(tabId => {
      chrome.tabs.get(tabId, () => {
        if (!chrome.runtime.lastError) {
          chrome.pageAction.show(tabId);
          chrome.pageAction.setIcon({
            tabId: tabId,
            path: newIsCapturing ? 'icons/iconCapturing38.png' : 'icons/icon38.png'
          });
        }
      });
    });
  }

  chrome.runtime.sendMessage({state: newState});
}

const stateTransition = createState(
  initialState,
  reduce,
  update
  // (state, action) => {console.log('reduce', action); return reduce(state, action);},
  // (oldState, newState, defer) => {console.log('update', oldState, newState); update(oldState, newState, defer);}
);

function captureAndMatch(options) {
  let validMatchers = validMatchersForOptions(options);
  if (validMatchers.length === 0) {
    stateTransition({needOptions: true});
    return;
  }

  return captureAudio(options.captureDuration*1000)
  .then(capture => {
    return Promise.all(validMatchers.map(m => {
      return (
        // assign source matcher, matches and convert catches to errors
        m.match(options[m.name], capture)
        .then(r => Object.assign({matches: r, matcher: m}))
        // e.message to convert error object to string
        .catch(e => Object.assign({error: (e.message || e), matcher: m}))
      );
    }));
  })
  .then(r => {
    stateTransition({captureResult: {
      errors: r.filter(m => m.error),
      matches: r.filter(m => m.matches)
    }});
  });
}

chrome.runtime.onMessage.addListener((request, _sender, _response) => {
  if (request.action) {
    stateTransition(request.action);
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.audible !== undefined) {
    stateTransition({changeTabIsAudible: {tabId: tab.id, audible: tab.audible}});
  }

  if (changeInfo.status === 'complete') {
    // this will take care of created tabs and reloaded tabs
    // also it seems like pageAction.show can't be used until complete status
    stateTransition({removeTabs: [tab.id]});
    stateTransition({createTabs: [tab.id]});
    chrome.tabs.get(tab.id, tab => {
      if (!chrome.runtime.lastError) {
        stateTransition({changeTabIsAudible: {tabId: tab.id, audible: tab.audible}});
      }
    });
  }
});

chrome.tabs.onRemoved.addListener((tabId, _removeInfo) => {
  stateTransition({removeTabs: [tabId]});
});

chrome.tabs.query({}, tabs => {
  stateTransition({createTabs: tabs.map(tab => tab.id)});
});

chrome.tabs.query({audible: true}, tabs => {
  tabs.forEach(t => stateTransition({changeTabIsAudible: {tabId: t.id, audible: t.audible}}));
});

chrome.storage.sync.get(null, items => {
  stateTransition({changeOptions: items});
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'sync') {
    return;
  }

  let newValues = Object.keys(changes).reduce((acc, p) =>  {
    acc[p] = changes[p].newValue;
    return acc;
  }, {});

  stateTransition({changeOptions: newValues});
});
