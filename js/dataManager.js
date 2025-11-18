export default class DataManager {
  constructor() {
    this.templateSrc = null;
    this.csvData = [];
    this.headers = [];
    this.elementMappings = new Map();
    this.elementsMeta = new Map();
    this.overlays = new Map(); // rowIndex -> dataURL
    this.elementOrder = [];
    this.rowEnabled = [];
  }

  setTemplateSource(src) {
    this.templateSrc = src;
  }

  getTemplateSource() {
    return this.templateSrc;
  }

  setCSVData(rows) {
    this.csvData = rows;
    this.headers = rows.length ? Object.keys(rows[0]) : [];
    this.overlays.clear();
    this.rowEnabled = rows.map(() => true);
  }

  getHeaders() {
    return this.headers;
  }

  getRowCount() {
    return this.csvData.length;
  }

  getRow(index) {
    return this.csvData[index] || null;
  }

  getAllRows() {
    return this.csvData.map((row) => ({ ...row }));
  }

  updateCell(rowIndex, key, value) {
    if (!this.csvData[rowIndex]) return;
    this.csvData[rowIndex][key] = value;
  }

  registerElement(id, meta) {
    const defaults = {
      customName: meta?.type === 'image' ? 'Image Layer' : 'Text Layer',
      visible: true,
      locked: false,
    };
    this.elementsMeta.set(id, { ...defaults, ...meta });
    this.elementOrder.push(id);
  }

  getAllElements() {
    return this.elementOrder
      .map((id) => {
        if (!this.elementsMeta.has(id)) return null;
        return {
          id,
          ...this.elementsMeta.get(id),
          mapping: this.getMapping(id) || '',
        };
      })
      .filter(Boolean);
  }

  updateElementMeta(id, metaPatch) {
    if (!this.elementsMeta.has(id)) return;
    const current = this.elementsMeta.get(id);
    this.elementsMeta.set(id, { ...current, ...metaPatch });
  }

  getElementMeta(id) {
    return this.elementsMeta.get(id) || null;
  }

  setMapping(id, headerKey) {
    if (!headerKey) {
      this.elementMappings.delete(id);
      return;
    }
    this.elementMappings.set(id, headerKey);
  }

  getMapping(id) {
    return this.elementMappings.get(id);
  }

  getAllMappings() {
    return Array.from(this.elementMappings.entries());
  }

  setLayerVisibility(id, visible) {
    if (!this.elementsMeta.has(id)) return;
    const current = this.elementsMeta.get(id);
    this.elementsMeta.set(id, { ...current, visible });
  }

  setLayerLocked(id, locked) {
    if (!this.elementsMeta.has(id)) return;
    const current = this.elementsMeta.get(id);
    this.elementsMeta.set(id, { ...current, locked });
  }

  getElementOrder() {
    return [...this.elementOrder];
  }

  setElementOrder(newOrder) {
    this.elementOrder = newOrder.filter((id) => this.elementsMeta.has(id));
  }

  setLayerVisibility(id, visible) {
    if (!this.elementsMeta.has(id)) return;
    const current = this.elementsMeta.get(id);
    this.elementsMeta.set(id, { ...current, visible });
  }

  setLayerLocked(id, locked) {
    if (!this.elementsMeta.has(id)) return;
    const current = this.elementsMeta.get(id);
    this.elementsMeta.set(id, { ...current, locked });
  }

  storeOverlay(rowIndex, dataUrl) {
    if (!dataUrl) {
      this.overlays.delete(rowIndex);
      return;
    }
    this.overlays.set(rowIndex, dataUrl);
  }

  getOverlay(rowIndex) {
    return this.overlays.get(rowIndex) || null;
  }

  isRowEnabled(index) {
    if (typeof this.rowEnabled[index] === 'boolean') {
      return this.rowEnabled[index];
    }
    return true;
  }

  setRowEnabled(index, enabled) {
    this.rowEnabled[index] = Boolean(enabled);
  }
}
