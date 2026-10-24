import React from 'react';
import {AppState} from 'react-native';
import {report} from './report';
export const Lifecycle = React.createContext(null);
export function LifecycleProvider({children}) {
  const [state, setState] = React.useState(AppState.currentState);
  React.useEffect(() => {
    report('app_state', {state: AppState.currentState});
    const subscription = AppState.addEventListener('change', next => {
      setState(next);
      report('app_state', {state: next});
    });
    return () => subscription.remove();
  }, []);
  return <Lifecycle.Provider value={state}>{children}</Lifecycle.Provider>;
}
