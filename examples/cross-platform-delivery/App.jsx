import React from 'react';
import {View, Text, Button} from 'react-native';
import * as Application from 'expo-application';
import release from './build-profile.json';
import {existingOrSeeded} from './lib/notes';
import {controlledFailure} from './lib/controlled-error';
import {labBase, report} from './lib/report';
export default function App() {
  const [state,setState]=React.useState({status:'loading'}),[error,setError]=React.useState(null);
  function capture() {
    try {controlledFailure();}
    catch (caught) {
      const stack=String(caught.stack).slice(0,12000);
      setError({message:caught.message,stack});
      report('controlled_js_error',{releaseId:release.releaseId,message:caught.message,stack});
    }
  }
  React.useEffect(()=>{
    let mounted=true;
    (async()=>{
      try {
        const nativeCode=Application.nativeBuildVersion,nativeName=Application.nativeApplicationVersion;
        if(nativeCode!==String(release.versionCode)||nativeName!==release.versionName)throw new Error('NOT_THIS_STANDALONE_BUILD');
        const saved=await existingOrSeeded(release.releaseId);
        const result={status:'ready',releaseId:release.releaseId,nativeCode,nativeName,...saved};
        if(mounted)setState(result);
      } catch(caught) {if(mounted)setState({status:'error',code:caught.message});}
    })();
    return()=>{mounted=false;};
  },[]);
  React.useEffect(()=>{
    if(state.status==='ready'){
      report('delivery_rendered',state);
      if(labBase&&release.releaseId==='lab-v2')capture();
    } else if(state.status==='error')report('delivery_error',state);
  },[state]);
  return <View style={{padding:24,gap:16}}><Text>仅本地假数据交付实验，无生产签名或商店上传。</Text>
    <Text testID="delivery-state">{JSON.stringify(state)}</Text><Button title="捕获一个教学JS错误并保留栈" onPress={capture}/>
    <Text>{error?JSON.stringify(error):'尚未触发错误；捕获后应用仍运行。'}</Text>
  </View>;
}
