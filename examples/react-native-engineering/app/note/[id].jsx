import React from 'react';
import {View, Text, Button} from 'react-native';
import {router, useLocalSearchParams, useFocusEffect} from 'expo-router';
import {Lifecycle} from '../../lib/lifecycle';
import {createSession, createCapabilitySession, noteId} from '../../lib/session.mjs';
import {loadNote, nativeFiles, requestLocationPermission} from '../../lib/native-port';
import {labBase, report} from '../../lib/report';
export default function Note() {
  const parameters = useLocalSearchParams();
  const [focused, setFocused] = React.useState(false), [state, setState] = React.useState({status:'paused'});
  const [capability, setCapability] = React.useState({status:'idle'});
  const appState = React.useContext(Lifecycle), eligible = focused && appState === 'active';
  const scenarioRan = React.useRef('');
  const capabilities = React.useMemo(() => createCapabilitySession(setCapability, report), []);
  const session = React.useMemo(() => createSession(loadNote, value => {
    setState(value);report('note_state', {status:value.status, id:value.id ?? null});
  }), []);
  React.useEffect(() => {report('note_rendered', {status:state.status, id:state.id ?? null});}, [state]);
  let id;
  try {id = noteId(parameters.id);} catch {id = null;}
  useFocusEffect(React.useCallback(() => {
    setFocused(true);report('screen_focus', {id});
    return () => {
      capabilities.dispose();session.dispose();
      setFocused(false);report('screen_blur', {id});
    };
  }, [id, session, capabilities]));
  React.useEffect(() => {
    capabilities.setEligible(Boolean(eligible && id));
    if (eligible && id) session.start(id);
    else {session.pause();report('note_paused', {id});}
    return () => {session.dispose();capabilities.dispose();};
  }, [session, capabilities, eligible, id]);
  function run(kind) {
    return capabilities.run(kind, () => kind === 'files' ? nativeFiles(id) : requestLocationPermission());
  }
  React.useEffect(() => {
    const scenario = parameters.case;
    if (!labBase || !eligible || !id || !['files','permission'].includes(scenario)) return;
    const key = id + ':' + scenario;
    if (scenarioRan.current === key) return;
    scenarioRan.current = key;
    void run(scenario);
  }, [eligible, id, parameters.case]);
  if (!id) return <View><Text>未知教学笔记，未开始任何原生操作。</Text></View>;
  return <View style={{padding:24, gap:16}}><Text>页面 {id}；AppState {String(appState)}；focus {String(focused)}</Text>
    <Text testID="note-state">{JSON.stringify(state)}</Text><Text testID="native-state">{JSON.stringify(capability)}</Text>
    <Button title="本机文件往返与缺文件失败" disabled={!eligible || capability.status==='running'} onPress={() => run('files')}/>
    <Button title="请求前台定位授权（不读取位置）" disabled={!eligible || capability.status==='running'} onPress={() => run('permission')}/>
    <Button title="回到列表" onPress={() => router.replace('/')}/>
  </View>;
}
