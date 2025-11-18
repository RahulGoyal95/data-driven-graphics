import { OVERLAY_KEY } from './canvasManager.js';

export default class UIManager {
  constructor(dataManager, canvasManager) {
    this.dataManager = dataManager;
    this.canvasManager = canvasManager;
    this.currentRow = 0;
    this.dom = {};
    this.currentSelection = null;
    this.isSyncingProperties = false;
    this.dragLayerId = null;
    this.currentLayerDisplayOrder = [];
  }

  init() {
    this.cacheDom();
    this.bindEvents();
    this.switchView('design');
    this.canvasManager.setRenderListener(() => this.updateDataPreview());
    this.updateDataPreview();
    this.renderLayersPanel();
    this.canvasManager.setSelectionCallback((payload) => this.handleSelectionChange(payload));
  }

  cacheDom() {
    this.dom.templateInput = document.getElementById('templateInput');
    this.dom.csvInput = document.getElementById('csvInput');
    this.dom.addTextBtn = document.getElementById('addTextBtn');
    this.dom.addImageBtn = document.getElementById('addImageBtn');
    this.dom.prevRow = document.getElementById('prevRow');
    this.dom.nextRow = document.getElementById('nextRow');
    this.dom.previewStatus = document.getElementById('previewStatus');
    this.dom.propertiesPanel = document.getElementById('propertiesPanel');
    this.dom.selectedElementLabel = document.getElementById('selectedElementLabel');
    this.dom.layersList = document.getElementById('layersList');
    this.dom.exportBtn = document.getElementById('exportAll');
    this.dom.exportStatus = document.getElementById('exportStatus');
    this.dom.themeToggle = document.getElementById('themeToggle');
    this.dom.viewButtons = document.querySelectorAll('.view-button');
    this.dom.designView = document.getElementById('designView');
    this.dom.dataView = document.getElementById('dataView');
    this.dom.tableContainer = document.getElementById('tableContainer');
    this.dom.layerMappings = document.getElementById('layerMappings');
    this.dom.dataPreviewCanvas = document.getElementById('dataPreviewCanvas');
    this.dom.textProperties = document.getElementById('textProperties');
    this.dom.imageProperties = document.getElementById('imageProperties');
    this.dom.textFontFamily = document.getElementById('textFontFamily');
    this.dom.textFontSize = document.getElementById('textFontSize');
    this.dom.textAutoFit = document.getElementById('textAutoFit');
    this.dom.textAlignX = document.getElementById('textAlignX');
    this.dom.textAlignY = document.getElementById('textAlignY');
    this.dom.textColor = document.getElementById('textColorPicker');
    this.dom.imageFitMode = document.getElementById('imageFitMode');
    this.dom.imageAlignX = document.getElementById('imageAlignX');
    this.dom.imageAlignY = document.getElementById('imageAlignY');
  }

  bindEvents() {
    this.dom.templateInput.addEventListener('change', (e) => this.handleTemplateUpload(e));
    if (this.dom.csvInput) {
      this.dom.csvInput.addEventListener('change', (e) => this.handleCSVUpload(e));
    }
    this.dom.addTextBtn.addEventListener('click', () => {
      this.canvasManager.addTextElement();
      this.renderLayerMappings();
    });
    this.dom.addImageBtn.addEventListener('click', () => {
      this.canvasManager.addImageElement();
      this.renderLayerMappings();
    });
    this.dom.prevRow.addEventListener('click', () => this.navigateRow(-1));
    this.dom.nextRow.addEventListener('click', () => this.navigateRow(1));
    this.dom.exportBtn.addEventListener('click', () => this.exportAll());
    this.dom.themeToggle.addEventListener('click', () => this.toggleTheme());
    this.dom.viewButtons.forEach((button) => {
      button.addEventListener('click', () => this.switchView(button.dataset.view));
    });
    this.dom.textFontFamily.addEventListener('change', () =>
      this.handleTextMetaChange('fontFamily', this.dom.textFontFamily.value)
    );
    this.dom.textFontSize.addEventListener('change', () => {
      const size = Number(this.dom.textFontSize.value) || 16;
      this.handleTextMetaChange('fontSize', Math.max(8, size));
    });
    this.dom.textAutoFit.addEventListener('change', () =>
      this.handleTextMetaChange('autoFit', this.dom.textAutoFit.checked)
    );
    this.dom.textAlignX.addEventListener('change', () =>
      this.handleTextMetaChange('hAlign', this.dom.textAlignX.value)
    );
    this.dom.textAlignY.addEventListener('change', () =>
      this.handleTextMetaChange('vAlign', this.dom.textAlignY.value)
    );
    this.dom.textColor.addEventListener('input', () =>
      this.handleTextMetaChange('textColor', this.dom.textColor.value)
    );
    this.dom.imageFitMode.addEventListener('change', () =>
      this.handleImageMetaChange('fitMode', this.dom.imageFitMode.value)
    );
    this.dom.imageAlignX.addEventListener('change', () =>
      this.handleImageMetaChange('hAlign', this.dom.imageAlignX.value)
    );
    this.dom.imageAlignY.addEventListener('change', () =>
      this.handleImageMetaChange('vAlign', this.dom.imageAlignY.value)
    );
  }

  async handleTemplateUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      const src = e.target?.result;
      if (!src) return;
      await this.canvasManager.setTemplate(src);
      this.dataManager.setTemplateSource(src);
      this.dom.addTextBtn.disabled = false;
      this.dom.addImageBtn.disabled = false;
    };
    reader.readAsDataURL(file);
  }

  handleCSVUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data;
        this.dataManager.setCSVData(rows);
        this.currentRow = 0;
        this.renderDataTable(rows);
        this.renderLayerMappings();
        this.dom.prevRow.disabled = false;
        this.dom.nextRow.disabled = false;
        this.dom.exportBtn.disabled = false;
        this.canvasManager.renderCanvas(0);
        this.updatePreviewStatus();
      },
      error: (err) => {
        console.error('CSV parsing failed', err);
      },
    });
  }

  renderDataTable(rows) {
    if (!rows.length) {
      this.dom.tableContainer.classList.add('empty-state');
      this.dom.tableContainer.innerHTML = '<p>No rows to show</p>';
      return;
    }
    const headers = this.dataManager.getHeaders();
    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    const includeTh = document.createElement('th');
    includeTh.textContent = 'Use';
    headRow.appendChild(includeTh);
    headers.forEach((header) => {
      const th = document.createElement('th');
      th.textContent = header;
      headRow.appendChild(th);
    });
    const overlayTh = document.createElement('th');
    overlayTh.textContent = 'Overlay Image';
    headRow.appendChild(overlayTh);
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    rows.forEach((row, rowIndex) => {
      const tr = document.createElement('tr');
      tr.dataset.rowIndex = String(rowIndex);
      const includeTd = document.createElement('td');
      includeTd.className = 'include-cell';
      const includeToggle = document.createElement('input');
      includeToggle.type = 'checkbox';
      includeToggle.className = 'include-toggle';
      includeToggle.checked = this.dataManager.isRowEnabled(rowIndex);
      includeToggle.setAttribute('aria-label', `Include row ${rowIndex + 1}`);
      includeToggle.addEventListener('click', (event) => event.stopPropagation());
      includeToggle.addEventListener('change', (event) => {
        event.stopPropagation();
        const enabled = event.target.checked;
        this.dataManager.setRowEnabled(rowIndex, enabled);
        tr.classList.toggle('disabled', !enabled);
      });
      includeTd.appendChild(includeToggle);
      tr.appendChild(includeTd);
      if (!this.dataManager.isRowEnabled(rowIndex)) {
        tr.classList.add('disabled');
      }
      headers.forEach((header) => {
        const td = document.createElement('td');
        td.contentEditable = 'true';
        td.textContent = row[header] ?? '';
        td.dataset.row = String(rowIndex);
        td.dataset.key = header;
        td.addEventListener('input', (e) => {
          const target = e.currentTarget;
          const value = target.textContent || '';
          const r = Number(target.dataset.row);
          const key = target.dataset.key;
          this.dataManager.updateCell(r, key, value);
          this.canvasManager.renderCanvas(this.currentRow);
        });
        tr.appendChild(td);
      });
      const overlayTd = document.createElement('td');
      const overlayInput = document.createElement('input');
      overlayInput.type = 'file';
      overlayInput.accept = 'image/*';
      overlayInput.className = 'overlay-input';
      overlayInput.addEventListener('click', (event) => event.stopPropagation());
      overlayInput.addEventListener('change', (event) => {
        event.stopPropagation();
        this.handleOverlayChange(event, rowIndex);
      });
      overlayTd.appendChild(overlayInput);
      tr.appendChild(overlayTd);
      tr.addEventListener('click', () => this.selectDataRow(rowIndex));
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    this.dom.tableContainer.innerHTML = '';
    this.dom.tableContainer.classList.remove('empty-state');
    this.dom.tableContainer.appendChild(table);
    this.highlightDataRow();
  }

  handleOverlayChange(event, rowIndex) {
    const file = event.target.files?.[0];
    if (!file) {
      this.dataManager.storeOverlay(rowIndex, null);
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result;
      if (typeof src === 'string') {
        this.dataManager.storeOverlay(rowIndex, src);
        this.canvasManager.renderCanvas(this.currentRow);
      }
    };
    reader.readAsDataURL(file);
  }

  selectDataRow(rowIndex) {
    if (rowIndex < 0 || rowIndex >= this.dataManager.getRowCount()) return;
    this.currentRow = rowIndex;
    this.canvasManager.renderCanvas(this.currentRow);
    this.updatePreviewStatus();
    this.highlightDataRow();
  }

  highlightDataRow() {
    if (!this.dom.tableContainer) return;
    const rows = this.dom.tableContainer.querySelectorAll('tbody tr');
    rows.forEach((row, index) => {
      row.classList.toggle('selected', index === this.currentRow);
    });
  }

  renderLayerMappings() {
    const container = this.dom.layerMappings;
    if (!container) return;
    const elements = this.dataManager.getAllElements();
    const headers = this.dataManager.getHeaders();
    if (!elements.length) {
      container.classList.add('empty-state');
      container.innerHTML =
        '<div class="empty-state"><p>Add elements on the Design View to map them to data columns.</p></div>';
      this.renderLayersPanel(elements);
      return;
    }
    container.classList.remove('empty-state');
    container.innerHTML = '';
    const mappingDisplay = elements.slice().reverse();
    mappingDisplay.forEach((element, index) => {
      const row = document.createElement('div');
      row.className = 'layer-row mapping-row';
      const metaBlock = document.createElement('div');
      metaBlock.className = 'layer-meta';
      const title = document.createElement('p');
      title.className = 'layer-title';
      title.textContent = element.customName || `Layer ${index + 1}`;
      const type = document.createElement('p');
      type.className = 'layer-type';
      let mappingLabel = 'Unmapped';
      if (element.mapping === OVERLAY_KEY) {
        mappingLabel = 'Overlay Image';
      } else if (element.mapping) {
        mappingLabel = element.mapping;
      }
      type.textContent = `${element.type?.toUpperCase() || 'ELEMENT'} · ${mappingLabel}`;
      metaBlock.appendChild(title);
      metaBlock.appendChild(type);

      const selectWrapper = document.createElement('div');
      selectWrapper.className = 'layer-col-controls';
      const select = document.createElement('select');
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = 'Select column';
      select.appendChild(placeholder);
      headers.forEach((header) => {
        const option = document.createElement('option');
        option.value = header;
        option.textContent = header;
        select.appendChild(option);
      });
      const overlayOption = document.createElement('option');
      overlayOption.value = OVERLAY_KEY;
      overlayOption.textContent = 'Overlay Image';
      if (element.type === 'text') {
        overlayOption.disabled = true;
      }
      select.appendChild(overlayOption);
      select.value = element.mapping || '';
      select.addEventListener('change', (event) => {
        this.dataManager.setMapping(element.id, event.target.value);
        this.canvasManager.renderCanvas(this.currentRow);
        this.renderLayerMappings();
      });
      selectWrapper.appendChild(select);
      row.appendChild(metaBlock);
      row.appendChild(selectWrapper);
      container.appendChild(row);
    });
    this.renderLayersPanel(elements);
  }

  renderLayersPanel(elementsList = null) {
    const container = this.dom.layersList;
    if (!container) return;
    const elements = elementsList ? [...elementsList] : this.dataManager.getAllElements();
    if (!elements.length) {
      container.classList.add('empty-state');
      container.innerHTML = '<p>Add elements to see the layer stack.</p>';
      this.currentLayerDisplayOrder = [];
      return;
    }
    container.classList.remove('empty-state');
    container.innerHTML = '';
    const displayOrder = elements.slice().reverse();
    this.currentLayerDisplayOrder = displayOrder.map((layer) => layer.id);
    const allowDrag = displayOrder.length > 1;
    displayOrder.forEach((element, idx) => {
      const row = document.createElement('div');
      row.className = 'layer-row';
      row.dataset.layerId = element.id;
      row.dataset.displayIndex = String(idx);
      row.draggable = allowDrag;
      if (this.currentSelection?.id === element.id) {
        row.classList.add('selected');
      }
      if (element.visible === false) {
        row.classList.add('layer-hidden');
      }
      if (element.locked) {
        row.classList.add('layer-locked');
      }
      const metaBlock = document.createElement('div');
      metaBlock.className = 'layer-meta';
      const title = document.createElement('p');
      title.className = 'layer-title';
      title.textContent = element.customName || `Layer ${displayOrder.length - idx}`;
      const type = document.createElement('p');
      type.className = 'layer-type';
      type.textContent = element.mapping
        ? `${element.type?.toUpperCase() || 'ELEMENT'} · ${element.mapping}`
        : `${element.type?.toUpperCase() || 'ELEMENT'} · Unmapped`;
      metaBlock.appendChild(title);
      metaBlock.appendChild(type);
      const actions = document.createElement('div');
      actions.className = 'layer-actions';
      const isVisible = element.visible !== false;
      const visibilityBtn = document.createElement('button');
      visibilityBtn.className = `layer-action${isVisible ? ' active' : ''}`;
      visibilityBtn.innerHTML = isVisible ? '👁' : '🙈';
      visibilityBtn.title = isVisible ? 'Hide layer' : 'Show layer';
      visibilityBtn.setAttribute('aria-label', visibilityBtn.title);
      visibilityBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        const next = !isVisible;
        this.dataManager.setLayerVisibility(element.id, next);
        this.canvasManager.setElementVisibility(element.id, next);
        this.renderLayersPanel();
      });
      const isLocked = element.locked === true;
      const lockBtn = document.createElement('button');
      lockBtn.className = `layer-action${isLocked ? ' active' : ''}`;
      lockBtn.innerHTML = isLocked ? '🔒' : '🔓';
      lockBtn.title = isLocked ? 'Unlock layer' : 'Lock layer';
      lockBtn.setAttribute('aria-label', lockBtn.title);
      lockBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        const next = !isLocked;
        this.dataManager.setLayerLocked(element.id, next);
        this.canvasManager.setElementLocked(element.id, next);
        this.renderLayersPanel();
      });
      actions.appendChild(visibilityBtn);
      actions.appendChild(lockBtn);
      row.appendChild(metaBlock);
      row.appendChild(actions);
      row.addEventListener('click', () => {
        this.canvasManager.selectElementById(element.id);
      });
      if (allowDrag) {
        row.addEventListener('dragstart', (event) => this.handleLayerDragStart(event, element.id, row));
        row.addEventListener('dragend', () => {
          row.classList.remove('dragging');
          this.dragLayerId = null;
        });
        row.addEventListener('dragover', (event) => {
          event.preventDefault();
          row.classList.add('drag-over');
        });
        row.addEventListener('dragleave', () => row.classList.remove('drag-over'));
        row.addEventListener('drop', (event) => {
          event.preventDefault();
          row.classList.remove('drag-over');
          this.handleLayerDrop(element.id);
        });
      }
      container.appendChild(row);
    });
  }

  handleSelectionChange(payload) {
    this.currentSelection = payload;
    if (!payload) {
      this.dom.propertiesPanel.classList.add('hidden');
      this.dom.textProperties.classList.add('hidden');
      this.dom.imageProperties.classList.add('hidden');
      this.renderLayersPanel();
      return;
    }
    this.dom.propertiesPanel.classList.remove('hidden');
    this.dom.selectedElementLabel.textContent = `${payload.type?.toUpperCase() || 'Element'} (${payload.id})`;
    this.populateProperties(payload);
    this.renderLayersPanel();
  }

  navigateRow(delta) {
    const total = this.dataManager.getRowCount();
    if (!total) return;
    this.currentRow = (this.currentRow + delta + total) % total;
    this.canvasManager.renderCanvas(this.currentRow);
    this.updatePreviewStatus();
    this.highlightDataRow();
  }

  updatePreviewStatus() {
    const total = this.dataManager.getRowCount();
    this.dom.previewStatus.textContent = `Previewing Row ${total ? this.currentRow + 1 : 0}/${total}`;
  }

  async exportAll() {
    const total = this.dataManager.getRowCount();
    if (!total) return;
    this.dom.exportStatus.textContent = 'Preparing ZIP...';
    this.dom.exportBtn.disabled = true;
    const zip = new JSZip();
    const csvRows = [];
    let renderCount = 0;
    try {
      for (let i = 0; i < total; i += 1) {
        if (!this.dataManager.isRowEnabled(i)) continue;
        renderCount += 1;
        this.dom.exportStatus.textContent = `Rendering ${i + 1}/${total}`;
        const blob = await this.canvasManager.exportRowToBlob(i);
        if (blob) {
          const fileName = `images/image_${String(renderCount).padStart(2, '0')}.png`;
          zip.file(fileName, blob);
        }
        const overlayData = this.dataManager.getOverlay(i);
        let overlayName = '';
        if (overlayData) {
          const overlayBlob = await this.dataUrlToBlob(overlayData);
          overlayName = `overlays/overlay_${String(renderCount).padStart(2, '0')}.png`;
          zip.file(overlayName, overlayBlob);
        }
        const rowData = { ...this.dataManager.getRow(i) };
        rowData.overlay_image_file = overlayName;
        csvRows.push(rowData);
      }
      if (!csvRows.length) {
        this.dom.exportStatus.textContent = 'No enabled rows to export.';
        return;
      }
      this.dom.exportStatus.textContent = 'Bundling CSV...';
      const csvText = this.buildCSVWithOverlays(csvRows);
      zip.file('data.csv', csvText);
      this.dom.exportStatus.textContent = 'Packaging ZIP...';
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      saveAs(zipBlob, 'generated_graphics.zip');
      this.dom.exportStatus.textContent = 'Download ready!';
    } catch (error) {
      console.error('Export failed', error);
      this.dom.exportStatus.textContent = 'Export failed, please retry.';
    } finally {
      this.dom.exportBtn.disabled = false;
    }
  }

  toggleTheme() {
    document.body.classList.toggle('dark');
    this.dom.themeToggle.textContent = document.body.classList.contains('dark')
      ? 'Toggle Light Mode'
      : 'Toggle Dark Mode';
  }

  switchView(view = 'design') {
    const targetView = view === 'data' ? 'data' : 'design';
    this.dom.viewButtons.forEach((button) => {
      button.classList.toggle('active', button.dataset.view === targetView);
    });
    if (this.dom.designView) {
      this.dom.designView.classList.toggle('active', targetView === 'design');
    }
    if (this.dom.dataView) {
      this.dom.dataView.classList.toggle('active', targetView === 'data');
    }
    if (targetView === 'data') {
      this.highlightDataRow();
    }
  }

  handleTextMetaChange(key, value) {
    if (this.isSyncingProperties) return;
    const selection = this.currentSelection;
    if (!selection || selection.type !== 'text') return;
    this.dataManager.updateElementMeta(selection.id, { [key]: value });
    this.canvasManager.renderCanvas(this.currentRow);
  }

  handleImageMetaChange(key, value) {
    if (this.isSyncingProperties) return;
    const selection = this.currentSelection;
    if (!selection || selection.type !== 'image') return;
    this.dataManager.updateElementMeta(selection.id, { [key]: value });
    this.canvasManager.renderCanvas(this.currentRow);
  }

  populateProperties(selection) {
    this.isSyncingProperties = true;
    const meta = selection ? this.dataManager.getElementMeta(selection.id) || {} : {};
    if (selection?.type === 'text') {
      this.dom.textProperties.classList.remove('hidden');
      this.dom.imageProperties.classList.add('hidden');
      this.dom.textFontFamily.value = meta.fontFamily || 'Inter';
      this.dom.textFontSize.value = meta.fontSize || 28;
      this.dom.textAutoFit.checked = meta.autoFit !== false;
      this.dom.textAlignX.value = meta.hAlign || 'center';
      this.dom.textAlignY.value = meta.vAlign || 'middle';
      this.dom.textColor.value = meta.textColor || '#111111';
    } else if (selection?.type === 'image') {
      this.dom.imageProperties.classList.remove('hidden');
      this.dom.textProperties.classList.add('hidden');
      this.dom.imageFitMode.value = meta.fitMode || 'fill';
      this.dom.imageAlignX.value = meta.hAlign || 'center';
      this.dom.imageAlignY.value = meta.vAlign || 'middle';
    } else {
      this.dom.textProperties.classList.add('hidden');
      this.dom.imageProperties.classList.add('hidden');
    }
    this.isSyncingProperties = false;
  }

  buildCSVWithOverlays(rows) {
    return rows.length ? Papa.unparse(rows) : '';
  }

  async dataUrlToBlob(dataUrl) {
    const response = await fetch(dataUrl);
    return response.blob();
  }

  updateDataPreview() {
    const canvas = this.dom.dataPreviewCanvas;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const width = canvas.width || 360;
    const height = canvas.height || 220;
    ctx.clearRect(0, 0, width, height);
    const dataUrl = this.canvasManager.getPreviewDataURL(width);
    if (!dataUrl) {
      ctx.fillStyle = '#f1f5f9';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '14px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Preview unavailable', width / 2, height / 2);
      return;
    }
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, width, height);
      const ratio = Math.min(width / img.width, height / img.height);
      const drawWidth = img.width * ratio;
      const drawHeight = img.height * ratio;
      const offsetX = (width - drawWidth) / 2;
      const offsetY = (height - drawHeight) / 2;
      ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
    };
    img.src = dataUrl;
  }

  handleLayerDragStart(event, layerId, row) {
    this.dragLayerId = layerId;
    row.classList.add('dragging');
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', layerId);
    }
  }

  handleLayerDrop(targetLayerId) {
    if (!this.dragLayerId || this.dragLayerId === targetLayerId) return;
    const displayOrder = [...this.currentLayerDisplayOrder];
    const fromIndex = displayOrder.indexOf(this.dragLayerId);
    const toIndex = displayOrder.indexOf(targetLayerId);
    if (fromIndex === -1 || toIndex === -1) {
      this.dragLayerId = null;
      return;
    }
    if (fromIndex === toIndex) {
      this.dragLayerId = null;
      return;
    }
    const [moved] = displayOrder.splice(fromIndex, 1);
    displayOrder.splice(toIndex, 0, moved);
    this.currentLayerDisplayOrder = displayOrder;
    const bottomOrder = [...displayOrder].reverse();
    this.dataManager.setElementOrder(bottomOrder);
    this.canvasManager.reorderElements(bottomOrder);
    this.dragLayerId = null;
    this.renderLayerMappings();
  }
}
