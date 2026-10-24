export function controlledFailure() {
  // A caught teaching error, not a native process crash or a production report.
  throw new Error('ATLAS_CONTROLLED_JS_FAILURE');
}
