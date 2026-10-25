import React from 'react';
import {AppState} from 'react-native';
import {report} from './report';
import {observeAppState} from './session.mjs';
export const Lifecycle = React.createContext(null);
export function LifecycleProvider({children}) {
  const [state, setState] = React.useState(AppState.currentState);
  React.useEffect(() => {
    return observeAppState(AppState, next => {
      setState(next);report('app_state', {state:next});
    });
  }, []);
  return <Lifecycle.Provider value={state}>{children}</Lifecycle.Provider>;
}
