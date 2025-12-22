const OVERLAY_KEY = '__overlay__';

export { OVERLAY_KEY };

export default class CanvasManager {
  constructor(dataManager) {
    this.dataManager = dataManager;
    this.stage = null;
    this.layer = null;
    this.transformer = null;
    this.selectedId = null;
    this.selectionCallback = null;
    this.currentRow = 0;
    this.measureCanvas = document.createElement('canvas');
    this.measureCtx = this.measureCanvas.getContext('2d');
    this.renderListener = null;
    this.loadedFonts = new Set();
    this.loadingFonts = new Set();
  }

  init(containerId) {
    const container = document.getElementById(containerId);
    if (!container) throw new Error('Canvas container missing');
    this.stage = new Konva.Stage({
      container,
      width: 800,
      height: 600,
    });
    this.layer = new Konva.Layer();
    this.stage.add(this.layer);
    this.transformer = new Konva.Transformer({
      rotateEnabled: false,
      enabledAnchors: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
      boundBoxFunc: (oldBox, newBox) => {
        const minSize = 20;
        if (
          Math.abs(newBox.width) < minSize ||
          Math.abs(newBox.height) < minSize ||
          oldBox.width * newBox.width < 0 ||
          oldBox.height * newBox.height < 0
        ) {
          return oldBox;
        }
        return newBox;
      },
    });
    this.layer.add(this.transformer);
    this.registerStageEvents();
  }

  registerStageEvents() {
    this.stage.on('click tap', (e) => {
      if (e.target === this.stage) {
        this.clearSelection();
        return;
      }
      if (e.target === this.transformer || e.target.getParent() === this.transformer) {
        return;
      }
      const group = e.target.findAncestor('.canvas-element');
      if (!group) {
        this.clearSelection();
        return;
      }
      this.selectGroup(group);
    });
  }

  setSelectionCallback(cb) {
    this.selectionCallback = cb;
  }

  setRenderListener(cb) {
    this.renderListener = cb;
  }

  async setTemplate(src) {
    const image = await this.loadImage(src);
    this.dataManager.setTemplateSource(src);

    // Calculate scaled dimensions to fit within viewport
    const { scaledWidth, scaledHeight, scale } = this.calculateFitToViewport(image.width, image.height);

    // Store original dimensions and scale for export
    this.originalTemplateWidth = image.width;
    this.originalTemplateHeight = image.height;
    this.templateScale = scale;

    this.stage.size({ width: scaledWidth, height: scaledHeight });

    let templateNode = this.layer.findOne('#template-image');
    if (templateNode) {
      templateNode.image(image);
      templateNode.setAttrs({ width: scaledWidth, height: scaledHeight });
    } else {
      templateNode = new Konva.Image({
        id: 'template-image',
        listening: false,
        image,
        width: scaledWidth,
        height: scaledHeight,
      });
      this.layer.add(templateNode);
      templateNode.moveToBottom();
    }
    this.layer.draw();
    this.notifyRender();
  }

  calculateFitToViewport(imageWidth, imageHeight) {
    // Get the canvas wrapper element to determine available space
    const wrapper = document.getElementById('canvasWrapper');
    const maxWidth = wrapper ? wrapper.clientWidth * 0.95 : 800;
    const maxHeight = wrapper ? Math.min(wrapper.clientHeight, window.innerHeight * 0.7) : 600;

    // Calculate scale to fit within viewport while maintaining aspect ratio
    const scaleX = maxWidth / imageWidth;
    const scaleY = maxHeight / imageHeight;
    const scale = Math.min(scaleX, scaleY, 1); // Don't scale up, only down

    return {
      scaledWidth: Math.round(imageWidth * scale),
      scaledHeight: Math.round(imageHeight * scale),
      scale
    };
  }

  addTextElement() {
    if (!this.stage) return;
    const id = `text-${Date.now()}`;
    const width = 240;
    const height = 80;
    const group = new Konva.Group({
      id,
      draggable: true,
      x: 60,
      y: 60,
      name: 'canvas-element',
      elementType: 'text',
    });
    const rect = new Konva.Rect({
      name: 'bounding-box',
      width,
      height,
      stroke: '#2563eb',
      dash: [4, 4],
      strokeWidth: 1,
      cornerRadius: 8,
      fill: 'rgba(37,99,235,0.05)',
    });
    const textNode = new Konva.Text({
      name: 'text-node',
      text: 'Sample Text',
      width,
      height,
      fontSize: 28,
      align: 'center',
      verticalAlign: 'middle',
      fill: '#111111',
      listening: false,
    });
    group.add(rect);
    group.add(textNode);
    this.layer.add(group);
    this.attachElementEvents(group);
    this.dataManager.registerElement(id, {
      type: 'text',
      customName: 'Text Layer',
      fontFamily: 'Inter',
      fontSize: 28,
      autoFit: true,
      hAlign: 'center',
      vAlign: 'middle',
      textColor: '#111111',
      fillType: 'solid',
      gradientStart: '#111111',
      gradientEnd: '#aaaaaa',
    });
    this.layer.draw();
    this.notifyRender();
    this.selectGroup(group);
  }

  addImageElement() {
    if (!this.stage) return;
    const id = `image-${Date.now()}`;
    const width = 200;
    const height = 200;
    const group = new Konva.Group({
      id,
      draggable: true,
      x: 120,
      y: 120,
      name: 'canvas-element',
      elementType: 'image',
      clip: { x: 0, y: 0, width, height },
    });
    const rect = new Konva.Rect({
      name: 'bounding-box',
      width,
      height,
      stroke: '#f97316',
      dash: [4, 4],
      strokeWidth: 1.5,
      cornerRadius: 8,
      fill: 'rgba(249,115,22,0.08)',
    });
    const imageNode = new Konva.Image({
      name: 'image-node',
      width,
      height,
      listening: false,
    });
    const placeholder = new Konva.Text({
      name: 'image-placeholder',
      text: 'Image',
      width,
      height,
      align: 'center',
      verticalAlign: 'middle',
      fontSize: 18,
      fill: '#f97316',
      listening: false,
    });
    group.add(rect);
    group.add(imageNode);
    group.add(placeholder);
    this.layer.add(group);
    this.attachElementEvents(group);
    this.dataManager.registerElement(id, {
      type: 'image',
      customName: 'Image Layer',
      fitMode: 'fill',
      hAlign: 'center',
      vAlign: 'middle',
    });
    this.layer.draw();
    this.notifyRender();
    this.selectGroup(group);
  }

  attachElementEvents(group) {
    group.on('dragend transformend', () => {
      this.normalizeGroup(group);
      this.renderCanvas(this.currentRow);
    });
  }

  normalizeGroup(group) {
    const rect = group.findOne('.bounding-box');
    if (!rect) return;
    const scaleX = Math.abs(group.scaleX());
    const scaleY = Math.abs(group.scaleY());
    if (scaleX !== 1 || scaleY !== 1) {
      const newWidth = Math.max(20, rect.width() * scaleX);
      const newHeight = Math.max(20, rect.height() * scaleY);
      rect.width(newWidth);
      rect.height(newHeight);
      const textNode = group.findOne('.text-node');
      if (textNode) {
        textNode.width(newWidth);
        textNode.height(newHeight);
      }
      const imageNode = group.findOne('.image-node');
      if (imageNode) {
        imageNode.width(newWidth);
        imageNode.height(newHeight);
      }
      const placeholder = group.findOne('.image-placeholder');
      if (placeholder) {
        placeholder.width(newWidth);
        placeholder.height(newHeight);
      }
      this.updateGroupClip(group, newWidth, newHeight);
      group.scaleX(1);
      group.scaleY(1);
      this.layer.draw();
      this.notifyRender();
    }
  }

  updateGroupClip(group, width, height) {
    if (group.getAttr('elementType') === 'image') {
      group.clip({ x: 0, y: 0, width, height });
    }
  }

  clearSelection() {
    this.selectedId = null;
    this.transformer.nodes([]);
    if (this.selectionCallback) this.selectionCallback(null);
  }

  selectGroup(group) {
    this.selectedId = group.id();
    const meta = this.dataManager.getElementMeta(group.id());
    if (meta?.locked) {
      this.transformer.nodes([]);
    } else {
      this.transformer.nodes([group]);
    }
    this.layer.draw();
    if (this.selectionCallback) {
      this.selectionCallback({
        id: group.id(),
        type: meta?.type,
        mapping: this.dataManager.getMapping(group.id()),
      });
    }
  }

  async renderCanvas(rowIndex) {
    if (!this.stage) return;

    // If no data loaded, still render with placeholder/default values
    const hasData = this.dataManager.getRowCount() > 0;
    if (hasData) {
      if (rowIndex < 0) rowIndex = 0;
      if (rowIndex >= this.dataManager.getRowCount()) rowIndex = this.dataManager.getRowCount() - 1;
    }
    this.currentRow = hasData ? rowIndex : 0;

    await this.populateStageWithRow(this.stage, this.currentRow, !hasData);
    this.layer.draw();
    this.notifyRender();
  }

  async populateStageWithRow(stage, rowIndex, previewMode = false) {
    const row = this.dataManager.getRow(rowIndex) || {};
    const promises = [];
    stage.find('.canvas-element').forEach((group) => {
      const mapping = this.dataManager.getMapping(group.id());
      const type = group.getAttr('elementType');
      const meta = this.dataManager.getElementMeta(group.id()) || {};
      if (type === 'text') {
        const textNode = group.findOne('.text-node');
        const rect = group.findOne('.bounding-box');
        let displayValue;
        if (previewMode) {
          displayValue = 'Sample Text';
        } else {
          displayValue = mapping ? row[mapping] || '' : 'Map a column';
        }
        this.applyTextContent(textNode, rect, displayValue, meta);
        return;
      }
      if (type === 'image') {
        const rect = group.findOne('.bounding-box');
        const imageNode = group.findOne('.image-node');
        const placeholder = group.findOne('.image-placeholder');
        const rawSrc = mapping
          ? mapping === OVERLAY_KEY
            ? this.dataManager.getOverlay(rowIndex)
            : row[mapping]
          : null;
        const sources = this.normalizeImageSource(rawSrc);
        if (!sources.length) {
          if (imageNode) {
            imageNode.image(null);
            imageNode.width(rect?.width() || imageNode.width());
            imageNode.height(rect?.height() || imageNode.height());
            imageNode.x(0);
            imageNode.y(0);
          }
          if (placeholder) placeholder.visible(true);
          return;
        }
        if (placeholder) placeholder.visible(false);
        promises.push(
          this.applyImageToNode(imageNode, rect, sources, meta).then((loaded) => {
            if (placeholder) placeholder.visible(!loaded);
          })
        );
      }
    });
    await Promise.all(promises);
  }

  applyTextContent(textNode, rect, text, meta = {}) {
    if (!textNode || !rect) return;
    const width = rect.width() || 200;
    const height = rect.height() || 80;
    const content = text || '';
    const fontFamily = meta.fontFamily || 'Inter';
    this.ensureFontLoaded(fontFamily);
    const fontSize = Math.max(8, meta.fontSize || textNode.fontSize() || 24);
    if (meta.autoFit === false) {
      const measured = this.measureMultilineHeight(content, fontSize, width, fontFamily);
      textNode.text(content);
      textNode.fontFamily(fontFamily);
      textNode.fontSize(fontSize);
      textNode.fontStyle(meta.fontWeight ? String(meta.fontWeight) : 'normal');
      textNode.width(width);
      textNode.height(height);
      textNode.lineHeight(1.2);
      textNode.align(meta.hAlign || 'left');
      textNode.verticalAlign('top');
      textNode.x(0);
      const offset = this.calculateVerticalOffset(height, measured, meta.vAlign);
      textNode.y(offset);
      textNode.y(offset);
      this.applyTextFill(textNode, meta, height);
      return;
    }
    this.fitTextToBox(textNode, content, width, height, meta);
  }

  fitTextToBox(textNode, text, width = 200, height = 80, meta = {}) {
    if (!textNode) return;
    const content = text || '';
    const maxSize = Math.max(8, meta.fontSize || 72);
    const minSize = 8;
    const fontFamily = meta.fontFamily || 'Inter';
    this.ensureFontLoaded(fontFamily);
    let fontSize = Math.min(maxSize, textNode.fontSize() || maxSize);
    let measured = this.measureMultilineHeight(content, fontSize, width, fontFamily);
    while (measured > height && fontSize > minSize) {
      fontSize -= 1;
      measured = this.measureMultilineHeight(content, fontSize, width, fontFamily);
    }
    textNode.text(content);
    textNode.fontFamily(fontFamily);
    textNode.fontSize(fontSize);
    textNode.fontStyle(meta.fontWeight ? String(meta.fontWeight) : 'normal');
    textNode.width(width);
    textNode.height(height);
    textNode.lineHeight(1.2);
    textNode.align(meta.hAlign || 'center');
    textNode.verticalAlign('top');
    textNode.x(0);
    const offset = this.calculateVerticalOffset(height, measured, meta.vAlign);
    textNode.y(offset);
    textNode.y(offset);
    this.applyTextFill(textNode, meta, height);
  }

  applyTextFill(textNode, meta, height) {
    if (meta.fillType === 'gradient') {
      textNode.fillPriority('linear-gradient');
      textNode.fillLinearGradientStartPoint({ x: 0, y: 0 });
      textNode.fillLinearGradientEndPoint({ x: 0, y: height });
      textNode.fillLinearGradientColorStops([
        0,
        meta.gradientStart || '#111111',
        1,
        meta.gradientEnd || '#aaaaaa',
      ]);
    } else {
      textNode.fillPriority('color');
      textNode.fill(meta.textColor || '#111111');
    }
  }

  measureMultilineHeight(text, fontSize, width, fontFamily = 'Inter') {
    const content = text || '';
    if (!content.length) return fontSize;
    const ctx = this.measureCtx;
    ctx.font = `${fontSize}px ${fontFamily}, sans-serif`;
    const lineHeight = fontSize * 1.2;
    const paragraphs = content.split(/\n/);
    let lineCount = 0;
    paragraphs.forEach((paragraph) => {
      const words = paragraph.split(/\s+/).filter(Boolean);
      if (!words.length) {
        lineCount += 1;
        return;
      }
      let line = '';
      words.forEach((word) => {
        const testLine = line ? `${line} ${word}` : word;
        const metrics = ctx.measureText(testLine).width;
        if (metrics > width && line) {
          lineCount += 1;
          line = word;
        } else {
          line = testLine;
        }
      });
      if (line) lineCount += 1;
    });
    if (lineCount === 0) lineCount = 1;
    return lineCount * lineHeight;
  }

  calculateVerticalOffset(containerHeight, contentHeight, align = 'middle') {
    if (align === 'top') return 0;
    if (align === 'bottom') return Math.max(0, containerHeight - contentHeight);
    return Math.max(0, (containerHeight - contentHeight) / 2);
  }

  computeAlignmentOffset(container, content, alignment = 'center') {
    if (alignment === 'left' || alignment === 'top') return 0;
    if (alignment === 'right' || alignment === 'bottom') {
      return container - content;
    }
    return (container - content) / 2;
  }

  applyImageToNode(node, rect, sources, meta = {}) {
    const candidates = Array.isArray(sources)
      ? sources.filter(Boolean)
      : [sources].filter(Boolean);
    if (!node || candidates.length === 0) {
      node?.image(null);
      return Promise.resolve(false);
    }
    return new Promise((resolve) => {
      const tryLoad = (index) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          this.drawImageWithFit(node, rect, img, meta);
          node.getLayer()?.batchDraw();
          this.notifyRender();
          resolve(true);
        };
        img.onerror = () => {
          if (index + 1 < candidates.length) {
            tryLoad(index + 1);
          } else {
            resolve(false);
          }
        };
        img.src = candidates[index];
      };
      tryLoad(0);
    });
  }

  drawImageWithFit(node, rect, image, meta = {}) {
    if (!node || !rect) return;
    const boxWidth = rect.width() || image.width;
    const boxHeight = rect.height() || image.height;
    const fitMode = meta.fitMode || 'fill';
    let drawWidth = boxWidth;
    let drawHeight = boxHeight;
    let offsetX = 0;
    let offsetY = 0;
    if (fitMode === 'fill') {
      drawWidth = boxWidth;
      drawHeight = boxHeight;
    } else {
      const scaleX = boxWidth / image.width;
      const scaleY = boxHeight / image.height;
      const scale = fitMode === 'cover' ? Math.max(scaleX, scaleY) : Math.min(scaleX, scaleY);
      drawWidth = image.width * scale;
      drawHeight = image.height * scale;
      offsetX = this.computeAlignmentOffset(boxWidth, drawWidth, meta.hAlign || 'center');
      offsetY = this.computeAlignmentOffset(boxHeight, drawHeight, meta.vAlign || 'middle');
    }
    node.image(image);
    node.width(drawWidth);
    node.height(drawHeight);
    node.x(offsetX);
    node.y(offsetY);
  }

  async exportRowToBlob(rowIndex) {
    if (!this.stage) return null;
    const { stage, container } = this.createOffscreenStage();
    await this.populateStageWithRow(stage, rowIndex);

    // Hide all bounding boxes and placeholders before export
    stage.find('.bounding-box').forEach((node) => node.visible(false));
    stage.find('.image-placeholder').forEach((node) => node.visible(false));

    // Use inverse of templateScale to export at original resolution
    const exportPixelRatio = this.templateScale ? (1 / this.templateScale) : 1;
    const canvas = stage.toCanvas({ pixelRatio: exportPixelRatio });
    const blob = await new Promise((resolve) => canvas.toBlob(resolve));
    stage.destroy();
    container.remove();
    return blob;
  }

  createOffscreenStage() {
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '-9999px';
    container.style.width = `${this.stage.width()}px`;
    container.style.height = `${this.stage.height()}px`;
    document.body.appendChild(container);
    const stage = new Konva.Stage({
      container,
      width: this.stage.width(),
      height: this.stage.height(),
    });
    const layer = new Konva.Layer();
    stage.add(layer);
    this.layer.getChildren().forEach((child) => {
      if (child === this.transformer) return;
      const clone = child.clone({ listening: false });
      // Hide bounding boxes and placeholders for export (only for Groups)
      if (typeof clone.findOne === 'function') {
        const boundingBox = clone.findOne('.bounding-box');
        if (boundingBox) boundingBox.visible(false);
        const placeholder = clone.findOne('.image-placeholder');
        if (placeholder) placeholder.visible(false);
      }
      layer.add(clone);
    });
    layer.draw();
    return { stage, container };
  }

  loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.crossOrigin = 'anonymous';
      img.src = src;
    });
  }

  reorderElements(order = []) {
    if (!this.layer) return;
    const templateNode = this.layer.findOne('#template-image');
    const baseIndex = templateNode ? 1 : 0;
    order.forEach((id, idx) => {
      const group = this.layer.findOne(`#${id}`);
      if (group) {
        group.zIndex(baseIndex + idx);
      }
    });
    this.layer.draw();
    this.notifyRender();
  }

  selectElementById(id) {
    if (!this.layer) return;
    const group = this.layer.findOne(`#${id}`);
    if (group) {
      this.selectGroup(group);
    }
  }

  setElementVisibility(id, isVisible) {
    if (!this.layer) return;
    const group = this.layer.findOne(`#${id}`);
    if (group) {
      group.visible(isVisible);
      this.layer.draw();
      this.notifyRender();
    }
  }

  setElementLocked(id, isLocked) {
    if (!this.layer) return;
    const group = this.layer.findOne(`#${id}`);
    if (group) {
      group.draggable(!isLocked);
      group.listening(true);
      if (this.selectedId === id) {
        if (isLocked) {
          this.transformer.nodes([]);
        } else {
          this.transformer.nodes([group]);
        }
      }
    }
  }

  getPreviewDataURL(maxWidth = 360) {
    if (!this.stage) return null;
    const width = this.stage.width();
    if (!width) return null;
    const scale = Math.min(1, maxWidth / width);
    const { stage, container } = this.createOffscreenStage();
    const dataUrl = stage.toDataURL({ pixelRatio: scale });
    stage.destroy();
    container.remove();
    return dataUrl;
  }

  notifyRender() {
    if (typeof this.renderListener === 'function') {
      this.renderListener();
    }
  }

  normalizeImageSource(value) {
    if (!value) return [];
    const src = String(value).trim();
    if (!src) return [];
    if (/^data:image\//i.test(src)) return [src];
    if (/^\/?proxy\?url=/i.test(src)) return [src];
    const driveSources = this.normalizeGoogleDriveUrl(src);
    if (driveSources.length) return driveSources;
    if (/^(https?:|blob:)/i.test(src)) return [src];
    const hasExtension = /\.[a-z0-9]{2,4}(\?.*)?$/i.test(src);
    if (/^([./]|..\/)/.test(src) && hasExtension) return [src];
    if (hasExtension) return [src];
    return [];
  }

  normalizeGoogleDriveUrl(src) {
    let url;
    try {
      url = new URL(src);
    } catch (error) {
      return [];
    }
    const host = url.hostname.toLowerCase();
    if (!host.endsWith('drive.google.com') && !host.endsWith('docs.google.com')) {
      return [];
    }
    let fileId = '';
    if (url.pathname.includes('/file/d/')) {
      const parts = url.pathname.split('/');
      const index = parts.indexOf('d');
      if (index !== -1 && parts[index + 1]) {
        fileId = parts[index + 1];
      }
    }
    if (!fileId && url.searchParams.has('id')) {
      fileId = url.searchParams.get('id') || '';
    }
    if (!fileId) return [];
    const directUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
    const apiProxyUrl = `/api/proxy?url=${encodeURIComponent(directUrl)}`;
    const localProxyUrl = `/proxy?url=${encodeURIComponent(directUrl)}`;
    return [apiProxyUrl, localProxyUrl, directUrl];
  }

  ensureFontLoaded(fontFamily) {
    if (!fontFamily || typeof document === 'undefined') return;
    if (this.loadedFonts.has(fontFamily) || this.loadingFonts.has(fontFamily)) return;

    // Check if it's a standard web font (simplified check)
    const webSafe = ['Arial', 'Verdana', 'Helvetica', 'Times New Roman', 'Courier New', 'Georgia', 'serif', 'sans-serif'];
    if (webSafe.includes(fontFamily)) return;

    this.loadingFonts.add(fontFamily);

    const self = this;
    WebFont.load({
      google: {
        // Load common font weights for flexibility
        families: [`${fontFamily}:100,200,300,400,500,600,700,800,900`]
      },
      fontactive: function (familyName) {
        self.loadedFonts.add(familyName);
        self.loadingFonts.delete(familyName);
        self.renderCanvas(self.currentRow);
      },
      fontinactive: function (familyName) {
        console.warn(`Font ${familyName} failed to load or is not available.`);
        self.loadingFonts.delete(familyName);
      }
    });
  }
}
