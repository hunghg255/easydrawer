import { defaultEditorLocalization, type EditorLocalization } from '../localization';

// A partial Spanish localization
const localization: EditorLocalization = {
  ...defaultEditorLocalization,
  pen: 'Lapiz',
  eraser: 'Borrador',
  select: 'Selecciona',
  handTool: 'Mover',
  image: 'Imagen',
  inputAltText: 'Texto alternativo',
  resetImage: 'Reiniciar',
  chooseFile: 'Seleccionar archivo',
  cancel: 'Cancelar',
  resetView: 'Reiniciar vista',
  thicknessLabel: 'Tamaño',
  fontLabel: 'Fuente:',
  textSize: 'Tamaño',
  resizeImageToSelection: 'Redimensionar la imagen a lo que está seleccionado',
  deleteSelection: 'Borra la selección',
  duplicateSelection: 'Duplica la selección',
  exit: 'Salir',
  save: 'Guardar',
  undo: 'Deshace',
  redo: 'Rehace',
  selectPenType: 'Punta',
  selectShape: 'Forma',
  pickColorFromScreen: 'Selecciona un color de la pantalla',
  clickToPickColorAnnouncement: 'Haga un clic en la pantalla para seleccionar un color',
  documentProperties: 'Fondo',
  backgroundColor: 'Color de fondo',
  imageWidthOption: 'Ancho',
  imageHeightOption: 'Alto',
  enableAutoresizeOption: 'Redimensionar automático',
  toggleOverflow: 'Más',
  about: 'Acerca de',
  touchPanning: 'Mover la pantalla con un dedo',
  roundedTipPen: 'Lapiz Redondeado',
  arrowPen: 'Flecha',
  linePen: 'Línea',
  outlinedRectanglePen: 'Rectángulo delineado',
  filledRectanglePen: 'Rectángulo sin borde',
  lockRotation: 'Bloquea rotación',
  paste: 'Pegar',
  selectionMenu__paste: 'Pegar',
  selectionMenu__delete: 'Eliminar',
  selectionMenu__duplicate: 'Duplicar',
  closeSidebar: (toolName) => `Close sidebar for ${toolName}`,
  dropdownShown: (toolName) => `Menú por ${toolName} es visible`,
  dropdownHidden: (toolName) => {
    return `Menú por ${toolName} fue ocultado`;
  },
  zoomLevel: (zoomPercent) => `Zoom: ${zoomPercent}%`,
  colorChangedAnnouncement: (color) => {
    return `Color fue cambiado a ${color}`;
  },
  imageSize: (size, units) => `Tamaño del imagen: ${size} ${units}`,
  imageLoadError: (message) => `Error cargando imagen: ${message}`,
  penTool: (penId) => `Lapiz ${penId}`,
  selectionTool: 'Selecciona',
  eraserTool: 'Borrador',
  touchPanTool: 'Instrumento de mover la pantalla con un dedo',
  undoRedoTool: 'Deshace/rehace',
  pipetteTool: 'Seleccione un color de la pantalla',
  keyboardPanZoom: 'Mover la pantalla con el teclado',
  textTool: 'Texto',
  enterTextToInsert: 'Entra texto',
  findLabel: 'Buscar',
  toNextMatch: 'Próxima',
  closeDialog: 'Cerrar',
  anyDevicePanning: 'Mover la pantalla con todo dispotivo',
  copied: (count) => `${count} cosas fueron copiados`,
  pasted: (count) => (count === 1 ? 'Pegado' : `${count} cosas fueron pegados`),
  toolEnabledAnnouncement: (toolName) => `${toolName} fue activado`,
  toolDisabledAnnouncement: (toolName) => `${toolName} fue desactivado`,
  resizeOutputCommand: (newSize) => `Tamaño de imagen fue cambiado a ${newSize.w}x${newSize.h}`,
  eraseAction: (componentDescription, numElems) => `Borrado: ${numElems} ${componentDescription}`,
  rerenderAsText: 'Redibuja la pantalla al texto',
  loading: (percentage) => `Cargando: ${percentage}%...`,
  imageEditor: 'Editor de dibujos',
  doneLoading: 'El cargado terminó',
  undoAnnouncement: (commandDescription) => `${commandDescription} fue deshecho`,
  redoAnnouncement: (commandDescription) => `${commandDescription} fue rehecho`,
};

export default localization;
