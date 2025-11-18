import DataManager from './dataManager.js';
import CanvasManager from './canvasManager.js';
import UIManager from './uiManager.js';

const dataManager = new DataManager();
const canvasManager = new CanvasManager(dataManager);

const GOOGLE_FONT_FAMILIES = [
  'Inter:300,400,500,600',
  'Roboto:400,500,700',
  'Lato:400,700',
  'Poppins:400,600',
  'Space Grotesk:400,600',
];

function loadGoogleFonts() {
  if (window.WebFont && typeof window.WebFont.load === 'function') {
    window.WebFont.load({
      google: {
        families: GOOGLE_FONT_FAMILIES,
      },
    });
  }
}

window.addEventListener('DOMContentLoaded', () => {
  loadGoogleFonts();
  canvasManager.init('canvasContainer');
  const uiManager = new UIManager(dataManager, canvasManager);
  uiManager.init();
});
