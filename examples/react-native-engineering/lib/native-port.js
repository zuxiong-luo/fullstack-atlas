import {Platform} from 'react-native';
import {Directory, File, Paths} from 'expo-file-system';
import * as Location from 'expo-location';
import {labBase} from './report';
import {noteId} from './session.mjs';

export async function loadNote(value, signal) {
  const id = noteId(value);
  if (!labBase) return {id, title: '只在本机展示的教学笔记 ' + id};
  const response = await fetch(labBase + '/gate?id=' + id, {signal});
  if (!response.ok) throw new Error('fixture HTTP status');
  return response.json();
}

export async function nativeFiles(value) {
  const id = noteId(value);
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return {status: 'unsupported'};
  const directory = new Directory(Paths.cache, 'atlas-rn-lab');
  directory.create({idempotent: true, intermediates: true});
  const file = new File(directory, id + '.json');
  try {
    file.write(JSON.stringify({id, title: 'fake note'}));
    const result = JSON.parse(await file.text());
    if (result.id !== id || result.title !== 'fake note') throw new Error('round trip mismatch');
    let missingRejected = false;
    try {await new File(directory, 'never-created.json').text();}
    catch {missingRejected = true;}
    if (!missingRejected) throw new Error('expected native missing-file rejection');
    return {status: 'ok', roundTrip: true, missingRejected};
  } finally {if (directory.exists) directory.delete();}
}

export async function requestLocationPermission() {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return {status: 'unsupported'};
  // This demonstration asks only for authorization. It never reads a location.
  const result = await Location.requestForegroundPermissionsAsync();
  return {status: result.status, granted: result.granted, canAskAgain: result.canAskAgain};
}
