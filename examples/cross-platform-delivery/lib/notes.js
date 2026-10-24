import {File, Paths} from 'expo-file-system';
export async function existingOrSeeded(releaseId) {
  const file=new File(Paths.document,'atlas-delivery-fake-note.json');
  let created=false;
  if (!file.exists) {
    file.write(JSON.stringify({schema:1,title:'fake note persisted by '+releaseId}));
    created=true;
  }
  const note=JSON.parse(await file.text());
  if (note.schema!==1 || typeof note.title!=='string' || note.title.length>120) throw new Error('UNSUPPORTED_LOCAL_SCHEMA');
  return {note,created};
}
