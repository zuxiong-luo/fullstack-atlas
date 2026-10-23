export class DeviceSession {
  constructor(source, port, publish) {
    this.source = source; this.port = port; this.publish = publish;
    this.generation = 0; this.closed = false; this.cancel = null;
    this.state = { deviceId: '', connection: 'idle', sequence: -1, battery: null, command: 'idle', firmware: '' };
  }
  owns(generation, id) { return !this.closed && generation === this.generation && id === this.state.deviceId; }
  emit(patch) { this.state = { ...this.state, ...patch }; if (!this.closed) this.publish(this.state); }
  connect(id) {
    if (this.closed) return;
    const generation = ++this.generation;
    this.cancel?.(); this.cancel = null;
    this.emit({ deviceId: id, connection: 'connecting', sequence: -1, battery: null, command: 'idle', firmware: '' });
    this.cancel = this.source.watch(id, reading => {
      if (!this.owns(generation, id) || reading.deviceId !== id || reading.sequence <= this.state.sequence) return;
      this.emit({ connection: 'connected', sequence: reading.sequence, battery: reading.battery });
    });
  }
  async readFirmware() {
    if (this.closed || !this.state.deviceId || this.state.command === 'pending') return;
    const generation = this.generation, id = this.state.deviceId;
    this.emit({ command: 'pending', firmware: '' });
    try {
      const firmware = await this.port.read(id);
      if (this.owns(generation, id)) this.emit({ command: 'success', firmware });
    } catch (error) {
      if (this.owns(generation, id)) this.emit({ command: ['permission_denied', 'unsupported'].includes(error.code) ? error.code : 'failed' });
    }
  }
  dispose() { this.closed = true; this.generation += 1; this.cancel?.(); this.cancel = null; }
}
export function createDemoSource() {
  const listeners = new Map();
  return {
    watch(id, callback) { listeners.set(id, callback); return () => { if (listeners.get(id) === callback) listeners.delete(id); }; },
    emit(reading) { listeners.get(reading.deviceId)?.(reading); },
    listenerCount() { return listeners.size; },
  };
}
